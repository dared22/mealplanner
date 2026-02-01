---
phase: 06-rating-infrastructure
plan: 01
subsystem: rating-system
tags: [database, api, ratings, tracking, personalization]

dependency_graph:
  requires:
    - 05-03-PLAN # Activity logging infrastructure for rating events
    - 04-01-PLAN # Recipe model foundation
    - 03-01-PLAN # User model and authentication
  provides:
    - rating-api
    - plan-recipe-tracking
    - personalization-threshold
  affects:
    - 07-01-PLAN # Constraint solver will read ratings
    - 07-02-PLAN # Solver integration uses rating data
    - 08-01-PLAN # Frontend rating UI will consume these endpoints

tech_stack:
  added:
    - sqlalchemy-unique-constraint
    - sqlalchemy-index
  patterns:
    - upsert-pattern # POST /ratings uses check-then-insert-or-update
    - plan-parsing # Extract recipe IDs from nested plan structure
    - threshold-tracking # 10-rating minimum for personalization

key_files:
  created:
    - N/A
  modified:
    - Backend/fastapi_app/models.py
    - Backend/fastapi_app/main.py

decisions:
  - slug: rating-upsert-pattern
    title: Use check-then-update pattern instead of ON CONFLICT
    context: POST /ratings needs to create or update ratings
    decision: Check for existing rating, then update or insert accordingly
    rationale: SQLAlchemy ORM pattern is clearer than raw SQL ON CONFLICT, easier to maintain
    alternatives:
      - raw-sql: Use ON CONFLICT DO UPDATE in raw SQL
      - merge: Use SQLAlchemy merge() operation
    status: implemented

  - slug: personalization-threshold-10
    title: Set personalization threshold at 10 ratings
    context: Need minimum ratings before enabling constraint solver
    decision: Require 10 ratings to unlock personalized recommendations
    rationale: Balances cold-start problem with having enough data for meaningful personalization
    alternatives:
      - threshold-5: Too few ratings for reliable patterns
      - threshold-20: Too high, most users wouldn't reach it
    status: implemented

  - slug: plan-recipe-tracking-automatic
    title: Automatically track recipes when plan is generated
    context: Need to know which recipes appeared in which plans
    decision: Parse plan structure in _persist_plan_result and create PlanRecipe entries
    rationale: Zero user effort, happens transparently during plan generation
    alternatives:
      - manual-tracking: Require frontend to submit recipe tracking data
      - batch-import: Retroactively parse existing plans
    status: implemented

metrics:
  duration: 3 min
  completed: 2026-02-01
---

# Phase 6 Plan 1: Rating Infrastructure Summary

**One-liner:** Recipe rating system with like/dislike tracking, 10-rating personalization threshold, and automatic plan-recipe linkage.

## What Was Built

Built the complete backend infrastructure for recipe ratings and meal plan history tracking:

1. **Database Models:**
   - `Rating` model with unique constraint on (user_id, recipe_id)
   - Tracks is_liked (boolean), created_at, updated_at timestamps
   - `PlanRecipe` model linking preferences to recipes with day_name and meal_type
   - Indexed on preference_id for efficient history queries

2. **Rating API Endpoints:**
   - `POST /ratings`: Create or update recipe rating (upsert pattern)
   - `GET /ratings/me`: Paginated list of user's ratings (ordered by updated_at desc)
   - `GET /ratings/progress`: Returns count vs 10-rating threshold for personalization unlock
   - Validates recipe exists and is_active before accepting rating
   - Activity logging for rating_created and rating_updated events

3. **Plan Tracking:**
   - `_persist_plan_result` now parses plan structure and creates PlanRecipe entries
   - Extracts recipe IDs from `plan.days[].meals` structure
   - Handles invalid UUIDs gracefully (skips, doesn't fail)
   - `GET /plans/history`: Returns user's meal plan history with recipe tracking
   - Each plan includes preference_id, submitted_at, plan_status, and list of recipes

## Key Decisions

### Rating Upsert Pattern

**Decision:** Use check-then-update SQLAlchemy pattern instead of raw SQL ON CONFLICT.

**Why:** SQLAlchemy ORM pattern is clearer and easier to maintain than raw SQL. The performance difference is negligible for this use case (user-initiated action, not batch operation).

**Implementation:**
```python
existing_rating = db.scalar(
    select(Rating).where(
        Rating.user_id == current_user.id,
        Rating.recipe_id == payload.recipe_id
    )
)
if existing_rating:
    # Update
else:
    # Create
```

### Personalization Threshold

**Decision:** Set threshold at 10 ratings to unlock constraint solver.

**Why:** Balances cold-start problem with having enough data. 10 ratings is achievable (1-2 weeks of meal plans) while providing meaningful signal for personalization.

**Progress tracking:** `GET /ratings/progress` returns `is_unlocked: true` when user hits 10 ratings.

### Automatic Plan-Recipe Tracking

**Decision:** Parse plan structure in `_persist_plan_result` and automatically create PlanRecipe entries.

**Why:** Zero effort for users, happens transparently. Enables HIST-01 through HIST-03 requirements (view past plans, see what was included).

**Robustness:** Handles missing/invalid recipe IDs gracefully, logs errors but doesn't fail plan storage.

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

**Manual verification steps:**
1. Start backend: `uvicorn main:app --reload --port 8000`
2. Create rating: `POST /ratings` with valid recipe_id
3. Update rating: `POST /ratings` again with same recipe_id, different is_liked
4. Check progress: `GET /ratings/progress` (should show count increasing)
5. View history: `GET /ratings/me` (should show latest rating first)
6. Generate plan: Trigger plan generation, then check `/plans/history` for PlanRecipe tracking

**Expected behavior:**
- POST /ratings completes in <1 second (PERF-01)
- Concurrent rating submissions handled gracefully via upsert (DATA-04)
- PlanRecipe entries created automatically when plan is persisted

## Next Phase Readiness

**Ready for Phase 6 Plan 2 (User Rating UI):**
- ✅ Backend endpoints available
- ✅ Progress tracking implemented
- ✅ Activity logging in place

**Constraint Solver Requirements:**
- ✅ Rating model with user preferences stored
- ✅ PlanRecipe history available for pattern analysis
- ✅ Threshold logic in place (10 ratings minimum)

**No blockers identified.**

## Files Changed

**Backend/fastapi_app/models.py:**
- Added `Rating` model (78 lines)
- Added `PlanRecipe` model (28 lines)
- Imported `UniqueConstraint`, `Index` from SQLAlchemy

**Backend/fastapi_app/main.py:**
- Added 4 Pydantic models: `RatingCreate`, `RatingResponse`, `RatingProgressResponse`, `RatingListResponse`
- Added 3 rating endpoints: POST /ratings, GET /ratings/me, GET /ratings/progress
- Added GET /plans/history endpoint
- Updated `_persist_plan_result` to track recipes in PlanRecipe table
- Imported `Rating`, `PlanRecipe` models

**Total changes:** 254 lines added across 2 files.

## Commits

- `372942b`: feat(06-01): add Rating and PlanRecipe database models
- `c85d399`: feat(06-01): add rating API endpoints
- `52b5749`: feat(06-01): track recipes in generated plans
