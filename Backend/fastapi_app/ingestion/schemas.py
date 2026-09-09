from __future__ import annotations

from datetime import datetime
from enum import Enum
import re
from typing import Any, Literal
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class CreatorStatus(str, Enum):
    active = "active"
    revoked = "revoked"


class JobStatus(str, Enum):
    queued = "queued"
    discovering = "discovering"
    processing = "processing"
    completed = "completed"
    partial_failed = "partial_failed"
    failed = "failed"
    cancelled = "cancelled"


class CandidateStatus(str, Enum):
    incomplete = "incomplete"
    ready_for_review = "ready_for_review"
    approved = "approved"
    rejected = "rejected"


PLANNER_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}


def _instagram_username(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or parsed.hostname not in {
        "instagram.com",
        "www.instagram.com",
    }:
        raise ValueError("Use an https://www.instagram.com/<creator>/ profile URL")
    if parsed.query or parsed.fragment:
        raise ValueError("Instagram profile URL cannot include a query or fragment")
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) != 1 or parts[0] in {"p", "reel", "stories", "explore"}:
        raise ValueError("URL must point to an Instagram creator profile")
    username = parts[0].lstrip("@")
    if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", username):
        raise ValueError("Instagram username contains invalid characters")
    return username


def _https_domain(value: str) -> str:
    normalized = value.strip().lower()
    parsed = urlparse(normalized if "://" in normalized else f"https://{normalized}")
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Allowed domains must be valid HTTPS hostnames")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("Allowed domains cannot include paths, queries, or fragments")
    return parsed.hostname


def _is_instagram_post_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value.strip())
    parts = [part for part in parsed.path.split("/") if part]
    return (
        parsed.scheme == "https"
        and parsed.hostname in {"instagram.com", "www.instagram.com"}
        and len(parts) >= 2
        and parts[0] in {"p", "reel", "tv"}
    )


def _is_cloudinary_image_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value.strip())
    parts = [part for part in parsed.path.split("/") if part]
    return (
        parsed.scheme == "https"
        and parsed.hostname == "res.cloudinary.com"
        and len(parts) >= 3
        and parts[1:3] == ["image", "upload"]
    )


class CreatorCreate(BaseModel):
    profile_url: str
    display_name: str | None = Field(default=None, max_length=255)
    allowed_domains: list[str] = Field(default_factory=list, max_length=20)
    permission_basis: str = Field(min_length=3, max_length=2000)
    permission_record_url: str | None = None
    permission_confirmed: bool

    @field_validator("profile_url")
    @classmethod
    def validate_profile_url(cls, value: str) -> str:
        _instagram_username(value)
        return value.strip().rstrip("/")

    @field_validator("allowed_domains")
    @classmethod
    def validate_domains(cls, values: list[str]) -> list[str]:
        return sorted(set(_https_domain(value) for value in values))

    @property
    def username(self) -> str:
        return _instagram_username(self.profile_url)

    @field_validator("permission_record_url")
    @classmethod
    def validate_permission_record_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parsed = urlparse(value.strip())
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("Permission record URL must use HTTPS")
        return value.strip()

    @model_validator(mode="after")
    def require_permission_confirmation(self) -> "CreatorCreate":
        if not self.permission_confirmed:
            raise ValueError("Creator permission must be confirmed")
        return self


class CreatorUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    allowed_domains: list[str] | None = Field(default=None, max_length=20)

    @field_validator("allowed_domains")
    @classmethod
    def validate_domains(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return sorted(set(_https_domain(value) for value in values))


class CreatorResponse(BaseModel):
    id: UUID
    instagram_username: str
    profile_url: str
    display_name: str | None = None
    allowed_domains: list[str] = Field(default_factory=list)
    permission_basis: str
    permission_record_url: str | None = None
    permission_confirmed_at: datetime
    status: CreatorStatus
    created_at: datetime
    updated_at: datetime
    last_scanned_at: datetime | None = None
    older_exhausted: bool = False

    model_config = {"from_attributes": True}


class CreatorListResponse(BaseModel):
    items: list[CreatorResponse]
    total: int


class ScanCreate(BaseModel):
    mode: Literal["new", "older"] = "new"
    limit: int = Field(default=100, ge=1, le=100)


class ManualPostCreate(BaseModel):
    creator_id: UUID
    source_url: str
    creator_text: str = Field(min_length=1, max_length=100_000)
    media_url: str | None = None
    media_type: Literal["image", "video"] | None = None
    media_public_id: str | None = Field(default=None, max_length=500)

    @field_validator("source_url")
    @classmethod
    def validate_post_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme != "https" or parsed.hostname not in {
            "instagram.com",
            "www.instagram.com",
        }:
            raise ValueError("Source URL must be an HTTPS Instagram URL")
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) < 2 or parts[0] not in {"p", "reel", "tv"}:
            raise ValueError("Source URL must point to an Instagram post or reel")
        return value.strip()

    @field_validator("media_url")
    @classmethod
    def validate_media_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parsed = urlparse(value.strip())
        if parsed.scheme != "https" or parsed.hostname != "res.cloudinary.com":
            raise ValueError("Manual media must be uploaded to the configured Cloudinary account")
        return value.strip()

    @field_validator("media_public_id")
    @classmethod
    def validate_media_public_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith("recipe-imports/manual/"):
            raise ValueError("Invalid manual media identifier")
        return value

    @model_validator(mode="after")
    def require_uploaded_media_metadata(self) -> "ManualPostCreate":
        if self.media_url and (not self.media_type or not self.media_public_id):
            raise ValueError("Manual media must be uploaded through the admin importer")
        return self


class JobResponse(BaseModel):
    id: UUID
    creator_id: UUID
    status: JobStatus
    mode: str
    requested_limit: int
    discovered_count: int
    processed_count: int
    candidate_count: int
    failed_count: int
    cancel_requested: bool
    error_summary: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    heartbeat_at: datetime | None = None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int


class Ingredient(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=500)
    original_text: str | None = Field(default=None, max_length=1000)


class NutritionPerServing(BaseModel):
    calories: float | None = Field(default=None, ge=0)
    protein_g: float | None = Field(default=None, ge=0)
    carbs_g: float | None = Field(default=None, ge=0)
    fat_g: float | None = Field(default=None, ge=0)
    source: Literal["creator", "calculated", "admin"] | None = None


class NutritionCalculation(BaseModel):
    complete: bool = False
    calculated: NutritionPerServing | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    comparison_percent: dict[str, float] = Field(default_factory=dict)


class StorageGuidance(BaseModel):
    fridge_days: int | None = Field(default=None, ge=0, le=14)
    freezer_months: int | None = Field(default=None, ge=0, le=24)
    storage_instructions: str | None = Field(default=None, max_length=2000)
    reheating_instructions: str | None = Field(default=None, max_length=2000)
    rule_version: str | None = Field(default=None, max_length=64)
    sources: list[str] = Field(default_factory=list)


class CandidateRecipeData(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    ingredients: list[Ingredient] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    portions: int | None = Field(default=None, gt=0, le=100)
    prep_time_minutes: int | None = Field(default=None, ge=0, le=1440)
    cook_time_minutes: int | None = Field(default=None, ge=0, le=1440)
    meal_type: str | None = Field(default=None, max_length=100)
    cuisine: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list)
    allergens: list[str] = Field(default_factory=list)
    dietary_flags: dict[str, Any] = Field(default_factory=dict)
    nutrition_per_serving: NutritionPerServing = Field(
        default_factory=NutritionPerServing
    )
    nutrition_calculation: NutritionCalculation = Field(
        default_factory=NutritionCalculation
    )
    storage: StorageGuidance = Field(default_factory=StorageGuidance)
    source_url: str | None = None
    attribution: str | None = Field(default=None, max_length=500)
    thumbnail_url: str | None = None
    allergen_reviewed: bool = False
    dietary_reviewed: bool = False
    food_safety_confirmed: bool = False


def approval_blockers(
    data: CandidateRecipeData,
    *,
    cloudinary_cloud_name: str | None = None,
) -> list[str]:
    blockers: list[str] = []
    if not data.title or not data.title.strip():
        blockers.append("title")
    if not data.ingredients:
        blockers.append("ingredients")
    elif any(item.quantity is None for item in data.ingredients):
        blockers.append("ingredient_quantities")
    if not data.instructions or any(not step.strip() for step in data.instructions):
        blockers.append("instructions")
    if not data.portions:
        blockers.append("batch_yield")
    if data.meal_type not in PLANNER_MEAL_TYPES:
        blockers.append("meal_type")
    macros = data.nutrition_per_serving
    if (
        macros.calories is None
        or macros.calories <= 0
        or any(
            value is None
            for value in (macros.protein_g, macros.carbs_g, macros.fat_g)
        )
    ):
        blockers.append("per_serving_macros")
    if (
        not data.storage.storage_instructions
        or not data.storage.storage_instructions.strip()
    ):
        blockers.append("storage_instructions")
    if (
        not data.storage.reheating_instructions
        or not data.storage.reheating_instructions.strip()
    ):
        blockers.append("reheating_instructions")
    if not _is_instagram_post_url(data.source_url):
        blockers.append("source_url")
    if not data.attribution or not data.attribution.strip():
        blockers.append("attribution")
    thumbnail_is_trusted = _is_cloudinary_image_url(data.thumbnail_url)
    if thumbnail_is_trusted and cloudinary_cloud_name:
        thumbnail_path = [
            part for part in urlparse(data.thumbnail_url or "").path.split("/") if part
        ]
        thumbnail_is_trusted = thumbnail_path[0] == cloudinary_cloud_name
    if not thumbnail_is_trusted:
        blockers.append("thumbnail")
    if not data.allergen_reviewed:
        blockers.append("allergen_review")
    if not data.dietary_reviewed:
        blockers.append("dietary_review")
    if not data.food_safety_confirmed:
        blockers.append("food_safety_confirmation")
    return blockers


class CandidateUpdate(BaseModel):
    data: CandidateRecipeData


class CandidateResponse(BaseModel):
    id: UUID
    source_post_id: UUID
    creator_id: UUID
    status: CandidateStatus
    data: CandidateRecipeData
    extraction_version: int
    confidence: float | None = None
    duplicate_recipe_ids: list[UUID] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    approved_recipe_id: UUID | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CandidateListResponse(BaseModel):
    items: list[CandidateResponse]
    total: int


class RejectCandidate(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class ReadinessCheck(BaseModel):
    ready: bool
    detail: str


class ReadinessResponse(BaseModel):
    enabled: bool
    ready: bool
    checks: dict[str, ReadinessCheck]


class ExtractionEnvelope(BaseModel):
    recipes: list[CandidateRecipeData] = Field(default_factory=list)

    @model_validator(mode="after")
    def preserve_missing_values(self) -> "ExtractionEnvelope":
        # Numeric omissions are deliberate. Provider prompts and this schema
        # never synthesize quantities, yields, times, or macros.
        return self
