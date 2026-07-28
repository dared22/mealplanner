"""Targeted tests for the solver's allergen fail-closed check, budget-tier
decision, and the liked-ratio quality gate fix (the landmine where running
the solver for every user would always fail a zero-rating user's plan,
since liked_ratio is 0/N by construction with no ratings at all).
"""
import uuid

import solver


def _meal(recipe_id, calories, protein, carbs, fat):
    return {
        "id": str(recipe_id),
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
    }


def test_violates_allergen_restriction_fails_closed_on_missing_data():
    assert solver._violates_allergen_restriction(set(), "gluten") is True


def test_violates_allergen_restriction_detects_match():
    assert solver._violates_allergen_restriction({"gluten"}, "gluten") is True
    assert solver._violates_allergen_restriction({"soy"}, "gluten") is False


def test_wants_cheap_tier():
    assert solver._wants_cheap_tier("budget friendly") is True
    assert solver._wants_cheap_tier("moderate") is False
    assert solver._wants_cheap_tier(None) is False


def test_calculate_quality_metrics_macro_deviation_math():
    liked_id = uuid.uuid4()
    disliked_id = uuid.uuid4()
    macro_targets = {"calories": 2000, "protein": 150, "carbs": 200, "fat": 65}

    # Every day hits targets exactly except Tuesday, which is 20% over on
    # calories only (an unfilled/empty day would itself read as 100%
    # deviation, so every day needs an on-target meal to isolate the case).
    solution = {day: [_meal(liked_id, 2000, 150, 200, 65)] for day in solver.WEEK_DAYS}
    solution["Monday"] = [_meal(liked_id, 2000, 150, 200, 65)]
    solution["Tuesday"] = [_meal(disliked_id, 2400, 150, 200, 65)]

    metrics = solver._calculate_quality_metrics(solution, liked_ids={liked_id}, macro_targets=macro_targets)

    assert metrics["liked_ratio"] == 6 / 7  # 6 of 7 days' meals are the liked recipe
    assert abs(metrics["macro_deviation"] - 0.2) < 1e-9  # Tuesday's calories are 20% over


def test_quality_gate_skips_liked_ratio_below_rating_threshold():
    # Zero ratings -> liked_ratio is always 0, but the gate must not fail
    # solely on that; only macro_deviation is enforced below the threshold.
    metrics = {"liked_ratio": 0.0, "macro_deviation": 0.05}
    assert solver._quality_gate_failed(metrics, rating_count=0) is False


def test_quality_gate_enforces_liked_ratio_above_rating_threshold():
    metrics = {"liked_ratio": 0.0, "macro_deviation": 0.05}
    assert solver._quality_gate_failed(metrics, rating_count=solver.MIN_RATINGS_FOR_LIKED_RATIO_GATE) is True


def test_quality_gate_always_enforces_macro_deviation():
    # Even with zero ratings (liked-ratio gate skipped), a badly-fitting
    # plan should still fail on macro_deviation alone.
    metrics = {"liked_ratio": 1.0, "macro_deviation": 0.5}
    assert solver._quality_gate_failed(metrics, rating_count=0) is True
