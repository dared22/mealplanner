import logging
import os
from typing import Any, Dict, Optional

from fastapi import BackgroundTasks, Body, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

from database import Base, SessionLocal, engine, get_session
from models import Preference, User
from planner import generate_meal_plan_for_preference
from recipe_translator import PlanTranslator

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

LANGUAGE_LABELS = {
    "en": "English",
    "no": "Norwegian",
    "nb": "Norwegian",
    "nn": "Norwegian",
}


def _normalize_language(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = str(value).strip().lower()
    if normalized.startswith("en"):
        return "en"
    if normalized.startswith(("no", "nb", "nn")):
        return "no"
    return normalized


def _language_label(code: str) -> str:
    return LANGUAGE_LABELS.get(code, code)


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]

    item_fn = getattr(value, "item", None)
    if callable(item_fn):
        try:
            return _json_safe(item_fn())
        except Exception:
            pass

    tolist_fn = getattr(value, "tolist", None)
    if callable(tolist_fn):
        try:
            return _json_safe(tolist_fn())
        except Exception:
            pass

    return str(value)


def _persist_plan_result(db: Session, preference: Preference, plan_result: Dict[str, Any]) -> None:
    existing_raw = preference.raw_data if isinstance(preference.raw_data, dict) else {}
    updated_raw = dict(existing_raw)
    updated_raw["generated_plan"] = _json_safe(plan_result)
    updated_raw["generated_plan"] = _json_safe(plan_result)
    preference.raw_data = updated_raw
    db.add(preference)
    db.commit()
    db.refresh(preference)


def _translate_plan_in_background(pref_id: int, lang: str) -> None:
    db = SessionLocal()
    try:
        entry = db.get(Preference, pref_id)
        if entry is None:
            logger.warning("Preference %s missing when translating plan", pref_id)
            return

        raw_data = entry.raw_data if isinstance(entry.raw_data, dict) else {}
        generated_plan = raw_data.get("generated_plan") if isinstance(raw_data, dict) else None
        plan_payload = generated_plan.get("plan") if isinstance(generated_plan, dict) else None
        if not plan_payload:
            logger.warning("No plan available to translate for preference %s", pref_id)
            return

        translator = PlanTranslator(target_language=_language_label(lang))
        translation = translator.translate_plan(plan_payload)

        translations = raw_data.get("generated_plan_translations")
        if not isinstance(translations, dict):
            translations = {}
        status_map = raw_data.get("generated_plan_translations_status")
        if not isinstance(status_map, dict):
            status_map = {}
        error_map = raw_data.get("generated_plan_translations_error")
        if not isinstance(error_map, dict):
            error_map = {}

        if translation.error:
            status_map[lang] = "error"
            error_map[lang] = translation.error
        else:
            translations[lang] = translation.data
            status_map[lang] = "success"
            if lang in error_map:
                error_map.pop(lang)

        updated_raw = dict(raw_data)
        updated_raw["generated_plan_translations"] = _json_safe(translations)
        updated_raw["generated_plan_translations_status"] = _json_safe(status_map)
        if error_map:
            updated_raw["generated_plan_translations_error"] = _json_safe(error_map)
        entry.raw_data = updated_raw
        db.add(entry)
        db.commit()
        db.refresh(entry)
        logger.info("Translated plan for preference %s to %s", pref_id, lang)
    except Exception:
        logger.exception("Failed to translate plan for preference %s", pref_id)
        db.rollback()
    finally:
        db.close()


def _generate_plan_in_background(pref_id: int) -> None:
    db = SessionLocal()
    try:
        try:
            plan_result = generate_daily_plan_for_preference(db, pref_id)
        except ValueError:
            logger.exception("Preference %s disappeared before plan generation", pref_id)
            return
        except Exception as exc:
            logger.exception("Meal plan generation failed for preference %s", pref_id)
            plan_result = {"plan": None, "raw_text": None, "error": str(exc)}

        preference = db.get(Preference, pref_id)
        if preference is None:
            logger.warning("Preference %s missing when storing generated plan", pref_id)
            return

        _persist_plan_result(db, preference, plan_result)
        logger.info("Generated meal plan for preference %s", pref_id)
    except Exception:
        logger.exception("Failed to update raw_data with generated plan for preference %s", pref_id)
        db.rollback()
    finally:
        db.close()

default_allowed_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://mealplanner-frontend-cc0005e5d9b0.herokuapp.com",
}
allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS")
allowed_origin_regex = os.getenv("CORS_ALLOWED_ORIGIN_REGEX")
frontend_url = os.getenv("FRONTEND_URL")

allowed_origins = set(default_allowed_origins)
if allowed_origins_env:
    allowed_origins.update(
        origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()
    )
if frontend_url:
    allowed_origins.add(frontend_url.strip().rstrip("/"))

cors_kwargs = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if allowed_origin_regex:
    cors_kwargs["allow_origin_regex"] = allowed_origin_regex
else:
    cors_kwargs["allow_origins"] = sorted(allowed_origins)

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs,
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
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(_generate_plan_in_background, preference.id)

    return {
        "id": preference.id,
        "stored": True,
        "plan": None,
        "raw_plan": None,
        "error": None,
        "plan_status": "pending",
    }


@app.get("/preferences/{pref_id}")
def get_preferences(
    pref_id: int,
    background_tasks: BackgroundTasks,
    lang: Optional[str] = None,
    db: Session = Depends(get_session),
) -> Dict[str, Any]:
    entry = db.get(Preference, pref_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Preferences not found")

    raw_data = entry.raw_data if isinstance(entry.raw_data, dict) else {}
    generated_plan = raw_data.get("generated_plan") if isinstance(raw_data, dict) else None
    plan_payload = generated_plan.get("plan") if isinstance(generated_plan, dict) else None
    raw_plan_text = generated_plan.get("raw_text") if isinstance(generated_plan, dict) else None
    plan_error = generated_plan.get("error") if isinstance(generated_plan, dict) else None
    if generated_plan is None:
        plan_status = "pending"
    elif plan_payload:
        plan_status = "success"
    else:
        plan_status = "error"
        if not plan_error:
            plan_error = "Plan generation completed without a usable plan."

    translation_status = None
    translation_error = None
    normalized_lang = _normalize_language(lang)
    if plan_payload and normalized_lang:
        pref_lang = _normalize_language(
            raw_data.get("language") or raw_data.get("lang")
        )
        if pref_lang and pref_lang == normalized_lang:
            translation_status = "success"
        else:
            translations = raw_data.get("generated_plan_translations")
            if not isinstance(translations, dict):
                translations = {}
            status_map = raw_data.get("generated_plan_translations_status")
            if not isinstance(status_map, dict):
                status_map = {}
            error_map = raw_data.get("generated_plan_translations_error")
            if not isinstance(error_map, dict):
                error_map = {}

            if normalized_lang in translations:
                plan_payload = translations.get(normalized_lang)
                translation_status = "success"
            else:
                existing_status = status_map.get(normalized_lang)
                if existing_status == "error":
                    translation_status = "error"
                    translation_error = error_map.get(normalized_lang)
                else:
                    translation_status = "pending"
                    if existing_status != "pending":
                        status_map[normalized_lang] = "pending"
                        updated_raw = dict(raw_data)
                        updated_raw["generated_plan_translations_status"] = _json_safe(status_map)
                        entry.raw_data = updated_raw
                        db.add(entry)
                        db.commit()
                        db.refresh(entry)
                        if background_tasks is not None:
                            background_tasks.add_task(
                                _translate_plan_in_background,
                                entry.id,
                                normalized_lang,
                            )

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
        "plan_status": plan_status,
        "plan": plan_payload,
        "raw_plan": raw_plan_text,
        "error": plan_error,
        "translation_status": translation_status,
        "translation_error": translation_error,
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
