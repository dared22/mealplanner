"""Baseline the schema that predates managed migrations.

Existing environments must be stamped at this revision once, after a restore
point is taken. Fresh databases can run it normally.
"""

from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from models import VectorType


revision = "0001_existing_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not context.is_offline_mode():
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        if inspector.has_table("recipes"):
            raise RuntimeError(
                "Existing schema detected. Take a Neon restore point, then use "
                "the guarded ingestion.migrate baseline-adoption flow."
            )

    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(255), nullable=False, unique=True),
        sa.Column("clerk_user_id", sa.String(255), unique=True),
        sa.Column("email", sa.String(255), unique=True),
        sa.Column("password_hash", sa.String(255)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_table(
        "recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("source_url", sa.Text(), unique=True),
        sa.Column("image_url", sa.Text()),
        sa.Column("description", sa.Text()),
        sa.Column("instructions", postgresql.JSONB()),
        sa.Column("ingredients", postgresql.JSONB()),
        sa.Column("prep_time_minutes", sa.Integer()),
        sa.Column("cook_time_minutes", sa.Integer()),
        sa.Column("total_time_minutes", sa.Integer()),
        sa.Column("portions", sa.Integer()),
        sa.Column("cuisine", sa.Text()),
        sa.Column("meal_type", sa.Text()),
        sa.Column("dish_type", sa.Text()),
        sa.Column("dietary_flags", postgresql.JSONB()),
        sa.Column("allergens", postgresql.ARRAY(sa.Text())),
        sa.Column("nutrition", postgresql.JSONB()),
        sa.Column("cost_per_serving_cents", sa.Integer()),
        sa.Column("cost_category", sa.String(32)),
        sa.Column("equipment", postgresql.ARRAY(sa.Text())),
        sa.Column("difficulty", sa.Text()),
        sa.Column("spice_level", sa.SmallInteger()),
        sa.Column("author", sa.Text()),
        sa.Column("language", sa.Text()),
        sa.Column("tags", postgresql.ARRAY(sa.Text())),
        sa.Column("embedding", VectorType(1536)),
        sa.Column("category", sa.Text()),
        sa.Column("rating", sa.Numeric()),
        sa.Column("popularity_score", sa.Numeric()),
        sa.Column("health_score", sa.Numeric()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("scraped_at", sa.DateTime(timezone=True)),
        sa.Column("scrape_hash", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.CheckConstraint(
            "(cost_category IS NULL) OR "
            "(cost_category IN ('cheap','medium expensive'))",
            name="recipes_cost_category_check",
        ),
    )
    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("actor_type", sa.String(32), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("actor_label", sa.String(255)),
        sa.Column("action_type", sa.String(255), nullable=False),
        sa.Column("action_detail", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_table(
        "preferences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("submitted_at", sa.String(32), nullable=False),
        sa.Column("age", sa.Integer()),
        sa.Column("gender", sa.String(32)),
        sa.Column("height_cm", sa.Integer()),
        sa.Column("weight_kg", sa.Integer()),
        sa.Column("activity_level", sa.String(64)),
        sa.Column("nutrition_goal", sa.String(64)),
        sa.Column("meals_per_day", sa.Integer()),
        sa.Column("budget_range", sa.String(64)),
        sa.Column("cooking_time_preference", sa.String(64)),
        sa.Column("dietary_restrictions", postgresql.ARRAY(sa.String())),
        sa.Column("preferred_cuisines", postgresql.ARRAY(sa.String())),
        sa.Column("raw_data", postgresql.JSONB(), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
    )
    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id"),
            nullable=False,
        ),
        sa.Column("is_liked", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "recipe_id", name="uq_user_recipe_rating"),
    )
    op.create_table(
        "plan_recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "preference_id",
            sa.Integer(),
            sa.ForeignKey("preferences.id"),
            nullable=False,
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id"),
            nullable=False,
        ),
        sa.Column("day_name", sa.String(16)),
        sa.Column("meal_type", sa.String(16)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_plan_recipes_preference_id", "plan_recipes", ["preference_id"]
    )


def downgrade() -> None:
    for table in (
        "plan_recipes",
        "ratings",
        "preferences",
        "activity_logs",
        "recipes",
        "users",
    ):
        op.drop_table(table)
