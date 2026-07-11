import random
import os
import sys
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost/mealplanner_test"
)

from planner import (  # noqa: E402
    CALORIE_BAND,
    _passes_level,
    _pick_day_combo,
    _recipe_matches_budget,
)


def _candidate(
    title,
    meal_type,
    calories,
    *,
    passes_cuisine=True,
    passes_budget=True,
    passes_cooking_time=True,
):
    return {
        "title": title,
        "meal_type": meal_type,
        "calories": calories,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "passes_cuisine": passes_cuisine,
        "passes_budget": passes_budget,
        "passes_cooking_time": passes_cooking_time,
    }


def _calories(combo):
    return sum(recipe["calories"] for recipe in combo)


def test_recipe_matches_budget():
    assert _recipe_matches_budget("cheap", "budget friendly") is True
    assert _recipe_matches_budget("medium expensive", "budget friendly") is False
    assert _recipe_matches_budget(None, "budget friendly") is False

    for budget in ("moderate", "no_limit", None):
        assert _recipe_matches_budget("cheap", budget) is True
        assert _recipe_matches_budget("medium expensive", budget) is True
        assert _recipe_matches_budget(None, budget) is True


def test_passes_level_escalates_constraints():
    relaxed_soft_constraints = _candidate(
        "Relaxed",
        "lunch",
        400,
        passes_cuisine=True,
        passes_budget=False,
        passes_cooking_time=False,
    )
    relaxed_all_soft_constraints = _candidate(
        "Any Cuisine",
        "lunch",
        400,
        passes_cuisine=False,
        passes_budget=False,
        passes_cooking_time=False,
    )

    assert _passes_level(relaxed_soft_constraints, 0) is False
    assert _passes_level(relaxed_soft_constraints, 1) is True
    assert _passes_level(relaxed_soft_constraints, 2) is True
    assert _passes_level(relaxed_all_soft_constraints, 1) is False
    assert _passes_level(relaxed_all_soft_constraints, 2) is True


def test_pick_day_combo_relaxes_budget_and_cooking_time_for_calorie_fit():
    target = 1000
    pool = {
        "breakfast": [
            _candidate("Strict Breakfast", "breakfast", 100),
            _candidate(
                "Relaxed Breakfast",
                "breakfast",
                300,
                passes_budget=False,
                passes_cooking_time=False,
            ),
        ],
        "lunch": [
            _candidate("Strict Lunch", "lunch", 200),
            _candidate(
                "Relaxed Lunch",
                "lunch",
                300,
                passes_budget=False,
                passes_cooking_time=False,
            ),
        ],
        "dinner": [
            _candidate("Strict Dinner", "dinner", 200),
            _candidate(
                "Relaxed Dinner",
                "dinner",
                400,
                passes_budget=False,
                passes_cooking_time=False,
            ),
        ],
    }

    combo, level = _pick_day_combo(
        pool,
        ["breakfast", "lunch", "dinner"],
        target,
        set(),
        random.Random(0),
    )

    assert combo is not None
    assert level >= 1
    assert abs(_calories(combo) - target) / target <= CALORIE_BAND


def test_pick_day_combo_returns_none_when_slot_pool_empty():
    combo, level = _pick_day_combo(
        {
            "breakfast": [_candidate("Breakfast", "breakfast", 300)],
            "lunch": [],
            "dinner": [_candidate("Dinner", "dinner", 700)],
        },
        ["breakfast", "lunch", "dinner"],
        1000,
        set(),
        random.Random(0),
    )

    assert combo is None
    assert level is None


def test_pick_day_combo_returns_level_zero_when_achievable():
    target = 1000
    combo, level = _pick_day_combo(
        {
            "breakfast": [_candidate("Breakfast", "breakfast", 300)],
            "lunch": [_candidate("Lunch", "lunch", 300)],
            "dinner": [_candidate("Dinner", "dinner", 400)],
        },
        ["breakfast", "lunch", "dinner"],
        target,
        set(),
        random.Random(0),
    )

    assert combo is not None
    assert level == 0
    assert abs(_calories(combo) - target) / target <= CALORIE_BAND


def test_pick_day_combo_prefers_variety_within_day_when_available():
    combo, level = _pick_day_combo(
        {
            "snack": [
                _candidate("Snack A", "snack", 300),
                _candidate("Snack B", "snack", 300),
                _candidate("Snack C", "snack", 400),
            ],
        },
        ["snack", "snack", "snack"],
        1000,
        set(),
        random.Random(0),
    )

    assert combo is not None
    assert level == 0
    titles = [recipe["title"] for recipe in combo]
    assert len(titles) == len(set(titles))
    assert abs(_calories(combo) - 1000) / 1000 <= CALORIE_BAND
