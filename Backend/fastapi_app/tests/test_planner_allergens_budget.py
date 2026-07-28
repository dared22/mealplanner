"""Targeted tests for the hybrid (new-user) path's allergen and budget fixes.

These cover pure logic only (no real database): the allergen fail-closed
check, the cheap-tier budget decision, the greedy macro-fit scorer, and the
budget-relaxation retry inside match_recipes_to_macro_goal (with
query_candidate_recipes stubbed out, since it needs a real DB session).
"""
import planner


def test_violates_allergen_restriction_fails_closed_on_missing_data():
    # No allergen info at all -> treated as unsafe, matching solver.py's
    # equivalent check (missing data must not silently pass a restriction).
    assert planner._violates_allergen_restriction(set(), "gluten") is True


def test_violates_allergen_restriction_detects_match():
    assert planner._violates_allergen_restriction({"gluten", "milk"}, "gluten") is True


def test_violates_allergen_restriction_allows_unrelated_allergen():
    assert planner._violates_allergen_restriction({"soy"}, "gluten") is False


def test_wants_cheap_tier_matches_budget_friendly_only():
    assert planner._wants_cheap_tier("budget friendly") is True
    assert planner._wants_cheap_tier("cheap") is True
    assert planner._wants_cheap_tier("moderate") is False
    assert planner._wants_cheap_tier("premium") is False
    assert planner._wants_cheap_tier("no_limit") is False
    assert planner._wants_cheap_tier(None) is False


def test_macro_fit_score_prefers_closer_match():
    remaining = {"calories": 500, "protein": 40, "carbs": 50, "fat": 15}
    close_fit = {"calories": 500, "protein": 40, "carbs": 50, "fat": 15}
    far_fit = {"calories": 900, "protein": 5, "carbs": 120, "fat": 40}

    close_score = planner.macro_fit_score(close_fit, remaining, remaining_slots=1)
    far_score = planner.macro_fit_score(far_fit, remaining, remaining_slots=1)

    assert close_score > far_score


def test_select_db_recipes_for_day_reports_unfilled_slot_when_pool_empty():
    candidates = {
        "breakfast": [],
        "lunch": [{"title": "Chicken Bowl", "calories": 600, "protein": 45, "carbs": 60, "fat": 20}],
        "dinner": [],
        "snack": [],
    }
    targets = {"calories": 1800, "protein": 130, "carbs": 180, "fat": 55}

    selected, unfilled = planner.select_db_recipes_for_day(
        candidates, ["breakfast", "lunch", "dinner"], targets, set()
    )

    assert [r["title"] for r in selected] == ["Chicken Bowl"]
    assert unfilled == ["breakfast", "dinner"]


def test_match_recipes_relaxes_budget_when_cheap_pool_cant_fill_week(monkeypatch):
    """The cheap-tier pool alone lacks a breakfast option; the relaxed pool
    (enforce_budget=False) has one. match_recipes_to_macro_goal should retry
    with budget relaxed and report budget_relaxed=True rather than punting
    the slot to the (budget-blind) AI fallback.
    """
    cheap_candidates = {
        "breakfast": [],
        "lunch": [{"id": "1", "title": "Cheap Lunch", "calories": 600, "protein": 40, "carbs": 60, "fat": 15,
                    "meal_type": "lunch", "ingredients": [], "instructions": [], "tags": []}],
        "dinner": [{"id": "2", "title": "Cheap Dinner", "calories": 700, "protein": 50, "carbs": 70, "fat": 20,
                     "meal_type": "dinner", "ingredients": [], "instructions": [], "tags": []}],
        "snack": [],
    }
    relaxed_candidates = {
        "breakfast": [{"id": "3", "title": "Pricier Breakfast", "calories": 500, "protein": 30, "carbs": 50, "fat": 15,
                        "meal_type": "breakfast", "ingredients": [], "instructions": [], "tags": []}],
        "lunch": [],
        "dinner": [],
        "snack": [],
    }

    def fake_query_candidate_recipes(db, dto, exclude_names=None, enforce_budget=True):
        return cheap_candidates if enforce_budget else relaxed_candidates

    monkeypatch.setattr(planner, "query_candidate_recipes", fake_query_candidate_recipes)

    pref = {
        "meals_per_day": 3,
        "budget_range": "budget friendly",
        "dietary_restrictions": [],
        "preferred_cuisines": [],
        "cooking_time_preference": None,
    }
    macro_goal = {"calorieTarget": 1800, "macroTargets": {"protein": 120, "carbs": 180, "fat": 50}}

    result = planner.match_recipes_to_macro_goal(pref, macro_goal, used_names=set(), db=object())

    assert result["error"] is None
    assert result["budget_relaxed"] is True
    assert result["db_recipe_count"] == 3
    assert result["ai_recipe_count"] == 0
    names = {m["name"] for m in result["meals"]}
    assert names == {"Cheap Lunch", "Cheap Dinner", "Pricier Breakfast"}


def test_match_recipes_no_relaxation_when_budget_not_constrained(monkeypatch):
    """When the user didn't ask for the cheap tier, an unfilled slot should
    NOT trigger a second (relaxed) query — there's nothing to relax."""
    calls = []

    def fake_query_candidate_recipes(db, dto, exclude_names=None, enforce_budget=True):
        calls.append(enforce_budget)
        return {
            "breakfast": [],
            "lunch": [{"id": "1", "title": "Lunch", "calories": 600, "protein": 40, "carbs": 60, "fat": 15,
                        "meal_type": "lunch", "ingredients": [], "instructions": [], "tags": []}],
            "dinner": [{"id": "2", "title": "Dinner", "calories": 700, "protein": 50, "carbs": 70, "fat": 20,
                         "meal_type": "dinner", "ingredients": [], "instructions": [], "tags": []}],
            "snack": [],
        }

    monkeypatch.setattr(planner, "query_candidate_recipes", fake_query_candidate_recipes)

    def fake_generate_meals_with_openai(dto, meal_slots, targets, remaining_targets, avoid_names):
        return {"meals": [{"name": "AI Breakfast", "meal_type": "breakfast",
                            "calories": 400, "protein": 25, "carbs": 40, "fat": 10}], "error": None}

    monkeypatch.setattr(planner, "_generate_meals_with_openai", fake_generate_meals_with_openai)

    pref = {
        "meals_per_day": 3,
        "budget_range": "no_limit",
        "dietary_restrictions": [],
        "preferred_cuisines": [],
        "cooking_time_preference": None,
    }
    macro_goal = {"calorieTarget": 1800, "macroTargets": {"protein": 120, "carbs": 180, "fat": 50}}

    result = planner.match_recipes_to_macro_goal(pref, macro_goal, used_names=set(), db=object())

    # Only one query attempt (no relaxation retry) since budget wasn't constrained.
    assert calls == [True]
    assert result["budget_relaxed"] is False
    assert result["ai_recipe_count"] == 1
