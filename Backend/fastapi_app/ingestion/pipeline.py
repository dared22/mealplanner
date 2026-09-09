from __future__ import annotations

import hashlib
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from database import SessionLocal

from .food_safety import suggested_storage
from .nutrition import NutritionCalculator
from .providers import (
    CloudinaryThumbnailStore,
    MetaInstagramClient,
    OpenAIRecipeExtractor,
    MediaUnavailableError,
    ProviderError,
    extract_media_context,
    extract_image_context,
    linked_page_text,
)
from .repository import RecipeImportRepository
from .repository import canonical_instagram_post_url
from .schemas import approval_blockers


logger = logging.getLogger(__name__)


class RecipeImportPipeline:
    def __init__(
        self,
        *,
        meta: MetaInstagramClient | None = None,
        extractor: OpenAIRecipeExtractor | None = None,
        thumbnails: CloudinaryThumbnailStore | None = None,
        concurrency: int = 3,
        nutrition: NutritionCalculator | None = None,
    ):
        self.meta = meta or MetaInstagramClient()
        self.extractor = extractor or OpenAIRecipeExtractor()
        self.thumbnails = thumbnails or CloudinaryThumbnailStore()
        self.nutrition = nutrition or NutritionCalculator()
        self.concurrency = max(1, min(concurrency, 6))

    def process_job(self, job_id: UUID) -> None:
        with SessionLocal() as session:
            repository = RecipeImportRepository(session)
            job = repository.get_job(job_id)
            if job is None:
                return
            creator = repository.get_creator(job.creator_id)
            if creator is None or creator.status != "active":
                repository.finish_job(
                    job, status="cancelled", error_summary="Creator is revoked"
                )
                return
            try:
                source_ids = self._discover(repository, job, creator)
                job_payload = dict(job.payload or {})
            except Exception as exc:
                logger.exception("Recipe-import discovery failed for job %s", job.id)
                repository.finish_job(job, status="failed", error_summary=str(exc)[:2000])
                return

        failures = 0
        created_in_run = 0
        target_candidate_id = (
            UUID(job_payload["candidate_id"])
            if job_payload.get("candidate_id")
            else None
        )
        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = {
                executor.submit(
                    self._process_source_with_retry,
                    source_id,
                    job_id,
                    target_candidate_id,
                ): source_id
                for source_id in source_ids
            }
            for future in as_completed(futures):
                try:
                    created_in_run += future.result()
                except Exception:
                    failures += 1
                    logger.exception(
                        "Recipe-import source failed: %s", futures[future]
                    )

        with SessionLocal() as session:
            repository = RecipeImportRepository(session)
            job = repository.get_job(job_id)
            if job is None:
                return
            if job.mode == "retry":
                job.discovered_count = 1
                job.processed_count = 1
                job.candidate_count = created_in_run
                job.failed_count = failures
                session.commit()
            else:
                repository.refresh_job_counts(job)
            if job.cancel_requested:
                final_status = "cancelled"
            elif job.failed_count:
                final_status = (
                    "partial_failed"
                    if job.processed_count > job.failed_count
                    else "failed"
                )
            else:
                final_status = "completed"
            repository.finish_job(job, status=final_status)

    def _process_source_with_retry(
        self,
        source_id: UUID,
        job_id: UUID,
        target_candidate_id: UUID | None = None,
    ) -> int:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                result = self._process_source(
                    source_id, job_id, target_candidate_id
                )
                self._cleanup_source_media(source_id)
                return result
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    with SessionLocal() as session:
                        repository = RecipeImportRepository(session)
                        source = repository.get_source_post(source_id)
                        job = (
                            repository.get_job(source.job_id)
                            if source is not None
                            else None
                        )
                        if job is not None:
                            job.retry_count += 1
                            session.commit()
                    time.sleep(2**attempt)
        with SessionLocal() as session:
            repository = RecipeImportRepository(session)
            source = repository.get_source_post(source_id)
            if source is not None:
                repository.mark_source_failed(
                    source, str(last_error or "Unknown provider error")
                )
        self._cleanup_source_media(source_id)
        raise last_error or ProviderError("Source processing failed")

    def _cleanup_source_media(self, source_id: UUID) -> None:
        with SessionLocal() as session:
            repository = RecipeImportRepository(session)
            source = repository.get_source_post(source_id)
            if source is None or not source.raw_metadata:
                return
            metadata = dict(source.raw_metadata)
            public_id = metadata.pop("media_public_id", None)
            media_type = str(metadata.get("media_type", "")).lower()
            metadata.pop("media_url", None)
            if public_id and media_type == "video":
                try:
                    self.thumbnails.destroy(public_id, "video")
                except Exception:
                    logger.exception(
                        "Failed to delete temporary manual video %s", public_id
                    )
                    metadata["media_cleanup_failed"] = True
                    metadata["media_public_id"] = public_id
            source.raw_metadata = metadata
            job = repository.get_job(source.job_id)
            if job is not None and job.payload:
                job_payload = dict(job.payload)
                job_payload.pop("media_url", None)
                job_payload.pop("media_public_id", None)
                job.payload = job_payload
            session.commit()

    def _discover(self, repository, job, creator) -> list[UUID]:
        if job.cancel_requested:
            repository.finish_job(job, status="cancelled")
            return []
        if job.payload and job.payload.get("source_post_id"):
            return [UUID(job.payload["source_post_id"])]
        pending_ids = repository.pending_source_ids(job.id)
        if job.status == "processing":
            return pending_ids
        if job.payload and job.payload.get("source_url"):
            payload = job.payload
            canonical_url = canonical_instagram_post_url(payload["source_url"])
            platform_id = "manual-" + hashlib.sha256(
                canonical_url.encode("utf-8")
            ).hexdigest()[:24]
            source = repository.save_source_post(
                job,
                {
                    "id": platform_id,
                    "permalink": canonical_url,
                    "caption": payload["creator_text"],
                    "media_url": payload.get("media_url"),
                    "media_type": (
                        payload.get("media_type", "").upper()
                        if payload.get("media_type")
                        else "MANUAL"
                    ),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            job.discovered_count = 1 if source else 0
            job.status = "processing"
            repository.session.commit()
            return [source.id] if source else []

        after_cursor = creator.older_cursor if job.mode == "older" else None
        posts, next_cursor = self.meta.discover(
            creator.instagram_username,
            limit=job.requested_limit,
            after=after_cursor,
        )
        source_ids: list[UUID] = list(pending_ids)
        for post in posts:
            source = repository.save_source_post(job, post)
            if source:
                source_ids.append(source.id)
        job.cursor = next_cursor
        if job.mode == "older" or creator.older_cursor is None:
            creator.older_cursor = next_cursor
            creator.older_exhausted = next_cursor is None
        repository.refresh_job_counts(job)
        job.status = "processing"
        creator.last_scanned_at = datetime.now(timezone.utc)
        repository.session.commit()
        return source_ids

    def _process_source(
        self,
        source_id: UUID,
        current_job_id: UUID,
        target_candidate_id: UUID | None = None,
    ) -> int:
        with SessionLocal() as session:
            repository = RecipeImportRepository(session)
            source = repository.get_source_post(source_id)
            if source is None:
                return 0
            job = repository.get_job(current_job_id)
            if job is not None and job.cancel_requested:
                source.status = "failed"
                source.error_detail = "Cancelled before processing"
                session.commit()
                return 0
            creator = repository.get_creator(source.creator_id)
            if creator is None:
                raise ProviderError("Creator record is missing")
            caption = source.caption or ""
            website = linked_page_text(caption, creator.allowed_domains or [])
            primary_text = f"{caption}\n\n{website}".strip()
            target_candidate = (
                repository.get_candidate(target_candidate_id)
                if target_candidate_id
                else None
            )
            if target_candidate is not None:
                primary_text += (
                    "\n\nPreviously extracted candidate to retry:\n"
                    + json.dumps(target_candidate.data)
                )
            likelihood = self.extractor.classify(primary_text)
            if not likelihood.likely_recipe:
                source.status = "not_recipe"
                session.commit()
                return 0

            thumbnail_url = source.cloudinary_thumbnail_url
            if not thumbnail_url and source.thumbnail_url:
                thumbnail_url = self.thumbnails.upload_remote(
                    source.thumbnail_url, str(source.id)
                )
                source.cloudinary_thumbnail_url = thumbnail_url
                session.commit()

            result = self.extractor.extract(
                primary_text,
                source_url=source.source_url,
                attribution=f"@{creator.instagram_username}",
                thumbnail_url=thumbnail_url,
            )
            core_missing = not result.recipes or any(
                set(approval_blockers(recipe))
                & {
                    "ingredients",
                    "ingredient_quantities",
                    "instructions",
                    "batch_yield",
                    "per_serving_macros",
                }
                for recipe in result.recipes
            )
            needs_media = False
            if core_missing and source.raw_metadata:
                media_url = source.raw_metadata.get("media_url")
                if media_url:
                    try:
                        if source.media_type == "VIDEO":
                            transcript, frames, temporary = extract_media_context(
                                media_url, self.extractor
                            )
                        else:
                            children = (
                                source.raw_metadata.get("children", {}).get(
                                    "data", []
                                )
                                if isinstance(
                                    source.raw_metadata.get("children"), dict
                                )
                                else []
                            )
                            image_urls = [media_url]
                            image_urls.extend(
                                child.get("media_url")
                                or child.get("thumbnail_url")
                                for child in children
                                if child.get("media_url")
                                or child.get("thumbnail_url")
                            )
                            frames, temporary = extract_image_context(image_urls)
                            transcript = ""
                        ocr_text = self.extractor.ocr_frames(frames)
                        source.transcript = transcript
                        source.ocr_text = ocr_text
                        result = self.extractor.extract(
                            (
                                f"{primary_text}\n\nTranscript:\n{transcript}"
                                f"\n\nOn-screen text:\n{ocr_text}"
                            ),
                            source_url=source.source_url,
                            attribution=f"@{creator.instagram_username}",
                            thumbnail_url=thumbnail_url,
                            image_paths=frames,
                        )
                    except MediaUnavailableError:
                        needs_media = True
                    finally:
                        if "temporary" in locals():
                            temporary.cleanup()
                else:
                    needs_media = True
            elif core_missing:
                needs_media = True

            for recipe in result.recipes:
                self.nutrition.enrich(recipe)
                if not recipe.storage.storage_instructions:
                    recipe.storage = suggested_storage()
                recipe.food_safety_confirmed = False
            input_snapshot = {
                "caption": caption,
                "linked_page_used": bool(website),
                "transcript": source.transcript,
            }
            if target_candidate is not None:
                first = result.recipes[0] if result.recipes else None
                repository.apply_candidate_extraction(
                    target_candidate,
                    first,
                    model_name=self.extractor.extractor_model,
                    input_snapshot=input_snapshot,
                )
                additional = result.recipes[1:] if result.recipes else []
                candidates = (
                    repository.create_candidates(
                        source,
                        additional,
                        model_name=self.extractor.extractor_model,
                        input_snapshot=input_snapshot,
                    )
                    if additional
                    else []
                )
                created_count = 1 + len(candidates)
            else:
                candidates = repository.create_candidates(
                    source,
                    result.recipes,
                    model_name=self.extractor.extractor_model,
                    input_snapshot=input_snapshot,
                )
                created_count = len(candidates)
            if needs_media:
                source.status = "needs_media"
                session.commit()
            return created_count
