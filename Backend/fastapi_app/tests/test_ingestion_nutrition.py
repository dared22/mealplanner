from ingestion.nutrition import FoodMatch, NutritionCalculator
from ingestion.schemas import CandidateRecipeData


class FoodDatabase:
    def __init__(self, matches):
        self.matches = matches
        self.queries = []

    def find(self, name):
        self.queries.append(name)
        return self.matches.get(name)


class UnavailableFoodDatabase:
    def find(self, _name):
        raise RuntimeError("provider unavailable")


def match(name, source):
    return FoodMatch(
        name=name,
        source=source,
        source_id=name,
        calories=200,
        protein_g=20,
        carbs_g=10,
        fat_g=5,
        portions=[],
    )


def test_nutrition_uses_primary_then_fallback_and_calculates_per_serving():
    primary = FoodDatabase({"chicken": match("Chicken", "Matvaretabellen")})
    fallback = FoodDatabase({"rice": match("Rice", "USDA FoodData Central")})
    recipe = CandidateRecipeData(
        title="Bowls",
        portions=2,
        ingredients=[
            {"name": "chicken", "quantity": 200, "unit": "g"},
            {"name": "rice", "quantity": 100, "unit": "g"},
        ],
    )

    NutritionCalculator(primary, fallback).enrich(recipe)

    assert recipe.nutrition_per_serving.calories == 300
    assert recipe.nutrition_per_serving.source == "calculated"
    assert [item["database"] for item in recipe.nutrition_calculation.sources] == [
        "Matvaretabellen",
        "USDA FoodData Central",
    ]


def test_nutrition_does_not_publish_partial_or_guessed_calculations():
    primary = FoodDatabase({"chicken": match("Chicken", "Matvaretabellen")})
    fallback = FoodDatabase({})
    recipe = CandidateRecipeData(
        title="Bowls",
        portions=2,
        ingredients=[
            {"name": "chicken", "quantity": 200, "unit": "g"},
            {"name": "mystery sauce", "quantity": 2, "unit": "tbsp"},
        ],
    )

    NutritionCalculator(primary, fallback).enrich(recipe)

    assert recipe.nutrition_calculation.complete is False
    assert recipe.nutrition_per_serving.calories is None


def test_nutrition_provider_failure_preserves_creator_macros():
    recipe = CandidateRecipeData(
        title="Bowls",
        portions=2,
        ingredients=[{"name": "chicken", "quantity": 200, "unit": "g"}],
        nutrition_per_serving={
            "calories": 500,
            "protein_g": 40,
            "carbs_g": 50,
            "fat_g": 12,
            "source": "creator",
        },
    )

    NutritionCalculator(
        UnavailableFoodDatabase(), UnavailableFoodDatabase()
    ).enrich(recipe)

    assert recipe.nutrition_per_serving.calories == 500
    assert recipe.nutrition_per_serving.source == "creator"
    assert recipe.nutrition_calculation.complete is False
    assert recipe.nutrition_calculation.sources == [
        {
            "ingredient": "chicken",
            "warning": "nutrition_lookup_unavailable",
        }
    ]
