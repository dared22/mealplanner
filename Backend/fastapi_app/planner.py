import ast
import json
import logging
import os
import re
from string import Template
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from uuid import UUID

import httpx
from openai import OpenAI, OpenAIError
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import PlanRecipe, Preference, Recipe
from planning_policy import (
    cooking_time_bounds,
    matches_cooking_time,
    matches_dietary_restrictions,
    matches_preferred_cuisines,
    meal_slots_for_day,
    normalize_cuisine_list,
    normalize_meal_slot,
    normalize_nutrition,
)

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MACRO_MODEL = os.getenv("OPENAI_PLAN_MODEL", "gpt-4o-mini")
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "120"))
OPENAI_MACRO_MAX_TOKENS = int(os.getenv("OPENAI_PLAN_MAX_TOKENS", "1000"))
OPENAI_MEAL_MODEL = os.getenv("OPENAI_MEAL_MODEL", OPENAI_MACRO_MODEL)
OPENAI_MEAL_MAX_TOKENS = int(os.getenv("OPENAI_MEAL_MAX_TOKENS", "1400"))
PLAN_BASE_LANGUAGE = os.getenv("PLAN_BASE_LANGUAGE") or os.getenv("RECIPE_BASE_LANGUAGE") or "no"

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

_MEAL_SYSTEM_PROMPT_TEMPLATE = Template(
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
    "- If impossible, return an empty meals array and a short error message.\n"
    "- IMPORTANT: All text content (name, ingredients, instructions) MUST be written in $language."
)

_LANGUAGE_LABELS = {
    "en": "English",
    "no": "Norwegian",
    "nb": "Norwegian",
    "nn": "Norwegian",
}


def _base_language_label() -> str:
    raw = (PLAN_BASE_LANGUAGE or "no").strip().lower()
    if raw.startswith("en"):
        code = "en"
    elif raw.startswith(("no", "nb", "nn")):
        code = "no"
    else:
        code = raw
    return _LANGUAGE_LABELS.get(code, "Norwegian")


MEAL_SYSTEM_PROMPT = _MEAL_SYSTEM_PROMPT_TEMPLATE.safe_substitute(language=_base_language_label())

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


def _request_with_chat(
    messages: List[Dict[str, str]],
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


def _normalize_language(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = str(value).strip().lower()
    if normalized.startswith("en"):
        return "en"
    if normalized.startswith(("no", "nb", "nn")):
        return "no"
    return normalized


def _extract_json(raw_text: str) -> Optional[Dict[str, Any]]:
    if not raw_text:
        return None
    candidates: List[str] = []
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
    min_minutes, max_minutes = cooking_time_bounds(value)
    if min_minutes is None and max_minutes is None:
        return "no limit"
    if min_minutes is None:
        return f"up to {max_minutes} minutes"
    if max_minutes is None:
        return f"{min_minutes} minutes or more"
    return f"between {min_minutes} and {max_minutes} minutes"


def _extract_targets(macro_goal: Dict[str, Any]) -> Dict[str, float]:
    """Extract macro targets from a macro goal dictionary."""
    macros = macro_goal.get("macroTargets")
    if not isinstance(macros, dict):
        macros = {}
    return {
        "calories": float(macro_goal.get("calorieTarget", 0)),
        "protein": float(macros.get("protein", 0)),
        "carbs": float(macros.get("carbs", 0)),
        "fat": float(macros.get("fat", 0)),
    }


MACRO_KEYS = ("calories", "protein", "carbs", "fat")


def _sum_meal_macros(meals: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    """Sum macro totals across a list of meals."""
    totals = {k: 0.0 for k in MACRO_KEYS}
    for meal in meals:
        if not isinstance(meal, dict):
            continue
        for k in MACRO_KEYS:
            totals[k] += float(meal.get(k, 0))
    return {k: round(v, 2) for k, v in totals.items()}


def _validate_meal_entry(meal: Dict[str, Any], dto: PreferenceDTO) -> Optional[str]:
    """Validate a single meal entry against constraints.

    Returns an error message if validation fails, or None if valid.
    """
    allowed_cuisines = normalize_cuisine_list(dto.preferred_cuisines)

    # Check cuisine
    cuisine = meal.get("cuisine")
    if allowed_cuisines and cuisine:
        if not matches_preferred_cuisines(cuisine, allowed_cuisines):
            # Relaxed: keep the meal but drop the mismatched cuisine to avoid hard failures.
            logger.warning(
                "Meal cuisine '%s' outside preferred cuisines %s; allowing meal without cuisine.",
                cuisine,
                sorted(allowed_cuisines),
            )
            meal["cuisine"] = None

    # Check cooking time
    cook_time = meal.get("cook_time_minutes")
    if not matches_cooking_time(cook_time, dto.cooking_time_preference):
        if cook_time is None:
            return "Missing cook_time_minutes for cooking time preference."
        try:
            float(cook_time)
        except (TypeError, ValueError):
            return "Invalid cook_time_minutes value."
        return "Meal cook_time_minutes is outside the preferred range."

    # Check dietary restrictions
    if not matches_dietary_restrictions(
        meal.get("dietary_flags"), meal.get("allergens"), dto.dietary_restrictions
    ):
        return "Meal violates dietary restrictions."

    return None


def _normalize_meal_entry(meal: Dict[str, Any]) -> Dict[str, Any]:
    """Extract and normalize fields from a meal entry."""
    try:
        calories = float(meal.get("calories", 0))
        protein = float(meal.get("protein", 0))
        carbs = float(meal.get("carbs", 0))
        fat = float(meal.get("fat", 0))
    except (TypeError, ValueError):
        raise ValueError("Invalid macro values in meal response.")

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

    meal_type = str(meal.get("meal_type", "")).strip().lower()
    return {
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
        "source": "ai",  # Track that this came from AI generation
    }


def _validate_slot_counts(
    meals: List[Dict[str, Any]],
    expected_slots: List[str],
) -> Optional[str]:
    """Validate that meal counts match expected slots."""
    type_counts: Dict[str, int] = {key: 0 for key in {"breakfast", "lunch", "dinner", "snack"}}
    for meal in meals:
        meal_type = meal.get("meal_type", "")
        type_counts[meal_type] = type_counts.get(meal_type, 0) + 1

    expected_counts: Dict[str, int] = {}
    for slot in expected_slots:
        expected_counts[slot] = expected_counts.get(slot, 0) + 1

    if len(meals) != len(expected_slots):
        return "Meal count does not match expected slots."

    for meal_type, count in type_counts.items():
        expected_count = expected_counts.get(meal_type, 0)
        if count != expected_count:
            return f"Expected {expected_count} '{meal_type}' meal(s) but got {count}."

    return None


def _validate_generated_meals(
    payload: Dict[str, Any],
    meal_slots: List[str],
    dto: PreferenceDTO,
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    if not isinstance(payload, dict):
        return None, "OpenAI meal response was not a JSON object."

    error = payload.get("error")
    if error:
        return None, str(error)

    meals = payload.get("meals")
    if not isinstance(meals, list):
        return None, "OpenAI meal response missing meals list."

    normalized_meals: List[Dict[str, Any]] = []

    for meal in meals:
        if not isinstance(meal, dict):
            return None, "OpenAI meal entry was not an object."

        meal_type = str(meal.get("meal_type", "")).strip().lower()
        if meal_type not in {"breakfast", "lunch", "dinner", "snack"}:
            return None, f"Invalid meal_type '{meal_type}'."

        # Validate meal against constraints
        validation_error = _validate_meal_entry(meal, dto)
        if validation_error:
            return None, validation_error

        # Normalize and extract meal fields
        try:
            normalized_meal = _normalize_meal_entry(meal)
            normalized_meals.append(normalized_meal)
        except ValueError as exc:
            return None, str(exc)

    # Validate slot counts
    slot_error = _validate_slot_counts(normalized_meals, list(meal_slots))
    if slot_error:
        return None, slot_error

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

    language_label = _base_language_label()

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
- Language: Write all meal names, ingredients, and instructions in {language_label}.

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


def _get_user_id(pref: Any) -> Optional[UUID]:
    if isinstance(pref, dict):
        return pref.get("user_id") or pref.get("userId")
    return getattr(pref, "user_id", None)


def _get_last_week_recipes(db: Session, user_id: UUID) -> Set[UUID]:
    stmt = (
        select(Preference)
        .where(Preference.user_id == user_id)
        .order_by(Preference.submitted_at.desc())
    )
    for previous_preference in db.execute(stmt).scalars().all():
        raw_data = previous_preference.raw_data if isinstance(previous_preference.raw_data, dict) else {}
        generated_plan = raw_data.get("generated_plan") if isinstance(raw_data, dict) else None
        if not isinstance(generated_plan, dict) or not generated_plan.get("plan"):
            continue
        recipe_ids = db.execute(
            select(PlanRecipe.recipe_id).where(PlanRecipe.preference_id == previous_preference.id)
        )
        return {recipe_id for (recipe_id,) in recipe_ids}
    return set()


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


def query_candidate_recipes(
    db: Session,
    dto: PreferenceDTO,
    exclude_names: Optional[Set[str]] = None,
    exclude_recipe_ids: Optional[Set[UUID]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """Query DB for recipe candidates matching user preferences.

    Returns dict like:
    {
        "breakfast": [{"id": ..., "title": ..., "calories": ..., ...}, ...],
        "lunch": [...],
        "dinner": [...],
        "snack": [...]
    }
    """
    if exclude_names is None:
        exclude_names = set()
    if exclude_recipe_ids is None:
        exclude_recipe_ids = set()

    # Build base query
    query = select(Recipe).where(Recipe.is_active == True)

    # Execute query
    recipes = db.execute(query).scalars().all()
    allowed_cuisines = normalize_cuisine_list(dto.preferred_cuisines)

    # Group by meal type
    candidates: Dict[str, List[Dict[str, Any]]] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snack": [],
    }

    for recipe in recipes:
        # Skip excluded recipes
        if recipe.title in exclude_names or recipe.id in exclude_recipe_ids:
            continue
        if not matches_dietary_restrictions(
            recipe.dietary_flags, recipe.allergens, dto.dietary_restrictions
        ):
            continue
        if not matches_preferred_cuisines(recipe.cuisine, allowed_cuisines):
            continue
        if not matches_cooking_time(recipe.total_time_minutes, dto.cooking_time_preference):
            continue

        # Extract nutrition data
        nutrition = normalize_nutrition(recipe.nutrition)
        calories = nutrition.get("calories", 0.0)
        protein = nutrition.get("protein", 0.0)
        carbs = nutrition.get("carbs", 0.0)
        fat = nutrition.get("fat", 0.0)

        # Skip recipes with missing nutrition data
        if calories == 0:
            continue

        # Determine meal type
        meal_type = normalize_meal_slot(recipe.meal_type)

        # Build candidate dict
        candidate = {
            "id": recipe.id,
            "title": recipe.title,
            "meal_type": meal_type,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fat": fat,
            "ingredients": recipe.ingredients or [],
            "instructions": recipe.instructions or [],
            "cuisine": recipe.cuisine,
            "tags": recipe.tags or [],
            "cost_category": recipe.cost_category,
            "total_time_minutes": recipe.total_time_minutes,
            "url": recipe.source_url,
        }

        candidates[meal_type].append(candidate)

    return candidates


def macro_fit_score(
    recipe: Dict[str, Any],
    remaining_macros: Dict[str, float],
    remaining_slots: int,
) -> float:
    """Score how well a recipe fits the remaining macro targets.

    Higher score = better fit.
    """
    if remaining_slots <= 0:
        remaining_slots = 1

    # Calculate ideal macros per remaining slot
    ideal = {k: v / remaining_slots for k, v in remaining_macros.items()}

    # Calculate deviation from ideal for each macro
    score = 0.0
    for macro in MACRO_KEYS:
        recipe_value = recipe.get(macro, 0)
        ideal_value = ideal.get(macro, 0)

        if ideal_value == 0:
            # If no target, penalize high values slightly
            if recipe_value > 0:
                score -= 0.1
            continue

        # Calculate percentage deviation
        deviation = abs(recipe_value - ideal_value) / ideal_value
        score -= deviation

    # Bonus for recipes with complete data
    if recipe.get("ingredients"):
        score += 0.1
    if recipe.get("instructions"):
        score += 0.1

    return score


def select_db_recipes_for_day(
    candidates: Dict[str, List[Dict[str, Any]]],
    meal_slots: List[str],
    targets: Dict[str, float],
    used_names: Set[str],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Greedy selection algorithm to pick best recipes for a day.

    Returns:
        (selected_recipes, unfilled_slots)
    """
    remaining_macros = dict(targets)
    selected: List[Dict[str, Any]] = []
    unfilled: List[str] = []
    remaining_slots = len(meal_slots)

    for slot in meal_slots:
        # Get candidates for this slot, excluding already used recipes
        pool = [
            recipe for recipe in candidates.get(slot, [])
            if recipe["title"] not in used_names
        ]

        if not pool:
            unfilled.append(slot)
            remaining_slots -= 1
            continue

        # Score each recipe
        scored_recipes = []
        for recipe in pool:
            score = macro_fit_score(recipe, remaining_macros, remaining_slots)
            scored_recipes.append((score, recipe))

        # Sort by score (descending) and pick best
        scored_recipes.sort(key=lambda x: x[0], reverse=True)
        best_recipe = scored_recipes[0][1]

        # Add to selected
        selected.append(best_recipe)
        used_names.add(best_recipe["title"])

        # Update remaining macros
        for macro in MACRO_KEYS:
            remaining_macros[macro] -= best_recipe.get(macro, 0)

        remaining_slots -= 1

    return selected, unfilled


def _format_db_recipe_as_meal(recipe: Dict[str, Any]) -> Dict[str, Any]:
    """Format a DB recipe candidate as a meal entry with source tracking."""
    return {
        "id": recipe.get("id"),
        "name": recipe.get("title") or "Recipe",
        "meal_type": recipe.get("meal_type", "snack"),
        "calories": recipe.get("calories", 0),
        "protein": recipe.get("protein", 0),
        "carbs": recipe.get("carbs", 0),
        "fat": recipe.get("fat", 0),
        "url": recipe.get("url"),
        "instructions": _format_instructions(recipe.get("instructions")),
        "ingredients": _jsonify_value(recipe.get("ingredients")),
        "tags": recipe.get("tags") or [],
        "source": "db",  # Track that this came from database
    }


def match_recipes_to_macro_goal(
    pref: Any,
    macro_goal: Dict[str, Any],
    used_names: Optional[set] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    if not macro_goal:
        return {"meals": [], "totals": None, "error": "Missing macro targets."}

    dto = _normalize_preference(pref)

    meal_slots = meal_slots_for_day(dto.meals_per_day)

    targets = _extract_targets(macro_goal)

    avoid_names = []
    if isinstance(used_names, set) and used_names:
        avoid_names = [str(item) for item in used_names]

    # Phase 1: Try DB recipes (hybrid approach)
    db_meals: List[Dict[str, Any]] = []
    unfilled_slots = meal_slots  # default: all slots unfilled

    if db is not None:
        try:
            previous_recipe_ids: Set[UUID] = set()
            user_id = _get_user_id(pref)
            if user_id is not None:
                previous_recipe_ids = _get_last_week_recipes(db, user_id)
            candidates = query_candidate_recipes(
                db,
                dto,
                exclude_names=set(avoid_names),
                exclude_recipe_ids=previous_recipe_ids,
            )
            db_meals, unfilled_slots = select_db_recipes_for_day(
                candidates, meal_slots, targets, set(avoid_names)
            )
            # Convert DB recipes to meal format
            db_meals = [_format_db_recipe_as_meal(recipe) for recipe in db_meals]
        except Exception as exc:
            logger.warning("DB recipe query failed, falling back to full AI generation: %s", exc)
            db_meals = []
            unfilled_slots = meal_slots

    # Phase 2: AI fills gaps
    ai_meals: List[Dict[str, Any]] = []
    if unfilled_slots:
        # Calculate remaining macro targets after DB recipes
        already_used = _sum_meal_macros(db_meals)
        remaining = {k: max(targets[k] - already_used[k], 0) for k in MACRO_KEYS}

        # Build avoid list (original + DB recipe names)
        ai_avoid_names = avoid_names + [m["name"] for m in db_meals]

        meal_result = _generate_meals_with_openai(
            dto=dto,
            meal_slots=unfilled_slots,
            targets=targets,
            remaining_targets=remaining,
            avoid_names=ai_avoid_names,
        )
        if meal_result.get("error"):
            # If AI fails and we have some DB meals, return what we have
            if db_meals:
                logger.warning("AI meal generation failed but returning %d DB meals", len(db_meals))
                totals = _sum_meal_macros(db_meals)
                return {
                    "meals": db_meals,
                    "totals": totals,
                    "error": None,
                    "db_recipe_count": len(db_meals),
                    "ai_recipe_count": 0,
                }
            # Otherwise, propagate the error
            return {"meals": [], "totals": None, "error": meal_result["error"]}

        ai_meals = meal_result.get("meals") or []

    # Combine DB and AI meals
    all_meals = db_meals + ai_meals
    totals = _sum_meal_macros(all_meals)

    return {
        "meals": all_meals,
        "totals": totals,
        "error": None,
        "db_recipe_count": len(db_meals),
        "ai_recipe_count": len(ai_meals),
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
        meal_type = normalize_meal_slot(meal.get("meal_type"))
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
    targets = _extract_targets(macro_goal)

    used_names: List[str] = []
    for day in plan.get("days", []):
        meals = day.get("meals") if isinstance(day, dict) else None
        if not isinstance(meals, dict):
            continue
        for key in ("Breakfast", "Lunch", "Dinner", "Snacks"):
            meal = meals.get(key)
            if isinstance(meal, dict) and meal.get("name"):
                used_names.append(str(meal["name"]))

    meal_slots = meal_slots_for_day(dto.meals_per_day)
    snack_slots = [slot for slot in meal_slots if slot == "snack"]

    for day in plan.get("days", []):
        if not isinstance(day, dict):
            continue
        meals = day.get("meals")
        if not isinstance(meals, dict):
            meals = {}
            day["meals"] = meals

        current_meals = [meals.get(k) for k in ("Breakfast", "Lunch", "Dinner", "Snacks") if meals.get(k)]
        current_totals = _sum_meal_macros(current_meals)

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
        day_meals = [meals.get(k) for k in ("Breakfast", "Lunch", "Dinner", "Snacks") if meals.get(k)]
        day_totals = _sum_meal_macros(day_meals)

        day["calories"] = day_totals["calories"]
        day["macros"] = {
            "protein": day_totals["protein"],
            "carbs": day_totals["carbs"],
            "fat": day_totals["fat"],
        }

    return {"plan": plan, "error": None}


def generate_daily_plan(
    pref: Any,
    macro_goal: Dict[str, Any],
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    if not macro_goal:
        return {"plan": None, "error": "Missing macro targets."}

    days: List[Dict[str, Any]] = []
    used_names: List[str] = []
    total_db_recipes = 0
    total_ai_recipes = 0

    for day in WEEK_DAYS:
        recipe_match = match_recipes_to_macro_goal(
            pref,
            macro_goal,
            used_names=set(used_names),
            db=db,
        )
        if recipe_match.get("error"):
            return {"plan": None, "error": recipe_match["error"]}
        meals_for_day = recipe_match.get("meals") or []

        # Track recipe source counts
        total_db_recipes += recipe_match.get("db_recipe_count", 0)
        total_ai_recipes += recipe_match.get("ai_recipe_count", 0)

        day_plan = _build_day_plan(day, meals_for_day, recipe_match.get("totals") or {})
        days.append(day_plan)
        for meal in meals_for_day:
            name = meal.get("name")
            if name:
                used_names.append(str(name))

    plan_payload = _build_weekly_plan(macro_goal, days)
    base_language = _normalize_language(PLAN_BASE_LANGUAGE) or "no"
    plan_language = base_language

    # Determine generation source based on recipe counts
    if total_db_recipes > 0 and total_ai_recipes > 0:
        generation_source = "hybrid"
    elif total_db_recipes > 0 and total_ai_recipes == 0:
        generation_source = "db_only"
    else:
        generation_source = "openai"

    return {
        "plan": plan_payload,
        "error": None,
        "language": plan_language,
        "generation_source": generation_source,
        "db_recipe_count": total_db_recipes,
        "ai_recipe_count": total_ai_recipes,
    }
