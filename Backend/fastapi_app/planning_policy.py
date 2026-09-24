"""Compatibility policy shared by every meal-planning strategy."""

import re
from typing import Any, Iterable, Optional, Set


NUTRITION_ALIASES = {
    "calories": ("calories", "calories_kcal", "calorie", "kcal", "energy_kcal"),
    "protein": ("protein_g", "protein", "proteins"),
    "carbs": ("carbs_g", "carbs", "carbohydrates", "carbohydrate"),
    "fat": ("fat_g", "fat", "fats"),
}

_COOKING_TIME_RANGES = {
    "under_15_min": (None, 15),
    "under15": (None, 15),
    "<15": (None, 15),
    "15_30_min": (15, 30),
    "15-30": (15, 30),
    "15_30": (15, 30),
    "30_60_min": (30, 60),
    "30-60": (30, 60),
    "30_60": (30, 60),
    "over_60_min": (60, None),
    "60_plus": (60, None),
    ">60": (60, None),
}


def normalize_nutrition(value: Any) -> dict[str, float]:
    """Return planner macro names while accepting current and legacy JSON keys."""
    if not isinstance(value, dict):
        return {}

    normalized_input = {str(key).strip().lower(): item for key, item in value.items()}
    normalized: dict[str, float] = {}
    for canonical_key, aliases in NUTRITION_ALIASES.items():
        for alias in aliases:
            raw = normalized_input.get(alias)
            if raw in (None, ""):
                continue
            try:
                normalized[canonical_key] = float(raw)
            except (TypeError, ValueError):
                continue
            break
    return normalized


def normalize_allergens(value: Any) -> Set[str]:
    if not value:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip().lower() for item in value if item}
    return {str(value).strip().lower()}


def dietary_flag_truthy(flags: Any, key: str) -> bool:
    if not isinstance(flags, dict):
        return False
    normalized = {str(candidate).strip().lower(): value for candidate, value in flags.items()}
    canonical = key.lower().removeprefix("is_")
    for candidate in (canonical, f"is_{canonical}"):
        value = normalized.get(candidate)
        if value is None:
            continue
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"true", "1", "yes", "y"}
    return False


def matches_dietary_restrictions(
    dietary_flags: Any,
    allergens: Any,
    restrictions: Iterable[Any],
) -> bool:
    normalized_allergens = normalize_allergens(allergens)
    for raw_restriction in _as_items(restrictions):
        restriction = str(raw_restriction or "").strip().lower()
        if not restriction or restriction == "none":
            continue
        if restriction == "vegan":
            if not dietary_flag_truthy(dietary_flags, "vegan"):
                return False
        elif restriction == "vegetarian":
            if not (
                dietary_flag_truthy(dietary_flags, "vegetarian")
                or dietary_flag_truthy(dietary_flags, "vegan")
            ):
                return False
        elif "gluten" in restriction:
            if not normalized_allergens or any("gluten" in allergen for allergen in normalized_allergens):
                return False
        elif "dairy" in restriction:
            if not normalized_allergens or any("dairy" in allergen for allergen in normalized_allergens):
                return False
        elif "nut" in restriction:
            if not normalized_allergens or any("nut" in allergen for allergen in normalized_allergens):
                return False
    return True


def normalize_cuisine_list(values: Iterable[Any]) -> Set[str]:
    return {
        normalized
        for normalized in (_normalize_token(value) for value in _as_items(values))
        if normalized
    }


def matches_preferred_cuisines(recipe_cuisine: Any, allowed_cuisines: Set[str]) -> bool:
    if not allowed_cuisines:
        return True
    if not recipe_cuisine:
        return False
    return any(
        _normalize_token(part) in allowed_cuisines
        for part in re.split(r"[,/;|]+", str(recipe_cuisine))
    )


def cooking_time_bounds(value: Any) -> tuple[Optional[int], Optional[int]]:
    if value is None:
        return None, None
    normalized = str(value).strip().lower()
    if normalized in _COOKING_TIME_RANGES:
        return _COOKING_TIME_RANGES[normalized]
    if "quick" in normalized or "fast" in normalized:
        return None, 30
    if "moderate" in normalized or "medium" in normalized:
        return 30, 60
    if "slow" in normalized or "long" in normalized:
        return 60, None
    return None, None


def matches_cooking_time(total_time_minutes: Any, preference: Any) -> bool:
    minimum, maximum = cooking_time_bounds(preference)
    if minimum is None and maximum is None:
        return True
    try:
        total_time = float(total_time_minutes)
    except (TypeError, ValueError):
        return False
    if minimum is not None and total_time < minimum:
        return False
    if maximum is not None and total_time > maximum:
        return False
    return True


def meal_slots_for_day(meals_per_day: Any) -> list[str]:
    try:
        count = max(int(meals_per_day), 1)
    except (TypeError, ValueError):
        count = 3
    slots = ["breakfast", "lunch", "dinner"][:count]
    slots.extend(["snack"] * max(count - len(slots), 0))
    if "dinner" not in slots:
        slots[-1] = "dinner"
    return slots


def normalize_meal_slot(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in {"breakfast", "lunch", "dinner", "snack"} else "snack"


def recipe_matches_meal_slot(recipe_meal_type: Any, slot: str) -> bool:
    if not recipe_meal_type:
        return slot != "breakfast"
    recipe_slot = normalize_meal_slot(recipe_meal_type)
    if slot == "breakfast":
        return recipe_slot == "breakfast"
    if slot == "lunch":
        return recipe_slot in {"lunch", "breakfast"}
    if slot == "dinner":
        return recipe_slot in {"dinner", "lunch"}
    return True


def _normalize_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _as_items(values: Any) -> Iterable[Any]:
    if values is None:
        return ()
    if isinstance(values, str):
        return (values,)
    try:
        return iter(values)
    except TypeError:
        return (values,)
