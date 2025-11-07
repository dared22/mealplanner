import logging
import os
from typing import Any, Dict, Optional

from fastapi import Body, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

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


class SessionResponse(BaseModel):
    user_id: int
    email: EmailStr


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def normalize_email(value: str) -> str:
    return value.strip().lower()

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "mealplanner_session")
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "please-change-me")
SESSION_COOKIE_MAX_AGE = int(os.getenv("SESSION_COOKIE_MAX_AGE", str(60 * 60 * 24 * 7)))  # 7 days default
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax")

def _get_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(SESSION_SECRET_KEY, salt="mealplanner-session")


def create_session_token(user_id: int) -> str:
    serializer = _get_serializer()
    return serializer.dumps({"user_id": user_id})


def decode_session_token(token: str) -> Optional[int]:
    serializer = _get_serializer()
    try:
        data = serializer.loads(token, max_age=SESSION_COOKIE_MAX_AGE)
    except (BadSignature, BadTimeSignature):
        return None
    return int(data.get("user_id")) if isinstance(data, dict) and data.get("user_id") is not None else None


def set_session_cookie(response: Response, user_id: int) -> None:
    token = create_session_token(user_id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE,
        expires=SESSION_COOKIE_MAX_AGE,
        path="/",
        secure=SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=SESSION_COOKIE_SAMESITE,  
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def optional_current_user(
    request: Request,
    db: Session = Depends(get_session),
) -> Optional[User]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    user_id = decode_session_token(token)
    if user_id is None:
        return None

    return db.get(User, user_id)


def current_user_dependency(
    user: Optional[User] = Depends(optional_current_user),
) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


app = FastAPI(title="Meal Planner API")

allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allowed_origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    if ENSURE_SCHEMA_ON_STARTUP:
        Base.metadata.create_all(bind=engine)


@app.post("/preferences")
def save_preferences(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(optional_current_user),
) -> Dict[str, Any]:
    if not payload:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")

    user_id = payload.get("user_id")
    if current_user is not None:
        if user_id is None:
            user_id = current_user.id
            payload["user_id"] = user_id
        elif user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot submit preferences for another user")

    user = db.get(User, user_id) if user_id is not None else None
    if user_id is not None and user is None:
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

    plan_result: Optional[Dict[str, Any]] = None
    try:
        plan_result = generate_meal_plan_for_preference(db, preference.id)
    except ValueError:
        logger.exception("Preference %s disappeared before plan generation", preference.id)
    except Exception:
        logger.exception("Meal plan generation failed for user_id=%s", user_id)
    else:
        if plan_result:
            try:
                existing_raw = preference.raw_data or {}
                existing_raw["generated_plan"] = plan_result
                preference.raw_data = existing_raw
                db.add(preference)
                db.commit()
                db.refresh(preference)
            except Exception:
                logger.exception("Failed to update raw_data with generated plan for preference %s", preference.id)
        logger.info("Generated meal plan for user %s", user_id)

    plan_payload = plan_result.get("plan") if isinstance(plan_result, dict) else None
    raw_plan_text = plan_result.get("raw_text") if isinstance(plan_result, dict) else None

    return {
        "id": preference.id,
        "stored": True,
        "plan": plan_payload,
        "raw_plan": raw_plan_text,
    }


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
def register_user(
    payload: AuthRequest,
    response: Response,
    db: Session = Depends(get_session),
) -> AuthResponse:
    normalized_email = normalize_email(payload.email)
    existing_user = db.scalar(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(email=normalized_email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    set_session_cookie(response, user.id)

    return AuthResponse(message="User registered", user_id=user.id, email=user.email)


@app.post("/auth/login", response_model=AuthResponse)
def login_user(
    payload: AuthRequest,
    response: Response,
    db: Session = Depends(get_session),
) -> AuthResponse:
    normalized_email = normalize_email(payload.email)
    user = db.scalar(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    set_session_cookie(response, user.id)

    return AuthResponse(message="Login successful", user_id=user.id, email=user.email)


@app.post("/auth/profile-info", response_model=AuthResponse)
def fetch_profile_info(
    payload: AuthRequest,
    db: Session = Depends(get_session),
) -> AuthResponse:
    """
    Secondary lookup endpoint that lets the client confirm the user id/email
    using the supplied credentials. This is useful when cross-site cookies
    prevent us from reading the session immediately after login.
    """
    normalized_email = normalize_email(payload.email)
    user = db.scalar(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        message="Profile lookup successful",
        user_id=user.id,
        email=user.email,
    )


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_user(response: Response) -> None:
    clear_session_cookie(response)


@app.get("/auth/session", response_model=SessionResponse)
def get_active_session(user: User = Depends(current_user_dependency)) -> SessionResponse:
    return SessionResponse(user_id=user.id, email=user.email)


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
