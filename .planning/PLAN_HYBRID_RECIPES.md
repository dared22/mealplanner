# Plan: Hybrid Recipe Database + AI Generation

## Current State

The planner has two completely separate paths:

| Path | Trigger | How it works | Uses DB recipes? |
|------|---------|-------------|-----------------|
| **OpenAI** (default) | All users without 10+ ratings | GPT generates every meal from scratch | No |
| **Solver** | Users with 10+ ratings | PuLP optimizer selects from DB recipes | Yes |

**Problems with this:**
1. New users get zero benefit from the recipe database (hundreds of pre-validated recipes ignored)
2. OpenAI path is slow (7 separate API calls, one per day) and expensive
3. No middle ground - you either get full optimization or full AI generation
4. When solver fails (infeasible constraints, timeout, quality threshold), it falls back to pure AI with no DB awareness

---

## Proposed Hybrid Approach

### Core Idea

For every meal slot, **try the recipe database first**, then **fall back to AI only for gaps**.

```
For each day in the week:
  1. Query DB for recipes matching user constraints
  2. Score & rank candidates per meal slot (breakfast/lunch/dinner/snack)
  3. Select best-fit recipes that collectively hit macro targets
  4. If any slot is unfilled or macros are off → ask AI to generate ONLY the missing meals
```

### Architecture

```
generate_daily_plan()
  │
  ├─ Step 1: generate_daily_macro_goal()     [unchanged - OpenAI]
  │
  ├─ Step 2: query_candidate_recipes()        [NEW - DB query]
  │    └─ Filter by: dietary, cuisine, cooking time, allergens
  │
  ├─ Step 3: For each day:
  │    ├─ select_db_recipes_for_day()         [NEW - greedy selection]
  │    │    └─ Pick best recipe per slot from candidates
  │    │    └─ Track remaining macro budget
  │    │
  │    ├─ If all slots filled & macros OK → done for this day
  │    │
  │    └─ If gaps remain:
  │         └─ _generate_meals_with_openai()  [existing - only for missing slots]
  │              └─ Pass remaining macro targets (not full day targets)
  │
  └─ Step 4: Build weekly plan                [unchanged]
```

---

## Detailed Implementation

### 1. New function: `query_candidate_recipes(db, dto) -> Dict[str, List[dict]]`

**Location:** `planner.py` (new function)

Queries the `recipes` table and returns candidates grouped by meal type.

```python
def query_candidate_recipes(
    db: Session,
    dto: PreferenceDTO,
    exclude_names: Optional[Set[str]] = None,
) -> Dict[str, List[dict]]:
    """
    Query DB for recipe candidates matching user preferences.

    Returns dict like:
    {
        "breakfast": [{"id": ..., "title": ..., "calories": ..., ...}, ...],
        "lunch": [...],
        "dinner": [...],
        "snack": [...]
    }
    """
```

**Filters applied (same as solver.py but reusable):**
- `Recipe.is_active == True`
- Dietary restrictions: vegan/vegetarian flags, allergen checks
- Preferred cuisines (if any)
- Cooking time bounds
- Exclude recipes with names in `exclude_names` (for variety across days)

**Key difference from solver:** No user ratings needed. Works for all users.

**Extraction:** For each recipe, pull:
- `id`, `title`, `meal_type`
- Nutrition: `calories`, `protein`, `carbs`, `fat` (from `nutrition` JSONB)
- `ingredients`, `instructions`
- `cuisine`, `tags`, `cost_category`
- `total_time_minutes`

### 2. New function: `select_db_recipes_for_day(candidates, meal_slots, targets, used_names) -> Tuple[List[dict], List[str]]`

**Location:** `planner.py` (new function)

Greedy selection algorithm (no PuLP dependency needed):

```
Input: candidates by meal type, meal slots needed, daily macro targets
Output: (selected_recipes, unfilled_slots)

Algorithm:
  remaining_macros = copy(targets)
  selected = []
  unfilled = []

  For each slot in [breakfast, lunch, dinner, snack]:
    pool = candidates[slot] filtered to exclude used_names
    if pool is empty:
      unfilled.append(slot)
      continue

    # Score each recipe by how well it fits remaining macros
    for recipe in pool:
      score = macro_fit_score(recipe, remaining_macros, len(remaining_slots))

    best = recipe with highest score
    selected.append(best)
    remaining_macros -= best.macros
    used_names.add(best.name)

  return selected, unfilled
```

**Scoring function (`macro_fit_score`):**
```
ideal_per_slot = remaining_macros / remaining_slots_count

score = 0
for macro in [calories, protein, carbs, fat]:
  deviation = abs(recipe[macro] - ideal_per_slot[macro]) / ideal_per_slot[macro]
  score -= deviation  # Lower deviation = higher score

# Bonus for recipes with complete data (ingredients, instructions)
if recipe has ingredients: score += 0.1
if recipe has instructions: score += 0.1
```

This is simpler than the PuLP solver but works well for single-day selection without requiring the full optimization library.

### 3. Modified: `match_recipes_to_macro_goal()` (hybrid logic)

**Location:** `planner.py` line 823 (modify existing function)

Current flow:
```python
def match_recipes_to_macro_goal(pref, macro_goal, used_names, db):
    # ... builds meal_slots, targets
    meal_result = _generate_meals_with_openai(...)  # ALL slots via AI
    return {"meals": selected, ...}
```

New flow:
```python
def match_recipes_to_macro_goal(pref, macro_goal, used_names, db):
    # ... builds meal_slots, targets (unchanged)

    # Phase 1: Try DB recipes
    db_meals = []
    unfilled_slots = meal_slots  # default: all slots unfilled

    if db is not None:
        candidates = query_candidate_recipes(db, dto, exclude_names=used_names)
        db_meals, unfilled_slots = select_db_recipes_for_day(
            candidates, meal_slots, targets, used_names
        )

    # Phase 2: AI fills gaps
    if unfilled_slots:
        already_used = _sum_meal_macros(db_meals)
        remaining = {k: targets[k] - already_used[k] for k in MACRO_KEYS}

        ai_result = _generate_meals_with_openai(
            dto=dto,
            meal_slots=unfilled_slots,  # Only missing slots
            targets=targets,
            remaining_targets=remaining,
            avoid_names=avoid_names + [m["name"] for m in db_meals],
        )
        ai_meals = ai_result.get("meals", [])
    else:
        ai_meals = []

    all_meals = db_meals + ai_meals
    totals = _sum_meal_macros(all_meals)

    return {
        "meals": all_meals,
        "totals": totals,
        "error": None,
        "db_recipe_count": len(db_meals),      # tracking
        "ai_recipe_count": len(ai_meals),       # tracking
    }
```

### 4. Track generation source per meal

Add an `"source"` field to each meal entry:
- `"db"` - came from recipe database (has a real `id`)
- `"ai"` - generated by OpenAI (`id` is null)

This is useful for:
- Analytics (how often DB vs AI is used)
- Frontend could show a "verified recipe" badge for DB recipes
- `PlanRecipe` junction table can track which DB recipes were used

**Change in `_normalize_meal_entry()`:** Add `"source": "ai"`
**Change in new DB recipe formatting:** Add `"source": "db"`

### 5. Modify `_persist_plan_result()` in `main.py`

Add `generation_source` tracking:
- `"hybrid"` - mix of DB + AI recipes
- `"db_only"` - all recipes from DB (rare but possible)
- `"openai"` - all recipes from AI (DB had nothing)

Also persist `PlanRecipe` entries for any DB recipes used (currently only done for solver path).

---

## What Stays the Same

| Component | Change? | Notes |
|-----------|---------|-------|
| `generate_daily_macro_goal()` | No | Still uses OpenAI for macro targets |
| `_generate_meals_with_openai()` | No | Still generates meals, but called less often |
| `_validate_generated_meals()` | No | Still validates AI-generated meals |
| `_build_day_plan()` / `_build_weekly_plan()` | No | Output format unchanged |
| `fill_missing_meals()` | No | Still works as safety net |
| `translate_plan()` | No | Translation unaffected |
| Solver path (`solver.py`) | No | Users with 10+ ratings still use PuLP solver |
| Frontend | No | Plan JSON structure is identical |

---

## Fallback Chain

```
User submits preferences
  │
  ├─ Has 10+ ratings? → Solver (PuLP) → falls back to Hybrid → falls back to Pure AI
  │
  └─ Otherwise → Hybrid (DB + AI) → falls back to Pure AI
```

The hybrid approach becomes the **new default** for all users, replacing pure OpenAI generation. The solver remains for personalized plans (it considers liked/disliked recipes).

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **Faster generation** | DB queries are instant; fewer AI calls needed |
| **Lower cost** | If DB covers 2/3 meals, that's 2/3 fewer OpenAI tokens |
| **Better quality** | DB recipes are pre-validated with real nutrition data |
| **Consistent data** | DB recipes have ingredients, instructions, nutrition - no AI hallucination |
| **Recipe tracking** | Can link plan meals to actual recipes in DB via `PlanRecipe` |
| **Graceful degradation** | Works with 0 DB recipes (pure AI), 10 recipes, or 1000 recipes |

---

## Edge Cases

1. **Empty recipe DB** - All slots unfilled, falls through to pure AI (same as current behavior)
2. **DB has breakfast but not dinner** - DB fills breakfast, AI generates dinner
3. **DB recipes don't meet macro targets** - AI generates compensating meals for remaining slots
4. **Very restrictive diet (vegan + gluten-free)** - Fewer DB candidates, more AI fallback
5. **User wants 5 meals/day** - DB fills what it can (likely breakfast/lunch/dinner), AI fills snack slots
6. **Same recipe selected across days** - `exclude_names` set prevents repetition; AI fills if DB runs out of unique options

---

## Files to Modify

| File | Changes |
|------|---------|
| `Backend/fastapi_app/planner.py` | Add `query_candidate_recipes()`, `select_db_recipes_for_day()`, `macro_fit_score()`. Modify `match_recipes_to_macro_goal()` |
| `Backend/fastapi_app/main.py` | Update `_persist_plan_result()` to handle hybrid source. Update `generation_source` tracking. Update `_generate_plan_in_background()` to always pass `db` session |
| No new files needed | |
| No frontend changes | Plan JSON structure is identical |

---

## Estimated Scope

- ~150 lines new code in `planner.py` (query + selection + scoring)
- ~20 lines modified in `planner.py` (`match_recipes_to_macro_goal`)
- ~10 lines modified in `main.py` (source tracking)
- No new dependencies (uses existing SQLAlchemy, no PuLP needed for greedy selection)
