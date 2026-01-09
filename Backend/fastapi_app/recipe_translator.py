import copy
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import httpx
from openai import OpenAI, OpenAIError

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
OPENAI_REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "120"))
OPENAI_TRANSLATE_REQUEST_TIMEOUT = float(
    os.getenv("OPENAI_TRANSLATE_REQUEST_TIMEOUT", str(OPENAI_REQUEST_TIMEOUT))
)
OPENAI_TRANSLATE_MAX_TOKENS = int(os.getenv("OPENAI_TRANSLATE_MAX_TOKENS", "6000"))


@dataclass(frozen=True)
class TranslationResult:
    data: Dict[str, Any]
    error: Optional[str] = None


class RecipeTranslator:
    def __init__(self, target_language: str = "Norwegian") -> None:
        self.target_language = target_language
        self.client = self._init_client()
        self._translatable_keys = ("name", "ingredients", "instructions", "tags")

    def _init_client(self) -> Optional[OpenAI]:
        if not OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY is not configured; translation will be disabled.")
            return None
        timeout = httpx.Timeout(
            OPENAI_TRANSLATE_REQUEST_TIMEOUT,
            connect=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
            read=OPENAI_TRANSLATE_REQUEST_TIMEOUT,
            write=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
            pool=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
        )
        return OpenAI(api_key=OPENAI_API_KEY, timeout=timeout)

    def translate_recipe(self, recipe: Dict[str, Any]) -> TranslationResult:
        if self.client is None:
            return TranslationResult(recipe, "Translation disabled: OPENAI_API_KEY not configured.")

        prompt = self._build_prompt(recipe)
        messages = [
            {"role": "system", "content": self._system_prompt()},
            {"role": "user", "content": prompt},
        ]
        try:
            raw = self._request(messages)
        except OpenAIError as exc:
            logger.exception("Recipe translation failed: %s", exc)
            return TranslationResult(recipe, str(exc))
        except Exception as exc:  # pragma: no cover
            logger.exception("Unexpected translation failure")
            return TranslationResult(recipe, str(exc))

        parsed = self._extract_json(raw)
        if parsed is None:
            return TranslationResult(recipe, "Failed to parse translation JSON.")

        merged = dict(recipe)
        for key in self._translatable_keys:
            if key not in parsed:
                continue
            merged[key] = self._normalize_value(key, parsed[key], recipe.get(key))
        return TranslationResult(merged, None)

    def translate_recipes(self, recipes: Iterable[Dict[str, Any]]) -> List[TranslationResult]:
        return [self.translate_recipe(recipe) for recipe in recipes]

    def _system_prompt(self) -> str:
        return (
            "You are a professional translator. Translate the provided recipe to "
            f"{self.target_language}. Translate all human-readable fields (name, ingredients, "
            "instructions, tags). Return ONLY valid JSON with the same keys and structure as the "
            "input. Preserve numbers, measurements, and units."
        )

    def _build_prompt(self, recipe: Dict[str, Any]) -> str:
        payload = {key: recipe.get(key) for key in self._translatable_keys if key in recipe}
        return (
            "Translate every string value in this JSON to the target language. "
            "Keep keys and array shapes unchanged. Return ONLY JSON.\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )

    def _request(self, messages: list[dict[str, str]]) -> str:
        request_kwargs = {
            "model": OPENAI_TRANSLATE_MODEL,
            "max_tokens": OPENAI_TRANSLATE_MAX_TOKENS,
            "temperature": 0.2,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        try:
            response = self.client.chat.completions.create(**request_kwargs)
        except TypeError as exc:
            if "response_format" not in str(exc):
                raise
            request_kwargs.pop("response_format", None)
            response = self.client.chat.completions.create(**request_kwargs)

        content = response.choices[0].message.content if response.choices else ""
        return content.strip() if content else ""

    def _extract_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
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

    def _normalize_value(self, key: str, value: Any, fallback: Any) -> Any:
        if key in {"ingredients", "tags"}:
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
            if isinstance(value, str):
                return [value.strip()] if value.strip() else []
            if value is None:
                return []
            return [str(value).strip()] if str(value).strip() else []
        if key in {"name", "instructions"}:
            if isinstance(value, list):
                return " ".join(str(item).strip() for item in value if str(item).strip())
            if isinstance(value, str):
                return value.strip()
            if value is None:
                return "" if fallback is None else fallback
            return str(value).strip()
        return value


class PlanTranslator:
    def __init__(self, target_language: str) -> None:
        self.target_language = target_language
        self.client = self._init_client()

    def _init_client(self) -> Optional[OpenAI]:
        if not OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY is not configured; translation will be disabled.")
            return None
        timeout = httpx.Timeout(
            OPENAI_TRANSLATE_REQUEST_TIMEOUT,
            connect=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
            read=OPENAI_TRANSLATE_REQUEST_TIMEOUT,
            write=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
            pool=min(10.0, OPENAI_TRANSLATE_REQUEST_TIMEOUT),
        )
        return OpenAI(api_key=OPENAI_API_KEY, timeout=timeout)

    def translate_plan(self, plan: Dict[str, Any]) -> TranslationResult:
        if self.client is None:
            return TranslationResult(plan, "Translation disabled: OPENAI_API_KEY not configured.")

        prompt = json.dumps(plan, ensure_ascii=False)
        messages = [
            {"role": "system", "content": self._system_prompt()},
            {"role": "user", "content": prompt},
        ]
        try:
            raw = self._request(messages)
        except OpenAIError as exc:
            logger.exception("Plan translation failed: %s", exc)
            return TranslationResult(plan, str(exc))
        except Exception as exc:  # pragma: no cover
            logger.exception("Unexpected translation failure")
            return TranslationResult(plan, str(exc))

        parsed = self._extract_json(raw)
        if parsed is None:
            repaired = self._repair_json(raw)
            parsed = self._extract_json(repaired) if repaired else None

        if parsed is None:
            fallback = self._translate_plan_by_meal(plan)
            return TranslationResult(
                fallback,
                "Failed to parse translation JSON; fell back to per-meal translation.",
            )

        return TranslationResult(parsed, None)

    def _system_prompt(self) -> str:
        return (
            "You are a professional translator. Translate all human-readable string values "
            f"to {self.target_language}. Keep keys, numbers, units, and array structure unchanged. "
            "Return ONLY valid JSON and do not add commentary."
        )

    def _request(self, messages: list[dict[str, str]]) -> str:
        request_kwargs = {
            "model": OPENAI_TRANSLATE_MODEL,
            "max_tokens": OPENAI_TRANSLATE_MAX_TOKENS,
            "temperature": 0.2,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        try:
            response = self.client.chat.completions.create(**request_kwargs)
        except TypeError as exc:
            if "response_format" not in str(exc):
                raise
            request_kwargs.pop("response_format", None)
            response = self.client.chat.completions.create(**request_kwargs)

        content = response.choices[0].message.content if response.choices else ""
        return content.strip() if content else ""

    def _repair_json(self, raw_text: str) -> Optional[str]:
        if not raw_text or self.client is None:
            return None
        prompt = (
            "Fix invalid JSON and return ONLY valid JSON with the exact same structure and keys. "
            "Do not add commentary."
        )
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": raw_text},
        ]
        try:
            return self._request(messages)
        except Exception:
            logger.exception("Plan translation JSON repair failed")
            return None

    def _extract_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
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

    def _translate_plan_by_meal(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        translator = RecipeTranslator(target_language=self.target_language)
        if translator.client is None:
            return plan

        translated_plan = copy.deepcopy(plan)
        days = translated_plan.get("days", [])
        if not isinstance(days, list):
            return translated_plan

        for day in days:
            meals = day.get("meals") if isinstance(day, dict) else None
            if not isinstance(meals, dict):
                continue
            for key, meal in meals.items():
                if not isinstance(meal, dict):
                    continue
                result = translator.translate_recipe(meal)
                if result.error is None:
                    meals[key] = result.data

        return translated_plan
