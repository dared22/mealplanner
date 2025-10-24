"""initial

Revision ID: 66d901937a71
Revises: 
Create Date: 2025-09-30 15:39:54.159329
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '66d901937a71'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.UniqueConstraint("email", name="uq_users_email"),
        )
        existing_tables.add("users")

    if "preferences" not in existing_tables:
        op.create_table(
            "preferences",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("submitted_at", sa.String(length=32), nullable=False),
            sa.Column("age", sa.Integer(), nullable=True),
            sa.Column("gender", sa.String(length=32), nullable=True),
            sa.Column("height_cm", sa.Integer(), nullable=True),
            sa.Column("weight_kg", sa.Integer(), nullable=True),
            sa.Column("activity_level", sa.String(length=64), nullable=True),
            sa.Column("nutrition_goal", sa.String(length=64), nullable=True),
            sa.Column("meals_per_day", sa.Integer(), nullable=True),
            sa.Column("budget_range", sa.String(length=64), nullable=True),
            sa.Column("cooking_time_preference", sa.String(length=64), nullable=True),
            sa.Column("dietary_restrictions", postgresql.ARRAY(sa.String()), nullable=True),
            sa.Column("preferred_cuisines", postgresql.ARRAY(sa.String()), nullable=True),
            sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "preferences" in existing_tables:
        op.drop_table("preferences")

    if "users" in existing_tables:
        op.drop_table("users")
