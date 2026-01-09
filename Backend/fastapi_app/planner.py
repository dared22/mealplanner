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
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "120"))
OPENAI_PLAN_MAX_TOKENS = int(os.getenv("OPENAI_PLAN_MAX_TOKENS", "4500"))
PLAN_DAYS = int(os.getenv("PLAN_DAYS", "7"))

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
    dietary_restrictions: list[str]
    preferred_cuisines: list[str]
    language: Optional[str]


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


def _language_label(value: Optional[str]) -> str:
    normalized = _normalize_language(value)
    if not normalized:
        return "English"
    return LANGUAGE_LABELS.get(normalized, normalized)


def _request_with_chat(messages: list[dict[str, str]], temperature: float = 0.2) -> str:
    if client is None:
        return ""
    request_kwargs = {
        "model": OPENAI_PLAN_MODEL,
        "max_tokens": OPENAI_PLAN_MAX_TOKENS,
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

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        logger.warning("OpenAI response truncated; increase OPENAI_PLAN_MAX_TOKENS.")
    content = response.choices[0].message.content if response.choices else ""
    return content.strip() if content else ""


def _request_with_responses(plan_prompt: str) -> str:
    if client is None:
        return ""
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

    return response.output_text.strip() if response.output_text else ""


def _request_plan_text(plan_prompt: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": plan_prompt},
    ]
    last_exc: Optional[Exception] = None
    try:
        return _request_with_chat(messages)
    except Exception as exc:
        last_exc = exc
        logger.warning("Chat completion failed; falling back to responses API: %s", exc)

    try:
        return _request_with_responses(plan_prompt)
    except Exception as exc:
        logger.exception("Responses API meal plan request failed")
        if last_exc:
            raise last_exc
        raise exc


def _repair_json_payload(raw_text: str) -> Optional[str]:
    if client is None or not raw_text:
        return None
    repair_prompt = (
        "You fix invalid JSON. Return ONLY valid JSON that matches the required schema. "
        "Do not add commentary or formatting."
    )
    messages = [
        {"role": "system", "content": repair_prompt},
        {"role": "user", "content": raw_text},
    ]
    try:
        repaired = _request_with_chat(messages, temperature=0.0)
        return repaired or None
    except Exception:
        logger.exception("AI JSON repair attempt failed")
        return None


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
- Language: {_language_label(pref.language)}

Guidelines:
1. Produce exactly {PLAN_DAYS} days named Monday through Sunday.
2. Provide {pref.meals_per_day} meals per day, covering Breakfast, Lunch, Dinner, and Snacks where applicable.
3. Each meal needs calories plus protein/carbs/fat estimates, cook time, up to 2 short tags, and concise ingredients/instructions (8-15 words). Keep ingredient lists under 6 items.
4. Use the requested language for meal names, tags, ingredients, and instructions.
5. Daily calories must align with the user's goal and activity level, staying within ±7%.
6. Keep ingredients accessible in Norway and respect dietary restrictions/cuisines.
7. Return ONLY compact JSON matching the schema from the system prompt—no markdown or commentary.
"""
    start_time = time.perf_counter()
    try:
        raw_text = _request_plan_text(plan_prompt)
    except OpenAIError as exc:
        logger.exception("OpenAI meal plan request failed: %s", exc)
        return {"plan": None, "raw_text": None, "error": str(exc)}
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected failure during meal plan generation")
        return {"plan": None, "raw_text": None, "error": str(exc)}
    finally:
        elapsed = time.perf_counter() - start_time
        logger.info("Meal plan response generation finished in %.2fs", elapsed)

    raw_text = (raw_text or "").strip()

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
            repaired_text = _repair_json_payload(raw_text)
            if repaired_text:
                for candidate in _json_candidates(repaired_text):
                    try:
                        plan_payload = json.loads(candidate)
                        parse_error = None
                        raw_text = repaired_text
                        break
                    except json.JSONDecodeError as exc:
                        parse_error = f"Failed to parse AI JSON after repair: {exc}"
                        continue
            if parse_error:
                logger.warning("%s", parse_error)

    return {"plan": plan_payload, "raw_text": raw_text, "error": parse_error}


def generate_meal_plan_for_preference(db: Session, pref_id: int) -> Dict[str, Any]:
    pref = db.get(Preference, pref_id)
    if pref is None:
        raise ValueError(f"Preference {pref_id} not found")

    raw_data = pref.raw_data if isinstance(pref.raw_data, dict) else {}
    language = raw_data.get("language") or raw_data.get("lang")
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
        language=language,
    )
    return generate_meal_plan(dto)
