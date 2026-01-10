import asyncio
import copy
import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

try:
    from googletrans import Translator
    _GOOGLETRANS_IMPORT_ERROR = None
except Exception as exc:  # pragma: no cover
    Translator = None
    _GOOGLETRANS_IMPORT_ERROR = exc

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class TranslationResult:
    data: Dict[str, Any]
    error: Optional[str] = None


class _GoogleTranslateBase:
    def __init__(self, target_language: str) -> None:
        self.target_language = target_language
        self._enabled = self._init_client()
        self.client = True if self._enabled else None

    def _init_client(self) -> bool:
        if Translator is None:
            logger.warning(
                "googletrans is not installed or failed to import; translation will be disabled: %s",
                _GOOGLETRANS_IMPORT_ERROR,
            )
            return False
        return True

    def _translate_batch(self, texts: List[str]) -> List[str]:
        if not texts:
            return []
        if not self._enabled or Translator is None:
            return texts
        try:
            result = self._run_coroutine(self._translate_async(texts))
        except Exception as exc:
            logger.exception("googletrans request failed: %s", exc)
            return texts

        if not isinstance(result, list):
            result = [result]

        translated: List[str] = []
        for item, original in zip(result, texts):
            value = getattr(item, "text", None)
            translated.append(value if value else original)
        return translated

    def _run_coroutine(self, coro: Any) -> Any:
        import concurrent.futures

        def runner() -> Any:
            asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
            return asyncio.run(coro)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(runner)
            return future.result()

    async def _translate_async(self, texts: List[str]) -> Any:
        translator = Translator()
        return await translator.translate(texts, dest=self.target_language)


class RecipeTranslator(_GoogleTranslateBase):
    def __init__(self, target_language: str = "Norwegian") -> None:
        super().__init__(target_language)
        self._translatable_keys = ("name", "ingredients", "instructions", "tags")

    def translate_recipe(self, recipe: Dict[str, Any]) -> TranslationResult:
        if not self._enabled:
            return TranslationResult(recipe, "Translation disabled: Google Translate not configured.")

        translated = dict(recipe)
        translated["name"] = self._translate_text(recipe.get("name"))
        translated["instructions"] = self._translate_text(recipe.get("instructions"))
        translated["ingredients"] = self._translate_list(recipe.get("ingredients"))
        translated["tags"] = self._translate_list(recipe.get("tags"))
        return TranslationResult(translated, None)

    def translate_recipes(self, recipes: Iterable[Dict[str, Any]]) -> List[TranslationResult]:
        return [self.translate_recipe(recipe) for recipe in recipes]

    def _translate_text(self, value: Any) -> Any:
        if value is None:
            return value
        if not isinstance(value, str):
            return value
        translated = self._translate_batch([value])
        return translated[0] if translated else value

    def _translate_list(self, value: Any) -> Any:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        texts = [str(item) for item in value]
        translated = self._translate_batch(texts)
        return translated if translated else value


class PlanTranslator(_GoogleTranslateBase):
    def translate_plan(self, plan: Dict[str, Any]) -> TranslationResult:
        if not self._enabled:
            return TranslationResult(plan, "Translation disabled: Google Translate not configured.")

        translated_plan = copy.deepcopy(plan)
        days = translated_plan.get("days", [])
        if isinstance(days, list):
            for day in days:
                if isinstance(day, dict) and isinstance(day.get("name"), str):
                    day["name"] = self._translate_batch([day["name"]])[0]
                meals = day.get("meals") if isinstance(day, dict) else None
                if not isinstance(meals, dict):
                    continue
                for key, meal in meals.items():
                    if not isinstance(meal, dict):
                        continue
                    meals[key] = self._translate_meal(meal)

        return TranslationResult(translated_plan, None)

    def _translate_meal(self, meal: Dict[str, Any]) -> Dict[str, Any]:
        translated = dict(meal)
        translated["name"] = self._translate_text(meal.get("name"))
        translated["instructions"] = self._translate_text(meal.get("instructions"))
        translated["ingredients"] = self._translate_list(meal.get("ingredients"))
        translated["tags"] = self._translate_list(meal.get("tags"))
        return translated

    def _translate_text(self, value: Any) -> Any:
        if value is None:
            return value
        if not isinstance(value, str):
            return value
        translated = self._translate_batch([value])
        return translated[0] if translated else value

    def _translate_list(self, value: Any) -> Any:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        texts = [str(item) for item in value]
        translated = self._translate_batch(texts)
        return translated if translated else value
