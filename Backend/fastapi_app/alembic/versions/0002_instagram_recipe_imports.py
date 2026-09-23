"""Add the reviewed Instagram recipe-import workflow."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_instagram_imports"
down_revision = "0001_existing_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_creators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("instagram_username", sa.String(255), nullable=False),
        sa.Column("profile_url", sa.Text(), nullable=False),
        sa.Column("display_name", sa.String(255)),
        sa.Column("allowed_domains", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("permission_basis", sa.Text(), nullable=False),
        sa.Column("permission_record_url", sa.Text()),
        sa.Column("permission_confirmed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True)),
        sa.Column("older_cursor", sa.Text()),
        sa.Column("older_exhausted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.UniqueConstraint("instagram_username", name="uq_recipe_creators_username"),
    )
    op.create_table(
        "recipe_import_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_creators.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("mode", sa.String(32), nullable=False, server_default="new"),
        sa.Column("requested_limit", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("cursor", sa.Text()),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("discovered_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("candidate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("error_summary", sa.Text()),
        sa.Column("lease_owner", sa.String(255)),
        sa.Column("lease_token", postgresql.UUID(as_uuid=True)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_recipe_import_jobs_creator_id", "recipe_import_jobs", ["creator_id"])
    op.create_index("ix_recipe_import_jobs_claim", "recipe_import_jobs", ["status", "created_at"])
    op.create_index(
        "uq_recipe_import_jobs_active_creator",
        "recipe_import_jobs",
        ["creator_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued','discovering','processing')"),
    )
    op.create_table(
        "recipe_source_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_creators.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_import_jobs.id"), nullable=False),
        sa.Column("platform_post_id", sa.String(255), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("media_type", sa.String(64)),
        sa.Column("caption", sa.Text()),
        sa.Column("thumbnail_url", sa.Text()),
        sa.Column("cloudinary_thumbnail_url", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False, server_default="discovered"),
        sa.Column("transcript", sa.Text()),
        sa.Column("ocr_text", sa.Text()),
        sa.Column("raw_metadata", postgresql.JSONB()),
        sa.Column("error_detail", sa.Text()),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("creator_id", "platform_post_id", name="uq_recipe_source_posts_external"),
    )
    op.create_index("ix_recipe_source_posts_job", "recipe_source_posts", ["job_id"])
    op.create_table(
        "recipe_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_source_posts.id"), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_creators.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="incomplete"),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("extraction_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("confidence", sa.Float()),
        sa.Column("duplicate_recipe_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default="{}"),
        sa.Column("approved_recipe_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id")),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_recipe_candidates_review", "recipe_candidates", ["status", "created_at"])
    op.create_table(
        "recipe_candidate_extractions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_candidates.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("model_name", sa.String(255)),
        sa.Column("prompt_version", sa.String(64), nullable=False, server_default="2026-08-01"),
        sa.Column("input_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("output_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("candidate_id", "version", name="uq_recipe_candidate_extraction_version"),
    )
    op.create_table(
        "recipe_import_worker_heartbeats",
        sa.Column("worker_id", sa.String(255), primary_key=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("current_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_import_jobs.id")),
    )

    op.add_column("recipes", sa.Column("source_kind", sa.String(32), nullable=True, server_default="legacy_matprat"))
    op.execute("UPDATE recipes SET source_kind = 'legacy_matprat' WHERE source_kind IS NULL")
    op.alter_column("recipes", "source_kind", nullable=False)
    op.add_column("recipes", sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_creators.id")))
    op.add_column("recipes", sa.Column("source_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipe_source_posts.id")))
    op.add_column("recipes", sa.Column("storage_guidance", postgresql.JSONB()))
    op.add_column("recipes", sa.Column("attribution", sa.Text()))
    # Legacy databases created through SQLAlchemy never had this constraint,
    # while fresh databases created by the baseline do. Support both paths.
    op.execute("ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_source_url_key")
    op.create_index("ix_recipes_source_url", "recipes", ["source_url"])
    op.create_index("ix_recipes_creator_id", "recipes", ["creator_id"])


def downgrade() -> None:
    raise RuntimeError(
        "The Instagram importer migration is irreversible because one source "
        "post can publish multiple recipes. Restore a database backup instead."
    )
