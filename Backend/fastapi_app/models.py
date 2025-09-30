from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

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
