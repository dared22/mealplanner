import logging
import os
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models import Preference

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled at runtime
    OpenAI = None  # type: ignore[misc,assignment]


logger = logging.getLogger(__name__)
_client: Optional["OpenAI"] = None


def _get_client() -> Optional["OpenAI"]:
    """Instantiate and cache the OpenAI client if the SDK is available."""
    global _client
    if OpenAI is None:
        logger.warning("openai package not installed; falling back to simple summary output.")
        return None

    if _client is None:
        _client = OpenAI()
    return _client


def _format_prompt(preference_data: Dict[str, Any]) -> str:
    """Build a prompt describing the user's preferences."""
    lines = [
        "Generate a concise 5-day meal plan based on the following user preferences.",
        "Respond with bullet points grouped by day.",
        "",
    ]

    def _add_line(label: str, key: str) -> None:
        value = preference_data.get(key)
        if value:
            lines.append(f"{label}: {value}")

    _add_line("Age", "age")
    _add_line("Gender", "gender")
    _add_line("Height (cm)", "height_cm")
    _add_line("Weight (kg)", "weight_kg")
    _add_line("Activity level", "activity_level")
    _add_line("Nutrition goal", "nutrition_goal")
    _add_line("Meals per day", "meals_per_day")
    _add_line("Budget range", "budget_range")
    _add_line("Cooking time preference", "cooking_time_preference")

    dietary_restrictions = preference_data.get("dietary_restrictions") or []
    if dietary_restrictions:
        lines.append(f"Dietary restrictions: {', '.join(dietary_restrictions)}")

    preferred_cuisines = preference_data.get("preferred_cuisines") or []
    if preferred_cuisines:
        lines.append(f"Preferred cuisines: {', '.join(preferred_cuisines)}")

    lines.append("")
    lines.append("Include variety, respect restrictions, and keep meals achievable.")
    return "\n".join(lines)


def _preference_to_data(preference: Preference) -> Dict[str, Any]:
    return {
        "age": preference.age,
        "gender": preference.gender,
        "height_cm": preference.height_cm,
        "weight_kg": preference.weight_kg,
        "activity_level": preference.activity_level,
        "nutrition_goal": preference.nutrition_goal,
        "meals_per_day": preference.meals_per_day,
        "budget_range": preference.budget_range,
        "cooking_time_preference": preference.cooking_time_preference,
        "dietary_restrictions": preference.dietary_restrictions or [],
        "preferred_cuisines": preference.preferred_cuisines or [],
    }


def generate_meal_plan_from_dict(preference_data: Dict[str, Any]) -> str:
    """Generate a meal plan for the provided preferences and return the text."""
    prompt = _format_prompt(preference_data)

    if not os.getenv("OPENAI_API_KEY"):
        logger.info("OPENAI_API_KEY not configured; returning formatted preferences instead of AI output.")
        return f"Meal plan request (no OpenAI key configured):\n{prompt}"

    client = _get_client()
    if client is None:
        return f"Meal plan request (OpenAI client unavailable):\n{prompt}"

    model = os.getenv("MEAL_PLANNER_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))

    try:
        response = client.responses.create(model=model, input=prompt)
    except Exception as exc:  # pragma: no cover - depends on external API
        logger.exception("Failed to generate meal plan: %s", exc)
        return f"Meal plan generation failed: {exc}\nPrompt was:\n{prompt}"

    output_text = getattr(response, "output_text", None)
    if not output_text:
        logger.warning("OpenAI response missing output_text. Response: %s", response)
        return f"Meal plan response missing text. Prompt was:\n{prompt}"

    return output_text.strip()


def generate_meal_plan_for_preference(db: Session, preference_id: int) -> str:
    """Load the given preference from the database and return the generated plan text."""
    preference = db.get(Preference, preference_id)
    if preference is None:
        raise ValueError(f"Preference {preference_id} not found")

    preference_data = _preference_to_data(preference)
    if preference.raw_data:
        # In case the raw payload holds additional keys, merge it on top.
        preference_data = {**preference.raw_data, **preference_data}

    print(preference_data) ##generate_meal_plan_from_dict(preference_data)
