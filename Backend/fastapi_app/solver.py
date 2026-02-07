"""
Constraint-based meal plan generator using PuLP optimization.

This module generates personalized weekly meal plans by solving a constraint
satisfaction problem that maximizes user preferences while meeting macro targets
and respecting dietary restrictions.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

import pandas as pd
from pulp import LpMaximize, LpProblem, LpStatus, LpVariable, lpSum, value
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import PlanRecipe, Preference, Rating, Recipe
from planner import generate_daily_macro_goal

logger = logging.getLogger(__name__)

# Constants
WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MACRO_TOLERANCE = 0.10  # ±10% tolerance for macro targets
QUALITY_THRESHOLD_LIKED_RATIO = 0.5  # Minimum 50% liked recipes
QUALITY_THRESHOLD_MACRO_DEVIATION = 0.2  # Maximum 20% macro deviation


def _adaptive_liked_threshold(liked_count: int, total_meals: int) -> float:
    """Compute an adaptive liked-ratio threshold based on available liked recipes.

    The standard quality gate requires 50% of meals to be from liked recipes.
    For users with very few likes relative to required meals, that ratio is
    impossible. Scale the target to 80% of the maximum achievable liked ratio
    (liked_count / total_meals) with a floor of 0.15 and ceiling of 0.50.
    """
    if total_meals <= 0:
        return QUALITY_THRESHOLD_LIKED_RATIO

    max_achievable = liked_count / total_meals
    threshold = max_achievable * 0.8
    return max(0.15, min(threshold, QUALITY_THRESHOLD_LIKED_RATIO))


def _normalize_token(value: str) -> str:
    """Normalize text to a comparable token (lowercase, underscores, alnum only)."""
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower())
    return normalized.strip("_")


def _normalize_cuisine_list(values: Optional[List[str]]) -> Set[str]:
    if not values:
        return set()
    return {token for token in (_normalize_token(v) for v in values) if token}


def _recipe_matches_preferred_cuisines(recipe_cuisine: Optional[str], allowed: Set[str]) -> bool:
    if not allowed:
        return True
    if not recipe_cuisine:
        return False
    # Split on common separators to support multi-cuisine strings.
    parts = re.split(r"[,/;|]+", str(recipe_cuisine))
    for part in parts:
        if _normalize_token(part) in allowed:
            return True
    return False


def _normalize_allergens(allergens: Any) -> Set[str]:
    if not allergens:
        return set()
    if isinstance(allergens, (list, tuple, set)):
        return {str(item).strip().lower() for item in allergens if item}
    return {str(allergens).strip().lower()}


def _dietary_flag_truthy(flags: Any, key: str) -> bool:
    if not isinstance(flags, dict):
        return False
    value = flags.get(key)
    if value is None:
        value = flags.get(key.lower())
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"true", "1", "yes", "y"}


def _violates_allergen_restriction(allergens: Set[str], restriction: str) -> bool:
    if not allergens:
        # If allergens are missing, treat as unsafe for allergen-based restrictions.
        return True
    if "gluten" in restriction:
        return any("gluten" in allergen for allergen in allergens)
    if "dairy" in restriction:
        return any("dairy" in allergen for allergen in allergens)
    if "nut" in restriction:
        return any("nut" in allergen for allergen in allergens)
    return False


def _cooking_time_bounds(value: Any) -> Tuple[Optional[int], Optional[int]]:
    if value is None:
        return None, None
    normalized = str(value).strip().lower()
    if normalized in {"under_20_min", "under20", "<20"}:
        return None, 20
    if normalized in {"15_30_min", "15-30", "15_30"}:
        return 15, 30
    if normalized in {"30_60_min", "30-60", "30_60"}:
        return 30, 60
    if normalized in {"over_60_min", "60_plus", ">60"}:
        return 60, None
    if "quick" in normalized or "fast" in normalized:
        return None, 30
    if "moderate" in normalized or "medium" in normalized:
        return 30, 60
    if "slow" in normalized or "long" in normalized:
        return 60, None
    return None, None


def _apply_cooking_time_filter(df: pd.DataFrame, preference: Preference) -> pd.DataFrame:
    if df.empty or "total_time_minutes" not in df.columns:
        return df
    min_minutes, max_minutes = _cooking_time_bounds(preference.cooking_time_preference)
    if min_minutes is None and max_minutes is None:
        return df

    series = pd.to_numeric(df["total_time_minutes"], errors="coerce")
    mask = series.notna()
    if min_minutes is not None:
        mask &= series >= min_minutes
    if max_minutes is not None:
        mask &= series <= max_minutes
    return df[mask]


def _get_user_ratings(db: Session, user_id: UUID) -> Tuple[Set[UUID], Set[UUID]]:
    """
    Get user's liked and disliked recipe IDs.

    Returns:
        (liked_ids, disliked_ids) tuple of sets
    """
    stmt = select(Rating.recipe_id, Rating.is_liked).where(Rating.user_id == user_id)
    result = db.execute(stmt)

    liked_ids = set()
    disliked_ids = set()

    for recipe_id, is_liked in result:
        if is_liked:
            liked_ids.add(recipe_id)
        else:
            disliked_ids.add(recipe_id)

    return liked_ids, disliked_ids


def _get_last_week_recipes(db: Session, user_id: UUID) -> Set[UUID]:
    """
    Get recipe IDs from the most recent successful meal plan.

    Returns:
        Set of recipe IDs from last week's plan
    """
    # Find most recent successful preference
    stmt = (
        select(Preference)
        .where(
            Preference.user_id == user_id,
            Preference.raw_data["plan_status"].astext == "success"
        )
        .order_by(Preference.submitted_at.desc())
        .limit(1)
    )
    result = db.execute(stmt)
    last_pref = result.scalar_one_or_none()

    if not last_pref:
        return set()

    # Get all recipes from that plan
    stmt = select(PlanRecipe.recipe_id).where(PlanRecipe.preference_id == last_pref.id)
    result = db.execute(stmt)

    return {recipe_id for (recipe_id,) in result}


def _filter_recipes_for_solver(
    db: Session,
    preference: Preference,
    disliked_ids: Set[UUID],
    last_week_ids: Set[UUID]
) -> pd.DataFrame:
    """
    Pre-filter recipes to valid candidates (300-500 recipes).

    Filters by:
    - Dietary restrictions (hard constraint)
    - Exclude disliked recipes
    - Exclude last week's recipes
    - Soft filters: budget, cooking time (relaxed if too few recipes)
    """
    # Start with active recipes
    stmt = select(Recipe).where(Recipe.is_active.is_(True))

    # Apply dietary restrictions (hard constraint)
    dietary_restrictions = preference.dietary_restrictions or []
    for restriction in dietary_restrictions:
        if not restriction:
            continue
        restriction_lower = str(restriction).lower()

        if restriction_lower == "vegan":
            stmt = stmt.where(Recipe.dietary_flags["is_vegan"].astext == "true")
        elif restriction_lower == "vegetarian":
            # Vegetarian includes vegan recipes
            stmt = stmt.where(
                (Recipe.dietary_flags["is_vegetarian"].astext == "true") |
                (Recipe.dietary_flags["is_vegan"].astext == "true")
            )

    result = db.execute(stmt)
    recipes = result.scalars().all()

    allowed_cuisines = _normalize_cuisine_list(preference.preferred_cuisines)

    # Convert to DataFrame
    recipe_data = []
    for recipe in recipes:
        # Skip disliked and last week's recipes
        if recipe.id in disliked_ids or recipe.id in last_week_ids:
            continue
        if not _recipe_matches_preferred_cuisines(recipe.cuisine, allowed_cuisines):
            continue

        restriction_blocked = False
        flags = recipe.dietary_flags or {}
        allergens = _normalize_allergens(recipe.allergens)
        for restriction in dietary_restrictions:
            if not restriction:
                continue
            restriction_lower = str(restriction).lower()
            if restriction_lower == "none":
                continue
            if restriction_lower == "vegan":
                if not _dietary_flag_truthy(flags, "is_vegan"):
                    restriction_blocked = True
                    break
            elif restriction_lower == "vegetarian":
                if not (_dietary_flag_truthy(flags, "is_vegetarian") or _dietary_flag_truthy(flags, "is_vegan")):
                    restriction_blocked = True
                    break
            elif restriction_lower == "gluten_free" or "gluten" in restriction_lower:
                if _violates_allergen_restriction(allergens, "gluten"):
                    restriction_blocked = True
                    break
            elif restriction_lower == "dairy_free" or "dairy" in restriction_lower:
                if _violates_allergen_restriction(allergens, "dairy"):
                    restriction_blocked = True
                    break
            elif restriction_lower == "nut_free" or "nut" in restriction_lower:
                if _violates_allergen_restriction(allergens, "nut"):
                    restriction_blocked = True
                    break
        if restriction_blocked:
            continue

        # Extract nutrition data
        nutrition = recipe.nutrition or {}
        calories = nutrition.get("calories_kcal") or nutrition.get("calories") or 0
        protein = nutrition.get("protein_g") or 0
        carbs = nutrition.get("carbs_g") or 0
        fat = nutrition.get("fat_g") or 0

        recipe_data.append({
            "id": recipe.id,
            "title": recipe.title,
            "meal_type": recipe.meal_type.lower() if recipe.meal_type else None,
            "calories": float(calories),
            "protein": float(protein),
            "carbs": float(carbs),
            "fat": float(fat),
            "ingredients": recipe.ingredients,
            "instructions": recipe.instructions,
            "cost_category": recipe.cost_category,
            "total_time_minutes": recipe.total_time_minutes,
            "tags": recipe.tags or [],
        })

    df = pd.DataFrame(recipe_data)

    if df.empty:
        return df

    # Soft filters: budget (relaxed if too few recipes)
    # Cooking time is enforced but dropped if it eliminates all options.
    initial_count = len(df)

    # Budget filter (soft)
    budget_range = preference.budget_range
    if budget_range and budget_range != "no_limit" and "cost_category" in df.columns:
        df["cost_category"] = df["cost_category"].astype(str).str.lower()
        budget_lower = str(budget_range).lower()
        if "budget" in budget_lower or "cheap" in budget_lower:
            budget_filtered = df[df["cost_category"] == "cheap"]
            if len(budget_filtered) >= 100:  # Keep if we have enough
                df = budget_filtered

    # Cooking time filter (enforced, but dropped if it yields no matches)
    if preference.cooking_time_preference:
        time_filtered = _apply_cooking_time_filter(df, preference)
        if time_filtered.empty and not df.empty:
            logger.info("Cooking time filter eliminated all recipes; dropping cooking time constraint.")
        else:
            df = time_filtered

    logger.info(
        f"Filtered recipes: {initial_count} -> {len(df)} "
        f"(dietary restrictions, disliked, last week excluded)"
    )

    return df


def _check_impossible_constraints(
    df: pd.DataFrame,
    macro_targets: Dict[str, float],
    meals_per_day: int
) -> Optional[str]:
    """
    Check if constraints are mathematically impossible to satisfy.

    Returns error message if impossible, None otherwise.
    """
    if df.empty:
        return "No recipes match your dietary restrictions. Please adjust your preferences."

    # Check if we have recipes for each meal type needed
    meal_types_needed = ["breakfast", "lunch", "dinner"][:meals_per_day]

    # Count recipes by meal type
    breakfast_count = len(df[df["meal_type"] == "breakfast"])
    lunch_count = len(df[df["meal_type"] == "lunch"])
    dinner_count = len(df[df["meal_type"] == "dinner"])

    if meals_per_day >= 1 and breakfast_count == 0:
        return "No breakfast recipes match your dietary restrictions."
    if meals_per_day >= 2 and lunch_count == 0:
        return "No lunch recipes match your dietary restrictions."
    if meals_per_day >= 3 and dinner_count == 0:
        return "No dinner recipes match your dietary restrictions."

    # Check if macro targets are achievable
    # Get min/max calories per meal from available recipes
    min_calories_per_meal = df["calories"].min()
    max_calories_per_meal = df["calories"].max()

    daily_target_calories = macro_targets.get("calories", 0)
    min_achievable = min_calories_per_meal * meals_per_day
    max_achievable = max_calories_per_meal * meals_per_day

    # Allow for tolerance
    if daily_target_calories < min_achievable * 0.5:
        return f"Your calorie target ({int(daily_target_calories)} kcal/day) is too low for available recipes. Minimum achievable is approximately {int(min_achievable)} kcal/day."

    if daily_target_calories > max_achievable * 2:
        return f"Your calorie target ({int(daily_target_calories)} kcal/day) is too high for available recipes. Maximum achievable is approximately {int(max_achievable)} kcal/day."

    return None


def _build_solver_model(
    df: pd.DataFrame,
    liked_ids: Set[UUID],
    macro_targets: Dict[str, float],
    meals_per_day: int,
    timeout_seconds: int
) -> Tuple[LpProblem, Dict, Dict]:
    """
    Build the PuLP optimization model.

    Returns:
        (model, recipe_vars, assignment) tuple
    """
    # Create optimization problem
    prob = LpProblem("MealPlan", LpMaximize)

    # Decision variables: x[recipe_id, day, meal_type] = 1 if recipe selected
    recipe_vars = {}
    meal_slots = _build_meal_slots(meals_per_day)

    for day in WEEK_DAYS:
        for meal_type in meal_slots:
            for _, recipe in df.iterrows():
                # Only create variables for appropriate meal types
                if not _is_appropriate_meal_type(recipe["meal_type"], meal_type):
                    continue

                var_name = f"x_{recipe['id']}_{day}_{meal_type}"
                recipe_vars[(recipe["id"], day, meal_type)] = LpVariable(
                    var_name, cat="Binary"
                )

    # Objective: maximize liked recipes
    # Score: 10 for liked, 1 for neutral
    objective = []
    for (recipe_id, day, meal_type), var in recipe_vars.items():
        score = 10 if recipe_id in liked_ids else 1
        objective.append(score * var)

    prob += lpSum(objective)

    # Constraint 1: Exactly one recipe per meal slot
    for day in WEEK_DAYS:
        for meal_type in meal_slots:
            slot_vars = [
                var for (rid, d, mt), var in recipe_vars.items()
                if d == day and mt == meal_type
            ]
            if slot_vars:
                prob += lpSum(slot_vars) == 1

    # Constraint 2: Each recipe used at most once per week (variety)
    # Allow 1 repeat if we have fewer than 21 unique recipes
    total_meals = len(WEEK_DAYS) * len(meal_slots)
    unique_recipes = len(df)

    for recipe_id in df["id"]:
        recipe_uses = [
            var for (rid, day, meal_type), var in recipe_vars.items()
            if rid == recipe_id
        ]
        if recipe_uses:
            if unique_recipes >= total_meals:
                # Enough recipes - enforce uniqueness
                prob += lpSum(recipe_uses) <= 1
            else:
                # Allow up to 2 uses if insufficient recipes
                prob += lpSum(recipe_uses) <= 2

    # Constraint 3: Daily macro targets (±10% tolerance)
    tolerance = MACRO_TOLERANCE

    for day in WEEK_DAYS:
        day_vars = [
            (rid, var) for (rid, d, mt), var in recipe_vars.items()
            if d == day
        ]

        # Calories
        day_calories = []
        for recipe_id, var in day_vars:
            recipe = df[df["id"] == recipe_id].iloc[0]
            day_calories.append(recipe["calories"] * var)

        target_cal = macro_targets.get("calories", 2000)
        prob += lpSum(day_calories) >= target_cal * (1 - tolerance)
        prob += lpSum(day_calories) <= target_cal * (1 + tolerance)

        # Protein
        day_protein = []
        for recipe_id, var in day_vars:
            recipe = df[df["id"] == recipe_id].iloc[0]
            day_protein.append(recipe["protein"] * var)

        target_protein = macro_targets.get("protein", 150)
        prob += lpSum(day_protein) >= target_protein * (1 - tolerance)
        prob += lpSum(day_protein) <= target_protein * (1 + tolerance)

        # Carbs
        day_carbs = []
        for recipe_id, var in day_vars:
            recipe = df[df["id"] == recipe_id].iloc[0]
            day_carbs.append(recipe["carbs"] * var)

        target_carbs = macro_targets.get("carbs", 200)
        prob += lpSum(day_carbs) >= target_carbs * (1 - tolerance)
        prob += lpSum(day_carbs) <= target_carbs * (1 + tolerance)

        # Fat
        day_fat = []
        for recipe_id, var in day_vars:
            recipe = df[df["id"] == recipe_id].iloc[0]
            day_fat.append(recipe["fat"] * var)

        target_fat = macro_targets.get("fat", 65)
        prob += lpSum(day_fat) >= target_fat * (1 - tolerance)
        prob += lpSum(day_fat) <= target_fat * (1 + tolerance)

    return prob, recipe_vars, meal_slots


def _build_meal_slots(meals_per_day: int) -> List[str]:
    """Build list of meal slots based on meals per day."""
    slots = ["breakfast", "lunch", "dinner"]
    extra = max(meals_per_day - 3, 0)
    slots.extend(["snack"] * extra)
    slots = slots[:max(meals_per_day, 1)]
    if "dinner" not in slots:
        if slots:
            slots[-1] = "dinner"
        else:
            slots = ["dinner"]
    return slots


def _is_appropriate_meal_type(recipe_meal_type: Optional[str], slot_meal_type: str) -> bool:
    """Check if a recipe is appropriate for a meal slot."""
    if not recipe_meal_type:
        # Recipes without meal_type can fill any slot (except breakfast)
        return slot_meal_type != "breakfast"

    recipe_type_lower = recipe_meal_type.lower()

    if slot_meal_type == "breakfast":
        return recipe_type_lower == "breakfast"
    elif slot_meal_type == "lunch":
        return recipe_type_lower in ["lunch", "breakfast"]  # Breakfast can be lunch
    elif slot_meal_type == "dinner":
        return recipe_type_lower in ["dinner", "lunch"]  # Lunch can be dinner
    elif slot_meal_type == "snack":
        return True  # Any recipe can be a snack

    return True


def _extract_solution(
    model: LpProblem,
    df: pd.DataFrame,
    recipe_vars: Dict,
    meal_slots: List[str]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Extract the solution from the solved model.

    Returns:
        Dict mapping day -> list of meals
    """
    solution = {}

    for day in WEEK_DAYS:
        day_meals = []

        for meal_type in meal_slots:
            # Find which recipe was selected for this slot
            for (recipe_id, d, mt), var in recipe_vars.items():
                if d == day and mt == meal_type:
                    if var.varValue == 1:
                        recipe = df[df["id"] == recipe_id].iloc[0]
                        day_meals.append({
                            "id": str(recipe["id"]),
                            "name": recipe["title"],
                            "meal_type": meal_type,
                            "calories": float(recipe["calories"]),
                            "protein": float(recipe["protein"]),
                            "carbs": float(recipe["carbs"]),
                            "fat": float(recipe["fat"]),
                            "ingredients": recipe["ingredients"],
                            "instructions": recipe["instructions"],
                            "tags": recipe["tags"],
                        })
                        break

        solution[day] = day_meals

    return solution


def _calculate_quality_metrics(
    solution: Dict[str, List[Dict[str, Any]]],
    liked_ids: Set[UUID],
    macro_targets: Dict[str, float]
) -> Dict[str, float]:
    """
    Calculate quality metrics for the solution.

    Returns:
        Dict with liked_ratio and macro_deviation
    """
    # Calculate liked ratio
    total_meals = 0
    liked_meals = 0

    for day_meals in solution.values():
        for meal in day_meals:
            total_meals += 1
            if UUID(meal["id"]) in liked_ids:
                liked_meals += 1

    liked_ratio = liked_meals / total_meals if total_meals > 0 else 0

    # Calculate macro deviation
    daily_totals = {day: {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
                   for day in WEEK_DAYS}

    for day, meals in solution.items():
        for meal in meals:
            daily_totals[day]["calories"] += meal["calories"]
            daily_totals[day]["protein"] += meal["protein"]
            daily_totals[day]["carbs"] += meal["carbs"]
            daily_totals[day]["fat"] += meal["fat"]

    # Calculate max deviation across all days and macros
    max_deviation = 0
    for day_total in daily_totals.values():
        for macro in ["calories", "protein", "carbs", "fat"]:
            target = macro_targets.get(macro, 0)
            if target > 0:
                deviation = abs(day_total[macro] - target) / target
                max_deviation = max(max_deviation, deviation)

    return {
        "liked_ratio": liked_ratio,
        "macro_deviation": max_deviation,
    }


def _format_plan_output(
    solution: Dict[str, List[Dict[str, Any]]],
    macro_targets: Dict[str, float]
) -> Dict[str, Any]:
    """
    Format the solution into the same structure as OpenAI planner.

    Matches the structure from planner.py _build_weekly_plan
    """
    days = []

    for day_name in WEEK_DAYS:
        day_meals = solution.get(day_name, [])

        # Group meals by type
        breakfast = None
        lunch = None
        dinner = None
        snacks = []

        for meal in day_meals:
            meal_type = meal["meal_type"]

            formatted_meal = {
                "id": meal["id"],
                "name": meal["name"],
                "calories": meal["calories"],
                "protein": meal["protein"],
                "carbs": meal["carbs"],
                "fat": meal["fat"],
                "cookTime": "",
                "tags": meal.get("tags", []),
                "ingredients": meal.get("ingredients", []),
                "instructions": _format_instructions(meal.get("instructions")),
            }

            if meal_type == "breakfast":
                breakfast = formatted_meal
            elif meal_type == "lunch":
                lunch = formatted_meal
            elif meal_type == "dinner":
                dinner = formatted_meal
            elif meal_type == "snack":
                snacks.append(formatted_meal)

        # Aggregate snacks
        snacks_meal = None
        if snacks:
            snacks_meal = {
                "name": "Snacks: " + ", ".join(s["name"] for s in snacks[:3]),
                "calories": sum(s["calories"] for s in snacks),
                "protein": sum(s["protein"] for s in snacks),
                "carbs": sum(s["carbs"] for s in snacks),
                "fat": sum(s["fat"] for s in snacks),
                "cookTime": "",
                "tags": [],
                "ingredients": [],
                "instructions": "",
            }

        # Calculate day totals
        day_calories = sum(m["calories"] for m in day_meals)
        day_protein = sum(m["protein"] for m in day_meals)
        day_carbs = sum(m["carbs"] for m in day_meals)
        day_fat = sum(m["fat"] for m in day_meals)

        day_plan = {
            "name": day_name,
            "calories": round(day_calories, 2),
            "macros": {
                "protein": round(day_protein, 2),
                "carbs": round(day_carbs, 2),
                "fat": round(day_fat, 2),
            },
            "meals": {
                "Breakfast": breakfast,
                "Lunch": lunch,
                "Dinner": dinner,
                "Snacks": snacks_meal,
            }
        }

        days.append(day_plan)

    return {
        "calorieTarget": float(macro_targets.get("calories", 0)),
        "macroTargets": {
            "protein": float(macro_targets.get("protein", 0)),
            "carbs": float(macro_targets.get("carbs", 0)),
            "fat": float(macro_targets.get("fat", 0)),
        },
        "days": days,
    }


def _format_instructions(instructions: Any) -> str:
    """Format instructions as a string."""
    if instructions is None:
        return ""
    if isinstance(instructions, str):
        return instructions
    if isinstance(instructions, list):
        return " ".join(str(step).strip() for step in instructions if str(step).strip())
    return str(instructions)


def generate_personalized_plan(
    db: Session,
    user_id: UUID,
    preference: Preference,
    timeout_seconds: int = 10,
) -> Dict[str, Any]:
    """
    Generate a personalized weekly meal plan using constraint optimization.

    Args:
        db: Database session
        user_id: User ID
        preference: User preferences
        timeout_seconds: Solver timeout in seconds

    Returns:
        Dict with keys:
        - plan: The meal plan structure (same format as OpenAI planner)
        - error: Error message if generation failed
        - fallback_reason: Why solver couldn't complete (for logging)
        - quality_metrics: Dict with liked_ratio, macro_deviation for monitoring
    """
    try:
        # Step 1: Load user ratings
        liked_ids, disliked_ids = _get_user_ratings(db, user_id)
        logger.info(f"User {user_id}: {len(liked_ids)} liked, {len(disliked_ids)} disliked")

        # Step 2: Get last week's recipes to avoid repeats
        last_week_ids = _get_last_week_recipes(db, user_id)
        logger.info(f"User {user_id}: {len(last_week_ids)} recipes from last week")

        # Step 3: Generate macro targets
        macro_response = generate_daily_macro_goal(preference)
        if macro_response.get("error"):
            return {
                "plan": None,
                "error": macro_response["error"],
                "fallback_reason": "macro_generation_failed",
                "quality_metrics": None,
            }

        macro_goal = macro_response.get("goal")
        macro_targets = {
            "calories": float(macro_goal.get("calorieTarget", 2000)),
            "protein": float(macro_goal.get("macroTargets", {}).get("protein", 150)),
            "carbs": float(macro_goal.get("macroTargets", {}).get("carbs", 200)),
            "fat": float(macro_goal.get("macroTargets", {}).get("fat", 65)),
        }

        meals_per_day = preference.meals_per_day or 3

        # Step 4: Filter recipes
        df = _filter_recipes_for_solver(db, preference, disliked_ids, last_week_ids)

        # Step 5: Check for impossible constraints
        impossible_error = _check_impossible_constraints(df, macro_targets, meals_per_day)
        if impossible_error:
            return {
                "plan": None,
                "error": impossible_error,
                "fallback_reason": None,  # Not a fallback - truly impossible
                "quality_metrics": None,
            }

        # Step 6: Build and solve optimization model
        logger.info(f"Building solver model with {len(df)} recipes")
        prob, recipe_vars, meal_slots = _build_solver_model(
            df, liked_ids, macro_targets, meals_per_day, timeout_seconds
        )

        # Solve with timeout
        logger.info("Solving optimization problem")
        prob.solve(timeLimit=timeout_seconds)

        status = LpStatus[prob.status]
        logger.info(f"Solver status: {status}")

        if status not in ["Optimal", "Not Solved"]:
            return {
                "plan": None,
                "error": None,
                "fallback_reason": "constraints_infeasible",
                "quality_metrics": None,
            }

        # Check if we got a solution (even if not optimal, if time limit hit)
        if not any(var.varValue == 1 for var in recipe_vars.values()):
            return {
                "plan": None,
                "error": None,
                "fallback_reason": "timeout",
                "quality_metrics": None,
            }

        # Step 7: Extract solution
        solution = _extract_solution(prob, df, recipe_vars, meal_slots)

        # Step 8: Calculate quality metrics
        metrics = _calculate_quality_metrics(solution, liked_ids, macro_targets)
        logger.info(f"Quality metrics: {metrics}")

        # Step 9: Quality threshold check
        if (metrics["liked_ratio"] < QUALITY_THRESHOLD_LIKED_RATIO or
            metrics["macro_deviation"] > QUALITY_THRESHOLD_MACRO_DEVIATION):
            logger.warning(
                f"Solution below quality threshold: "
                f"liked={metrics['liked_ratio']:.2f}, "
                f"macro_dev={metrics['macro_deviation']:.2f}"
            )
            return {
                "plan": None,
                "error": None,
                "fallback_reason": "quality_threshold",
                "quality_metrics": metrics,
            }

        # Step 10: Format output
        plan = _format_plan_output(solution, macro_targets)

        return {
            "plan": plan,
            "error": None,
            "fallback_reason": None,
            "quality_metrics": metrics,
        }

    except Exception as e:
        logger.exception(f"Unexpected error in solver: {e}")
        return {
            "plan": None,
            "error": None,
            "fallback_reason": f"unexpected_error: {str(e)}",
            "quality_metrics": None,
        }
