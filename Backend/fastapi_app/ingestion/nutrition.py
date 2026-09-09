from __future__ import annotations

import os
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from .schemas import CandidateRecipeData, NutritionPerServing


MACRO_IDS = {
    "Protein": "protein_g",
    "Karbo": "carbs_g",
    "Fett": "fat_g",
}


@dataclass
class FoodMatch:
    name: str
    source: str
    source_id: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    portions: list[dict[str, Any]]


class FoodDatabase(Protocol):
    def find(self, name: str) -> FoodMatch | None: ...


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


class MatvaretabellenClient:
    """Primary, source-backed macro data cached from the official annual table."""

    endpoint = "https://www.matvaretabellen.no/api/en/foods.json"
    _cache: tuple[float, list[dict[str, Any]]] | None = None
    _lock = threading.Lock()

    def _foods(self) -> list[dict[str, Any]]:
        with self._lock:
            if self._cache and time.time() - self._cache[0] < 24 * 60 * 60:
                return self._cache[1]
            response = httpx.get(self.endpoint, timeout=60)
            if response.status_code >= 400:
                raise RuntimeError("Matvaretabellen data request failed")
            foods = response.json()["foods"]
            self._cache = (time.time(), foods)
            return foods

    def find(self, name: str) -> FoodMatch | None:
        query = _normalize(name)
        if not query:
            return None
        query_tokens = set(query.split())
        best: tuple[float, dict[str, Any]] | None = None
        for food in self._foods():
            candidates = [
                food.get("foodName", ""),
                *(food.get("searchKeywords") or []),
            ]
            for candidate in candidates:
                normalized = _normalize(candidate)
                tokens = set(normalized.split())
                if normalized == query:
                    score = 1.0
                elif query_tokens and query_tokens.issubset(tokens):
                    score = len(query_tokens) / max(len(tokens), 1)
                else:
                    continue
                if best is None or score > best[0]:
                    best = (score, food)
        if best is None or best[0] < 0.6:
            return None
        food = best[1]
        nutrients = {
            item.get("nutrientId"): float(item.get("quantity", 0))
            for item in food.get("constituents", [])
            if item.get("quantity") is not None
        }
        return FoodMatch(
            name=food["foodName"],
            source="Matvaretabellen",
            source_id=str(food["foodId"]),
            calories=float(food.get("calories", {}).get("quantity") or 0),
            protein_g=nutrients.get("Protein", 0),
            carbs_g=nutrients.get("Karbo", 0),
            fat_g=nutrients.get("Fett", 0),
            portions=food.get("portions") or [],
        )


class USDAFoodDataCentralClient:
    endpoint = "https://api.nal.usda.gov/fdc/v1/foods/search"

    def __init__(self):
        self.api_key = os.getenv("USDA_FDC_API_KEY")

    def find(self, name: str) -> FoodMatch | None:
        if not self.api_key:
            return None
        response = httpx.post(
            self.endpoint,
            params={"api_key": self.api_key},
            json={
                "query": name,
                "dataType": ["Foundation", "SR Legacy"],
                "pageSize": 5,
            },
            timeout=20,
        )
        if response.status_code >= 400:
            raise RuntimeError("USDA FoodData Central request failed")
        foods = response.json().get("foods") or []
        if not foods:
            return None
        query = _normalize(name)
        exact = [
            food
            for food in foods
            if _normalize(food.get("description", "")) == query
        ]
        if not exact:
            return None
        food = exact[0]
        nutrients = {
            item.get("nutrientName"): float(item.get("value") or 0)
            for item in food.get("foodNutrients", [])
        }
        return FoodMatch(
            name=food["description"],
            source="USDA FoodData Central",
            source_id=str(food["fdcId"]),
            calories=nutrients.get("Energy", 0),
            protein_g=nutrients.get("Protein", 0),
            carbs_g=nutrients.get("Carbohydrate, by difference", 0),
            fat_g=nutrients.get("Total lipid (fat)", 0),
            portions=[],
        )


def _grams(quantity: float, unit: str | None, match: FoodMatch) -> float | None:
    normalized = _normalize(unit or "g")
    if normalized in {"g", "gram", "grams"}:
        return quantity
    if normalized in {"kg", "kilogram", "kilograms"}:
        return quantity * 1000
    if normalized in {"mg", "milligram", "milligrams"}:
        return quantity / 1000
    for portion in match.portions:
        portion_unit = _normalize(portion.get("portionUnit", ""))
        if portion_unit == normalized and portion.get("unit") == "g":
            return quantity * float(portion["quantity"])
    # No density or household-measure guesses.
    return None


class NutritionCalculator:
    def __init__(
        self,
        primary: FoodDatabase | None = None,
        fallback: FoodDatabase | None = None,
    ):
        self.primary = primary or MatvaretabellenClient()
        self.fallback = fallback or USDAFoodDataCentralClient()

    def enrich(self, recipe: CandidateRecipeData) -> None:
        if not recipe.portions or not recipe.ingredients:
            return
        totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        sources: list[dict[str, Any]] = []
        for ingredient in recipe.ingredients:
            if ingredient.quantity is None:
                return
            match = self.primary.find(ingredient.name)
            if match is None:
                match = self.fallback.find(ingredient.name)
            if match is None:
                return
            grams = _grams(ingredient.quantity, ingredient.unit, match)
            if grams is None:
                return
            factor = grams / 100
            for key in totals:
                totals[key] += getattr(match, key) * factor
            sources.append(
                {
                    "ingredient": ingredient.name,
                    "matched_food": match.name,
                    "database": match.source,
                    "source_id": match.source_id,
                    "grams": round(grams, 2),
                }
            )
        calculated = NutritionPerServing(
            calories=round(totals["calories"] / recipe.portions, 1),
            protein_g=round(totals["protein_g"] / recipe.portions, 1),
            carbs_g=round(totals["carbs_g"] / recipe.portions, 1),
            fat_g=round(totals["fat_g"] / recipe.portions, 1),
            source="calculated",
        )
        existing = recipe.nutrition_per_serving
        comparison: dict[str, float] = {}
        for key in ("calories", "protein_g", "carbs_g", "fat_g"):
            stated = getattr(existing, key)
            computed = getattr(calculated, key)
            if stated is not None and stated != 0 and computed is not None:
                comparison[key] = round(((computed - stated) / stated) * 100, 1)
        recipe.nutrition_calculation.complete = True
        recipe.nutrition_calculation.calculated = calculated
        recipe.nutrition_calculation.sources = sources
        recipe.nutrition_calculation.comparison_percent = comparison
        if all(
            getattr(existing, key) is None
            for key in ("calories", "protein_g", "carbs_g", "fat_g")
        ):
            recipe.nutrition_per_serving = calculated
