"""End-to-end check that vectorizing _build_solver_model / _extract_solution
(replacing per-variable df[df["id"] == recipe_id] scans with a precomputed
id -> row dict) didn't change solver behavior. Runs a real, tiny PuLP solve.
"""
import uuid

import pandas as pd
from pulp import PULP_CBC_CMD, LpStatus

import solver


def _recipe(recipe_id, meal_type, calories, protein, carbs, fat):
    return {
        "id": recipe_id,
        "title": f"{meal_type}-{recipe_id}",
        "meal_type": meal_type,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "ingredients": [],
        "instructions": [],
        "cost_category": "cheap",
        "total_time_minutes": 20,
        "tags": [],
    }


def test_build_and_extract_solution_end_to_end():
    # 4 recipes per meal type: with only 12 unique recipes against 21 weekly
    # slots, the variety constraint caps each recipe at <=2 uses/week, so at
    # least 4 options per slot are needed for all 7 days to be satisfiable
    # (ceil(7/2) = 4). One recipe per slot would make 5 of 7 days infeasible.
    df = pd.DataFrame([
        _recipe(uuid.uuid4(), "breakfast", 500, 35, 50, 15) for _ in range(4)
    ] + [
        _recipe(uuid.uuid4(), "lunch", 700, 55, 70, 20) for _ in range(4)
    ] + [
        _recipe(uuid.uuid4(), "dinner", 800, 60, 80, 25) for _ in range(4)
    ])
    macro_targets = {"calories": 2000, "protein": 150, "carbs": 200, "fat": 60}

    prob, recipe_vars, meal_slots = solver._build_solver_model(
        df, liked_ids=set(), macro_targets=macro_targets, meals_per_day=3, timeout_seconds=10
    )
    # Mirrors the fixed call in generate_personalized_plan: the time limit
    # must be set on the solver command object, not passed to .solve() directly.
    prob.solve(PULP_CBC_CMD(msg=False, timeLimit=10))

    assert LpStatus[prob.status] in ("Optimal", "Not Solved")
    assert any(var.varValue == 1 for var in recipe_vars.values())

    solution = solver._extract_solution(prob, df, recipe_vars, meal_slots)

    assert set(solution.keys()) == set(solver.WEEK_DAYS)
    for day in solver.WEEK_DAYS:
        day_meals = solution[day]
        assert len(day_meals) == 3
        assert {m["meal_type"] for m in day_meals} == {"breakfast", "lunch", "dinner"}
        totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        for meal in day_meals:
            for key in totals:
                totals[key] += meal[key]
        for key, target in macro_targets.items():
            assert abs(totals[key] - target) / target <= solver.MACRO_TOLERANCE + 1e-9
