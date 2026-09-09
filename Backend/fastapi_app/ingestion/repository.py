from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import ActivityLog, Recipe

from .models import (
    RecipeCandidate,
    RecipeCandidateExtraction,
    RecipeCreator,
    RecipeImportJob,
    RecipeImportWorkerHeartbeat,
    RecipeSourcePost,
)
from .schemas import (
    CandidateRecipeData,
    CreatorCreate,
    CreatorUpdate,
    ScanCreate,
    approval_blockers,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_timestamp(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _actor_label(actor: Any) -> str | None:
    return getattr(actor, "email", None) or getattr(actor, "username", None)


def _slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "recipe"


def canonical_instagram_post_url(value: str) -> str:
    parsed = urlparse(value.strip())
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 2 and parts[0] in {"p", "reel", "tv"}:
        return f"https://www.instagram.com/{parts[0]}/{parts[1]}/"
    return value.strip().split("?", 1)[0].rstrip("/")


class RecipeImportRepository:
    """All transaction boundaries for the recipe-import module."""

    def __init__(self, session: Session):
        self.session = session

    def _audit(
        self,
        actor: Any,
        action: str,
        detail: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.session.add(
            ActivityLog(
                actor_type="admin" if actor is not None else "system",
                actor_id=getattr(actor, "id", None),
                actor_label=_actor_label(actor),
                action_type=action,
                action_detail=detail,
                status="success",
                metadata_=metadata,
            )
        )

    def create_creator(self, payload: CreatorCreate, actor: Any) -> RecipeCreator:
        creator = RecipeCreator(
            instagram_username=payload.username.lower(),
            profile_url=payload.profile_url,
            display_name=payload.display_name,
            allowed_domains=payload.allowed_domains,
            permission_basis=payload.permission_basis,
            permission_record_url=payload.permission_record_url,
            created_by=actor.id,
        )
        self.session.add(creator)
        self._audit(
            actor,
            "recipe_import_creator_added",
            f"Approved Instagram creator @{payload.username}",
            {"instagram_username": payload.username},
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ValueError("This Instagram creator is already allowlisted") from exc
        self.session.refresh(creator)
        return creator

    def list_creators(self) -> tuple[list[RecipeCreator], int]:
        items = list(
            self.session.scalars(
                select(RecipeCreator).order_by(RecipeCreator.created_at.desc())
            )
        )
        return items, len(items)

    def get_creator(
        self, creator_id: UUID, for_update: bool = False
    ) -> RecipeCreator | None:
        if not for_update:
            return self.session.get(RecipeCreator, creator_id)
        return self.session.scalar(
            select(RecipeCreator)
            .where(RecipeCreator.id == creator_id)
            .with_for_update()
        )

    def update_creator(
        self, creator: RecipeCreator, payload: CreatorUpdate, actor: Any
    ) -> RecipeCreator:
        updates = payload.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(creator, key, value)
        creator.updated_at = _now()
        self._audit(
            actor,
            "recipe_import_creator_updated",
            f"Updated @{creator.instagram_username}",
            {"fields": sorted(updates)},
        )
        self.session.commit()
        self.session.refresh(creator)
        return creator

    def revoke_creator(self, creator: RecipeCreator, actor: Any) -> int:
        if creator.status == "revoked":
            return 0
        now = _now()
        creator.status = "revoked"
        creator.revoked_at = now
        creator.revoked_by = actor.id
        self.session.execute(
            update(RecipeImportJob)
            .where(
                RecipeImportJob.creator_id == creator.id,
                RecipeImportJob.status.in_(
                    ["queued", "discovering", "processing"]
                ),
            )
            .values(cancel_requested=True)
        )
        result = self.session.execute(
            update(Recipe)
            .where(
                Recipe.creator_id == creator.id,
                Recipe.source_kind == "instagram",
                Recipe.is_active.is_(True),
            )
            .values(is_active=False, updated_at=now)
        )
        count = result.rowcount or 0
        self._audit(
            actor,
            "recipe_import_creator_revoked",
            f"Revoked @{creator.instagram_username} and deactivated {count} recipes",
            {"creator_id": str(creator.id), "deactivated_recipes": count},
        )
        self.session.commit()
        return count

    def create_job(
        self,
        creator: RecipeCreator,
        payload: ScanCreate,
        actor: Any,
        *,
        job_payload: dict[str, Any] | None = None,
    ) -> RecipeImportJob:
        job = RecipeImportJob(
            creator_id=creator.id,
            mode=payload.mode,
            requested_limit=payload.limit,
            requested_by=actor.id,
            payload=job_payload,
        )
        self.session.add(job)
        self._audit(
            actor,
            "recipe_import_scan_queued",
            f"Queued {payload.mode} scan for @{creator.instagram_username}",
            {
                "creator_id": str(creator.id),
                "mode": payload.mode,
                "limit": payload.limit,
            },
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ValueError("This creator already has an active import job") from exc
        self.session.refresh(job)
        return job

    def audit_manual_upload(self, actor: Any, filename: str) -> None:
        self._audit(
            actor,
            "recipe_import_manual_media_uploaded",
            "Uploaded licensed media for manual recipe intake",
            {"filename": filename[:255]},
        )
        self.session.commit()

    def list_jobs(
        self, creator_id: UUID | None = None, limit: int = 100
    ) -> tuple[list[RecipeImportJob], int]:
        stmt = select(RecipeImportJob)
        count_stmt = select(func.count()).select_from(RecipeImportJob)
        if creator_id:
            stmt = stmt.where(RecipeImportJob.creator_id == creator_id)
            count_stmt = count_stmt.where(RecipeImportJob.creator_id == creator_id)
        items = list(
            self.session.scalars(
                stmt.order_by(RecipeImportJob.created_at.desc()).limit(limit)
            )
        )
        return items, int(self.session.scalar(count_stmt) or 0)

    def get_job(self, job_id: UUID) -> RecipeImportJob | None:
        return self.session.get(RecipeImportJob, job_id)

    def get_source_post(self, source_post_id: UUID) -> RecipeSourcePost | None:
        return self.session.get(RecipeSourcePost, source_post_id)

    def pending_source_ids(self, job_id: UUID) -> list[UUID]:
        return list(
            self.session.scalars(
                select(RecipeSourcePost.id).where(
                    RecipeSourcePost.job_id == job_id,
                    RecipeSourcePost.status == "discovered",
                )
            )
        )

    def refresh_job_counts(self, job: RecipeImportJob) -> None:
        statuses = list(
            self.session.execute(
                select(RecipeSourcePost.id, RecipeSourcePost.status).where(
                    RecipeSourcePost.job_id == job.id
                )
            )
        )
        source_ids = [source_id for source_id, _ in statuses]
        job.discovered_count = len(statuses)
        job.processed_count = sum(
            status != "discovered" for _, status in statuses
        )
        job.failed_count = sum(status == "failed" for _, status in statuses)
        job.candidate_count = (
            int(
                self.session.scalar(
                    select(func.count())
                    .select_from(RecipeCandidate)
                    .where(RecipeCandidate.source_post_id.in_(source_ids))
                )
                or 0
            )
            if source_ids
            else 0
        )
        self.session.commit()

    def request_cancel(self, job: RecipeImportJob, actor: Any) -> RecipeImportJob:
        if job.status in {"completed", "partial_failed", "failed", "cancelled"}:
            return job
        job.cancel_requested = True
        self._audit(
            actor,
            "recipe_import_job_cancel_requested",
            f"Requested cancellation of import job {job.id}",
        )
        self.session.commit()
        self.session.refresh(job)
        return job

    def list_candidates(
        self,
        status: str | None = None,
        creator_id: UUID | None = None,
        limit: int = 100,
    ) -> tuple[list[RecipeCandidate], int]:
        stmt = select(RecipeCandidate)
        count_stmt = select(func.count()).select_from(RecipeCandidate)
        if status:
            stmt = stmt.where(RecipeCandidate.status == status)
            count_stmt = count_stmt.where(RecipeCandidate.status == status)
        if creator_id:
            stmt = stmt.where(RecipeCandidate.creator_id == creator_id)
            count_stmt = count_stmt.where(RecipeCandidate.creator_id == creator_id)
        items = list(
            self.session.scalars(
                stmt.order_by(RecipeCandidate.created_at.desc()).limit(limit)
            )
        )
        return items, int(self.session.scalar(count_stmt) or 0)

    def get_candidate(
        self, candidate_id: UUID, for_update: bool = False
    ) -> RecipeCandidate | None:
        stmt = select(RecipeCandidate).where(RecipeCandidate.id == candidate_id)
        if for_update:
            stmt = stmt.with_for_update()
        return self.session.scalar(stmt)

    def update_candidate(
        self, candidate: RecipeCandidate, data: CandidateRecipeData, actor: Any
    ) -> RecipeCandidate:
        candidate.extraction_version += 1
        candidate.data = data.model_dump(mode="json")
        candidate.status = (
            "incomplete" if approval_blockers(data) else "ready_for_review"
        )
        candidate.updated_at = _now()
        self.session.add(
            RecipeCandidateExtraction(
                candidate_id=candidate.id,
                version=candidate.extraction_version,
                model_name="admin",
                prompt_version="admin-edit",
                input_snapshot={},
                output_snapshot=candidate.data,
            )
        )
        self._audit(
            actor,
            "recipe_import_candidate_updated",
            f"Edited recipe candidate {candidate.id}",
        )
        self.session.commit()
        self.session.refresh(candidate)
        return candidate

    def reject_candidate(
        self, candidate: RecipeCandidate, reason: str, actor: Any
    ) -> RecipeCandidate:
        if candidate.status == "approved":
            raise ValueError("Approved candidates cannot be rejected")
        candidate.status = "rejected"
        candidate.rejection_reason = reason
        candidate.reviewed_by = actor.id
        candidate.reviewed_at = _now()
        self._audit(
            actor,
            "recipe_import_candidate_rejected",
            f"Rejected recipe candidate {candidate.id}",
            {"reason": reason},
        )
        self.session.commit()
        self.session.refresh(candidate)
        return candidate

    def retry_candidate(
        self, candidate: RecipeCandidate, actor: Any
    ) -> RecipeImportJob:
        source = self.session.get(RecipeSourcePost, candidate.source_post_id)
        creator = self.session.get(RecipeCreator, candidate.creator_id)
        if source is None or creator is None:
            raise ValueError("Candidate source is unavailable")
        candidate.status = "incomplete"
        candidate.rejection_reason = None
        job = RecipeImportJob(
            creator_id=creator.id,
            mode="retry",
            requested_limit=1,
            requested_by=actor.id,
            payload={
                "source_post_id": str(source.id),
                "candidate_id": str(candidate.id),
            },
        )
        self.session.add(job)
        self._audit(
            actor,
            "recipe_import_candidate_retry_queued",
            f"Queued retry for recipe candidate {candidate.id}",
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ValueError("This creator already has an active import job") from exc
        self.session.refresh(job)
        return job

    def apply_candidate_extraction(
        self,
        candidate: RecipeCandidate,
        data: CandidateRecipeData | None,
        *,
        model_name: str,
        input_snapshot: dict[str, Any],
    ) -> RecipeCandidate:
        candidate.extraction_version += 1
        if data is not None:
            candidate.data = data.model_dump(mode="json")
            candidate.status = (
                "incomplete"
                if approval_blockers(data)
                else "ready_for_review"
            )
            output_snapshot: dict[str, Any] = candidate.data
        else:
            candidate.status = "incomplete"
            output_snapshot = {"recipes": []}
        self.session.add(
            RecipeCandidateExtraction(
                candidate_id=candidate.id,
                version=candidate.extraction_version,
                model_name=model_name,
                input_snapshot=input_snapshot,
                output_snapshot=output_snapshot,
            )
        )
        source = self.session.get(RecipeSourcePost, candidate.source_post_id)
        if source is not None:
            source.status = "candidate_created"
        self.session.commit()
        self.session.refresh(candidate)
        return candidate

    def approve_candidate(self, candidate: RecipeCandidate, actor: Any) -> UUID:
        # The service fetches this row FOR UPDATE. Re-checking the link makes
        # retries safe if a client repeats the approval request.
        if candidate.approved_recipe_id:
            return candidate.approved_recipe_id

        data = CandidateRecipeData.model_validate(candidate.data)
        base_slug = _slugify(data.title or "recipe")
        slug = base_slug
        suffix = 2
        while self.session.scalar(select(Recipe.id).where(Recipe.slug == slug)):
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        nutrition = data.nutrition_per_serving.model_dump(exclude_none=True)
        recipe = Recipe(
            id=uuid4(),
            title=data.title or "Untitled recipe",
            slug=slug,
            source_url=data.source_url,
            source_kind="instagram",
            creator_id=candidate.creator_id,
            source_post_id=candidate.source_post_id,
            image_url=data.thumbnail_url,
            description=data.description,
            instructions=data.instructions,
            ingredients=[item.model_dump(exclude_none=True) for item in data.ingredients],
            prep_time_minutes=data.prep_time_minutes,
            cook_time_minutes=data.cook_time_minutes,
            total_time_minutes=(
                (data.prep_time_minutes or 0) + (data.cook_time_minutes or 0)
                if data.prep_time_minutes is not None
                or data.cook_time_minutes is not None
                else None
            ),
            portions=data.portions,
            cuisine=data.cuisine,
            meal_type=data.meal_type,
            dietary_flags=data.dietary_flags,
            allergens=data.allergens,
            nutrition={
                **nutrition,
                "protein": nutrition.get("protein_g"),
                "carbs": nutrition.get("carbs_g"),
                "fat": nutrition.get("fat_g"),
            },
            storage_guidance=data.storage.model_dump(exclude_none=True),
            attribution=data.attribution,
            author=data.attribution,
            language="en",
            tags=sorted(set([*data.tags, "meal-prep"])),
            category="meal_prep",
            is_active=True,
        )
        self.session.add(recipe)
        candidate.status = "approved"
        candidate.approved_recipe_id = recipe.id
        candidate.reviewed_by = actor.id
        candidate.reviewed_at = _now()
        self._audit(
            actor,
            "recipe_import_candidate_approved",
            f"Published {recipe.title}",
            {
                "candidate_id": str(candidate.id),
                "recipe_id": str(recipe.id),
                "source_url": data.source_url,
            },
        )
        self.session.commit()
        return recipe.id

    def claim_job(
        self, worker_id: str, lease_seconds: int = 120
    ) -> RecipeImportJob | None:
        now = _now()
        job = self.session.scalar(
            select(RecipeImportJob)
            .where(
                or_(
                    RecipeImportJob.status == "queued",
                    (
                        RecipeImportJob.status.in_(["discovering", "processing"])
                        & or_(
                            RecipeImportJob.lease_expires_at.is_(None),
                            RecipeImportJob.lease_expires_at < now,
                        )
                    ),
                )
            )
            .order_by(RecipeImportJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            self.session.rollback()
            return None
        job.lease_owner = worker_id
        job.lease_expires_at = now + timedelta(seconds=lease_seconds)
        job.heartbeat_at = now
        job.status = "discovering" if job.status == "queued" else job.status
        job.started_at = job.started_at or now
        self.session.commit()
        self.session.refresh(job)
        return job

    def worker_is_alive(self, max_age_seconds: int = 180) -> bool:
        cutoff = _now() - timedelta(seconds=max_age_seconds)
        return (
            self.session.scalar(
                select(func.count())
                .select_from(RecipeImportWorkerHeartbeat)
                .where(RecipeImportWorkerHeartbeat.heartbeat_at >= cutoff)
            )
            or 0
        ) > 0

    def worker_heartbeat(
        self, worker_id: str, current_job_id: UUID | None = None
    ) -> None:
        heartbeat = self.session.get(RecipeImportWorkerHeartbeat, worker_id)
        if heartbeat is None:
            heartbeat = RecipeImportWorkerHeartbeat(worker_id=worker_id)
            self.session.add(heartbeat)
        heartbeat.heartbeat_at = _now()
        heartbeat.current_job_id = current_job_id
        self.session.commit()

    def heartbeat(self, job: RecipeImportJob, lease_seconds: int = 120) -> None:
        now = _now()
        job.heartbeat_at = now
        job.lease_expires_at = now + timedelta(seconds=lease_seconds)
        self.session.commit()

    def save_source_post(
        self, job: RecipeImportJob, post: dict[str, Any]
    ) -> RecipeSourcePost | None:
        canonical_url = canonical_instagram_post_url(post["permalink"])
        existing = self.session.scalar(
            select(RecipeSourcePost).where(
                RecipeSourcePost.creator_id == job.creator_id,
                or_(
                    RecipeSourcePost.platform_post_id == str(post["id"]),
                    RecipeSourcePost.source_url == canonical_url,
                ),
            )
        )
        if existing:
            return None
        source = RecipeSourcePost(
            creator_id=job.creator_id,
            job_id=job.id,
            platform_post_id=str(post["id"]),
            source_url=canonical_url,
            media_type=post.get("media_type"),
            caption=post.get("caption"),
            thumbnail_url=post.get("thumbnail_url")
            or (
                post.get("media_url")
                if post.get("media_type") in {"IMAGE", "CAROUSEL_ALBUM"}
                else None
            ),
            cloudinary_thumbnail_url=(
                post.get("media_url")
                if str(post["id"]).startswith("manual-")
                and post.get("media_type") == "IMAGE"
                else None
            ),
            published_at=_parse_timestamp(post.get("timestamp")),
            raw_metadata={
                key: value
                for key, value in post.items()
                if key not in {"caption", "thumbnail_url"}
            },
        )
        self.session.add(source)
        self.session.commit()
        self.session.refresh(source)
        return source

    def create_candidates(
        self,
        source: RecipeSourcePost,
        recipes: list[CandidateRecipeData],
        *,
        model_name: str,
        input_snapshot: dict[str, Any],
    ) -> list[RecipeCandidate]:
        candidates: list[RecipeCandidate] = []
        for recipe_data in recipes:
            duplicate_ids = self._near_duplicate_ids(recipe_data)
            candidate = RecipeCandidate(
                source_post_id=source.id,
                creator_id=source.creator_id,
                data=recipe_data.model_dump(mode="json"),
                status=(
                    "incomplete"
                    if approval_blockers(recipe_data)
                    else "ready_for_review"
                ),
                duplicate_recipe_ids=duplicate_ids,
            )
            self.session.add(candidate)
            self.session.flush()
            self.session.add(
                RecipeCandidateExtraction(
                    candidate_id=candidate.id,
                    version=1,
                    model_name=model_name,
                    input_snapshot=input_snapshot,
                    output_snapshot=candidate.data,
                )
            )
            candidates.append(candidate)
        source.status = "candidate_created" if candidates else "not_recipe"
        self.session.commit()
        for candidate in candidates:
            self.session.refresh(candidate)
        return candidates

    def _near_duplicate_ids(
        self, data: CandidateRecipeData, limit: int = 5
    ) -> list[UUID]:
        def tokens(value: str) -> set[str]:
            return set(re.findall(r"[a-z0-9]+", value.lower()))

        title_tokens = tokens(data.title or "")
        ingredient_tokens = {
            token
            for ingredient in data.ingredients
            for token in tokens(ingredient.name)
        }
        if not title_tokens or not ingredient_tokens:
            return []
        matches: list[tuple[float, UUID]] = []
        rows = self.session.execute(
            select(Recipe.id, Recipe.title, Recipe.ingredients).where(
                Recipe.is_active.is_(True)
            )
        )
        for recipe_id, title, ingredients in rows:
            existing_title = tokens(title or "")
            existing_ingredients = {
                token
                for ingredient in (ingredients or [])
                for token in tokens(
                    ingredient.get("name", "")
                    if isinstance(ingredient, dict)
                    else str(ingredient)
                )
            }
            title_union = title_tokens | existing_title
            ingredient_union = ingredient_tokens | existing_ingredients
            title_score = (
                len(title_tokens & existing_title) / len(title_union)
                if title_union
                else 0
            )
            ingredient_score = (
                len(ingredient_tokens & existing_ingredients)
                / len(ingredient_union)
                if ingredient_union
                else 0
            )
            if title_score >= 0.75 and ingredient_score >= 0.6:
                matches.append(((title_score + ingredient_score) / 2, recipe_id))
        matches.sort(reverse=True, key=lambda item: item[0])
        return [recipe_id for _, recipe_id in matches[:limit]]

    def finish_job(
        self,
        job: RecipeImportJob,
        *,
        status: str,
        error_summary: str | None = None,
    ) -> None:
        job.status = status
        job.error_summary = error_summary
        job.finished_at = _now()
        job.lease_owner = None
        job.lease_expires_at = None
        self.session.commit()

    def mark_source_failed(self, source: RecipeSourcePost, detail: str) -> None:
        source.status = "failed"
        source.error_detail = detail[:2000]
        self.session.commit()
