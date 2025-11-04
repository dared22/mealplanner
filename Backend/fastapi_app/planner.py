import logging
import os
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from models import Preference
from dataclasses import dataclass
from openai import OpenAI

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not configured; AI meal plan generation will be disabled.")
    client: Optional[OpenAI] = None
else:
    client = OpenAI(api_key=OPENAI_API_KEY)

@dataclass(frozen=True)
class PreferenceDTO:
    age: int; gender: str; height_cm: int; weight_kg: int
    activity_level: str; nutrition_goal: str
    meals_per_day: int; budget_range: str
    cooking_time_preference: str
    dietary_restrictions: list[str]; preferred_cuisines: list[str]



def generate_meal_plan(pref: PreferenceDTO) -> str:
    if client is None:
        return (
            "Meal plan generator is disabled because OPENAI_API_KEY is not configured. "
            "Please set the environment variable to enable AI-generated plans."
        )
    plan_text = f"""
                    You are a professional nutritionist creating a personalized meal plan.

                    User profile:
                    - Age: {pref.age}
                    - Gender: {pref.gender}
                    - Height: {pref.height_cm} cm
                    - Weight: {pref.weight_kg} kg
                    - Activity level: {pref.activity_level}
                    - Nutrition goal: {pref.nutrition_goal} (e.g. lose, maintain, or gain weight)
                    - Meals per day: {pref.meals_per_day}
                    - Budget range: {pref.budget_range}
                    - Cooking time preference: {pref.cooking_time_preference.replace('_', ' ')}
                    - Dietary restrictions: {', '.join(pref.dietary_restrictions) if pref.dietary_restrictions else 'none'}
                    - Preferred cuisines: {', '.join(pref.preferred_cuisines) if pref.preferred_cuisines else 'no specific preference'}

                    Task:
                    1. Generate a 5-day meal plan that fits these preferences.
                    2. Include {pref.meals_per_day} meals (e.g., breakfast, lunch, dinner, snacks).
                    3. Each meal should list:
                       - The dish name
                       - Main ingredients
                       - Approximate calories
                       - Brief preparation instructions
                    4. Make sure total daily calories align with the user's goal and activity level.
                    5. Keep the plan {pref.budget_range.replace('_', ' ')} and suitable for {pref.cooking_time_preference.replace('_', ' ')} meals.
                    6. All the ingredients should be availible for purchase in Norway.

                    Return the plan in a readable, well-formatted text output.
                    """
    response = client.responses.create(
    model="gpt-5-nano",
    input=plan_text
    )
    return response.output_text

def generate_meal_plan_for_preference(db: Session, pref_id: int) -> str:
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
