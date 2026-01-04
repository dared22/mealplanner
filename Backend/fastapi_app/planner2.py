import ast
import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import httpx
from openai import OpenAI, OpenAIError
from sqlalchemy.orm import Session

from models import Preference

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MACRO_MODEL = os.getenv("OPENAI_PLAN_MODEL", "gpt-4o-mini")
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "120"))
OPENAI_MACRO_MAX_TOKENS = int(os.getenv("OPENAI_PLAN_MAX_TOKENS", "1000"))

RECIPES_PATH = Path(__file__).with_name("recipes.parquet")

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


def _to_int(value: Any) -> Optional[int]:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return None
    return numeric


def _get_pref_value(pref: Any, key: str) -> Any:
    if isinstance(pref, dict):
        return pref.get(key)
    return getattr(pref, key, None)


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
    )


def _request_with_chat(messages: list[dict[str, str]], temperature: float = 0.2) -> str:
    if client is None:
        return ""
    request_kwargs = {
        "model": OPENAI_MACRO_MODEL,
        "max_tokens": OPENAI_MACRO_MAX_TOKENS,
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


@lru_cache(maxsize=1)
def _load_recipes_df():
    try:
        import pandas as pd
    except ImportError as exc:
        raise RuntimeError(
            "pandas is required to load recipes.parquet. Please install pandas and pyarrow."
        ) from exc

    if not RECIPES_PATH.exists():
        raise FileNotFoundError(f"recipes.parquet not found at {RECIPES_PATH}")

    return pd.read_parquet(RECIPES_PATH)


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
    meal_col = _find_column(df.columns, ["meal_type", "meal", "course", "category", "dish_type"])
    cost_col = _find_column(df.columns, ["price", "cost", "amount", "price_value"])
    tier_col = _find_column(df.columns, ["price_tier", "budget_range", "price_level", "cost_level", "price_category"])
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
                return parsed.get(key)
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
    df["_id"] = df[id_col] if id_col else df.index
    df["_url"] = df[url_col] if url_col else None

    for key in ["_calories", "_protein", "_carbs", "_fat"]:
        df[key] = df[key].fillna(0)

    return df, {"meal": meal_col, "tags": tags_col, "cost": cost_col, "tier": tier_col}


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
        return text
    if isinstance(value, (list, tuple)):
        return " ".join(str(item).strip() for item in value if str(item).strip())
    return str(value)


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
    best = scored.nsmallest(1, "_score").iloc[0]

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
    }


def match_recipes_to_macro_goal(
    pref: Any,
    macro_goal: Dict[str, Any],
    recipes_df=None,
    used_ids: Optional[set] = None,
) -> Dict[str, Any]:
    if not macro_goal:
        return {"meals": [], "totals": None, "error": "Missing macro targets."}

    dto = _normalize_preference(pref)
    if recipes_df is None:
        df = _load_recipes_df()
        prepared, meta = _prepare_recipes(df)
        prepared = _budget_filter(prepared, dto.budget_range, meta["cost"], meta["tier"])
    else:
        prepared = recipes_df
    if prepared.empty:
        return {"meals": [], "totals": None, "error": "No recipes match the selected budget."}

    meal_slots = _build_meal_slots(dto.meals_per_day or 3)

    macro_targets = macro_goal.get("macroTargets") if isinstance(macro_goal, dict) else None
    targets = {
        "calories": float(macro_goal.get("calorieTarget", 0)),
        "protein": float(macro_targets.get("protein", 0)) if isinstance(macro_targets, dict) else 0.0,
        "carbs": float(macro_targets.get("carbs", 0)) if isinstance(macro_targets, dict) else 0.0,
        "fat": float(macro_targets.get("fat", 0)) if isinstance(macro_targets, dict) else 0.0,
    }

    remaining = targets.copy()
    selected: List[Dict[str, Any]] = []
    used_ids_local: set = used_ids if used_ids is not None else set()

    for index, slot in enumerate(meal_slots):
        remaining_meals = max(len(meal_slots) - index, 1)
        per_meal = {
            "calories": max(remaining["calories"] / remaining_meals, 0),
            "protein": max(remaining["protein"] / remaining_meals, 0),
            "carbs": max(remaining["carbs"] / remaining_meals, 0),
            "fat": max(remaining["fat"] / remaining_meals, 0),
        }
        recipe = _pick_recipe(prepared, slot, per_meal, used_ids_local)
        selected.append(recipe)
        if recipe.get("id") is not None:
            used_ids_local.add(recipe["id"])
        remaining["calories"] = max(remaining["calories"] - recipe["calories"], 0)
        remaining["protein"] = max(remaining["protein"] - recipe["protein"], 0)
        remaining["carbs"] = max(remaining["carbs"] - recipe["carbs"], 0)
        remaining["fat"] = max(remaining["fat"] - recipe["fat"], 0)

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
        "name": name,
        "calories": float(recipe.get("calories", 0)),
        "protein": float(recipe.get("protein", 0)),
        "carbs": float(recipe.get("carbs", 0)),
        "fat": float(recipe.get("fat", 0)),
        "cookTime": "",
        "tags": [],
        "ingredients": [],
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


def generate_daily_plan(pref: Any) -> Dict[str, Any]:
    macro_response = generate_daily_macro_goal(pref)
    if macro_response.get("error"):
        return {"plan": None, "raw_text": None, "error": macro_response["error"]}

    macro_goal = macro_response.get("goal")
    dto = _normalize_preference(pref)
    df = _load_recipes_df()
    prepared, meta = _prepare_recipes(df)
    prepared = _budget_filter(prepared, dto.budget_range, meta["cost"], meta["tier"])
    if prepared.empty:
        return {"plan": None, "raw_text": None, "error": "No recipes match the selected budget."}

    days: List[Dict[str, Any]] = []
    used_ids: set = set()
    for day in WEEK_DAYS:
        recipe_match = match_recipes_to_macro_goal(
            pref,
            macro_goal,
            recipes_df=prepared,
            used_ids=used_ids,
        )
        if recipe_match.get("error"):
            return {"plan": None, "raw_text": None, "error": recipe_match["error"]}
        day_plan = _build_day_plan(
            day,
            recipe_match.get("meals") or [],
            recipe_match.get("totals") or {},
        )
        days.append(day_plan)

    plan_payload = _build_weekly_plan(macro_goal, days)
    return {"plan": plan_payload, "raw_text": None, "error": None}


def generate_daily_plan_for_preference(db: Session, pref_id: int) -> Dict[str, Any]:
    pref = db.get(Preference, pref_id)
    if pref is None:
        raise ValueError(f"Preference {pref_id} not found")
    return generate_daily_plan(pref)
