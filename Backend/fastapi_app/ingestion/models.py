from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RecipeCreator(Base):
    __tablename__ = "recipe_creators"
    __table_args__ = (
        UniqueConstraint("instagram_username", name="uq_recipe_creators_username"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    instagram_username: Mapped[str] = mapped_column(String(255), nullable=False)
    profile_url: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    allowed_domains: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    permission_basis: Mapped[str] = mapped_column(Text, nullable=False)
    permission_record_url: Mapped[str | None] = mapped_column(Text)
    permission_confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active", server_default="active"
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    older_cursor: Mapped[str | None] = mapped_column(Text)
    older_exhausted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )


class RecipeImportJob(Base):
    __tablename__ = "recipe_import_jobs"
    __table_args__ = (
        Index("ix_recipe_import_jobs_claim", "status", "created_at"),
        Index(
            "uq_recipe_import_jobs_active_creator",
            "creator_id",
            unique=True,
            postgresql_where=text(
                "status IN ('queued','discovering','processing')"
            ),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    creator_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("recipe_creators.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="queued", server_default="queued"
    )
    mode: Mapped[str] = mapped_column(String(32), nullable=False, default="new")
    requested_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    cursor: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    discovered_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    processed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    candidate_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    failed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    retry_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    cancel_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    error_summary: Mapped[str | None] = mapped_column(Text)
    lease_owner: Mapped[str | None] = mapped_column(String(255))
    lease_token: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RecipeSourcePost(Base):
    __tablename__ = "recipe_source_posts"
    __table_args__ = (
        UniqueConstraint(
            "creator_id", "platform_post_id", name="uq_recipe_source_posts_external"
        ),
        Index("ix_recipe_source_posts_job", "job_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    creator_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_creators.id"), nullable=False
    )
    job_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_import_jobs.id"), nullable=False
    )
    platform_post_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    media_type: Mapped[str | None] = mapped_column(String(64))
    caption: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    cloudinary_thumbnail_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="discovered", server_default="discovered"
    )
    transcript: Mapped[str | None] = mapped_column(Text)
    ocr_text: Mapped[str | None] = mapped_column(Text)
    raw_metadata: Mapped[dict | None] = mapped_column(JSONB)
    error_detail: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class RecipeCandidate(Base):
    __tablename__ = "recipe_candidates"
    __table_args__ = (
        Index("ix_recipe_candidates_review", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    source_post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_source_posts.id"), nullable=False
    )
    creator_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_creators.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="incomplete", server_default="incomplete"
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extraction_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    confidence: Mapped[float | None] = mapped_column(Float)
    duplicate_recipe_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(PGUUID(as_uuid=True)), nullable=False, default=list, server_default="{}"
    )
    approved_recipe_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipes.id")
    )
    reviewed_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class RecipeCandidateExtraction(Base):
    __tablename__ = "recipe_candidate_extractions"
    __table_args__ = (
        UniqueConstraint(
            "candidate_id", "version", name="uq_recipe_candidate_extraction_version"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    candidate_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_candidates.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(255))
    prompt_version: Mapped[str] = mapped_column(
        String(64), nullable=False, default="2026-08-01"
    )
    input_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    output_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RecipeImportWorkerHeartbeat(Base):
    __tablename__ = "recipe_import_worker_heartbeats"

    worker_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    current_job_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("recipe_import_jobs.id")
    )
