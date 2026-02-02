---
phase: 07
plan: 01
subsystem: constraint-solver
tags: [pulp, optimization, personalization, meal-planning]

dependency-graph:
  requires: [06-01, 06-02]
  provides: ["constraint-based meal plan generation", "personalized plan optimization"]
  affects: [07-02, 07-03]

tech-stack:
  added: ["PuLP 3.3.0"]
  patterns: ["linear programming", "constraint satisfaction", "binary optimization"]

file-inventory:
  created:
    - path: Backend/fastapi_app/solver.py
      lines: 732
      exports: [generate_personalized_plan]
  modified:
    - path: Backend/fastapi_app/requirements.txt
      change: added PuLP dependency

decisions:
  - id: SOLVER-LIB
    what: Use PuLP for constraint optimization
    why: Simpler API than OR-Tools, sufficient for meal selection problem
    impact: Lighter dependency, easier to maintain
  - id: SOLVER-SCORING
    what: Binary scoring (liked=10, neutral=1)
    why: Simple preference model per phase context
    impact: All liked recipes weighted equally in optimization
  - id: SOLVER-VARIETY
    what: Allow max 1 repeat per week if insufficient unique recipes
    why: Balance variety with feasibility when recipe pool is small
    impact: Most plans will have 21 unique meals, some may have 1 repeat
  - id: SOLVER-HISTORY
    what: Exclude last week's recipes only (1-week lookback)
    why: Balance freshness with implementation simplicity
    impact: Users won't see same recipes two weeks in a row

metrics:
  duration: "3m 48s"
  completed: "2026-02-02"

links:
  - relates-to: 06-01-SUMMARY.md
    nature: uses Rating model and PlanRecipe tracking
  - relates-to: planner.py
    nature: reuses generate_daily_macro_goal, matches output format
---

# Phase 07 Plan 01: Constraint Solver Foundation Summary

**One-liner:** PuLP-based constraint solver that maximizes liked recipes while meeting macro targets within ±10% tolerance

## What Was Built

Created the core constraint solver module (`solver.py`) that generates personalized weekly meal plans using linear programming optimization. The solver replaces OpenAI generation for users with 10+ ratings.

**Key capabilities:**
- Pre-filters recipes by dietary restrictions (hard constraint)
- Excludes disliked recipes and last week's meals
- Maximizes liked recipe selection (10x weight vs neutral)
- Enforces daily macro targets with ±10% tolerance
- Ensures meal type appropriateness (breakfast/lunch/dinner/snack)
- Enforces variety (max 1 repeat per week)
- Quality thresholds trigger fallback to OpenAI if solution is poor

**Algorithm flow:**
1. Load user ratings (liked/disliked) and last week's recipes from database
2. Generate macro targets using existing OpenAI function
3. Pre-filter recipe pool to 300-500 candidates (dietary, budget, time preferences)
4. Build PuLP optimization model with binary decision variables
5. Solve with 10-second timeout
6. Validate quality metrics (50%+ liked, ±20% macro deviation)
7. Format output matching OpenAI planner structure

## Technical Implementation

**Constraint model:**
- **Decision variables:** Binary x[recipe_id, day, meal_type] for each valid assignment
- **Objective function:** Maximize sum of (recipe_score × selection) where score = 10 for liked, 1 for neutral
- **Hard constraints:**
  - Exactly 1 recipe per meal slot (21 slots for 7 days × 3 meals)
  - Dietary restrictions pre-filtered (vegan, vegetarian, gluten-free, etc.)
  - Meal type matching (breakfast recipes for breakfast slots, etc.)
- **Soft constraints with bounds:**
  - Daily calories: target ± 10%
  - Daily protein: target ± 10%
  - Daily carbs: target ± 10%
  - Daily fat: target ± 10%
  - Recipe uniqueness: ≤1 use (or ≤2 if insufficient unique recipes)

**Helper functions implemented:**
- `_get_user_ratings()` - Query Rating model for liked/disliked sets
- `_get_last_week_recipes()` - Query PlanRecipe for most recent plan
- `_filter_recipes_for_solver()` - Pre-filter recipe pool with dietary/preference filters
- `_check_impossible_constraints()` - Detect mathematically impossible goals
- `_build_solver_model()` - Construct PuLP problem with constraints
- `_extract_solution()` - Parse solver output into meal assignments
- `_calculate_quality_metrics()` - Compute liked_ratio and macro_deviation
- `_format_plan_output()` - Convert to OpenAI planner compatible structure

**Quality thresholds:**
- Liked ratio < 50% → fallback
- Macro deviation > 20% → fallback
- Solver timeout (10s) → fallback
- Infeasible constraints → fallback
- Impossible constraints → error to user (no fallback)

## Key Files

**Backend/fastapi_app/solver.py** (732 lines)
- Main module with `generate_personalized_plan()` entry point
- Returns dict with plan, error, fallback_reason, quality_metrics
- Integrates with existing models (Recipe, Rating, PlanRecipe, Preference)
- Reuses `generate_daily_macro_goal()` from planner.py

**Backend/fastapi_app/requirements.txt**
- Added `pulp>=2.7.0` for linear programming solver

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Binary scoring (liked=10, neutral=1) | Simpler than weighted scoring, matches phase context | All liked recipes treated equally |
| Allow 1 repeat if <21 unique recipes | Ensures solver can find feasible solution | Maintains variety while avoiding infeasibility |
| 1-week recipe history lookback | Balances freshness with complexity | Simpler than multi-week tracking |
| Pre-filter to ~500 recipes max | SOLVER-09 requirement for performance | Keeps solver runtime under 10 seconds |
| Soft budget/time filters | Relax if needed to meet other constraints | Prioritizes macros and preferences over convenience |

## Testing Notes

**Verification completed:**
- ✓ Module imports successfully (structure validation)
- ✓ Python syntax is valid
- ✓ PuLP dependency installs without errors
- ✓ All functions follow documented signatures

**Integration testing deferred to Plan 07-02:**
- End-to-end plan generation with real database
- Fallback behavior validation
- Quality threshold verification
- Performance benchmarking

## Next Phase Readiness

**Ready for Plan 07-02 (Hybrid Generation Integration):**
- Solver module is complete and importable
- Returns same structure as OpenAI planner
- Quality metrics enable decision logic (solver vs fallback)
- Fallback reasons logged for monitoring

**Blockers:** None

**Concerns:**
- Solver performance with large recipe databases (>1000 recipes) needs benchmarking
- Meal type distribution may need tuning based on real data
- Quality thresholds (50% liked, 20% macro deviation) may need adjustment after user testing

## Performance

- **Duration:** 3 minutes 48 seconds
- **Files created:** 1 (solver.py)
- **Files modified:** 1 (requirements.txt)
- **Lines of code:** 732
- **Commits:** 2 (dependency + implementation)

## Links

- **Depends on:** Phase 06-01 (Rating Infrastructure Backend) for Rating/PlanRecipe models
- **Enables:** Phase 07-02 (Hybrid Generation Integration) to route users to solver vs OpenAI
- **Relates to:** planner.py for macro target generation and output format compatibility
