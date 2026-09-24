import os
import sys
from pathlib import Path
from types import SimpleNamespace


os.environ.setdefault(
    "DATABASE_URL", "postgresql://user:password@localhost:5432/mealplanner_test"
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from planning_policy import (
    matches_cooking_time,
    matches_dietary_restrictions,
    matches_preferred_cuisines,
    meal_slots_for_day,
    normalize_cuisine_list,
    normalize_nutrition,
)
import planner
from solver import _get_last_week_recipes as solver_last_week_recipes


def test_policy_normalizes_canonical_and_legacy_nutrition():
    assert normalize_nutrition(
        {"calories_kcal": "540", "protein": 28, "carbohydrates": 72, "fat_g": 12}
    ) == {"calories": 540.0, "protein": 28.0, "carbs": 72.0, "fat": 12.0}


def test_policy_accepts_canonical_and_legacy_dietary_flags_and_fails_closed_for_allergens():
    assert matches_dietary_restrictions(
        {"vegan": True, "gluten_free": True}, ["soy"], ["vegan", "gluten_free"]
    )
    assert matches_dietary_restrictions({"is_vegetarian": "true"}, ["dairy"], ["vegetarian"])
    assert not matches_dietary_restrictions({"vegan": True}, [], ["gluten_free"])
    assert not matches_dietary_restrictions({"vegan": True}, ["gluten"], ["gluten_free"])


def test_policy_applies_cuisine_time_and_meal_slot_rules():
    assert matches_preferred_cuisines("Nordic / Italian", normalize_cuisine_list(["italian"]))
    assert not matches_preferred_cuisines("Thai", normalize_cuisine_list(["italian"]))
    assert matches_preferred_cuisines("Italian", normalize_cuisine_list("italian"))
    assert matches_cooking_time(25, "under_15_min") is False
    assert matches_cooking_time(25, "15_30_min")
    assert meal_slots_for_day(2) == ["breakfast", "dinner"]
    assert meal_slots_for_day(4) == ["breakfast", "lunch", "dinner", "snack"]


def test_hybrid_planner_uses_the_supplied_macro_goal_once_and_keeps_seven_days(monkeypatch):
    monkeypatch.setattr(
        planner,
        "generate_daily_macro_goal",
        lambda _preference: (_ for _ in ()).throw(AssertionError("must not generate macros twice")),
    )
    monkeypatch.setattr(
        planner,
        "match_recipes_to_macro_goal",
        lambda *_args, **_kwargs: {
            "meals": [],
            "totals": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
            "error": None,
            "db_recipe_count": 0,
            "ai_recipe_count": 0,
        },
    )
    preference = SimpleNamespace(
        meals_per_day=3,
        language="en",
        raw_data={},
    )
    macro_goal = {
        "calorieTarget": 2000,
        "macroTargets": {"protein": 150, "carbs": 200, "fat": 65},
    }

    result = planner.generate_daily_plan(preference, macro_goal=macro_goal)

    assert result["error"] is None
    assert len(result["plan"]["days"]) == 7
    assert result["plan"]["calorieTarget"] == 2000.0
    assert result["language"] == "no"


def test_both_planning_strategies_exclude_recipes_from_the_last_successful_plan():
    recipe_id = "6dd9b98f-5683-4eba-b7da-c1f090141b9a"
    current = SimpleNamespace(id=2, raw_data={})
    previous = SimpleNamespace(id=1, raw_data={"generated_plan": {"plan": {"days": []}}})

    class HistorySession:
        def __init__(self):
            self.call_count = 0

        def execute(self, _statement):
            self.call_count += 1
            if self.call_count == 1:
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [current, previous]))
            return [(recipe_id,)]

    assert planner._get_last_week_recipes(HistorySession(), "user") == {recipe_id}
    assert solver_last_week_recipes(HistorySession(), "user") == {recipe_id}
