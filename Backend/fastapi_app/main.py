import ast
import concurrent.futures
import io
import json
import logging
import os
import re
from fractions import Fraction
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import Any, Dict, Optional, Literal, Iterable

from fastapi import BackgroundTasks, Body, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from models import ActivityLog, Preference, Rating, Recipe, User, PlanRecipe
from planner import generate_daily_plan, generate_daily_plan_for_preference, generate_daily_macro_goal, _format_list_values
from recipe_translator import PlanTranslator

ENSURE_SCHEMA_ON_STARTUP = os.getenv("ENSURE_SCHEMA_ON_STARTUP", "").lower() in {"1", "true", "yes"}

logger = logging.getLogger(__name__)
PLAN_GENERATION_TIMEOUT = int(os.getenv("PLAN_GENERATION_TIMEOUT", "180"))


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


class AdminActivityLogEntry(BaseModel):
    id: UUID
    created_at: datetime
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_label: Optional[str] = None
    action_type: str
    action_detail: Optional[str] = None
    status: str
    metadata: Optional[Dict[str, Any]] = None


class AdminActivityLogListResponse(BaseModel):
    items: list[AdminActivityLogEntry]
    pagination: AdminPagination


class AdminUserListResponse(BaseModel):
    items: list[AdminUserSummary]
    pagination: AdminPagination


class AdminRecipeSummary(BaseModel):
    id: UUID
    title: str
    slug: str
    meal_type: Optional[str] = None
    cost_category: Optional[str] = None
    tags: list[str]
    is_active: bool
    created_at: Optional[datetime] = None


class AdminRecipeDetail(BaseModel):
    id: UUID
    title: str
    slug: str
    cost_category: Optional[str] = None
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


class AdminRecipeCreate(BaseModel):
    title: str
    ingredients: list[Any]
    instructions: list[Any]
    nutrition: Dict[str, Any]
    tags: list[str]
    meal_type: str
    cost_category: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    total_time_minutes: Optional[int] = None
    yield_qty: Optional[float] = None
    yield_unit: Optional[str] = None
    cuisine: Optional[str] = None
    dish_type: Optional[str] = None
    dietary_flags: Optional[Dict[str, Any]] = None
    allergens: Optional[list[str]] = None
    cost_per_serving_cents: Optional[int] = None
    equipment: Optional[list[str]] = None
    difficulty: Optional[str] = None
    spice_level: Optional[int] = None
    author: Optional[str] = None
    language: Optional[str] = None
    popularity_score: Optional[float] = None
    health_score: Optional[float] = None


class AdminRecipeUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    cost_category: Optional[str] = None
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
    is_active: Optional[bool] = None


class AdminRecipeImportError(BaseModel):
    row: Optional[int] = None
    field: Optional[str] = None
    message: str


class AdminRecipeImportResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[AdminRecipeImportError]
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


class RatingCreate(BaseModel):
    recipe_id: UUID
    is_liked: bool


class RatingResponse(BaseModel):
    id: UUID
    user_id: UUID
    recipe_id: UUID
    is_liked: bool
    created_at: datetime
    updated_at: datetime


class RatingProgressResponse(BaseModel):
    total_ratings: int
    threshold: int
    is_unlocked: bool


class RatingListResponse(BaseModel):
    items: list[RatingResponse]
    pagination: AdminPagination


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
    log_activity(
        db,
        actor_type="user",
        actor_id=user.id,
        actor_label=user.email or user.username,
        action_type="user_signup",
        action_detail="User account created",
        status="success",
        metadata={"clerk_user_id": clerk_user_id},
    )
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


@app.exception_handler(Exception)
async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    log_activity(
        None,
        actor_type="system",
        actor_id=None,
        actor_label=None,
        action_type="unhandled_exception",
        action_detail=str(exc),
        status="critical",
        metadata={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

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


def _slugify_recipe_title(title: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return cleaned or "recipe"


def _recipe_slug_exists(db: Session, slug: str, exclude_id: Optional[UUID] = None) -> bool:
    stmt = select(Recipe.id).where(Recipe.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Recipe.id != exclude_id)
    return db.scalar(stmt) is not None


def _ensure_unique_recipe_slug(
    db: Session,
    base_slug: str,
    exclude_id: Optional[UUID] = None,
) -> str:
    candidate = base_slug
    suffix = 1
    while _recipe_slug_exists(db, candidate, exclude_id=exclude_id):
        suffix += 1
        candidate = f"{base_slug}-{suffix}"
        if suffix > 50:
            candidate = f"{base_slug}-{uuid4().hex[:6]}"
            if not _recipe_slug_exists(db, candidate, exclude_id=exclude_id):
                break
    return candidate


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


def _repair_plan_payload(plan: Any) -> Any:
    """Ensure calories/macros are populated and ingredients are properly formatted."""
    if not isinstance(plan, dict):
        return plan

    def _repair_meal(meal: Any) -> Any:
        if not isinstance(meal, dict):
            return meal
        fixed = dict(meal)
        # Keep ingredients as structured objects (list of dicts with quantity, unit, name)
        # instead of converting to plain strings
        ingredients = meal.get("ingredients")
        if ingredients is not None:
            fixed["ingredients"] = ingredients if isinstance(ingredients, list) else []
        # Backfill calories from macros if missing/zero.
        cal = fixed.get("calories")
        protein = float(fixed.get("protein") or 0)
        carbs = float(fixed.get("carbs") or 0)
        fat = float(fixed.get("fat") or 0)
        if cal in (None, 0, "0", 0.0):
            estimated = protein * 4 + carbs * 4 + fat * 9
            fixed["calories"] = round(estimated, 2) if estimated else 0
        return fixed

    def _repair_day(day: Any) -> Any:
        if not isinstance(day, dict):
            return day
        fixed_day = dict(day)
        meals = fixed_day.get("meals") if isinstance(fixed_day.get("meals"), dict) else {}
        repaired_meals = {}
        for key, meal in meals.items():
            repaired_meals[key] = _repair_meal(meal) if meal else meal
        fixed_day["meals"] = repaired_meals

        # Recompute day totals from meals if zero/missing.
        def _sum(field: str) -> float:
            total = 0.0
            for meal in repaired_meals.values():
                if not isinstance(meal, dict):
                    continue
                try:
                    total += float(meal.get(field) or 0)
                except (TypeError, ValueError):
                    continue
            return round(total, 2)

        if float(fixed_day.get("calories") or 0) == 0:
            fixed_day["calories"] = _sum("calories")
        macros = fixed_day.get("macros") if isinstance(fixed_day.get("macros"), dict) else {}
        fixed_day["macros"] = {
            "protein": macros.get("protein") if macros.get("protein") not in (None, "") else _sum("protein"),
            "carbs": macros.get("carbs") if macros.get("carbs") not in (None, "") else _sum("carbs"),
            "fat": macros.get("fat") if macros.get("fat") not in (None, "") else _sum("fat"),
        }
        return fixed_day

    repaired = dict(plan)
    days = plan.get("days") if isinstance(plan.get("days"), list) else []
    repaired["days"] = [_repair_day(day) for day in days]
    return repaired


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _tokenize_title(title: Any) -> set[str]:
    normalized = _normalize_text(title)
    return set(normalized.split()) if normalized else set()


def _tokenize_ingredients(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        text = " ".join(str(item) for item in value)
    else:
        text = str(value)
    normalized = _normalize_text(text)
    return set(normalized.split()) if normalized else set()


def _jaccard_similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    intersection = left.intersection(right)
    union = left.union(right)
    if not union:
        return 0.0
    return len(intersection) / len(union)


def _is_duplicate_recipe(
    title_tokens: set[str],
    ingredient_tokens: set[str],
    existing: list[dict[str, Any]],
    *,
    title_threshold: float = 0.75,
    ingredient_threshold: float = 0.6,
) -> Optional[dict[str, Any]]:
    if not title_tokens or not ingredient_tokens:
        return None
    for entry in existing:
        title_score = _jaccard_similarity(title_tokens, entry["title_tokens"])
        if title_score < title_threshold:
            continue
        ingredient_score = _jaccard_similarity(ingredient_tokens, entry["ingredient_tokens"])
        if ingredient_score >= ingredient_threshold:
            return {
                "title_score": title_score,
                "ingredient_score": ingredient_score,
                "recipe_id": entry.get("id"),
                "title": entry.get("title"),
            }
    return None


def log_activity(
    db: Optional[Session],
    *,
    actor_type: str,
    action_type: str,
    status: str,
    actor_id: Optional[UUID] = None,
    actor_label: Optional[str] = None,
    action_detail: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    owns_session = False
    session = db
    if session is None:
        session = SessionLocal()
        owns_session = True

    try:
        entry = ActivityLog(
            actor_type=actor_type,
            actor_id=actor_id,
            actor_label=actor_label,
            action_type=action_type,
            action_detail=action_detail,
            status=status,
            metadata_=_json_safe(metadata) if metadata else None,
        )
        session.add(entry)
        session.commit()
    except Exception:
        logger.exception("Failed to write activity log")
        try:
            session.rollback()
        except Exception:
            pass
    finally:
        if owns_session:
            session.close()


def _should_use_solver(db: Session, user_id: UUID) -> bool:
    """Check if user has enough ratings for solver-based generation."""
    rating_count = db.scalar(
        select(func.count(Rating.id)).where(Rating.user_id == user_id)
    ) or 0
    return rating_count >= 10  # Personalization threshold


def _is_impossible_constraint(preference: Preference, macro_goal: Dict[str, Any]) -> Optional[str]:
    """
    Check if user's constraints are mathematically impossible.
    Returns error message if impossible, None otherwise.

    Checks:
    - Vegan + high protein (>30% of calories from protein)
    - Very low calorie (<1000 cal/day)
    - Multiple severe restrictions (vegan + nut-free + soy-free)
    - High protein + low calorie combination
    """
    # Get macro targets
    targets = macro_goal.get("macroTargets", {}) if macro_goal else {}
    calories = macro_goal.get("calorieTarget", 2000) if macro_goal else 2000
    protein = targets.get("protein", 0)
    dietary = preference.dietary_restrictions or []

    # Check 1: Very low calorie (unrealistic for any diet)
    if calories < 1000:
        return (
            "Your calorie target is too low for healthy meal planning. "
            "Please set a target of at least 1000 calories per day."
        )

    # Check 2: Vegan high protein (max realistic ~30% from protein)
    # Protein has 4 cal/g, so max protein_g = (calories * 0.30) / 4
    if "vegan" in dietary:
        max_vegan_protein = (calories * 0.30) / 4
        if protein > max_vegan_protein * 1.2:  # 20% tolerance
            return (
                f"Your goals may be incompatible: {protein}g protein on a vegan diet "
                f"with {calories} calories is very difficult to achieve. "
                "Please adjust your protein target or dietary restrictions."
            )

    # Check 3: High protein + low calorie (any diet)
    # Max sustainable is ~35% of calories from protein
    max_protein_any_diet = (calories * 0.35) / 4
    if protein > max_protein_any_diet * 1.2:
        return (
            f"Your protein target ({protein}g) is very high for {calories} calories. "
            "Please increase calories or reduce protein target."
        )

    # Check 4: Multiple severe restrictions (limited recipe pool)
    severe_restrictions = {"vegan", "gluten_free", "nut_free", "soy_free"}
    active_severe = [r for r in dietary if r in severe_restrictions]
    if len(active_severe) >= 3:
        return (
            f"You have multiple dietary restrictions ({', '.join(active_severe)}) "
            "that significantly limit available recipes. Please consider relaxing "
            "one restriction to get better meal variety."
        )

    return None


def _generate_solver_plan(db: Session, user_id: UUID, preference: Preference) -> Dict[str, Any]:
    """Generate plan using solver with automatic OpenAI fallback."""
    from solver import generate_personalized_plan

    try:
        solver_result = generate_personalized_plan(
            db=db,
            user_id=user_id,
            preference=preference,
            timeout_seconds=10,
        )

        if solver_result.get("plan") is not None:
            fallback_reason = solver_result.get("fallback_reason")
            if fallback_reason:
                log_activity(
                    db,
                    actor_type="system",
                    action_type="solver_fallback",
                    action_detail=f"Solver fallback: {fallback_reason}",
                    status="warning",
                    metadata={
                        "user_id": str(user_id),
                        "reason": fallback_reason,
                        "quality_metrics": solver_result.get("quality_metrics"),
                    },
                )
            else:
                _persist_plan_result(db, preference, solver_result, generation_source="solver")
                return solver_result

        fallback_reason = solver_result.get("fallback_reason") or solver_result.get("error") or "unknown"
        log_activity(
            db,
            actor_type="system",
            action_type="solver_fallback",
            action_detail=f"Using OpenAI fallback: {fallback_reason}",
            status="warning",
            metadata={"user_id": str(user_id), "reason": fallback_reason},
        )

    except Exception as exc:
        logger.exception("Solver failed with exception, falling back to OpenAI")
        log_activity(
            db,
            actor_type="system",
            action_type="solver_fallback",
            action_detail=f"Solver exception: {exc}",
            status="error",
            metadata={"user_id": str(user_id), "exception": str(exc)},
        )

    openai_result = generate_daily_plan(preference, translate=False, db=db)
    _persist_plan_result(db, preference, openai_result, generation_source="openai_fallback")
    return openai_result


def _persist_plan_result(
    db: Session,
    preference: Preference,
    plan_result: Dict[str, Any],
    generation_source: str = "openai",  # "solver" or "openai" or "openai_fallback"
) -> None:
    existing_raw = preference.raw_data if isinstance(preference.raw_data, dict) else {}
    updated_raw = dict(existing_raw)

    # Add generation metadata
    plan_result_with_meta = dict(plan_result)
    plan_result_with_meta["generation_source"] = generation_source
    plan_result_with_meta["generated_at"] = datetime.now(timezone.utc).isoformat()

    updated_raw["generated_plan"] = _json_safe(plan_result_with_meta)
    preference.raw_data = updated_raw
    db.add(preference)
    db.commit()
    db.refresh(preference)

    # Track recipes in PlanRecipe table
    plan = plan_result.get("plan") if isinstance(plan_result, dict) else None
    if plan and isinstance(plan, dict):
        days = plan.get("days") if isinstance(plan.get("days"), list) else []
        for day in days:
            if not isinstance(day, dict):
                continue
            day_name = day.get("name")
            meals = day.get("meals") if isinstance(day.get("meals"), dict) else {}
            for meal_key, meal_data in meals.items():
                if not isinstance(meal_data, dict):
                    continue
                recipe_id_str = meal_data.get("id")
                if not recipe_id_str:
                    continue
                try:
                    recipe_id = UUID(str(recipe_id_str))
                except (ValueError, TypeError):
                    continue

                # Create PlanRecipe entry
                plan_recipe = PlanRecipe(
                    preference_id=preference.id,
                    recipe_id=recipe_id,
                    day_name=str(day_name) if day_name else None,
                    meal_type=meal_key.lower() if meal_key else None,
                )
                db.add(plan_recipe)

        try:
            db.commit()
        except Exception:
            logger.exception("Failed to track recipes in PlanRecipe table")
            db.rollback()


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


_INGREDIENT_UNITS = [
    "kg",
    "g",
    "mg",
    "l",
    "dl",
    "cl",
    "ml",
    "ss",  # tablespoon (spiseskje)
    "ts",  # teaspoon (teskje)
    "stk",
    "st",
    "bat",  # "båt" (garlic clove) in ascii form
    "fedd",
    "klype",
]


def _to_float(value: str) -> Optional[float]:
    numeric = value.replace(",", ".").strip()
    try:
        if "/" in numeric:
            return float(Fraction(numeric))
        return float(numeric)
    except Exception:
        return None


def _parse_quantity_unit(text: str) -> tuple[Optional[float], Optional[str], str]:
    if not text:
        return None, None, ""

    match = re.match(r"^\s*(?P<qty>\d+(?:[.,]\d+)?(?:/\d+)?)(?P<rest>.*)$", text)
    if not match:
        return None, None, text.strip()

    qty_raw = match.group("qty") or ""
    rest = (match.group("rest") or "").lstrip()
    unit: Optional[str] = None
    name_part = rest

    lower_rest = rest.lower()
    for unit_candidate in sorted(_INGREDIENT_UNITS, key=len, reverse=True):
        candidate = unit_candidate.lower()
        if lower_rest.startswith(candidate):
            unit = candidate
            name_part = rest[len(unit_candidate):]
            break
        dotted = f"{candidate}."
        if lower_rest.startswith(dotted):
            unit = candidate
            name_part = rest[len(unit_candidate) + 1 :]
            break

    if unit is None and rest:
        parts = rest.split(maxsplit=1)
        if parts and parts[0].lower() in _INGREDIENT_UNITS:
            unit = parts[0].lower()
            name_part = parts[1] if len(parts) > 1 else ""

    quantity = _to_float(qty_raw)
    cleaned_name = name_part.lstrip(" .,-:\t") or rest
    return quantity, unit, cleaned_name.strip()


def _maybe_eval_dict(text: str) -> Optional[dict[str, Any]]:
    if not text or not text.strip().startswith("{"):
        return None
    try:
        parsed = ast.literal_eval(text)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _normalize_ingredient_item(item: Any) -> Optional[dict[str, Any]]:
    if item is None:
        return None

    original_text = ""
    payload: Optional[dict[str, Any]] = None

    if isinstance(item, dict):
        payload = item
        original_text = str(item.get("original_text") or item.get("name") or "").strip()
    elif isinstance(item, str):
        original_text = item.strip()
        payload = _maybe_eval_dict(original_text)
    else:
        original_text = str(item).strip()

    if payload is None:
        qty, unit, name = _parse_quantity_unit(original_text)
        return {
            "name": name or original_text,
            "quantity": qty,
            "unit": unit,
            "notes": "",
            "original_text": original_text,
        }

    name_value = str(payload.get("name") or "").strip()
    qty_value = payload.get("quantity")
    unit_value = payload.get("unit")
    notes_value = payload.get("notes") or ""
    parsed_qty, parsed_unit, parsed_name = _parse_quantity_unit(name_value or original_text)

    quantity = qty_value if qty_value not in (None, "") else parsed_qty
    unit = unit_value or parsed_unit
    name = parsed_name or name_value or original_text
    original = original_text or name_value or name

    return {
        "name": name.strip(),
        "quantity": quantity,
        "unit": unit,
        "notes": notes_value,
        "original_text": original.strip(),
    }


def _parse_import_ingredients(value: Any) -> list[dict[str, Any]]:
    if _is_blank(value):
        return []

    items: list[Any] = []
    if isinstance(value, dict):
        items = [value]
    elif isinstance(value, (list, tuple, set)):
        items = list(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            items = []
        else:
            parsed = None
            if text.startswith("[") and text.endswith("]"):
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    parsed = None
            if isinstance(parsed, list):
                items = parsed
            elif "\n" in text:
                items = [segment.strip() for segment in text.splitlines() if segment.strip()]
            elif "," in text:
                items = [segment.strip() for segment in text.split(",") if segment.strip()]
            else:
                items = [text]
    else:
        items = [value]

    normalized: list[dict[str, Any]] = []
    for item in items:
        parsed_item = _normalize_ingredient_item(item)
        if parsed_item and parsed_item.get("name"):
            normalized.append(parsed_item)
    return normalized


def _normalize_ingredients_payload(value: Any) -> list[dict[str, Any]]:
    try:
        return _parse_import_ingredients(value)
    except Exception:
        logger.exception("Failed to normalize ingredients; falling back to string list")
        return _parse_import_list_field(value)


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
        "price_tier": recipe.cost_category,
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
        cost_category=recipe.cost_category,
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
        cost_category=recipe.cost_category,
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


def _normalize_import_column_name(value: str) -> str:
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def _find_import_column(columns: Iterable[str], candidates: Iterable[str]) -> Optional[str]:
    normalized = {_normalize_import_column_name(col): col for col in columns}
    for candidate in candidates:
        needle = _normalize_import_column_name(candidate)
        if needle in normalized:
            return normalized[needle]
        for key, original in normalized.items():
            if needle and needle in key:
                return original
    return None


def _normalize_cost_category(value: Any) -> Optional[str]:
    if _is_blank(value):
        return None
    normalized = str(value).strip().lower().replace("_", " ")
    if normalized in {"cheap", "low", "budget"}:
        return "cheap"
    if normalized in {"medium expensive", "medium", "mid", "moderate"}:
        return "medium expensive"
    raise ValueError("cost_category must be either 'cheap' or 'medium expensive'")


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    try:
        import pandas as pd

        if pd.isna(value):
            return True
    except Exception:
        pass
    if isinstance(value, str) and not value.strip():
        return True
    return False


def _parse_import_list_field(value: Any) -> list[str]:
    if _is_blank(value):
        return []
    if isinstance(value, dict):
        text = value.get("original_text") or value.get("name")
        return [str(text).strip()] if text and str(text).strip() else []
    if isinstance(value, (list, tuple, set)):
        items: list[str] = []
        for item in value:
            if isinstance(item, dict):
                text = item.get("original_text") or item.get("name")
                if text and str(text).strip():
                    items.append(str(text).strip())
            else:
                text = str(item).strip()
                if text:
                    items.append(text)
        return items
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        if "\n" in text:
            return [segment.strip() for segment in text.splitlines() if segment.strip()]
        if "," in text:
            return [segment.strip() for segment in text.split(",") if segment.strip()]
        return [text]
    text = str(value).strip()
    return [text] if text else []


def _parse_import_nutrition(value: Any) -> Dict[str, Any]:
    if _is_blank(value):
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return {}
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {}
        if isinstance(parsed, dict):
            return parsed
    return {}


def _infer_import_format(request: Request) -> str:
    content_type = (request.headers.get("content-type") or "").lower()
    filename = (request.headers.get("x-file-name") or "").lower()
    if "parquet" in content_type or filename.endswith((".parquet", ".pq")):
        return "parquet"
    if "csv" in content_type or filename.endswith(".csv"):
        return "csv"
    if content_type in {"application/octet-stream", "binary/octet-stream"} and filename:
        if filename.endswith((".parquet", ".pq")):
            return "parquet"
        if filename.endswith(".csv"):
            return "csv"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format. Provide a CSV or Parquet payload.",
    )


def _read_import_dataframe(payload: bytes, file_format: str):
    try:
        import pandas as pd
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pandas is required to import recipe files.",
        ) from exc

    buffer = io.BytesIO(payload)
    try:
        if file_format == "csv":
            return pd.read_csv(buffer)
        if file_format == "parquet":
            return pd.read_parquet(buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse {file_format} payload.",
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format. Provide a CSV or Parquet payload.",
    )


def _max_import_errors() -> int:
    return 25


def _resolve_import_columns(columns: Iterable[str]) -> Dict[str, Optional[str]]:
    return {
        "title": _find_import_column(columns, ["title", "name", "recipe", "recipe_name"]),
        "ingredients": _find_import_column(columns, ["ingredients", "ingredient_list"]),
        "instructions": _find_import_column(
            columns, ["instructions", "instruction", "steps", "directions"]
        ),
        "cuisine": _find_import_column(columns, ["cuisine", "cuisine_type", "region"]),
        "nutrition": _find_import_column(columns, ["nutrition", "nutrients", "macros"]),
        "tags": _find_import_column(columns, ["tags", "labels", "categories"]),
        "meal_type": _find_import_column(columns, ["meal_type", "meal", "course", "category"]),
        "cost_category": _find_import_column(
            columns,
            ["cost_category", "price_tier", "budget_range", "price_level", "cost_level", "price_category"],
        ),
        "slug": _find_import_column(columns, ["slug"]),
    }


def _normalize_import_row(
    row: Dict[str, Any],
    columns: Dict[str, Optional[str]],
) -> Dict[str, Any]:
    title_col = columns.get("title")
    title_value = row.get(title_col) if title_col else None
    if _is_blank(title_value):
        raise ValueError("Missing recipe title")
    title = str(title_value).strip()

    slug_col = columns.get("slug")
    slug_value = row.get(slug_col) if slug_col else None
    slug_source = slug_value if not _is_blank(slug_value) else title
    base_slug = _slugify_recipe_title(str(slug_source))

    ingredients_col = columns.get("ingredients")
    instructions_col = columns.get("instructions")
    nutrition_col = columns.get("nutrition")
    tags_col = columns.get("tags")
    meal_type_col = columns.get("meal_type")
    cuisine_col = columns.get("cuisine")
    cost_category_col = columns.get("cost_category")

    meal_type_value = row.get(meal_type_col) if meal_type_col else None
    meal_type = None if _is_blank(meal_type_value) else str(meal_type_value).strip().lower()

    cost_value = row.get(cost_category_col) if cost_category_col else None
    cost_category = None
    if not _is_blank(cost_value):
        try:
            cost_category = _normalize_cost_category(cost_value)
        except ValueError:
            cost_category = None

    cuisine_value = row.get(cuisine_col) if cuisine_col else None
    cuisine = None if _is_blank(cuisine_value) else str(cuisine_value).strip()

    return {
        "title": title,
        "slug": base_slug,
        "ingredients": _normalize_ingredients_payload(row.get(ingredients_col) if ingredients_col else None),
        "instructions": _parse_import_list_field(
            row.get(instructions_col) if instructions_col else None
        ),
        "nutrition": _parse_import_nutrition(row.get(nutrition_col) if nutrition_col else None),
        "tags": _parse_import_list_field(row.get(tags_col) if tags_col else None),
        "meal_type": meal_type,
        "cost_category": cost_category,
        "cuisine": cuisine,
    }


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
    def _generate_plan_for_pref(pref_id: int) -> Dict[str, Any]:
        local_db = SessionLocal()
        try:
            return generate_daily_plan_for_preference(local_db, pref_id)
        finally:
            local_db.close()

    def _run_with_timeout(fn, timeout_seconds: int) -> Dict[str, Any]:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn)
            try:
                return future.result(timeout=timeout_seconds)
            except concurrent.futures.TimeoutError:
                future.cancel()
                return {
                    "plan": None,
                    "raw_text": None,
                    "error": f"Plan generation timed out after {timeout_seconds} seconds.",
                }
            except Exception as exc:
                return {"plan": None, "raw_text": None, "error": str(exc)}

    db = SessionLocal()
    try:
        preference = db.get(Preference, pref_id)
        if preference is None:
            logger.warning("Preference %s missing when storing generated plan", pref_id)
            return

        user_id = preference.user_id
        use_solver = bool(user_id and _should_use_solver(db, user_id))

        macro_response = generate_daily_macro_goal(preference)
        macro_goal = macro_response.get("goal")

        impossible_error = _is_impossible_constraint(preference, macro_goal)
        if impossible_error:
            plan_result = {"plan": None, "raw_text": None, "error": impossible_error}
            source = "solver" if use_solver else "openai"
            _persist_plan_result(db, preference, plan_result, generation_source=source)
            log_activity(
                db,
                actor_type="user",
                actor_id=user_id,
                action_type="plan_generation",
                action_detail=impossible_error,
                status="error",
                metadata={"preference_id": pref_id, "reason": "impossible_constraints"},
            )
            return

        if use_solver and user_id is not None:
            plan_result = _generate_solver_plan(db, user_id, preference)
        else:
            plan_result = _run_with_timeout(
                lambda: _generate_plan_for_pref(pref_id),
                PLAN_GENERATION_TIMEOUT,
            )
            if plan_result.get("plan") is None and plan_result.get("error"):
                logger.warning(
                    "Plan generation for %s failed/timeout: %s",
                    pref_id,
                    plan_result.get("error"),
                )
            _persist_plan_result(db, preference, plan_result, generation_source="openai")

        status_value = "success" if plan_result.get("plan") else "error"
        detail = "Meal plan generated" if status_value == "success" else plan_result.get("error")
        log_activity(
            db,
            actor_type="user",
            actor_id=preference.user_id,
            actor_label=None,
            action_type="plan_generation",
            action_detail=detail,
            status=status_value,
            metadata={"preference_id": preference.id, "user_id": str(preference.user_id)},
        )
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

    generation_source = None
    if isinstance(generated_plan, dict):
        generation_source = generated_plan.get("generation_source")

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

    if plan_payload:
        plan_payload = _repair_plan_payload(plan_payload)

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
        "generation_source": generation_source,
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

    action = "user_activated" if payload.is_active else "user_suspended"
    log_activity(
        db,
        actor_type="admin",
        actor_id=_admin.id,
        actor_label=_admin.email or _admin.username,
        action_type=action,
        action_detail=f"Admin set user {user.id} active={payload.is_active}",
        status="success",
        metadata={"target_user_id": str(user.id), "is_active": payload.is_active},
    )

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


@app.delete("/admin/recipes/{recipe_id}", response_model=AdminRecipeDetail)
def delete_admin_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeDetail:
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe.is_active = False
    recipe.updated_at = datetime.now(timezone.utc)
    db.add(recipe)
    db.commit()
    db.refresh(recipe)

    log_activity(
        db,
        actor_type="admin",
        actor_id=_admin.id,
        actor_label=_admin.email or _admin.username,
        action_type="recipe_deleted",
        action_detail=f"Deleted recipe {recipe.title}",
        status="success",
        metadata={"recipe_id": str(recipe.id), "title": recipe.title, "is_active": False},
    )

    return _admin_recipe_detail(recipe)


@app.post("/admin/recipes", response_model=AdminRecipeDetail, status_code=status.HTTP_201_CREATED)
def create_admin_recipe(
    payload: AdminRecipeCreate,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeDetail:
    try:
        normalized_cost = _normalize_cost_category(payload.cost_category)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    base_slug = _slugify_recipe_title(payload.title)
    slug = _ensure_unique_recipe_slug(db, base_slug)

    recipe = Recipe(
        id=uuid4(),
        title=payload.title,
        slug=slug,
        cost_category=normalized_cost,
        source_url=payload.source_url,
        image_url=payload.image_url,
        description=payload.description,
        instructions=_json_safe(payload.instructions),
        ingredients=_json_safe(_normalize_ingredients_payload(payload.ingredients)),
        prep_time_minutes=payload.prep_time_minutes,
        cook_time_minutes=payload.cook_time_minutes,
        total_time_minutes=payload.total_time_minutes,
        yield_qty=payload.yield_qty,
        yield_unit=payload.yield_unit,
        cuisine=payload.cuisine,
        meal_type=payload.meal_type,
        dish_type=payload.dish_type,
        dietary_flags=_json_safe(payload.dietary_flags),
        allergens=_json_safe(payload.allergens),
        nutrition=_json_safe(payload.nutrition),
        cost_per_serving_cents=payload.cost_per_serving_cents,
        equipment=_json_safe(payload.equipment),
        difficulty=payload.difficulty,
        spice_level=payload.spice_level,
        author=payload.author,
        language=payload.language,
        tags=_json_safe(payload.tags),
        popularity_score=payload.popularity_score,
        health_score=payload.health_score,
        is_active=True,
    )

    db.add(recipe)
    db.commit()
    db.refresh(recipe)

    log_activity(
        db,
        actor_type="admin",
        actor_id=_admin.id,
        actor_label=_admin.email or _admin.username,
        action_type="recipe_created",
        action_detail=f"Created recipe {recipe.title}",
        status="success",
        metadata={"recipe_id": str(recipe.id), "title": recipe.title},
    )

    return _admin_recipe_detail(recipe)


@app.patch("/admin/recipes/{recipe_id}", response_model=AdminRecipeDetail)
def update_admin_recipe(
    recipe_id: UUID,
    payload: AdminRecipeUpdate,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeDetail:
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    updates = payload.dict(exclude_unset=True)
    if "cost_category" in updates:
        try:
            updates["cost_category"] = _normalize_cost_category(updates["cost_category"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    title_changed = "title" in updates and updates.get("title") != recipe.title
    slug_value = updates.pop("slug", None)

    if slug_value:
        base_slug = _slugify_recipe_title(slug_value)
        updates["slug"] = _ensure_unique_recipe_slug(db, base_slug, exclude_id=recipe.id)
    elif title_changed:
        base_slug = _slugify_recipe_title(str(updates.get("title")))
        updates["slug"] = _ensure_unique_recipe_slug(db, base_slug, exclude_id=recipe.id)

    updates["updated_at"] = datetime.now(timezone.utc)

    for key, value in updates.items():
        if key == "ingredients":
            setattr(recipe, key, _json_safe(_normalize_ingredients_payload(value)))
        else:
            setattr(recipe, key, _json_safe(value))

    db.add(recipe)
    db.commit()
    db.refresh(recipe)

    log_activity(
        db,
        actor_type="admin",
        actor_id=_admin.id,
        actor_label=_admin.email or _admin.username,
        action_type="recipe_updated",
        action_detail=f"Updated recipe {recipe.title}",
        status="success",
        metadata={"recipe_id": str(recipe.id), "title": recipe.title},
    )

    return _admin_recipe_detail(recipe)


@app.post("/admin/recipes/import", response_model=AdminRecipeImportResponse)
async def import_admin_recipes(
    request: Request,
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminRecipeImportResponse:
    payload = await request.body()
    if not payload:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")

    file_format = _infer_import_format(request)
    df = _read_import_dataframe(payload, file_format)
    if df.empty:
        return AdminRecipeImportResponse(created=0, updated=0, skipped=0, errors=[])

    columns = _resolve_import_columns(df.columns)
    if not columns.get("title"):
        raise HTTPException(
            status_code=400,
            detail="Missing title column in import file.",
        )

    created = 0
    updated = 0
    skipped = 0
    errors: list[AdminRecipeImportError] = []

    existing_rows = db.execute(
        select(Recipe.id, Recipe.title, Recipe.ingredients)
    ).mappings().all()
    existing_tokens: list[dict[str, Any]] = []
    for row in existing_rows:
        existing_tokens.append(
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "title_tokens": _tokenize_title(row.get("title")),
                "ingredient_tokens": _tokenize_ingredients(row.get("ingredients")),
            }
        )

    for index, row in enumerate(df.to_dict("records"), start=1):
        try:
            normalized = _normalize_import_row(row, columns)
            base_slug = normalized["slug"]
            existing = db.scalar(select(Recipe).where(Recipe.slug == base_slug))

            if existing is not None:
                existing.title = normalized["title"]
                existing.ingredients = _json_safe(normalized["ingredients"])
                existing.instructions = _json_safe(normalized["instructions"])
                existing.nutrition = _json_safe(normalized["nutrition"])
                existing.tags = _json_safe(normalized["tags"])
                existing.meal_type = normalized["meal_type"]
                existing.cost_category = normalized["cost_category"]
                existing.cuisine = normalized["cuisine"]
                existing.updated_at = datetime.now(timezone.utc)
                db.add(existing)
                db.commit()
                db.refresh(existing)
                updated += 1
                continue

            title_tokens = _tokenize_title(normalized["title"])
            ingredient_tokens = _tokenize_ingredients(normalized["ingredients"])
            duplicate_match = _is_duplicate_recipe(
                title_tokens,
                ingredient_tokens,
                existing_tokens,
            )
            if duplicate_match is not None:
                skipped += 1
                if len(errors) < _max_import_errors():
                    errors.append(
                        AdminRecipeImportError(
                            row=index,
                            field="title",
                            message=(
                                "Duplicate detected (title similarity "
                                f"{duplicate_match['title_score']:.2f}, "
                                "ingredients similarity "
                                f"{duplicate_match['ingredient_score']:.2f})."
                            ),
                        )
                    )
                continue

            slug = _ensure_unique_recipe_slug(db, base_slug)
            recipe = Recipe(
                id=uuid4(),
                title=normalized["title"],
                slug=slug,
                ingredients=_json_safe(normalized["ingredients"]),
                instructions=_json_safe(normalized["instructions"]),
                nutrition=_json_safe(normalized["nutrition"]),
                tags=_json_safe(normalized["tags"]),
                meal_type=normalized["meal_type"],
                cuisine=normalized["cuisine"],
                cost_category=normalized["cost_category"],
                is_active=True,
            )
            db.add(recipe)
            db.commit()
            db.refresh(recipe)
            created += 1
            existing_tokens.append(
                {
                    "id": recipe.id,
                    "title": recipe.title,
                    "title_tokens": title_tokens,
                    "ingredient_tokens": ingredient_tokens,
                }
            )
        except ValueError as exc:
            skipped += 1
            if len(errors) < _max_import_errors():
                errors.append(
                    AdminRecipeImportError(row=index, field="title", message=str(exc))
                )
        except Exception as exc:
            skipped += 1
            db.rollback()
            logger.exception("Failed to import recipe row %s", index)
            if len(errors) < _max_import_errors():
                errors.append(AdminRecipeImportError(row=index, message=str(exc)))

    return AdminRecipeImportResponse(
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )


@app.get("/admin/logs", response_model=AdminActivityLogListResponse)
def list_admin_activity_logs(
    start_date: Optional[datetime] = Query(None, description="Filter by start date (UTC)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (UTC)"),
    actor_type: Optional[str] = Query(None, description="Filter by actor type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    _admin: User = Depends(admin_user_dependency),
) -> AdminActivityLogListResponse:
    filters = []
    if start_date:
        filters.append(ActivityLog.created_at >= _ensure_utc(start_date))
    if end_date:
        filters.append(ActivityLog.created_at <= _ensure_utc(end_date))
    if actor_type:
        filters.append(ActivityLog.actor_type == actor_type)
    if status_filter:
        filters.append(ActivityLog.status == status_filter)

    base_stmt = select(ActivityLog)
    if filters:
        base_stmt = base_stmt.where(*filters)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    entries = db.scalars(
        base_stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return AdminActivityLogListResponse(
        items=[
            AdminActivityLogEntry(
                id=entry.id,
                created_at=entry.created_at,
                actor_type=entry.actor_type,
                actor_id=entry.actor_id,
                actor_label=entry.actor_label,
                action_type=entry.action_type,
                action_detail=entry.action_detail,
                status=entry.status,
                metadata=_json_safe(entry.metadata_),
            )
            for entry in entries
        ],
        pagination=AdminPagination(total=total, limit=limit, offset=offset),
    )


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


@app.get("/plans/history")
def get_plan_history(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> Dict[str, Any]:
    """Get user's meal plan history with recipe tracking."""
    # Get total count
    total = db.scalar(
        select(func.count(Preference.id)).where(Preference.user_id == current_user.id)
    ) or 0

    # Get preferences with plan recipes
    preferences = db.scalars(
        select(Preference)
        .where(Preference.user_id == current_user.id)
        .order_by(Preference.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    plans = []
    for pref in preferences:
        # Get PlanRecipe entries for this preference
        plan_recipes = db.scalars(
            select(PlanRecipe)
            .where(PlanRecipe.preference_id == pref.id)
            .order_by(PlanRecipe.created_at)
        ).all()

        plan_status = _plan_status_from_raw_data(pref.raw_data)

        plans.append({
            "preference_id": pref.id,
            "submitted_at": pref.submitted_at,
            "plan_status": plan_status,
            "recipes": [
                {
                    "recipe_id": str(pr.recipe_id),
                    "day_name": pr.day_name,
                    "meal_type": pr.meal_type,
                }
                for pr in plan_recipes
            ],
        })

    return {
        "items": plans,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@app.post("/ratings", response_model=RatingResponse)
def create_or_update_rating(
    payload: RatingCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> RatingResponse:
    """Create or update a recipe rating (like/dislike)."""
    recipe = db.get(Recipe, payload.recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not recipe.is_active:
        raise HTTPException(status_code=400, detail="Cannot rate inactive recipe")

    # Check if rating already exists
    existing_rating = db.scalar(
        select(Rating).where(
            Rating.user_id == current_user.id,
            Rating.recipe_id == payload.recipe_id
        )
    )

    if existing_rating:
        # Update existing rating
        existing_rating.is_liked = payload.is_liked
        existing_rating.updated_at = datetime.now(timezone.utc)
        db.add(existing_rating)
        db.commit()
        db.refresh(existing_rating)

        log_activity(
            db,
            actor_type="user",
            actor_id=current_user.id,
            actor_label=current_user.email or current_user.username,
            action_type="rating_updated",
            action_detail=f"Updated rating for recipe {recipe.title}",
            status="success",
            metadata={"recipe_id": str(payload.recipe_id), "is_liked": payload.is_liked},
        )

        return RatingResponse(
            id=existing_rating.id,
            user_id=existing_rating.user_id,
            recipe_id=existing_rating.recipe_id,
            is_liked=existing_rating.is_liked,
            created_at=existing_rating.created_at,
            updated_at=existing_rating.updated_at,
        )
    else:
        # Create new rating
        new_rating = Rating(
            user_id=current_user.id,
            recipe_id=payload.recipe_id,
            is_liked=payload.is_liked,
        )
        db.add(new_rating)
        db.commit()
        db.refresh(new_rating)

        log_activity(
            db,
            actor_type="user",
            actor_id=current_user.id,
            actor_label=current_user.email or current_user.username,
            action_type="rating_created",
            action_detail=f"Rated recipe {recipe.title}",
            status="success",
            metadata={"recipe_id": str(payload.recipe_id), "is_liked": payload.is_liked},
        )

        return RatingResponse(
            id=new_rating.id,
            user_id=new_rating.user_id,
            recipe_id=new_rating.recipe_id,
            is_liked=new_rating.is_liked,
            created_at=new_rating.created_at,
            updated_at=new_rating.updated_at,
        )


@app.get("/ratings/me", response_model=RatingListResponse)
def get_my_ratings(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> RatingListResponse:
    """Get current user's recipe ratings."""
    total = db.scalar(
        select(func.count(Rating.id)).where(Rating.user_id == current_user.id)
    ) or 0

    ratings = db.scalars(
        select(Rating)
        .where(Rating.user_id == current_user.id)
        .order_by(Rating.updated_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return RatingListResponse(
        items=[
            RatingResponse(
                id=rating.id,
                user_id=rating.user_id,
                recipe_id=rating.recipe_id,
                is_liked=rating.is_liked,
                created_at=rating.created_at,
                updated_at=rating.updated_at,
            )
            for rating in ratings
        ],
        pagination=AdminPagination(total=total, limit=limit, offset=offset),
    )


@app.get("/ratings/progress", response_model=RatingProgressResponse)
def get_rating_progress(
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> RatingProgressResponse:
    """Get user's progress toward personalization threshold."""
    total_ratings = db.scalar(
        select(func.count(Rating.id)).where(Rating.user_id == current_user.id)
    ) or 0

    threshold = 10
    is_unlocked = total_ratings >= threshold

    return RatingProgressResponse(
        total_ratings=total_ratings,
        threshold=threshold,
        is_unlocked=is_unlocked,
    )


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
