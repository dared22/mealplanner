import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union

import httpx
from openai import OpenAI
from openai import OpenAIError
from sqlalchemy.orm import Session

from models import Preference

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_PLAN_MODEL = os.getenv("OPENAI_PLAN_MODEL", "gpt-4o-mini")
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "90"))
OPENAI_PLAN_MAX_TOKENS = int(os.getenv("OPENAI_PLAN_MAX_TOKENS", "3000"))

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not configured; AI meal plan generation will be disabled.")
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
    "You are a professional nutrition coach. Always respond with valid JSON matching the schema:\n"
    "{\n"
    '  "calorieTarget": number,\n'
    '  "macroTargets": {"protein": number, "carbs": number, "fat": number},\n'
    '  "days": [\n'
    '    {\n'
    '      "name": "Monday",\n'
    '      "calories": number,\n'
    '      "macros": {"protein": number, "carbs": number, "fat": number},\n'
    '      "meals": {\n'
    '        "Breakfast": {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "cookTime": string, "tags": [string], "ingredients": [string], "instructions": string},\n'
    '        "Lunch": {...},\n'
    '        "Dinner": {...},\n'
    '        "Snacks": {...}\n'
    "      }\n"
    "    }\n"
    "  ]\n"
    "}\n"
    "Ensure each day totals roughly the calorie target, respect dietary restrictions and cuisines, "
    "and keep instructions concise."
)

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
    dietary_restrictions: list[str]; preferred_cuisines: list[str]



def generate_meal_plan(pref: PreferenceDTO) -> Union[Dict[str, Any], str]:
    if client is None:
        return {
            "plan": None,
            "raw_text": None,
            "error": (
                "Meal plan generator is disabled because OPENAI_API_KEY is not configured. "
                "Please set the environment variable to enable AI-generated plans."
            ),
        }
    plan_prompt = f"""
Create a personalized meal plan for this profile:
- Age: {pref.age}
- Gender: {pref.gender}
- Height: {pref.height_cm} cm
- Weight: {pref.weight_kg} kg
- Activity level: {pref.activity_level}
- Nutrition goal: {pref.nutrition_goal}
- Meals per day: {pref.meals_per_day}
- Budget range: {pref.budget_range}
- Cooking time preference: {pref.cooking_time_preference.replace('_', ' ')}
- Dietary restrictions: {', '.join(pref.dietary_restrictions) if pref.dietary_restrictions else 'none'}
- Preferred cuisines: {', '.join(pref.preferred_cuisines) if pref.preferred_cuisines else 'no specific preference'}

Guidelines:
1. Produce exactly 7 days named Monday through Friday (extend naturally if user needs more).
2. Provide {pref.meals_per_day} meals per day, covering Breakfast, Lunch, Dinner, and Snacks where applicable.
3. Each meal needs calories plus protein/carbs/fat estimates, cook time, up to 3 short tags, and concise ingredients/instructions (10-25 words). Keep ingredient lists brief.
4. Daily calories must align with the user's goal and activity level, staying within ±7%.
5. Keep ingredients accessible in Norway and respect dietary restrictions/cuisines.
6. Return ONLY JSON matching the schema from the system prompt—no markdown or commentary.
"""
    start_time = time.perf_counter()
    try:
        request_kwargs = {
            "model": OPENAI_PLAN_MODEL,
            "max_output_tokens": OPENAI_PLAN_MAX_TOKENS,
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "input": [
                {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
                {"role": "user", "content": [{"type": "input_text", "text": plan_prompt}]},
            ],
            "timeout": OPENAI_REQUEST_TIMEOUT,
        }
        try:
            response = client.responses.create(**request_kwargs)
        except TypeError as exc:
            if "response_format" not in str(exc):
                raise
            request_kwargs.pop("response_format", None)
            response = client.responses.create(**request_kwargs)
    except OpenAIError as exc:
        logger.exception("OpenAI meal plan request failed: %s", exc)
        return {"plan": None, "raw_text": None, "error": str(exc)}
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected failure during meal plan generation")
        return {"plan": None, "raw_text": None, "error": str(exc)}
    finally:
        elapsed = time.perf_counter() - start_time
        logger.info("Meal plan response generation finished in %.2fs", elapsed)

    raw_text = response.output_text.strip()

    def _json_candidates(text: str) -> List[str]:
        candidates: List[str] = []
        trimmed = text.strip()
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
        return candidates

    plan_payload: Optional[Dict[str, Any]] = None
    parse_error: Optional[str] = None
    if raw_text:
        for candidate in _json_candidates(raw_text):
            try:
                plan_payload = json.loads(candidate)
                parse_error = None
                break
            except json.JSONDecodeError as exc:
                parse_error = f"Failed to parse AI JSON: {exc}"
                continue
        if plan_payload is None and parse_error:
            logger.warning("%s", parse_error)

    return {"plan": plan_payload, "raw_text": raw_text, "error": parse_error}


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
