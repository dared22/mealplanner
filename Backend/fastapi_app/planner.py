import ast
import copy
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

import httpx
from openai import OpenAI, OpenAIError
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import PlanRecipe, Preference, Rating, Recipe
from recipe_translator import RecipeTranslator

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MACRO_MODEL = os.getenv("OPENAI_PLAN_MODEL", "gpt-4o-mini")
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "120"))
OPENAI_MACRO_MAX_TOKENS = int(os.getenv("OPENAI_PLAN_MAX_TOKENS", "1000"))
OPENAI_MEAL_MODEL = os.getenv("OPENAI_MEAL_MODEL", OPENAI_MACRO_MODEL)
OPENAI_MEAL_MAX_TOKENS = int(os.getenv("OPENAI_MEAL_MAX_TOKENS", "1400"))

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not configured; macro target generation will be disabled.")
    client: Optional[OpenAI] = None
else:
    timeout = httpx.Timeout(
        OPENAI_REQUEST_TIMEOUT,
        connect=min(10.0, OPENAI_REQUEST_TIMEOUT),
        read=OPENAI_REQUEST_TIMEOUT,
        write=min(10.0, OPENAI_REQUEST_TIMEOUT),
        pool=min(10.0, OPENAI_REQUEST_TIMEOUT),
    )
    client = OpenAI(api_key=OPENAI_API_KEY, timeout=timeout)

SYSTEM_PROMPT = (
    "You are a professional nutrition coach. Return ONLY valid JSON with this schema:\n"
    "{\n"
    '  "calorieTarget": number,\n'
    '  "macroTargets": {"protein": number, "carbs": number, "fat": number}\n'
    "}\n"
    "Targets are per day. Use grams for macros."
)

MEAL_SYSTEM_PROMPT = (
    "You are a professional nutrition coach and chef. Return ONLY valid JSON with this schema:\n"
    "{\n"
    '  "meals": [\n'
    '    {\n'
    '      "meal_type": "breakfast|lunch|dinner|snack",\n'
    '      "name": string,\n'
    '      "calories": number,\n'
    '      "protein": number,\n'
    '      "carbs": number,\n'
    '      "fat": number,\n'
    '      "dietary_flags": {"is_vegan": boolean, "is_vegetarian": boolean},\n'
    '      "allergens": [string],\n'
    '      "cook_time_minutes": number|null,\n'
    '      "cuisine": string|null,\n'
    '      "ingredients": [string],\n'
    '      "instructions": [string]\n'
    "    }\n"
    "  ],\n"
    '  "error": string|null\n'
    "}\n"
    "Rules:\n"
    "- Return exactly one meal for each requested slot, matching the slot's meal_type.\n"
    "- Total macros across meals should closely match the provided targets.\n"
    "- Strictly follow dietary restrictions, preferred cuisines allow-list, and cooking time bounds.\n"
    "- If impossible, return an empty meals array and a short error message."
)

WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_TAG_KEYWORDS = {
    "breakfast": ["frokost", "breakfast"],
    "lunch": ["lunsj", "lunch", "smorbrod", "sandwich", "smaretter", "salater", "supper"],
    "dinner": ["middag", "middagsrett", "dinner", "ovnsretter", "gryter", "panneretter"],
}


@dataclass(frozen=True)
class PreferenceDTO:
    age: Optional[int]
    gender: Optional[str]
    height_cm: Optional[int]
    weight_kg: Optional[int]
    activity_level: Optional[str]
    nutrition_goal: Optional[str]
    meals_per_day: Optional[int]
    budget_range: Optional[str]
    cooking_time_preference: Optional[str]
    dietary_restrictions: List[str]
    preferred_cuisines: List[str]
    language: Optional[str]


def _to_int(value: Any) -> Optional[int]:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return None
    return numeric


def _get_pref_value(pref: Any, key: str) -> Any:
    if isinstance(pref, dict):
        return pref.get(key)
    value = getattr(pref, key, None)
    if value is not None:
        return value
    raw_data = getattr(pref, "raw_data", None)
    if isinstance(raw_data, dict):
        if key in raw_data:
            return raw_data.get(key)
    return None


def _normalize_preference(pref: Any) -> PreferenceDTO:
    return PreferenceDTO(
        age=_to_int(_get_pref_value(pref, "age")),
        gender=_get_pref_value(pref, "gender"),
        height_cm=_to_int(_get_pref_value(pref, "height_cm") or _get_pref_value(pref, "height")),
        weight_kg=_to_int(_get_pref_value(pref, "weight_kg") or _get_pref_value(pref, "weight")),
        activity_level=_get_pref_value(pref, "activity_level"),
        nutrition_goal=_get_pref_value(pref, "nutrition_goal"),
        meals_per_day=_to_int(_get_pref_value(pref, "meals_per_day")) or 3,
        budget_range=_get_pref_value(pref, "budget_range"),
        cooking_time_preference=_get_pref_value(pref, "cooking_time_preference"),
        dietary_restrictions=_get_pref_value(pref, "dietary_restrictions") or [],
        preferred_cuisines=_get_pref_value(pref, "preferred_cuisines") or [],
        language=_get_pref_value(pref, "language") or _get_pref_value(pref, "lang"),
    )


def _normalize_token(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower())
    return normalized.strip("_")


def _normalize_cuisine_list(values: List[str]) -> set[str]:
    return {token for token in (_normalize_token(v) for v in values) if token}


def _recipe_matches_preferred_cuisines(recipe_cuisine: Any, allowed: set[str]) -> bool:
    if not allowed:
        return True
    if not recipe_cuisine:
        return False
    parts = re.split(r"[,/;|]+", str(recipe_cuisine))
    for part in parts:
        if _normalize_token(part) in allowed:
            return True
    return False


def _normalize_allergens(value: Any) -> set[str]:
    if not value:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip().lower() for item in value if item}
    return {str(value).strip().lower()}


def _dietary_flag_truthy(flags: Any, key: str) -> bool:
    if not isinstance(flags, dict):
        return False
    value = flags.get(key)
    if value is None:
        value = flags.get(key.lower())
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"true", "1", "yes", "y"}


def _violates_allergen_restriction(allergens: set[str], restriction: str) -> bool:
    if not allergens:
        return True
    if "gluten" in restriction:
        return any("gluten" in allergen for allergen in allergens)
    if "dairy" in restriction:
        return any("dairy" in allergen for allergen in allergens)
    if "nut" in restriction:
        return any("nut" in allergen for allergen in allergens)
    return False


def _cooking_time_bounds(value: Any) -> tuple[Optional[int], Optional[int]]:
    if value is None:
        return None, None
    normalized = str(value).strip().lower()
    if normalized in {"under_15_min", "under15", "<15"}:
        return None, 15
    if normalized in {"15_30_min", "15-30", "15_30"}:
        return 15, 30
    if normalized in {"30_60_min", "30-60", "30_60"}:
        return 30, 60
    if normalized in {"over_60_min", "60_plus", ">60"}:
        return 60, None
    if "quick" in normalized or "fast" in normalized:
        return None, 30
    if "moderate" in normalized or "medium" in normalized:
        return 30, 60
    if "slow" in normalized or "long" in normalized:
        return 60, None
    return None, None


def _request_with_chat(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
) -> str:
    if client is None:
        return ""
    request_kwargs = {
        "model": model or OPENAI_MACRO_MODEL,
        "max_tokens": max_tokens or OPENAI_MACRO_MAX_TOKENS,
        "temperature": temperature,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    try:
        response = client.chat.completions.create(**request_kwargs)
    except TypeError as exc:
        if "response_format" not in str(exc):
            raise
        request_kwargs.pop("response_format", None)
        response = client.chat.completions.create(**request_kwargs)
    content = response.choices[0].message.content if response.choices else ""
    return content.strip() if content else ""


def _is_english(value: Optional[str]) -> bool:
    if not value:
        return False
    normalized = str(value).strip().lower()
    if normalized in {"en", "eng", "english"}:
        return True
    return normalized.startswith("en-") or normalized.startswith("en_")


def _extract_json(raw_text: str) -> Optional[Dict[str, Any]]:
    if not raw_text:
        return None
    candidates: list[str] = []
    trimmed = raw_text.strip()
    if trimmed:
        candidates.append(trimmed)
        if "```" in trimmed:
            for segment in trimmed.split("```"):
                seg = segment.strip()
                if not seg:
                    continue
                if seg.lower().startswith("json"):
                    seg = seg[4:].strip()
                candidates.append(seg)
        first = trimmed.find("{")
        last = trimmed.rfind("}")
        if first != -1 and last != -1 and last > first:
            candidates.append(trimmed[first:last + 1])

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    return None


def _format_cooking_time_preference(value: Optional[str]) -> str:
    min_minutes, max_minutes = _cooking_time_bounds(value)
    if min_minutes is None and max_minutes is None:
        return "no limit"
    if min_minutes is None:
        return f"up to {max_minutes} minutes"
    if max_minutes is None:
        return f"{min_minutes} minutes or more"
    return f"between {min_minutes} and {max_minutes} minutes"


def _validate_generated_meals(
    payload: Dict[str, Any],
    meal_slots: List[str],
    dto: PreferenceDTO,
) -> tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    if not isinstance(payload, dict):
        return None, "OpenAI meal response was not a JSON object."

    error = payload.get("error")
    if error:
        return None, str(error)

    meals = payload.get("meals")
    if not isinstance(meals, list):
        return None, "OpenAI meal response missing meals list."

    expected_slots = list(meal_slots)
    allowed_cuisines = _normalize_cuisine_list(dto.preferred_cuisines)
    dietary_restrictions = [str(r).lower() for r in (dto.dietary_restrictions or []) if r]
    min_minutes, max_minutes = _cooking_time_bounds(dto.cooking_time_preference)

    type_counts: Dict[str, int] = {key: 0 for key in {"breakfast", "lunch", "dinner", "snack"}}
    normalized_meals: List[Dict[str, Any]] = []

    for meal in meals:
        if not isinstance(meal, dict):
            return None, "OpenAI meal entry was not an object."
        meal_type = str(meal.get("meal_type", "")).strip().lower()
        if meal_type not in {"breakfast", "lunch", "dinner", "snack"}:
            return None, f"Invalid meal_type '{meal_type}'."
        type_counts[meal_type] = type_counts.get(meal_type, 0) + 1

        cuisine = meal.get("cuisine")
        if allowed_cuisines and not _recipe_matches_preferred_cuisines(cuisine, allowed_cuisines):
            return None, "Meal cuisine is outside preferred cuisines."

        cook_time = meal.get("cook_time_minutes")
        if min_minutes is not None or max_minutes is not None:
            if cook_time is None:
                return None, "Missing cook_time_minutes for cooking time preference."
            try:
                cook_time_value = float(cook_time)
            except (TypeError, ValueError):
                return None, "Invalid cook_time_minutes value."
            if min_minutes is not None and cook_time_value < min_minutes:
                return None, "Meal cook_time_minutes is below the preferred range."
            if max_minutes is not None and cook_time_value > max_minutes:
                return None, "Meal cook_time_minutes exceeds the preferred range."

        flags = meal.get("dietary_flags", {}) if isinstance(meal.get("dietary_flags"), dict) else {}
        allergens = _normalize_allergens(meal.get("allergens"))
        for restriction in dietary_restrictions:
            if restriction == "none":
                continue
            if restriction == "vegan":
                if not _dietary_flag_truthy(flags, "is_vegan"):
                    return None, "Meal violates vegan restriction."
            elif restriction == "vegetarian":
                if not (_dietary_flag_truthy(flags, "is_vegetarian") or _dietary_flag_truthy(flags, "is_vegan")):
                    return None, "Meal violates vegetarian restriction."
            elif restriction == "gluten_free" or "gluten" in restriction:
                if _violates_allergen_restriction(allergens, "gluten"):
                    return None, "Meal contains gluten."
            elif restriction == "dairy_free" or "dairy" in restriction:
                if _violates_allergen_restriction(allergens, "dairy"):
                    return None, "Meal contains dairy."
            elif restriction == "nut_free" or "nut" in restriction:
                if _violates_allergen_restriction(allergens, "nut"):
                    return None, "Meal contains nuts."

        try:
            calories = float(meal.get("calories", 0))
            protein = float(meal.get("protein", 0))
            carbs = float(meal.get("carbs", 0))
            fat = float(meal.get("fat", 0))
        except (TypeError, ValueError):
            return None, "Invalid macro values in meal response."

        ingredients = meal.get("ingredients")
        if isinstance(ingredients, str):
            ingredients = [item.strip() for item in ingredients.split(",") if item.strip()]
        if not isinstance(ingredients, list):
            ingredients = []

        instructions = meal.get("instructions")
        if isinstance(instructions, str):
            instructions = [instructions.strip()] if instructions.strip() else []
        if not isinstance(instructions, list):
            instructions = []

        tags = []
        cuisine = meal.get("cuisine")
        if cuisine:
            tags.append(str(cuisine))

        normalized_meals.append(
            {
                "id": None,
                "name": _jsonify_value(meal.get("name") or "Recipe"),
                "meal_type": meal_type,
                "calories": calories,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "url": None,
                "instructions": _format_instructions(instructions),
                "ingredients": _jsonify_value(ingredients),
                "tags": tags,
            }
        )

    expected_counts: Dict[str, int] = {}
    for slot in expected_slots:
        expected_counts[slot] = expected_counts.get(slot, 0) + 1
    if len(meals) != len(expected_slots):
        return None, "Meal count does not match expected slots."
    for meal_type, count in type_counts.items():
        expected_count = expected_counts.get(meal_type, 0)
        if count != expected_count:
            return None, f"Expected {expected_count} '{meal_type}' meal(s) but got {count}."

    return normalized_meals, None


def _generate_meals_with_openai(
    dto: PreferenceDTO,
    meal_slots: List[str],
    targets: Dict[str, float],
    avoid_names: Optional[List[str]] = None,
    remaining_targets: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    if client is None:
        return {"meals": [], "error": "Meal generation is disabled because OPENAI_API_KEY is not configured."}

    total_targets = remaining_targets or targets
    cooking_text = _format_cooking_time_preference(dto.cooking_time_preference)
    cuisine_text = ", ".join(dto.preferred_cuisines) if dto.preferred_cuisines else "none"
    restrictions_text = ", ".join(dto.dietary_restrictions) if dto.dietary_restrictions else "none"
    avoid_text = ", ".join(avoid_names) if avoid_names else "none"

    slot_counts: Dict[str, int] = {}
    for slot in meal_slots:
        slot_counts[slot] = slot_counts.get(slot, 0) + 1
    slot_summary = ", ".join(f"{slot} x{count}" for slot, count in slot_counts.items())

    prompt = f"""
Create meals for these slots: {slot_summary}.

Total targets for ALL returned meals (sum across meals):
- calories: {round(total_targets.get("calories", 0), 2)}
- protein: {round(total_targets.get("protein", 0), 2)} g
- carbs: {round(total_targets.get("carbs", 0), 2)} g
- fat: {round(total_targets.get("fat", 0), 2)} g

Constraints:
- Dietary restrictions: {restrictions_text}
- Preferred cuisines (allow-list, strict): {cuisine_text}
- Cooking time per meal: {cooking_text}
- Avoid repeating these meal names: {avoid_text}

Return JSON only, matching the system schema.
"""

    messages = [
        {"role": "system", "content": MEAL_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    raw_text = _request_with_chat(
        messages,
        temperature=0.3,
        model=OPENAI_MEAL_MODEL,
        max_tokens=OPENAI_MEAL_MAX_TOKENS,
    )
    payload = _extract_json(raw_text)
    if not payload:
        return {"meals": [], "error": "Failed to parse meal generation response."}

    meals, error = _validate_generated_meals(payload, meal_slots, dto)
    if error:
        return {"meals": [], "error": error}
    return {"meals": meals, "error": None}


def generate_daily_macro_goal(pref: Any) -> Dict[str, Any]:
    if client is None:
        return {
            "goal": None,
            "error": (
                "Macro target generator is disabled because OPENAI_API_KEY is not configured."
            ),
        }

    dto = _normalize_preference(pref)
    prompt = f"""
Create daily calorie and macro targets for this profile:
- Age: {dto.age or 'unknown'}
- Gender: {dto.gender or 'unknown'}
- Height: {dto.height_cm or 'unknown'} cm
- Weight: {dto.weight_kg or 'unknown'} kg
- Activity level: {dto.activity_level or 'unknown'}
- Nutrition goal: {dto.nutrition_goal or 'unknown'}
- Meals per day: {dto.meals_per_day}
- Budget range: {dto.budget_range or 'unknown'}
- Cooking time preference: {dto.cooking_time_preference or 'unknown'}
- Dietary restrictions: {', '.join(dto.dietary_restrictions) if dto.dietary_restrictions else 'none'}
- Preferred cuisines: {', '.join(dto.preferred_cuisines) if dto.preferred_cuisines else 'no preference'}

Return ONLY JSON matching the schema in the system prompt.
"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    try:
        raw_text = _request_with_chat(messages)
    except OpenAIError as exc:
        logger.exception("OpenAI macro target request failed: %s", exc)
        return {"goal": None, "error": str(exc)}
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected failure during macro target generation")
        return {"goal": None, "error": str(exc)}

    payload = _extract_json(raw_text)
    if not payload:
        return {"goal": None, "error": "Failed to parse macro targets from the AI response."}

    return {"goal": payload, "error": None}


def _normalize_column_name(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _find_column(columns: Iterable[str], candidates: Iterable[str]) -> Optional[str]:
    normalized = { _normalize_column_name(col): col for col in columns }
    for candidate in candidates:
        needle = _normalize_column_name(candidate)
        if needle in normalized:
            return normalized[needle]
        for key, original in normalized.items():
            if needle and needle in key:
                return original
    return None


def _budget_filter(df, budget_range: Optional[str], cost_col: Optional[str], tier_col: Optional[str]):
    if df.empty or not budget_range or budget_range == "no_limit":
        return df
    normalized = str(budget_range).strip().lower()

    if cost_col is not None:
        import pandas as pd
        series = df[cost_col]
        numeric = pd.to_numeric(series, errors="coerce")
        if numeric.notna().any():
            lower = numeric.quantile(0.33)
            upper = numeric.quantile(0.66)
            if "budget" in normalized or "cheap" in normalized:
                return df[numeric <= lower]
            if "moderate" in normalized or "mid" in normalized or "balanced" in normalized:
                return df[(numeric > lower) & (numeric <= upper)]
            if "premium" in normalized or "high" in normalized or "expensive" in normalized:
                return df[numeric > upper]

    if tier_col is not None:
        tiers = df[tier_col].astype(str).str.lower()
        if "budget" in normalized or "cheap" in normalized:
            return df[tiers.str.contains("budget|cheap|low", regex=True, na=False)]
        if "moderate" in normalized or "mid" in normalized or "balanced" in normalized:
            return df[tiers.str.contains("moderate|medium|mid|balanced", regex=True, na=False)]
        if "premium" in normalized or "high" in normalized or "expensive" in normalized:
            return df[tiers.str.contains("premium|high|expensive|lux", regex=True, na=False)]

    return df


def _get_user_id(pref: Any) -> Optional[UUID]:
    if isinstance(pref, dict):
        return pref.get("user_id") or pref.get("userId")
    return getattr(pref, "user_id", None)


def _get_user_ratings(db: Session, user_id: UUID) -> tuple[set[UUID], set[UUID]]:
    stmt = select(Rating.recipe_id, Rating.is_liked).where(Rating.user_id == user_id)
    result = db.execute(stmt)

    liked_ids: set[UUID] = set()
    disliked_ids: set[UUID] = set()
    for recipe_id, is_liked in result:
        if is_liked:
            liked_ids.add(recipe_id)
        else:
            disliked_ids.add(recipe_id)
    return liked_ids, disliked_ids


def _get_last_week_recipes(db: Session, user_id: UUID) -> set[UUID]:
    stmt = (
        select(Preference)
        .where(
            Preference.user_id == user_id,
            Preference.raw_data["plan_status"].astext == "success",
        )
        .order_by(Preference.submitted_at.desc())
        .limit(1)
    )
    result = db.execute(stmt)
    last_pref = result.scalar_one_or_none()
    if not last_pref:
        return set()
    stmt = select(PlanRecipe.recipe_id).where(PlanRecipe.preference_id == last_pref.id)
    result = db.execute(stmt)
    return {recipe_id for (recipe_id,) in result}


def _apply_preference_filters(
    df,
    dto: PreferenceDTO,
    meta: Dict[str, Optional[str]],
    db: Optional[Session],
    pref: Any,
):
    if df.empty:
        return df

    import pandas as pd

    filtered = df

    # Preferred cuisines (allow-list)
    allowed_cuisines = _normalize_cuisine_list(dto.preferred_cuisines)
    cuisine_col = meta.get("cuisine")
    if allowed_cuisines and cuisine_col in filtered.columns:
        filtered = filtered[
            filtered[cuisine_col].apply(
                lambda value: _recipe_matches_preferred_cuisines(value, allowed_cuisines)
            )
        ]

    # Dietary restrictions
    dietary_restrictions = [str(r).lower() for r in (dto.dietary_restrictions or []) if r]
    if dietary_restrictions:
        flags_col = meta.get("dietary_flags")
        allergens_col = meta.get("allergens")

        def _passes_restrictions(row) -> bool:
            flags = row.get(flags_col) if flags_col in row else None
            allergens = _normalize_allergens(row.get(allergens_col)) if allergens_col in row else set()
            for restriction in dietary_restrictions:
                if restriction == "none":
                    continue
                if restriction == "vegan":
                    if not _dietary_flag_truthy(flags, "is_vegan"):
                        return False
                elif restriction == "vegetarian":
                    if not (_dietary_flag_truthy(flags, "is_vegetarian") or _dietary_flag_truthy(flags, "is_vegan")):
                        return False
                elif restriction == "gluten_free" or "gluten" in restriction:
                    if _violates_allergen_restriction(allergens, "gluten"):
                        return False
                elif restriction == "dairy_free" or "dairy" in restriction:
                    if _violates_allergen_restriction(allergens, "dairy"):
                        return False
                elif restriction == "nut_free" or "nut" in restriction:
                    if _violates_allergen_restriction(allergens, "nut"):
                        return False
            return True

        filtered = filtered[filtered.apply(_passes_restrictions, axis=1)]

    # Exclude disliked and last week's recipes (if available)
    if db is not None:
        user_id = _get_user_id(pref)
        if user_id is not None:
            _liked_ids, disliked_ids = _get_user_ratings(db, user_id)
            last_week_ids = _get_last_week_recipes(db, user_id)
            banned_ids = disliked_ids | last_week_ids
            if banned_ids and "_id" in filtered.columns:
                filtered = filtered[~filtered["_id"].isin(banned_ids)]

    # Cooking time filter (enforced, but dropped if it yields no matches)
    time_col = meta.get("total_time_minutes")
    if dto.cooking_time_preference and time_col in filtered.columns:
        min_minutes, max_minutes = _cooking_time_bounds(dto.cooking_time_preference)
        if min_minutes is not None or max_minutes is not None:
            series = pd.to_numeric(filtered[time_col], errors="coerce")
            mask = series.notna()
            if min_minutes is not None:
                mask &= series >= min_minutes
            if max_minutes is not None:
                mask &= series <= max_minutes
            time_filtered = filtered[mask]
            if not time_filtered.empty:
                filtered = time_filtered

    return filtered


def _load_recipes_df(db: Session):
    try:
        import pandas as pd
    except ImportError as exc:
        raise RuntimeError(
            "pandas is required to load recipes from the database."
        ) from exc

    if db is None:
        raise RuntimeError("Database session is required to load recipes.")

    def _flatten_ingredients(value):
        if isinstance(value, list):
            items = []
            for item in value:
                if isinstance(item, dict):
                    text = item.get("original_text") or item.get("name")
                    if text:
                        items.append(str(text))
                elif item is not None:
                    items.append(str(item))
            return items
        if value is None:
            return []
        return [str(value)]

    def _normalize_instructions(value):
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()]
        if isinstance(value, str):
            return [value]
        return [str(value)]

    stmt = select(
        Recipe.id,
        Recipe.slug,
        Recipe.title,
        Recipe.source_url,
        Recipe.image_url,
        Recipe.description,
        Recipe.ingredients,
        Recipe.instructions,
        Recipe.nutrition,
        Recipe.tags,
        Recipe.meal_type,
        Recipe.dish_type,
        Recipe.cuisine,
        Recipe.dietary_flags,
        Recipe.allergens,
        Recipe.popularity_score,
        Recipe.health_score,
        Recipe.prep_time_minutes,
        Recipe.cook_time_minutes,
        Recipe.total_time_minutes,
        Recipe.cost_per_serving_cents,
        Recipe.cost_category,
    ).where(Recipe.is_active.is_(True))
    result = db.execute(stmt)
    rows = result.mappings().all()
    df = pd.DataFrame(rows)

    if df.empty:
        return df

    # Derived/normalized fields for downstream filters
    if "meal_type" in df.columns:
        normalized_meal = df["meal_type"].astype(str).str.lower()
        df["is_breakfast"] = normalized_meal == "breakfast"
        df["is_lunch"] = normalized_meal == "lunch"

    if "ingredients" in df.columns:
        # Preserve original structured ingredients; create a flattened helper for text filters/tokenization.
        df["ingredients_flat"] = df["ingredients"].apply(_flatten_ingredients)

    if "instructions" in df.columns:
        df["instructions"] = df["instructions"].apply(_normalize_instructions)

    if "title" in df.columns and "name" not in df.columns:
        df["name"] = df["title"]

    if "source_url" in df.columns and "url" not in df.columns:
        df["url"] = df["source_url"]

    return df


def _prepare_recipes(df):
    import pandas as pd

    nutrition_col = _find_column(df.columns, ["nutrition", "nutrients", "macros"])
    calories_col = _find_column(
        df.columns, ["calories", "kcal", "energykcal", "energy", "calorie"]
    )
    protein_col = _find_column(df.columns, ["protein", "proteing", "protein_grams"])
    carbs_col = _find_column(df.columns, ["carbs", "carbohydrates", "carbsg"])
    fat_col = _find_column(df.columns, ["fat", "fatg", "totalfat"])
    name_col = _find_column(df.columns, ["name", "title", "recipe", "recipe_name"])
    tags_col = _find_column(df.columns, ["tags", "categories", "labels"])
    instructions_col = _find_column(df.columns, ["instructions", "instruction", "steps", "directions"])
    ingredients_col = _find_column(df.columns, ["ingredients", "ingredient_list"])
    ingredients_flat_col = _find_column(df.columns, ["ingredients_flat"])
    meal_col = _find_column(df.columns, ["meal_type", "meal", "course", "category", "dish_type"])
    breakfast_col = _find_column(df.columns, ["is_breakfast", "breakfast"])
    lunch_col = _find_column(df.columns, ["is_lunch", "lunch"])
    cost_col = _find_column(df.columns, ["price", "cost", "amount", "price_value", "cost_per_serving", "cost_per_serving_cents"])
    tier_col = _find_column(
        df.columns,
        ["price_tier", "budget_range", "price_level", "cost_level", "price_category", "cost_category"],
    )
    cuisine_col = _find_column(df.columns, ["cuisine", "region", "cuisine_type"])
    dietary_flags_col = _find_column(df.columns, ["dietary_flags", "dietary", "diet_flags", "diet"])
    allergens_col = _find_column(df.columns, ["allergens", "allergy", "allergies"])
    total_time_col = _find_column(df.columns, ["total_time_minutes", "total_time", "time_total", "cook_time_total"])
    id_col = _find_column(df.columns, ["id", "recipe_id", "slug"])
    url_col = _find_column(df.columns, ["url", "link", "source_url"])

    df = df.copy()

    def _nutrition_value(row, key):
        if nutrition_col is None:
            return None
        payload = row.get(nutrition_col)
        if isinstance(payload, dict):
            return payload.get(key)
        if isinstance(payload, str):
            try:
                parsed = json.loads(payload)
            except json.JSONDecodeError:
                return None
            if isinstance(parsed, dict):
                payload = parsed
            else:
                return None
        if isinstance(payload, dict):
            if key == "calories_kcal":
                return payload.get("calories_kcal") or payload.get("calories")
            return payload.get(key)
        return None

    if nutrition_col:
        df["_calories"] = pd.to_numeric(
            df.apply(lambda row: _nutrition_value(row, "calories_kcal"), axis=1),
            errors="coerce",
        )
        df["_protein"] = pd.to_numeric(
            df.apply(lambda row: _nutrition_value(row, "protein_g"), axis=1),
            errors="coerce",
        )
        df["_carbs"] = pd.to_numeric(
            df.apply(lambda row: _nutrition_value(row, "carbs_g"), axis=1),
            errors="coerce",
        )
        df["_fat"] = pd.to_numeric(
            df.apply(lambda row: _nutrition_value(row, "fat_g"), axis=1),
            errors="coerce",
        )
    else:
        df["_calories"] = pd.to_numeric(df[calories_col], errors="coerce") if calories_col else 0
        df["_protein"] = pd.to_numeric(df[protein_col], errors="coerce") if protein_col else 0
        df["_carbs"] = pd.to_numeric(df[carbs_col], errors="coerce") if carbs_col else 0
        df["_fat"] = pd.to_numeric(df[fat_col], errors="coerce") if fat_col else 0

    df["_name"] = df[name_col] if name_col else "Recipe"
    df["_tags"] = df[tags_col] if tags_col else None
    df["_meal_type"] = df[meal_col] if meal_col else None
    df["_instructions"] = df[instructions_col] if instructions_col else None
    df["_ingredients"] = df[ingredients_col] if ingredients_col else None
    df["_ingredients_flat"] = df[ingredients_flat_col] if ingredients_flat_col else df["_ingredients"]
    df["_is_breakfast"] = df[breakfast_col] if breakfast_col else None
    df["_is_lunch"] = df[lunch_col] if lunch_col else None
    df["_id"] = df[id_col] if id_col else df.index
    df["_url"] = df[url_col] if url_col else None

    for key in ["_calories", "_protein", "_carbs", "_fat"]:
        df[key] = df[key].fillna(0)

    return df, {
        "meal": meal_col,
        "tags": tags_col,
        "cost": cost_col,
        "tier": tier_col,
        "breakfast": breakfast_col,
        "lunch": lunch_col,
        "ingredients": ingredients_col,
        "cuisine": cuisine_col,
        "dietary_flags": dietary_flags_col,
        "allergens": allergens_col,
        "total_time_minutes": total_time_col,
    }


def _build_meal_slots(meals_per_day: int) -> List[str]:
    slots = ["breakfast", "lunch", "dinner"]
    extra = max(meals_per_day - 3, 0)
    slots.extend(["snack"] * extra)
    slots = slots[: max(meals_per_day, 1)]
    if "dinner" not in slots:
        if slots:
            slots[-1] = "dinner"
        else:
            slots = ["dinner"]
    return slots


def _score_recipe(row, targets: Dict[str, float]) -> float:
    calorie_score = (row["_calories"] - targets["calories"]) ** 2
    protein_score = (row["_protein"] - targets["protein"]) ** 2
    carbs_score = (row["_carbs"] - targets["carbs"]) ** 2
    fat_score = (row["_fat"] - targets["fat"]) ** 2
    return calorie_score + protein_score + carbs_score + fat_score


def _jsonify_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _jsonify_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonify_value(item) for item in value]
    item_fn = getattr(value, "item", None)
    if callable(item_fn):
        try:
            return item_fn()
        except Exception:
            return str(value)
    return str(value)


def _format_instructions(value: Any) -> str:
    if value is None:
        return ""

    list_value: Optional[List[Any]] = None

    if isinstance(value, (list, tuple)):
        list_value = list(value)
    else:
        tolist_fn = getattr(value, "tolist", None)
        if callable(tolist_fn):
            try:
                list_value = list(tolist_fn())
            except Exception:
                list_value = None

    if list_value is not None:
        return " ".join(str(item).strip() for item in list_value if str(item).strip())

    if isinstance(value, str):
        text = value.strip()
        if text.startswith("[") and text.endswith("]"):
            parsed = None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                try:
                    parsed = ast.literal_eval(text)
                except (ValueError, SyntaxError):
                    parsed = None
            if isinstance(parsed, (list, tuple)):
                return " ".join(str(item).strip() for item in parsed if str(item).strip())

            quoted = re.findall(r"'([^']+)'|\"([^\"]+)\"", text)
            if quoted:
                segments = [a or b for a, b in quoted if (a or b)]
                return " ".join(segment.strip() for segment in segments if segment.strip())

        return text

    return str(value)


def _format_list_values(value: Any) -> List[str]:
    """Normalize a heterogeneous value into a list of readable strings."""
    if value is None:
        return []

    def _extract(item: Any) -> Optional[str]:
        if item is None:
            return None
        if isinstance(item, dict):
            text = item.get("original_text") or item.get("name") or item.get("text")
            if text is None:
                return None
            text = str(text).strip()
            return text if text else None
        text = str(item).strip()
        return text if text else None

    def _from_iterable(items: Iterable[Any]) -> List[str]:
        return [text for text in (_extract(it) for it in items) if text]

    # Already a list/tuple/set
    if isinstance(value, (list, tuple, set)):
        return _from_iterable(value)

    # Numpy/pandas objects that support tolist()
    tolist_fn = getattr(value, "tolist", None)
    if callable(tolist_fn):
        try:
            return _from_iterable(tolist_fn())
        except Exception:
            pass

    # String that might encode a list/dict
    if isinstance(value, str):
        text = value.strip()

        # List encoded as string
        if text.startswith("[") and text.endswith("]"):
            parsed = None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                try:
                    parsed = ast.literal_eval(text)
                except (ValueError, SyntaxError):
                    parsed = None
            if isinstance(parsed, (list, tuple, set)):
                return _from_iterable(parsed)

        # Dict encoded as string: try to extract original_text/name
        if text.startswith("{") and text.endswith("}"):
            parsed_dict = None
            try:
                parsed_dict = ast.literal_eval(text)
            except Exception:
                parsed_dict = None
            if isinstance(parsed_dict, dict):
                extracted = _extract(parsed_dict)
                return [extracted] if extracted else []

        extracted = _extract(text)
        return [extracted] if extracted else []

    extracted = _extract(value)
    return [extracted] if extracted else []


def _tag_matches(meal_type: str, value: Any) -> bool:
    keywords = MEAL_TAG_KEYWORDS.get(meal_type, [])
    if not keywords or value is None:
        return False
    if isinstance(value, str):
        tags = [value]
    elif isinstance(value, (list, tuple, set)):
        tags = value
    else:
        return False

    for tag in tags:
        normalized = str(tag).lower()
        for keyword in keywords:
            if keyword in normalized:
                return True
    return False


def _pick_recipe(df, meal_type: str, targets: Dict[str, float], used_ids: set) -> Dict[str, Any]:
    candidates = df
    if "_id" in df.columns and used_ids:
        candidates = candidates[~candidates["_id"].isin(used_ids)]
    base_candidates = candidates

    if meal_type == "breakfast" and "_is_breakfast" in candidates.columns:
        breakfast_mask = candidates["_is_breakfast"].fillna(False).astype(bool)
        breakfast_filtered = candidates[breakfast_mask]
        if not breakfast_filtered.empty:
            candidates = breakfast_filtered

    if meal_type in {"lunch", "snack"} and "_is_lunch" in candidates.columns:
        lunch_mask = candidates["_is_lunch"].fillna(False).astype(bool)
        lunch_filtered = candidates[lunch_mask]
        if not lunch_filtered.empty:
            candidates = lunch_filtered

    if "_tags" in candidates.columns and candidates["_tags"].notna().any():
        tag_filtered = candidates[candidates["_tags"].apply(lambda value: _tag_matches(meal_type, value))]
        if not tag_filtered.empty:
            candidates = tag_filtered

    if "_meal_type" in candidates.columns and candidates["_meal_type"].notna().any():
        filtered = candidates[
            candidates["_meal_type"]
            .astype(str)
            .str.contains(meal_type, case=False, na=False)
        ]
        if not filtered.empty:
            candidates = filtered

    if candidates.empty:
        candidates = base_candidates if not base_candidates.empty else df

    scored = candidates.copy()
    scored["_score"] = scored.apply(lambda row: _score_recipe(row, targets), axis=1)
    # Add a bit of randomness so consecutive days don't always pick the single best.
    top_k = min(5, len(scored))
    top = scored.nsmallest(top_k, "_score")
    best = top.sample(1).iloc[0] if top_k > 1 else top.iloc[0]

    return {
        "id": _jsonify_value(best.get("_id")),
        "name": _jsonify_value(best.get("_name") or "Recipe"),
        "meal_type": meal_type,
        "calories": float(best.get("_calories", 0)),
        "protein": float(best.get("_protein", 0)),
        "carbs": float(best.get("_carbs", 0)),
        "fat": float(best.get("_fat", 0)),
        "url": _jsonify_value(best.get("_url")),
        "instructions": _format_instructions(best.get("_instructions")),
        # Preserve structured ingredients (list of dicts) so frontend can render qty/unit/name cleanly.
        "ingredients": _jsonify_value(best.get("_ingredients")),
        "tags": _format_list_values(best.get("_tags")),
    }


def match_recipes_to_macro_goal(
    pref: Any,
    macro_goal: Dict[str, Any],
    recipes_df=None,
    used_names: Optional[set] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    if not macro_goal:
        return {"meals": [], "totals": None, "error": "Missing macro targets."}

    dto = _normalize_preference(pref)

    meal_slots = _build_meal_slots(dto.meals_per_day or 3)

    macro_targets = macro_goal.get("macroTargets") if isinstance(macro_goal, dict) else None
    targets = {
        "calories": float(macro_goal.get("calorieTarget", 0)),
        "protein": float(macro_targets.get("protein", 0)) if isinstance(macro_targets, dict) else 0.0,
        "carbs": float(macro_targets.get("carbs", 0)) if isinstance(macro_targets, dict) else 0.0,
        "fat": float(macro_targets.get("fat", 0)) if isinstance(macro_targets, dict) else 0.0,
    }

    avoid_names = []
    if isinstance(used_names, set) and used_names:
        avoid_names = [str(item) for item in used_names]

    meal_result = _generate_meals_with_openai(
        dto=dto,
        meal_slots=meal_slots,
        targets=targets,
        avoid_names=avoid_names,
    )
    if meal_result.get("error"):
        return {"meals": [], "totals": None, "error": meal_result["error"]}

    selected = meal_result.get("meals") or []

    totals = {
        "calories": round(sum(item["calories"] for item in selected), 2),
        "protein": round(sum(item["protein"] for item in selected), 2),
        "carbs": round(sum(item["carbs"] for item in selected), 2),
        "fat": round(sum(item["fat"] for item in selected), 2),
    }

    return {
        "meals": selected,
        "totals": totals,
        "error": None,
    }


def _format_meal(recipe: Dict[str, Any], fallback_name: str) -> Dict[str, Any]:
    name = recipe.get("name") or fallback_name
    url = recipe.get("url")
    instructions = recipe.get("instructions") or (f"Recipe link: {url}" if url else "")
    return {
        "id": recipe.get("id"),
        "name": name,
        "calories": float(recipe.get("calories", 0)),
        "protein": float(recipe.get("protein", 0)),
        "carbs": float(recipe.get("carbs", 0)),
        "fat": float(recipe.get("fat", 0)),
        "cookTime": "",
        "tags": recipe.get("tags") or [],
        "ingredients": recipe.get("ingredients") or [],
        "instructions": instructions,
    }


def _aggregate_snacks(recipes: List[Dict[str, Any]]) -> Dict[str, Any]:
    names = [meal.get("name") or "Snack" for meal in recipes]
    urls = [meal.get("url") for meal in recipes if meal.get("url")]
    instructions = " ".join(
        step for step in (meal.get("instructions") for meal in recipes) if step
    ).strip()
    if not instructions and urls:
        instructions = "Recipe links: " + ", ".join(urls[:3])
    return {
        "name": "Snacks: " + ", ".join(names[:3]) if names else "Snacks",
        "calories": float(sum(meal.get("calories", 0) for meal in recipes)),
        "protein": float(sum(meal.get("protein", 0) for meal in recipes)),
        "carbs": float(sum(meal.get("carbs", 0) for meal in recipes)),
        "fat": float(sum(meal.get("fat", 0) for meal in recipes)),
        "cookTime": "",
        "tags": [],
        "ingredients": [],
        "instructions": instructions,
    }


def _build_day_plan(day_name: str, recipes: List[Dict[str, Any]], totals: Dict[str, float]) -> Dict[str, Any]:
    meal_map: Dict[str, List[Dict[str, Any]]] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snack": [],
    }
    for meal in recipes:
        meal_type = str(meal.get("meal_type", "snack")).lower()
        if meal_type not in meal_map:
            meal_type = "snack"
        meal_map[meal_type].append(meal)

    meals_payload = {
        "Breakfast": _format_meal(meal_map["breakfast"][0], "Breakfast") if meal_map["breakfast"] else None,
        "Lunch": _format_meal(meal_map["lunch"][0], "Lunch") if meal_map["lunch"] else None,
        "Dinner": _format_meal(meal_map["dinner"][0], "Dinner") if meal_map["dinner"] else None,
        "Snacks": _aggregate_snacks(meal_map["snack"]) if meal_map["snack"] else None,
    }

    return {
        "name": day_name,
        "calories": round(totals.get("calories", 0), 2),
        "macros": {
            "protein": round(totals.get("protein", 0), 2),
            "carbs": round(totals.get("carbs", 0), 2),
            "fat": round(totals.get("fat", 0), 2),
        },
        "meals": meals_payload,
    }


def _build_weekly_plan(macro_goal: Dict[str, Any], days: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "calorieTarget": float(macro_goal.get("calorieTarget", 0)),
        "macroTargets": {
            "protein": float(macro_goal.get("macroTargets", {}).get("protein", 0)),
            "carbs": float(macro_goal.get("macroTargets", {}).get("carbs", 0)),
            "fat": float(macro_goal.get("macroTargets", {}).get("fat", 0)),
        },
        "days": days,
    }


def fill_missing_meals(
    plan: Dict[str, Any],
    pref: Any,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Fill missing meals in an existing plan using the same constraints as the planner."""
    if not plan or not isinstance(plan, dict):
        return {"plan": plan, "error": "Missing plan data."}

    dto = _normalize_preference(pref)

    macro_goal = {
        "calorieTarget": plan.get("calorieTarget", 0),
        "macroTargets": plan.get("macroTargets", {}),
    }
    targets = {
        "calories": float(macro_goal.get("calorieTarget", 0)),
        "protein": float(macro_goal.get("macroTargets", {}).get("protein", 0)),
        "carbs": float(macro_goal.get("macroTargets", {}).get("carbs", 0)),
        "fat": float(macro_goal.get("macroTargets", {}).get("fat", 0)),
    }

    used_names: List[str] = []
    for day in plan.get("days", []):
        meals = day.get("meals") if isinstance(day, dict) else None
        if not isinstance(meals, dict):
            continue
        for key in ("Breakfast", "Lunch", "Dinner", "Snacks"):
            meal = meals.get(key)
            if isinstance(meal, dict) and meal.get("name"):
                used_names.append(str(meal["name"]))

    meal_slots = _build_meal_slots(dto.meals_per_day or 3)
    snack_slots = [slot for slot in meal_slots if slot == "snack"]

    for day in plan.get("days", []):
        if not isinstance(day, dict):
            continue
        meals = day.get("meals")
        if not isinstance(meals, dict):
            meals = {}
            day["meals"] = meals

        current_totals = {
            "calories": 0.0,
            "protein": 0.0,
            "carbs": 0.0,
            "fat": 0.0,
        }
        for key in ("Breakfast", "Lunch", "Dinner", "Snacks"):
            meal = meals.get(key)
            if isinstance(meal, dict):
                current_totals["calories"] += float(meal.get("calories", 0))
                current_totals["protein"] += float(meal.get("protein", 0))
                current_totals["carbs"] += float(meal.get("carbs", 0))
                current_totals["fat"] += float(meal.get("fat", 0))

        missing_slots: List[str] = []
        if meals.get("Breakfast") is None and "breakfast" in meal_slots:
            missing_slots.append("breakfast")
        if meals.get("Lunch") is None and "lunch" in meal_slots:
            missing_slots.append("lunch")
        if meals.get("Dinner") is None and "dinner" in meal_slots:
            missing_slots.append("dinner")

        if snack_slots and meals.get("Snacks") is None:
            missing_slots.extend(["snack"] * len(snack_slots))

        if not missing_slots:
            continue

        remaining = {
            "calories": max(targets["calories"] - current_totals["calories"], 0),
            "protein": max(targets["protein"] - current_totals["protein"], 0),
            "carbs": max(targets["carbs"] - current_totals["carbs"], 0),
            "fat": max(targets["fat"] - current_totals["fat"], 0),
        }

        meal_result = _generate_meals_with_openai(
            dto=dto,
            meal_slots=missing_slots,
            targets=targets,
            remaining_targets=remaining,
            avoid_names=used_names,
        )
        if meal_result.get("error"):
            return {"plan": plan, "error": meal_result["error"]}

        new_snacks: List[Dict[str, Any]] = []
        for recipe in meal_result.get("meals") or []:
            if recipe.get("name"):
                used_names.append(str(recipe["name"]))
            if recipe.get("meal_type") == "snack":
                new_snacks.append(recipe)
            elif recipe.get("meal_type") == "breakfast":
                meals["Breakfast"] = _format_meal(recipe, "Breakfast")
            elif recipe.get("meal_type") == "lunch":
                meals["Lunch"] = _format_meal(recipe, "Lunch")
            elif recipe.get("meal_type") == "dinner":
                meals["Dinner"] = _format_meal(recipe, "Dinner")

        if new_snacks:
            meals["Snacks"] = _aggregate_snacks(new_snacks)

        # Recalculate totals for the day
        day_totals = {
            "calories": 0.0,
            "protein": 0.0,
            "carbs": 0.0,
            "fat": 0.0,
        }
        for key in ("Breakfast", "Lunch", "Dinner", "Snacks"):
            meal = meals.get(key)
            if isinstance(meal, dict):
                day_totals["calories"] += float(meal.get("calories", 0))
                day_totals["protein"] += float(meal.get("protein", 0))
                day_totals["carbs"] += float(meal.get("carbs", 0))
                day_totals["fat"] += float(meal.get("fat", 0))

        day["calories"] = round(day_totals["calories"], 2)
        day["macros"] = {
            "protein": round(day_totals["protein"], 2),
            "carbs": round(day_totals["carbs"], 2),
            "fat": round(day_totals["fat"], 2),
        }

    return {"plan": plan, "error": None}


def translate_plan(plan: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
    if not plan or not _is_english(language):
        return {"plan": plan, "error": None}

    translator = RecipeTranslator(target_language="English")
    if translator.client is None:
        return {"plan": plan, "error": "Translation disabled: OPENAI_API_KEY not configured."}

    translated_plan = copy.deepcopy(plan)
    failures = 0
    days = translated_plan.get("days", [])
    if isinstance(days, list):
        for day in days:
            meals = day.get("meals") if isinstance(day, dict) else None
            if not isinstance(meals, dict):
                continue
            for meal_key, meal in meals.items():
                if not isinstance(meal, dict):
                    continue
                result = translator.translate_recipe(meal)
                if result.error is None:
                    meals[meal_key] = result.data
                else:
                    failures += 1

    error = None
    if failures:
        error = f"Failed to translate {failures} meal(s)."
    return {"plan": translated_plan, "error": error}


def generate_daily_plan(pref: Any, translate: bool = False, db: Optional[Session] = None) -> Dict[str, Any]:
    macro_response = generate_daily_macro_goal(pref)
    if macro_response.get("error"):
        return {"plan": None, "raw_text": None, "error": macro_response["error"]}

    macro_goal = macro_response.get("goal")
    dto = _normalize_preference(pref)

    days: List[Dict[str, Any]] = []
    used_names: List[str] = []
    for day in WEEK_DAYS:
        recipe_match = match_recipes_to_macro_goal(
            pref,
            macro_goal,
            recipes_df=None,
            used_names=set(used_names),
            db=db,
        )
        if recipe_match.get("error"):
            return {"plan": None, "raw_text": None, "error": recipe_match["error"]}
        meals_for_day = recipe_match.get("meals") or []

        day_plan = _build_day_plan(day, meals_for_day, recipe_match.get("totals") or {})
        days.append(day_plan)
        for meal in meals_for_day:
            name = meal.get("name")
            if name:
                used_names.append(str(name))

    plan_payload = _build_weekly_plan(macro_goal, days)
    plan_language = "en" if translate and _is_english(dto.language) else "no"
    if translate and _is_english(dto.language):
        translation = translate_plan(plan_payload, dto.language)
        return {
            "plan": translation["plan"],
            "raw_text": None,
            "error": translation["error"],
            "language": "en",
        }
    return {"plan": plan_payload, "raw_text": None, "error": None, "language": plan_language}


def generate_daily_plan_for_preference(db: Session, pref_id: int) -> Dict[str, Any]:
    pref = db.get(Preference, pref_id)
    if pref is None:
        raise ValueError(f"Preference {pref_id} not found")
    return generate_daily_plan(pref, translate=False, db=db)
