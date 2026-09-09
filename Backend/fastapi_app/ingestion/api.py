from __future__ import annotations

from typing import Any, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from database import get_session

from .repository import RecipeImportRepository
from .schemas import (
    CandidateListResponse,
    CandidateResponse,
    CandidateUpdate,
    CreatorCreate,
    CreatorListResponse,
    CreatorResponse,
    CreatorUpdate,
    JobListResponse,
    JobResponse,
    ManualPostCreate,
    ReadinessResponse,
    RejectCandidate,
    ScanCreate,
)
from .service import RecipeImportService


def get_import_service(
    db: Session = Depends(get_session),
) -> RecipeImportService:
    return RecipeImportService(RecipeImportRepository(db))


def create_recipe_import_router(
    admin_dependency: Callable[..., Any],
) -> APIRouter:
    router = APIRouter(
        prefix="/admin/recipe-imports",
        tags=["admin-recipe-imports"],
    )

    @router.get("/readiness", response_model=ReadinessResponse)
    def readiness(
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.readiness()

    @router.get("/creators", response_model=CreatorListResponse)
    def list_creators(
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        items, total = service.list_creators()
        return {"items": items, "total": total}

    @router.post(
        "/creators",
        response_model=CreatorResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_creator(
        payload: CreatorCreate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.create_creator(payload, admin)

    @router.get("/creators/{creator_id}", response_model=CreatorResponse)
    def get_creator(
        creator_id: UUID,
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.get_creator(creator_id)

    @router.patch("/creators/{creator_id}", response_model=CreatorResponse)
    def update_creator(
        creator_id: UUID,
        payload: CreatorUpdate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.update_creator(creator_id, payload, admin)

    @router.post(
        "/creators/{creator_id}/scans",
        response_model=JobResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def scan_creator(
        creator_id: UUID,
        payload: ScanCreate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.create_scan(creator_id, payload, admin)

    @router.post("/creators/{creator_id}/revoke")
    def revoke_creator(
        creator_id: UUID,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.revoke_creator(creator_id, admin)

    @router.post(
        "/manual-posts",
        response_model=JobResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def create_manual_post(
        payload: ManualPostCreate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.create_manual_post(payload, admin)

    @router.post("/manual-media")
    async def upload_manual_media(
        media: UploadFile = File(...),
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        content = await media.read(100 * 1024 * 1024 + 1)
        return service.upload_manual_media(
            content,
            media.filename or "upload",
            media.content_type,
            admin,
        )

    @router.get("/jobs", response_model=JobListResponse)
    def list_jobs(
        creator_id: UUID | None = None,
        limit: int = Query(default=100, ge=1, le=200),
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        items, total = service.list_jobs(creator_id, limit)
        return {"items": items, "total": total}

    @router.get("/jobs/{job_id}", response_model=JobResponse)
    def get_job(
        job_id: UUID,
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.get_job(job_id)

    @router.post("/jobs/{job_id}/cancel", response_model=JobResponse)
    def cancel_job(
        job_id: UUID,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.cancel_job(job_id, admin)

    @router.get("/candidates", response_model=CandidateListResponse)
    def list_candidates(
        candidate_status: str | None = Query(default=None, alias="status"),
        creator_id: UUID | None = None,
        limit: int = Query(default=100, ge=1, le=200),
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        items, total = service.list_candidates(
            candidate_status, creator_id, limit
        )
        return {"items": items, "total": total}

    @router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
    def get_candidate(
        candidate_id: UUID,
        _admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.get_candidate(candidate_id)

    @router.patch(
        "/candidates/{candidate_id}", response_model=CandidateResponse
    )
    def update_candidate(
        candidate_id: UUID,
        payload: CandidateUpdate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.update_candidate(candidate_id, payload, admin)

    @router.post(
        "/candidates/{candidate_id}/retry",
        response_model=JobResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def retry_candidate(
        candidate_id: UUID,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.retry_candidate(candidate_id, admin)

    @router.post("/candidates/{candidate_id}/approve")
    def approve_candidate(
        candidate_id: UUID,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        recipe_id = service.approve_candidate(candidate_id, admin)
        return {"candidate_id": candidate_id, "recipe_id": recipe_id}

    @router.post(
        "/candidates/{candidate_id}/reject",
        response_model=CandidateResponse,
    )
    def reject_candidate(
        candidate_id: UUID,
        payload: RejectCandidate,
        admin: Any = Depends(admin_dependency),
        service: RecipeImportService = Depends(get_import_service),
    ):
        return service.reject_candidate(candidate_id, payload, admin)

    return router
