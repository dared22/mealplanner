import logging
import os
from typing import Any, Dict

from fastapi import Body, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Base, engine, get_session
from models import Preference, User
from planner import generate_meal_plan_for_preference

ENSURE_SCHEMA_ON_STARTUP = os.getenv("ENSURE_SCHEMA_ON_STARTUP", "").lower() in {"1", "true", "yes"}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    message: str
    user_id: int
    email: EmailStr


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

app = FastAPI(title="Meal Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    # Allow optional schema sync for lightweight local setups without Alembic.
    if ENSURE_SCHEMA_ON_STARTUP:
        Base.metadata.create_all(bind=engine)


@app.post("/preferences")
def save_preferences(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
) -> Dict[str, Any]:
    if not payload:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")

    print(f"Incoming preference payload: {payload}")

    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id is required")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    preference = Preference(
        age=payload.get("age"),
        gender=payload.get("gender"),
        height_cm=payload.get("height"),
        weight_kg=payload.get("weight"),
        activity_level=payload.get("activity_level"),
        nutrition_goal=payload.get("nutrition_goal"),
        meals_per_day=payload.get("meals_per_day"),
        budget_range=payload.get("budget_range"),
        cooking_time_preference=payload.get("cooking_time_preference"),
        dietary_restrictions=payload.get("dietary_restrictions") or [],
        preferred_cuisines=payload.get("preferred_cuisines") or [],
        raw_data=payload,
        user=user,
    )

    db.add(preference)
    db.commit()
    db.refresh(preference)

    try:
        plan_text = generate_meal_plan_for_preference(db, preference.id)
    except ValueError:
        logger.exception("Preference %s disappeared before plan generation", preference.id)
    except Exception:
        logger.exception("Meal plan generation failed for user_id=%s", user_id)
    else:
        print(f"Generated meal plan for user {user_id}:\n{plan_text}")

    return {"id": preference.id, "stored": True}


@app.get("/preferences/{pref_id}")
def get_preferences(pref_id: int, db: Session = Depends(get_session)) -> Dict[str, Any]:
    entry = db.get(Preference, pref_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return {
        "id": entry.id,
        "submitted_at": entry.submitted_at,
        "age": entry.age,
        "gender": entry.gender,
        "height_cm": entry.height_cm,
        "weight_kg": entry.weight_kg,
        "activity_level": entry.activity_level,
        "nutrition_goal": entry.nutrition_goal,
        "meals_per_day": entry.meals_per_day,
        "budget_range": entry.budget_range,
        "cooking_time_preference": entry.cooking_time_preference,
        "dietary_restrictions": entry.dietary_restrictions,
        "preferred_cuisines": entry.preferred_cuisines,
        "raw_data": entry.raw_data,
        "user_id": entry.user_id,
    }


@app.post("/auth/register", status_code=status.HTTP_201_CREATED, response_model=AuthResponse)
def register_user(payload: AuthRequest, db: Session = Depends(get_session)) -> AuthResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(message="User registered", user_id=user.id, email=user.email)


@app.post("/auth/login", response_model=AuthResponse)
def login_user(payload: AuthRequest, db: Session = Depends(get_session)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(message="Login successful", user_id=user.id, email=user.email)


@app.get("/users/{user_id}/preferences")
def list_user_preferences(user_id: int, db: Session = Depends(get_session)) -> Dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    entries = db.scalars(select(Preference).where(Preference.user_id == user_id)).all()
    return {
        "user_id": user_id,
        "preferences": [
            {
                "id": entry.id,
                "submitted_at": entry.submitted_at,
                "raw_data": entry.raw_data,
            }
            for entry in entries
        ],
    }
