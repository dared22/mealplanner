from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Any, Dict, Optional, List

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func, Numeric, SmallInteger
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Preference(Base):
    __tablename__ = "preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    submitted_at: Mapped[str] = mapped_column(
        String(32),
        default=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        nullable=False,
    )

    age: Mapped[Optional[int]] = mapped_column(Integer)
    gender: Mapped[Optional[str]] = mapped_column(String(32))
    height_cm: Mapped[Optional[int]] = mapped_column(Integer)
    weight_kg: Mapped[Optional[int]] = mapped_column(Integer)
    activity_level: Mapped[Optional[str]] = mapped_column(String(64))
    nutrition_goal: Mapped[Optional[str]] = mapped_column(String(64))
    meals_per_day: Mapped[Optional[int]] = mapped_column(Integer)
    budget_range: Mapped[Optional[str]] = mapped_column(String(64))
    cooking_time_preference: Mapped[Optional[str]] = mapped_column(String(64))
    dietary_restrictions: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))
    preferred_cuisines: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))

    raw_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    user: Mapped["User"] = relationship("User", back_populates="preferences")


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    preferences: Mapped[list["Preference"]] = relationship(
        "Preference", back_populates="user", cascade="all, delete-orphan"
    )


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        CheckConstraint(
            "(cost_category IS NULL) OR (cost_category IN ('cheap','medium expensive'))",
            name="recipes_cost_category_check",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    instructions: Mapped[Optional[List[Any]]] = mapped_column(JSONB)
    ingredients: Mapped[Optional[List[Any]]] = mapped_column(JSONB)
    prep_time_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    cook_time_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    total_time_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    yield_qty: Mapped[Optional[Numeric]] = mapped_column(Numeric)
    yield_unit: Mapped[Optional[str]] = mapped_column(Text)
    cuisine: Mapped[Optional[str]] = mapped_column(Text)
    meal_type: Mapped[Optional[str]] = mapped_column(Text)
    dish_type: Mapped[Optional[str]] = mapped_column(Text)
    dietary_flags: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    allergens: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    nutrition: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    cost_per_serving_cents: Mapped[Optional[int]] = mapped_column(Integer)
    cost_category: Mapped[Optional[str]] = mapped_column(String(32))
    equipment: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    difficulty: Mapped[Optional[str]] = mapped_column(Text)
    spice_level: Mapped[Optional[int]] = mapped_column(SmallInteger)
    author: Mapped[Optional[str]] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    popularity_score: Mapped[Optional[float]] = mapped_column(Numeric)
    health_score: Mapped[Optional[float]] = mapped_column(Numeric)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scrape_hash: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    actor_label: Mapped[Optional[str]] = mapped_column(String(255))
    action_type: Mapped[str] = mapped_column(String(255), nullable=False)
    action_detail: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB)
