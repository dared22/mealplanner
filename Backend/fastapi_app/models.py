from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
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
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    preferences: Mapped[list["Preference"]] = relationship(
        "Preference", back_populates="user", cascade="all, delete-orphan"
    )


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    ingredients: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    instructions: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    nutrition: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    images: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    local_images: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    type: Mapped[Optional[str]] = mapped_column(Text)
    price_tier: Mapped[Optional[str]] = mapped_column(Text)
    url_norm: Mapped[Optional[str]] = mapped_column(Text)
    is_breakfast: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_lunch: Mapped[Optional[bool]] = mapped_column(Boolean)
