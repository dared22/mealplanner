from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from .config import imports_enabled
from .repository import RecipeImportRepository
from .providers import CloudinaryThumbnailStore, ProviderError
from .schemas import (
    CandidateRecipeData,
    CandidateResponse,
    CandidateUpdate,
    CreatorCreate,
    CreatorUpdate,
    ManualPostCreate,
    RejectCandidate,
    ScanCreate,
    approval_blockers,
)


class RecipeImportService:
    def __init__(
        self,
        repository: RecipeImportRepository,
        *,
        enabled: bool | None = None,
    ):
        self.repository = repository
        self.enabled = (
            enabled
            if enabled is not None
            else imports_enabled()
        )

    def _require_enabled(self) -> None:
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Instagram recipe imports are disabled by feature flag",
            )

    def readiness(self) -> dict[str, Any]:
        def configured(*names: str) -> tuple[bool, str]:
            missing = [name for name in names if not os.getenv(name)]
            if missing:
                return False, f"{', '.join(missing)} is missing"
            return True, "configured"

        meta_ready, meta_detail = configured(
            "META_ACCESS_TOKEN", "META_IG_USER_ID"
        )
        ai_ready, ai_detail = configured("OPENAI_API_KEY")
        cloud_ready, cloud_detail = configured(
            "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"
        )
        try:
            worker_ready = self.repository.worker_is_alive()
            worker_detail = (
                "heartbeat received"
                if worker_ready
                else "no worker heartbeat in the last 3 minutes"
            )
        except Exception:
            worker_ready = False
            worker_detail = "worker heartbeat table unavailable; run migrations"
        checks = {
            "meta": {"ready": meta_ready, "detail": meta_detail},
            "worker": {"ready": worker_ready, "detail": worker_detail},
            "openai": {"ready": ai_ready, "detail": ai_detail},
            "cloudinary": {"ready": cloud_ready, "detail": cloud_detail},
            "food_databases": {
                "ready": True,
                "detail": "Matvaretabellen primary; USDA FDC used when configured",
            },
        }
        return {
            "enabled": self.enabled,
            "ready": self.enabled
            and all(check["ready"] for check in checks.values()),
            "checks": checks,
        }

    def create_creator(self, payload: CreatorCreate, actor: Any):
        self._require_enabled()
        try:
            return self.repository.create_creator(payload, actor)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    def list_creators(self):
        return self.repository.list_creators()

    def get_creator(self, creator_id: UUID):
        creator = self.repository.get_creator(creator_id)
        if creator is None:
            raise HTTPException(status_code=404, detail="Creator not found")
        return creator

    def update_creator(
        self, creator_id: UUID, payload: CreatorUpdate, actor: Any
    ):
        self._require_enabled()
        return self.repository.update_creator(
            self.get_creator(creator_id), payload, actor
        )

    def revoke_creator(self, creator_id: UUID, actor: Any) -> dict[str, Any]:
        self._require_enabled()
        creator = self.repository.get_creator(creator_id, for_update=True)
        if creator is None:
            raise HTTPException(status_code=404, detail="Creator not found")
        count = self.repository.revoke_creator(creator, actor)
        return {
            "creator_id": creator.id,
            "status": "revoked",
            "deactivated_recipes": count,
        }

    def create_scan(
        self, creator_id: UUID, payload: ScanCreate, actor: Any
    ):
        self._require_enabled()
        creator = self.repository.get_creator(creator_id, for_update=True)
        if creator is None:
            raise HTTPException(status_code=404, detail="Creator not found")
        if creator.status != "active":
            raise HTTPException(status_code=409, detail="Creator is revoked")
        if payload.mode == "older" and creator.older_exhausted:
            raise HTTPException(
                status_code=409,
                detail="All available older posts have already been scanned",
            )
        try:
            return self.repository.create_job(creator, payload, actor)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    def create_manual_post(self, payload: ManualPostCreate, actor: Any):
        self._require_enabled()
        if payload.media_url:
            cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
            path_parts = [
                part for part in urlparse(payload.media_url).path.split("/") if part
            ]
            if not cloud_name or not path_parts or path_parts[0] != cloud_name:
                raise HTTPException(
                    status_code=422,
                    detail="Manual media must belong to the configured Cloudinary account",
                )
        creator = self.repository.get_creator(payload.creator_id, for_update=True)
        if creator is None:
            raise HTTPException(status_code=404, detail="Creator not found")
        if creator.status != "active":
            raise HTTPException(status_code=409, detail="Creator is revoked")
        job_payload = {
            "source_url": payload.source_url,
            "creator_text": payload.creator_text,
            "media_url": payload.media_url,
            "media_type": payload.media_type,
            "media_public_id": payload.media_public_id,
        }
        try:
            return self.repository.create_job(
                creator,
                ScanCreate(mode="new", limit=1),
                actor,
                job_payload=job_payload,
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    def upload_manual_media(
        self,
        content: bytes,
        filename: str,
        content_type: str | None,
        actor: Any,
    ) -> dict[str, str]:
        self._require_enabled()
        if len(content) > 100 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Media exceeds 100 MB")
        if not content_type or not content_type.startswith(("image/", "video/")):
            raise HTTPException(
                status_code=415, detail="Only image and video uploads are supported"
            )
        try:
            uploaded = CloudinaryThumbnailStore().upload_bytes(
                content, filename, f"manual-{uuid4()}"
            )
        except ProviderError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        self.repository.audit_manual_upload(actor, filename)
        return {
            "media_url": uploaded["secure_url"],
            "media_type": "image" if content_type.startswith("image/") else "video",
            "media_public_id": uploaded["public_id"],
        }

    def list_jobs(self, creator_id: UUID | None = None, limit: int = 100):
        return self.repository.list_jobs(creator_id, limit)

    def get_job(self, job_id: UUID):
        job = self.repository.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Import job not found")
        return job

    def cancel_job(self, job_id: UUID, actor: Any):
        return self.repository.request_cancel(self.get_job(job_id), actor)

    @staticmethod
    def candidate_response(candidate: Any) -> CandidateResponse:
        data = CandidateRecipeData.model_validate(candidate.data)
        return CandidateResponse(
            id=candidate.id,
            source_post_id=candidate.source_post_id,
            creator_id=candidate.creator_id,
            status=candidate.status,
            data=data,
            extraction_version=candidate.extraction_version,
            confidence=candidate.confidence,
            duplicate_recipe_ids=candidate.duplicate_recipe_ids or [],
            blockers=approval_blockers(
                data,
                cloudinary_cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            ),
            approved_recipe_id=candidate.approved_recipe_id,
            rejection_reason=candidate.rejection_reason,
            created_at=candidate.created_at,
            updated_at=candidate.updated_at,
        )

    def list_candidates(
        self,
        candidate_status: str | None = None,
        creator_id: UUID | None = None,
        limit: int = 100,
    ) -> tuple[list[CandidateResponse], int]:
        items, total = self.repository.list_candidates(
            candidate_status, creator_id, limit
        )
        return [self.candidate_response(item) for item in items], total

    def get_candidate(self, candidate_id: UUID) -> CandidateResponse:
        candidate = self.repository.get_candidate(candidate_id)
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return self.candidate_response(candidate)

    def update_candidate(
        self, candidate_id: UUID, payload: CandidateUpdate, actor: Any
    ) -> CandidateResponse:
        self._require_enabled()
        candidate = self.repository.get_candidate(candidate_id)
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if candidate.status in {"approved", "rejected"}:
            raise HTTPException(
                status_code=409, detail="Reviewed candidates cannot be edited"
            )
        updated = self.repository.update_candidate(candidate, payload.data, actor)
        return self.candidate_response(updated)

    def approve_candidate(self, candidate_id: UUID, actor: Any) -> UUID:
        self._require_enabled()
        candidate = self.repository.get_candidate(candidate_id, for_update=True)
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if candidate.approved_recipe_id:
            return candidate.approved_recipe_id
        creator = self.repository.get_creator(
            candidate.creator_id, for_update=True
        )
        if creator is None or creator.status != "active":
            raise HTTPException(
                status_code=409,
                detail="Candidate creator is revoked or unavailable",
            )
        if candidate.status == "rejected":
            raise HTTPException(status_code=409, detail="Candidate was rejected")
        cloudinary_cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        blockers = approval_blockers(
            CandidateRecipeData.model_validate(candidate.data),
            cloudinary_cloud_name=cloudinary_cloud_name,
        )
        if blockers:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Candidate is not ready for approval",
                    "blockers": blockers,
                },
            )
        if not cloudinary_cloud_name:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cloudinary is not configured for recipe publication",
            )
        return self.repository.approve_candidate(candidate, actor)

    def retry_candidate(self, candidate_id: UUID, actor: Any):
        self._require_enabled()
        candidate = self.repository.get_candidate(candidate_id)
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if candidate.status == "approved":
            raise HTTPException(
                status_code=409, detail="Approved candidates cannot be retried"
            )
        creator = self.repository.get_creator(
            candidate.creator_id, for_update=True
        )
        if creator is None or creator.status != "active":
            raise HTTPException(
                status_code=409,
                detail="Candidate creator is revoked or unavailable",
            )
        try:
            return self.repository.retry_candidate(candidate, actor)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    def reject_candidate(
        self, candidate_id: UUID, payload: RejectCandidate, actor: Any
    ) -> CandidateResponse:
        self._require_enabled()
        candidate = self.repository.get_candidate(candidate_id)
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate not found")
        try:
            rejected = self.repository.reject_candidate(
                candidate, payload.reason, actor
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return self.candidate_response(rejected)
