import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from models import Preference

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PreferenceDTO:
    age: int
    gender: str
    height_cm: int
    weight_kg: int
    activity_level: str
    nutrition_goal: str
    meals_per_day: int
    budget_range: str
    cooking_time_preference: str
    dietary_restrictions: list[str]
    preferred_cuisines: list[str]


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_PLAN_MODEL = os.getenv("OPENAI_PLAN_MODEL", "gpt-4.1-mini")

TS_SCHEMA = """
{
  "calorieTarget": number;
  "macroTargets": { "protein": number; "carbs": number; "fat": number };
  "days": Array<{
    "name": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
    "calories": number;
    "macros": { "protein": number; "carbs": number; "fat": number };
    "meals": {
      "Breakfast": Meal;
      "Lunch": Meal;
      "Dinner": Meal;
      "Snacks": Meal;
    };
  }>;
}

type Meal = {
  "name": string;
  "calories": number;
  "protein": number;
  "carbs": number;
  "fat": number;
  "cookTime": string;
  "tags": string[];
  "ingredients": string[];
  "instructions": string;
};
""".strip()
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not configured; AI meal plan generation will be disabled.")
    client: Optional[OpenAI] = None
else:
    client = OpenAI(api_key=OPENAI_API_KEY)


def _disabled_payload(pref: PreferenceDTO) -> Dict[str, Any]:
    return {
        "plan": None,
        "raw_text": (
            "Meal plan generator is disabled because OPENAI_API_KEY is not configured. "
            "Please set the environment variable to enable AI-generated plans."
        ),
    }


def generate_meal_plan(pref: PreferenceDTO) -> Dict[str, Any]:
    if client is None:
        return _disabled_payload(pref)

    system_prompt = (
        "You are a registered dietitian who creates balanced weekly meal plans. "
        "You MUST return strictly valid JSON and nothing else."
    )

    user_prompt = f"""
Create a 7-day meal plan that fits this individual:
- Age: {pref.age}
- Gender: {pref.gender}
- Height: {pref.height_cm} cm
- Weight: {pref.weight_kg} kg
- Activity level: {pref.activity_level}
- Primary goal: {pref.nutrition_goal}
- Meals per day: {pref.meals_per_day}
- Budget: {pref.budget_range}
- Typical cooking time: {pref.cooking_time_preference.replace('_', ' ')}
- Dietary restrictions: {', '.join(pref.dietary_restrictions) if pref.dietary_restrictions else 'none'}
- Preferred cuisines: {', '.join(pref.preferred_cuisines) if pref.preferred_cuisines else 'no specific preference'}

Return JSON matching this TypeScript type:
{TS_SCHEMA}

Rules:
- Ensure each day has realistic calories near the user's target and macros that sum reasonably.
- Tags should include budget or timing notes when relevant.
- Instructions must be concise (max 2 sentences).
- Use ingredients available in Norway.
- Respond with JSON only, no markdown fences.
"""

    response = client.responses.create(
        model=OPENAI_PLAN_MODEL,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
    )

    raw_text = response.output_text.strip()
    plan_payload: Optional[Dict[str, Any]] = None
    if raw_text:
        try:
            plan_payload = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse meal plan JSON. Returning raw text instead.")

    return {"plan": plan_payload, "raw_text": raw_text}


def generate_meal_plan_for_preference(db: Session, pref_id: int) -> Dict[str, Any]:
    pref = db.get(Preference, pref_id)
    if pref is None:
        raise ValueError(f"Preference {pref_id} not found")

    dto = PreferenceDTO(
        age=pref.age,
        gender=pref.gender,
        height_cm=pref.height_cm,
        weight_kg=pref.weight_kg,
        activity_level=pref.activity_level,
        nutrition_goal=pref.nutrition_goal,
        meals_per_day=pref.meals_per_day,
        budget_range=pref.budget_range,
        cooking_time_preference=pref.cooking_time_preference,
        dietary_restrictions=pref.dietary_restrictions or [],
        preferred_cuisines=pref.preferred_cuisines or [],
    )
    return generate_meal_plan(dto)
