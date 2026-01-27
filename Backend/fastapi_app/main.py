import logging
import os
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import Any, Dict, Optional, Literal

from fastapi import BackgroundTasks, Body, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from clerk_auth import (
    extract_primary_email,
    extract_username,
    get_session_token,
    verify_session_token,
)
from database import Base, SessionLocal, engine, get_session
from models import Preference, Recipe, User
from planner import generate_daily_plan_for_preference
from recipe_translator import PlanTranslator

ENSURE_SCHEMA_ON_STARTUP = os.getenv("ENSURE_SCHEMA_ON_STARTUP", "").lower() in {"1", "true", "yes"}

logger = logging.getLogger(__name__)


class SessionResponse(BaseModel):
    user_id: UUID
    clerk_user_id: str
    email: Optional[EmailStr] = None
    username: str


class AdminSessionResponse(BaseModel):
    user_id: UUID
    clerk_user_id: str
    email: Optional[EmailStr] = None
    username: str
    is_admin: bool


class GrowthStat(BaseModel):
    total: int
    current_week: int
    previous_week: int
    wow_percent: float


class HealthStatus(BaseModel):
    status: Literal["healthy", "degraded"]
    checks: Dict[str, str]


class DashboardMetricsResponse(BaseModel):
    users: GrowthStat
    recipes: GrowthStat
    health: HealthStatus


class AdminUserSummary(BaseModel):
    id: UUID
    username: str
    email: Optional[EmailStr] = None
    created_at: datetime
    is_admin: bool
    is_active: bool


class AdminPagination(BaseModel):
    total: int
    limit: int
    offset: int


class AdminUserListResponse(BaseModel):
    items: list[AdminUserSummary]
    pagination: AdminPagination


class AdminRecipeSummary(BaseModel):
    id: UUID
    title: str
    slug: str
    meal_type: Optional[str] = None
    tags: list[str]
    is_active: bool
    created_at: Optional[datetime] = None


class AdminRecipeDetail(BaseModel):
    id: UUID
    title: str
    slug: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[list[Any]] = None
    ingredients: Optional[list[Any]] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    total_time_minutes: Optional[int] = None
    yield_qty: Optional[float] = None
    yield_unit: Optional[str] = None
    cuisine: Optional[str] = None
    meal_type: Optional[str] = None
    dish_type: Optional[str] = None
    dietary_flags: Optional[Dict[str, Any]] = None
    allergens: Optional[list[str]] = None
    nutrition: Optional[Dict[str, Any]] = None
    cost_per_serving_cents: Optional[int] = None
    equipment: Optional[list[str]] = None
    difficulty: Optional[str] = None
    spice_level: Optional[int] = None
    author: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[list[str]] = None
    popularity_score: Optional[float] = None
    health_score: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    scraped_at: Optional[datetime] = None
    scrape_hash: Optional[str] = None
    is_active: bool


class AdminRecipeListResponse(BaseModel):
    items: list[AdminRecipeSummary]
    pagination: AdminPagination
class AdminPreferenceSummary(BaseModel):
    id: int
    submitted_at: str
    raw_data: Dict[str, Any]
    plan_status: str


class AdminUserDetailResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[EmailStr] = None
    clerk_user_id: Optional[str] = None
    created_at: datetime
    is_admin: bool
    is_active: bool
    preferences: list[AdminPreferenceSummary]


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


def optional_current_user(
    request: Request,
    db: Session = Depends(get_session),
) -> Optional[User]:
    token = get_session_token(request)
    if not token:
        return None

    payload = verify_session_token(token)
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")

    preferred_username = extract_username(payload)

    user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    if user is not None:
        if not user.username:
            user.username = _generate_username(db, user.email, clerk_user_id, preferred_username)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            _maybe_update_username(db, user, preferred_username)
        return user

    email = extract_primary_email(payload)
    if email:
        existing = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
        if existing is not None:
            existing.clerk_user_id = clerk_user_id
            if not existing.username:
                existing.username = _generate_username(db, existing.email, clerk_user_id, preferred_username)
            else:
                _maybe_update_username(db, existing, preferred_username)
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing

    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        username=_generate_username(db, email, clerk_user_id, preferred_username),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def current_user_dependency(
    user: Optional[User] = Depends(optional_current_user),
) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    return user


def admin_user_dependency(
    user: User = Depends(current_user_dependency),
) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
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


def _slugify_username_seed(seed: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", seed.lower()).strip("_")
    return cleaned or "user"


def _generate_username(
    db: Session,
    email: Optional[str],
    clerk_user_id: Optional[str],
    preferred_username: Optional[str] = None,
) -> str:
    seeds: list[str] = []
    if preferred_username:
        seeds.append(preferred_username.strip())
    if email:
        seeds.append(email.split("@")[0])
    if clerk_user_id:
        seeds.append(clerk_user_id)
    seeds.append("user")

    for seed in seeds:
        if preferred_username and seed == preferred_username.strip() and seed:
            base = seed
        else:
            base = _slugify_username_seed(seed)
        candidate = base
        suffix = 1
        while db.scalar(select(User.id).where(User.username == candidate)) is not None:
            suffix += 1
            candidate = f"{base}_{suffix}"
            if suffix > 50:
                break
        if candidate:
            return candidate

    return f"user_{uuid4().hex[:8]}"


def _maybe_update_username(
    db: Session,
    user: User,
    preferred_username: Optional[str],
) -> None:
    if not preferred_username:
        return

    desired = _generate_username(db, user.email, user.clerk_user_id, preferred_username)
    if desired != user.username:
        user.username = desired
        db.add(user)
        db.commit()
        db.refresh(user)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _plan_status_from_raw_data(raw_data: Any) -> str:
    if not isinstance(raw_data, dict):
        return "pending"
    generated_plan = raw_data.get("generated_plan")
    if not isinstance(generated_plan, dict):
        return "pending"
    if generated_plan.get("plan"):
        return "success"
    return "error"


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
    preference.raw_data = updated_raw
    db.add(preference)
    db.commit()
    db.refresh(preference)


def _flatten_ingredients(value: Any) -> list[str]:
    items: list[str] = []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple)):
        for item in value:
            if isinstance(item, dict):
                text = item.get("original_text") or item.get("name")
                if text:
                    items.append(str(text))
            elif item is not None:
                items.append(str(item))
    return items


def _recipe_to_dict(recipe: Recipe) -> Dict[str, Any]:
    """Normalize a Recipe ORM object into a JSON-serializable dict."""
    nutrition = recipe.nutrition if isinstance(recipe.nutrition, dict) else {}
    calories = nutrition.get("calories") or nutrition.get("calories_kcal")

    primary_image = recipe.image_url
    images = [recipe.image_url] if recipe.image_url else []

    meal_type = (recipe.meal_type or "").lower()
    is_breakfast = meal_type == "breakfast"
    is_lunch = meal_type == "lunch"

    payload = {
        "id": recipe.id,
        "name": recipe.title,
        "url": recipe.source_url,
        "source": recipe.author or "unknown",
        "type": recipe.dish_type,
        "price_tier": None,
        "tags": recipe.tags or [],
        "ingredients": _flatten_ingredients(recipe.ingredients) if recipe.ingredients else [],
        "instructions": recipe.instructions or [],
        "images": images,
        "local_images": [],
        "image": primary_image,
        "nutrition": {
            "calories": calories,
            "protein_g": nutrition.get("protein_g"),
            "carbs_g": nutrition.get("carbs_g"),
            "fat_g": nutrition.get("fat_g"),
        },
        "is_breakfast": is_breakfast,
        "is_lunch": is_lunch,
    }
    return _json_safe(payload)


def _admin_recipe_summary(recipe: Recipe) -> AdminRecipeSummary:
    return AdminRecipeSummary(
        id=recipe.id,
        title=recipe.title,
        slug=recipe.slug,
        meal_type=recipe.meal_type,
        tags=recipe.tags or [],
        is_active=recipe.is_active,
        created_at=recipe.created_at,
    )


def _admin_recipe_detail(recipe: Recipe) -> AdminRecipeDetail:
    return AdminRecipeDetail(
        id=recipe.id,
        title=recipe.title,
        slug=recipe.slug,
        source_url=recipe.source_url,
        image_url=recipe.image_url,
        description=recipe.description,
        instructions=_json_safe(recipe.instructions),
        ingredients=_json_safe(recipe.ingredients),
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        total_time_minutes=recipe.total_time_minutes,
        yield_qty=_json_safe(recipe.yield_qty),
        yield_unit=recipe.yield_unit,
        cuisine=recipe.cuisine,
        meal_type=recipe.meal_type,
        dish_type=recipe.dish_type,
        dietary_flags=_json_safe(recipe.dietary_flags),
        allergens=_json_safe(recipe.allergens),
        nutrition=_json_safe(recipe.nutrition),
        cost_per_serving_cents=recipe.cost_per_serving_cents,
        equipment=_json_safe(recipe.equipment),
        difficulty=recipe.difficulty,
        spice_level=recipe.spice_level,
        author=recipe.author,
        language=recipe.language,
        tags=_json_safe(recipe.tags),
        popularity_score=_json_safe(recipe.popularity_score),
        health_score=_json_safe(recipe.health_score),
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        scraped_at=recipe.scraped_at,
        scrape_hash=recipe.scrape_hash,
        is_active=recipe.is_active,
    )


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
    current_user: User = Depends(current_user_dependency),
) -> Dict[str, Any]:
    if not payload:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")

    user_id = payload.get("user_id")
    if user_id is not None:
        try:
            provided_id = UUID(str(user_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid user_id format") from exc
        if provided_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot submit preferences for another user")

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
        user=current_user,
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
        generated_plan_language = None
        if isinstance(generated_plan, dict):
            generated_plan_language = _normalize_language(generated_plan.get("language"))
        base_lang = generated_plan_language or _normalize_language(
            raw_data.get("language") or raw_data.get("lang")
        )
        if base_lang and base_lang == normalized_lang:
            translation_status = "success"
        elif base_lang is None and normalized_lang == "no":
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


@app.get("/auth/session", response_model=SessionResponse)
def get_active_session(user: User = Depends(current_user_dependency)) -> SessionResponse:
    return SessionResponse(
        user_id=user.id,
        clerk_user_id=user.clerk_user_id or "",
        email=user.email,
        username=user.username,
    )


@app.get("/admin/session", response_model=AdminSessionResponse)
def get_admin_session(user: User = Depends(admin_user_dependency)) -> AdminSessionResponse:
    return AdminSessionResponse(
        user_id=user.id,
        clerk_user_id=user.clerk_user_id or "",
        email=user.email,
        username=user.username,
        is_admin=user.is_admin,
    )


def _wow_percent(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return float(round(((current - previous) / previous) * 100))


@app.get("/admin/dashboard/metrics", response_model=DashboardMetricsResponse)
def get_admin_dashboard_metrics(
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> DashboardMetricsResponse:
    now = datetime.now(timezone.utc)
    current_week_start = now - timedelta(days=7)
    previous_week_start = now - timedelta(days=14)

    try:
        total_users = db.scalar(select(func.count(User.id))) or 0
        users_current_week = (
            db.scalar(select(func.count(User.id)).where(User.created_at >= current_week_start)) or 0
        )
        users_previous_week = (
            db.scalar(
                select(func.count(User.id)).where(
                    User.created_at >= previous_week_start, User.created_at < current_week_start
                )
            )
            or 0
        )

        total_recipes = db.scalar(select(func.count(Recipe.id))) or 0
        recipes_current_week = (
            db.scalar(
                select(func.count(Recipe.id)).where(
                    Recipe.created_at >= current_week_start
                )
            )
            or 0
        )
        recipes_previous_week = (
            db.scalar(
                select(func.count(Recipe.id)).where(
                    Recipe.created_at >= previous_week_start,
                    Recipe.created_at < current_week_start,
                )
            )
            or 0
        )
        recipes_wow = _wow_percent(recipes_current_week, recipes_previous_week)

        health = HealthStatus(status="healthy", checks={"database": "ok"})
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.exception("Failed to compute admin dashboard metrics: %s", exc)
        total_users = users_current_week = users_previous_week = 0
        total_recipes = recipes_current_week = recipes_previous_week = 0
        recipes_wow = 0.0
        health = HealthStatus(status="degraded", checks={"database": "error"})

    return DashboardMetricsResponse(
        users=GrowthStat(
            total=total_users,
            current_week=users_current_week,
            previous_week=users_previous_week,
            wow_percent=_wow_percent(users_current_week, users_previous_week),
        ),
        recipes=GrowthStat(
            total=total_recipes,
            current_week=recipes_current_week,
            previous_week=recipes_previous_week,
            wow_percent=recipes_wow,
        ),
        health=health,
    )


@app.get("/admin/users", response_model=AdminUserListResponse)
def list_admin_users(
    search: Optional[str] = Query(None, description="Match username or email (case-insensitive)"),
    start_date: Optional[datetime] = Query(None, description="Filter by signup date (UTC)"),
    end_date: Optional[datetime] = Query(None, description="Filter by signup date (UTC)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminUserListResponse:
    filters = []
    if search:
        normalized = search.strip()
        if normalized:
            pattern = f"%{normalized}%"
            filters.append(or_(User.username.ilike(pattern), User.email.ilike(pattern)))

    if start_date:
        filters.append(User.created_at >= _ensure_utc(start_date))
    if end_date:
        filters.append(User.created_at <= _ensure_utc(end_date))

    base_stmt = select(User)
    if filters:
        base_stmt = base_stmt.where(*filters)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    users = db.scalars(
        base_stmt.order_by(User.created_at.desc().nullslast(), User.username)
        .offset(offset)
        .limit(limit)
    ).all()

    return AdminUserListResponse(
        items=[
            AdminUserSummary(
                id=user.id,
                username=user.username,
                email=user.email,
                created_at=user.created_at,
                is_admin=user.is_admin,
                is_active=user.is_active,
            )
            for user in users
        ],
        pagination=AdminPagination(total=total, limit=limit, offset=offset),
    )


@app.get("/admin/users/{user_id}", response_model=AdminUserDetailResponse)
def get_admin_user_detail(
    user_id: UUID,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminUserDetailResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    preferences = db.scalars(
        select(Preference)
        .where(Preference.user_id == user_id)
        .order_by(Preference.id.desc())
    ).all()

    return AdminUserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        clerk_user_id=user.clerk_user_id,
        created_at=user.created_at,
        is_admin=user.is_admin,
        is_active=user.is_active,
        preferences=[
            AdminPreferenceSummary(
                id=entry.id,
                submitted_at=entry.submitted_at,
                raw_data=entry.raw_data,
                plan_status=_plan_status_from_raw_data(entry.raw_data),
            )
            for entry in preferences
        ],
    )


@app.patch("/admin/users/{user_id}/status", response_model=AdminUserSummary)
def update_admin_user_status(
    user_id: UUID,
    payload: AdminUserStatusUpdate,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminUserSummary:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)

    return AdminUserSummary(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_admin=user.is_admin,
        is_active=user.is_active,
    )


@app.get("/admin/recipes", response_model=AdminRecipeListResponse)
def list_admin_recipes(
    search: Optional[str] = Query(None, description="Match title or tags (case-insensitive)"),
    active: Optional[bool] = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeListResponse:
    filters = []
    if search:
        normalized = search.strip()
        if normalized:
            pattern = f"%{normalized}%"
            tags_text = func.coalesce(func.array_to_string(Recipe.tags, " "), "")
            filters.append(or_(Recipe.title.ilike(pattern), tags_text.ilike(pattern)))

    if active is not None:
        filters.append(Recipe.is_active == active)

    base_stmt = select(Recipe)
    if filters:
        base_stmt = base_stmt.where(*filters)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    recipes = db.scalars(
        base_stmt.order_by(Recipe.created_at.desc().nullslast(), Recipe.title)
        .offset(offset)
        .limit(limit)
    ).all()

    return AdminRecipeListResponse(
        items=[_admin_recipe_summary(recipe) for recipe in recipes],
        pagination=AdminPagination(total=total, limit=limit, offset=offset),
    )


@app.get("/admin/recipes/{recipe_id}", response_model=AdminRecipeDetail)
def get_admin_recipe_detail(
    recipe_id: UUID,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeDetail:
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return _admin_recipe_detail(recipe)


@app.get("/users/{user_id}/preferences")
def list_user_preferences(
    user_id: UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> Dict[str, Any]:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot access another user's preferences")

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


@app.get("/recipes")
def list_recipes(
    search: Optional[str] = Query(None, description="Case-insensitive name match"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    _user: Optional[User] = Depends(optional_current_user),
) -> Dict[str, Any]:
    """Return recipes from the database with lightweight filtering."""
    filters = []

    if search:
        filters.append(Recipe.title.ilike(f"%{search.strip()}%"))
    if tag:
        filters.append(Recipe.tags.any(tag))

    base_stmt = select(Recipe)
    if filters:
        base_stmt = base_stmt.where(*filters)

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = db.scalar(count_stmt) or 0

    rows = db.scalars(
        base_stmt.order_by(Recipe.created_at.desc().nullslast(), Recipe.slug).offset(offset).limit(limit)
    ).all()

    return {
        "items": [_recipe_to_dict(row) for row in rows],
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }
