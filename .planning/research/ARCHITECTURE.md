# Architecture Research: Constraint-Based Recommendation Engine Integration

**Domain:** Meal planning personalization engine
**Researched:** 2026-01-31
**Confidence:** HIGH

## Executive Summary

Integrating a constraint-based recommendation engine with an existing OpenAI-based meal planner requires a **hybrid decision architecture** that switches between generative AI (cold start, <10 ratings) and constraint optimization (warm start, 10+ ratings). The architecture builds on proven patterns from collaborative filtering systems while preserving existing background task infrastructure.

**Key integration points:**
1. New data models (ratings, plan history) live alongside existing `Preference` model
2. Decision logic inserted at the beginning of `_generate_plan_in_background`
3. Constraint solver runs synchronously (sub-10s) or falls back to OpenAI
4. Existing polling mechanism unchanged; frontend agnostic to solver source

**Critical insight:** The existing system already has the infrastructure needed (background tasks, JSONB storage, polling) — we extend, not replace.

---

## Current System Architecture

### Existing Flow (Baseline)

```
User submits preferences
    ↓
POST /preferences → Preference saved to DB
    ↓
BackgroundTask: _generate_plan_in_background(pref_id)
    ↓
OpenAI: generate_daily_macro_goal() → macro targets
    ↓
Database: load recipes from PostgreSQL (Recipe table)
    ↓
Planner: match_recipes_to_macro_goal() → 7-day plan
    ↓
Store plan in Preference.raw_data["generated_plan"]
    ↓
Frontend polls GET /preferences/{id} until plan_status = "success"
```

### Existing Data Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Authentication, profile | id, email, clerk_user_id, is_active |
| `Preference` | Questionnaire submission | age, gender, nutrition_goal, dietary_restrictions, raw_data (JSONB) |
| `Recipe` | Recipe database | id, title, ingredients, nutrition, tags, meal_type, is_active |
| `ActivityLog` | Audit trail | actor_type, action_type, status, metadata |

### Current Component Boundaries

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `main.py` | FastAPI routes, auth, background task orchestration | Backend/fastapi_app/main.py |
| `planner.py` | OpenAI macro generation, recipe matching | Backend/fastapi_app/planner.py |
| `models.py` | SQLAlchemy ORM models | Backend/fastapi_app/models.py |
| `database.py` | Session management | Backend/fastapi_app/database.py |
| `clerk_auth.py` | JWT verification | Backend/fastapi_app/clerk_auth.py |

---

## Recommended Hybrid Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  - Submits preferences                                       │
│  - Polls for plan_status                                     │
│  - Displays plan (agnostic to solver source)                 │
│  - NEW: Rating UI (like/dislike buttons per recipe)          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/JSON
┌────────────────────────┴────────────────────────────────────┐
│                    API Layer (FastAPI)                       │
├─────────────────────────────────────────────────────────────┤
│  POST /preferences  │  GET /preferences/{id}                 │
│  NEW: POST /ratings │  GET /users/{id}/history               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Decision Router (NEW)                           │
│  Counts user ratings → routes to OpenAI or Solver            │
└───────┬──────────────────────────────┬─────────────────────┘
        │                              │
        │ <10 ratings                  │ 10+ ratings
        ↓                              ↓
┌──────────────────┐         ┌──────────────────────────────┐
│  OpenAI Path     │         │  Constraint Solver Path      │
│  (existing)      │         │  (NEW)                       │
├──────────────────┤         ├──────────────────────────────┤
│ - Macro goal AI  │         │ - Load user rating history   │
│ - Recipe match   │         │ - Build constraint model     │
│ - 7-day plan     │         │ - OR-Tools CP-SAT solve      │
│                  │         │ - Timeout/fallback to OpenAI │
└────────┬─────────┘         └────────┬─────────────────────┘
         │                            │
         └────────────┬───────────────┘
                      ↓
         ┌─────────────────────────────┐
         │  Plan Storage (JSONB)       │
         │  Preference.raw_data        │
         └─────────────────────────────┘
                      ↓
         ┌─────────────────────────────┐
         │  Database (PostgreSQL)      │
         │  - preferences              │
         │  - recipes                  │
         │  - NEW: meal_ratings        │
         │  - NEW: meal_plan_history   │
         └─────────────────────────────┘
```

### New Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| `Decision Router` | Count user ratings; route to solver or OpenAI | `planner.py::generate_daily_plan_hybrid()` |
| `Constraint Solver` | Optimize recipe selection based on ratings + nutrition | `solver.py::solve_meal_plan()` |
| `Rating Manager` | CRUD for meal ratings | `main.py::POST /ratings`, `main.py::GET /ratings` |
| `History Tracker` | Record which recipes appear in which plans | `planner.py::_record_plan_history()` |
| `meal_ratings` table | Store user recipe ratings | `models.py::MealRating` |
| `meal_plan_history` table | Track recipe usage over time | `models.py::MealPlanHistory` |

---

## Data Model Design

### New Tables

#### `meal_ratings`

**Purpose:** Track user like/dislike ratings per recipe.

```python
class MealRating(Base):
    __tablename__ = "meal_ratings"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipe_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1 = like, -1 = dislike
    rated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    context: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)  # meal_type, preference_id

    __table_args__ = (
        UniqueConstraint("user_id", "recipe_id", name="unique_user_recipe_rating"),
        CheckConstraint("rating IN (-1, 1)", name="rating_check"),
    )
```

**Rationale:**
- **Binary rating (like/dislike):** Simpler UX than 5-star; proven effective in collaborative filtering ([freeCodeCamp cold start guide](https://www.freecodecamp.org/news/cold-start-problem-in-recommender-systems/))
- **Unique constraint:** One rating per user-recipe pair (updates allowed)
- **Context JSONB:** Store meal_type, preference_id for analysis (e.g., "user dislikes this for breakfast but likes for dinner")

#### `meal_plan_history`

**Purpose:** Record which recipes appeared in which plans for which users.

```python
class MealPlanHistory(Base):
    __tablename__ = "meal_plan_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    preference_id: Mapped[int] = mapped_column(Integer, ForeignKey("preferences.id"), nullable=False)
    recipe_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False)
    day_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0-6 for Mon-Sun
    meal_type: Mapped[str] = mapped_column(String(32), nullable=False)  # breakfast, lunch, dinner, snack
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    solver_method: Mapped[str] = mapped_column(String(32), nullable=False)  # "openai" or "constraint_solver"

    __table_args__ = (
        Index("ix_meal_plan_history_user_recipe", "user_id", "recipe_id"),
        Index("ix_meal_plan_history_preference", "preference_id"),
    )
```

**Rationale:**
- **Variety tracking:** Solver can avoid recently used recipes
- **Analytics:** Track solver performance (OpenAI vs constraint solver acceptance rates)
- **Indices:** Fast lookup for "recipes this user has seen recently"

### Modified Tables

**No changes to existing tables.** The `Preference.raw_data` JSONB already supports storing plan metadata. We add:

```json
{
  "generated_plan": { /* existing */ },
  "solver_metadata": {  // NEW
    "method": "constraint_solver",
    "ratings_used": 12,
    "solve_time_ms": 1847,
    "objective_score": 0.87,
    "fallback_triggered": false
  }
}
```

---

## Integration Points

### 1. Decision Router

**Location:** `planner.py` (new function)

**Logic:**

```python
def generate_daily_plan_hybrid(
    pref: Preference,
    db: Session,
    translate: bool = False
) -> Dict[str, Any]:
    """
    Route to constraint solver if user has 10+ ratings, else OpenAI.
    """
    user_id = pref.user_id

    # Count user ratings
    rating_count = db.scalar(
        select(func.count(MealRating.id))
        .where(MealRating.user_id == user_id)
    ) or 0

    if rating_count >= 10:
        # Attempt constraint solver
        result = solve_meal_plan_with_fallback(pref, db)
        if result["plan"] is not None:
            result["solver_metadata"] = {
                "method": "constraint_solver",
                "ratings_used": rating_count,
                "fallback_triggered": False,
            }
            return result
        # Solver failed → fallback
        logger.warning(f"Solver failed for pref {pref.id}, falling back to OpenAI")

    # Cold start or solver failed → use OpenAI
    result = generate_daily_plan(pref, translate=translate, db=db)
    result["solver_metadata"] = {
        "method": "openai",
        "ratings_used": rating_count,
        "fallback_triggered": rating_count >= 10,  # True if we tried solver
    }
    return result
```

**Threshold rationale:**
- **10 ratings:** Common industry threshold for collaborative filtering ([IEEE survey on cold start](https://ieeexplore.ieee.org/document/10339320/))
- **Fallback logic:** Ensures no user sees errors; OpenAI always works

### 2. Constraint Solver

**Location:** `solver.py` (new file)

**Architecture:**

```python
from ortools.sat.python import cp_model

def solve_meal_plan_with_fallback(
    pref: Preference,
    db: Session,
    timeout_seconds: int = 10
) -> Dict[str, Any]:
    """
    Build and solve constraint model. Return None plan if timeout/infeasible.
    """
    try:
        model = cp_model.CpModel()
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = timeout_seconds

        # 1. Load user ratings
        ratings = load_user_ratings(pref.user_id, db)

        # 2. Load recipes (filter by is_active=True, budget, dietary restrictions)
        recipes = load_filtered_recipes(pref, db)

        # 3. Build decision variables (binary: recipe X in meal Y on day Z?)
        recipe_vars = build_recipe_selection_vars(model, recipes, num_days=7)

        # 4. Add constraints
        add_nutrition_constraints(model, recipe_vars, recipes, pref)
        add_variety_constraints(model, recipe_vars, recipes)
        add_meal_type_constraints(model, recipe_vars, recipes)

        # 5. Objective: maximize sum of ratings for selected recipes
        add_rating_objective(model, recipe_vars, ratings)

        # 6. Solve
        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return extract_plan_from_solution(solver, recipe_vars, recipes, pref)
        else:
            return {"plan": None, "error": "No feasible solution found"}

    except Exception as exc:
        logger.exception(f"Solver error for pref {pref.id}: {exc}")
        return {"plan": None, "error": str(exc)}
```

**Constraint types:**

1. **Nutrition constraints:** Daily calories/macros within ±20% of target
2. **Variety constraints:** No recipe repeated within same week
3. **Meal type constraints:** Breakfast recipes for breakfast slots, etc.
4. **Budget constraints:** Recipe cost_category matches user budget_range
5. **Dietary constraints:** Filter out allergens/restrictions before solving

**Objective function:**

```
maximize: Σ (rating[recipe_i] * selected[recipe_i])
```

Where `rating[recipe_i]` is:
- +1 for liked recipes
- -1 for disliked recipes
- 0 for unrated recipes (neutral)

**Solver choice:** [Google OR-Tools CP-SAT](https://developers.google.com/optimization/cp) — proven for meal planning ([Z3 meal planning example](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/))

### 3. Rating API

**Location:** `main.py` (new endpoints)

```python
@app.post("/ratings")
def create_or_update_rating(
    payload: RatingCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> Dict[str, Any]:
    """
    Create or update a rating for a recipe.
    """
    # Upsert logic
    existing = db.scalar(
        select(MealRating)
        .where(
            MealRating.user_id == current_user.id,
            MealRating.recipe_id == payload.recipe_id
        )
    )

    if existing:
        existing.rating = payload.rating
        existing.rated_at = datetime.now(timezone.utc)
        existing.context = payload.context
        db.add(existing)
    else:
        rating = MealRating(
            user_id=current_user.id,
            recipe_id=payload.recipe_id,
            rating=payload.rating,
            context=payload.context,
        )
        db.add(rating)

    db.commit()
    return {"status": "created"}

@app.get("/ratings")
def get_user_ratings(
    db: Session = Depends(get_session),
    current_user: User = Depends(current_user_dependency),
) -> List[Dict[str, Any]]:
    """
    Return all ratings for current user.
    """
    ratings = db.scalars(
        select(MealRating)
        .where(MealRating.user_id == current_user.id)
        .order_by(MealRating.rated_at.desc())
    ).all()

    return [
        {
            "id": r.id,
            "recipe_id": r.recipe_id,
            "rating": r.rating,
            "rated_at": r.rated_at,
            "context": r.context,
        }
        for r in ratings
    ]
```

### 4. Plan History Recording

**Location:** `planner.py` (modification to existing function)

After plan generation succeeds, record history:

```python
def _record_plan_history(
    db: Session,
    pref: Preference,
    plan: Dict[str, Any],
    solver_method: str
) -> None:
    """
    Extract recipes from plan and insert into meal_plan_history.
    """
    days = plan.get("days", [])
    for day_index, day in enumerate(days):
        meals = day.get("meals", {})
        for meal_type, meal_data in meals.items():
            if not isinstance(meal_data, dict):
                continue
            recipe_id = meal_data.get("id")
            if recipe_id is None:
                continue

            history_entry = MealPlanHistory(
                user_id=pref.user_id,
                preference_id=pref.id,
                recipe_id=recipe_id,
                day_index=day_index,
                meal_type=meal_type.lower(),
                solver_method=solver_method,
            )
            db.add(history_entry)

    db.commit()
```

**Modification to `_generate_plan_in_background`:**

```python
def _generate_plan_in_background(pref_id: int) -> None:
    db = SessionLocal()
    try:
        preference = db.get(Preference, pref_id)

        # NEW: Use hybrid router
        plan_result = generate_daily_plan_hybrid(preference, db, translate=False)

        _persist_plan_result(db, preference, plan_result)

        # NEW: Record history
        if plan_result.get("plan"):
            solver_method = plan_result.get("solver_metadata", {}).get("method", "unknown")
            _record_plan_history(db, preference, plan_result["plan"], solver_method)

        # Existing: log activity
        log_activity(db, ...)

    finally:
        db.close()
```

---

## Data Flow Patterns

### Cold Start Flow (< 10 ratings)

```
User submits preferences (Preference #1)
    ↓
Decision Router: 0 ratings → OpenAI path
    ↓
OpenAI generates plan
    ↓
Store in Preference.raw_data
    ↓
Record in meal_plan_history (solver_method="openai")
    ↓
User sees plan, rates 3 recipes (like, dislike, like)
    ↓
User submits new preferences (Preference #2)
    ↓
Decision Router: 3 ratings → still OpenAI
    ↓
... repeat until 10+ ratings ...
```

### Warm Start Flow (10+ ratings)

```
User has 12 ratings: 8 likes, 4 dislikes
    ↓
Decision Router: 12 ratings → Constraint Solver
    ↓
Solver loads:
  - User ratings (8 positive, 4 negative weights)
  - Recipe DB (filtered by budget, dietary restrictions)
  - Recent history (avoid recipes used in last 2 weeks)
    ↓
Build CP model:
  - Variables: recipe selection per meal per day
  - Constraints: nutrition, variety, meal_type, budget
  - Objective: maximize sum of ratings
    ↓
OR-Tools solves in ~2-5 seconds
    ↓
Feasible solution found?
  YES → Extract 7-day plan → Store → Record history
  NO → Fallback to OpenAI → Store → Record history (fallback_triggered=true)
    ↓
User sees plan (frontend doesn't know which solver was used)
```

### Rating Feedback Loop

```
User views meal plan
    ↓
Frontend shows "Rate this recipe" buttons (👍 👎) per meal
    ↓
User clicks 👍 on "Chicken Quesadilla"
    ↓
POST /ratings {recipe_id, rating: 1, context: {meal_type: "lunch"}}
    ↓
Backend upserts MealRating table
    ↓
Next plan generation uses updated ratings (13 total now)
    ↓
Solver gives higher weight to similar recipes
```

---

## Architectural Patterns

### Pattern 1: Hybrid Decision Router

**What:** Single entry point that routes to different planners based on data availability.

**When to use:** Recommendation systems with cold start problem.

**Trade-offs:**
- ✅ Pro: Graceful degradation (OpenAI always works)
- ✅ Pro: No user-facing errors if solver fails
- ❌ Con: Two code paths to maintain

**Example:**

```python
def generate_daily_plan_hybrid(pref, db):
    if has_sufficient_data(pref.user_id, db):
        return try_solver_with_fallback(pref, db)
    else:
        return generate_with_openai(pref, db)
```

### Pattern 2: Constraint Solver with Timeout

**What:** Run constraint solver with strict time limit; abort if exceeded.

**When to use:** Optimization problems where "good enough" is better than "perfect or nothing."

**Trade-offs:**
- ✅ Pro: Guarantees response time (<10s)
- ✅ Pro: OR-Tools CP-SAT supports `max_time_in_seconds`
- ❌ Con: May return suboptimal solution (but still valid)

**Example:**

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 10
status = solver.Solve(model)

if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    return extract_plan(solver)
else:
    return None  # Trigger fallback
```

### Pattern 3: Upsert Rating Pattern

**What:** Single endpoint for create/update to avoid duplicate ratings.

**When to use:** User preferences that change over time.

**Trade-offs:**
- ✅ Pro: Simpler frontend (one API call)
- ✅ Pro: Unique constraint enforced at DB level
- ❌ Con: Slightly more complex backend logic

**Example:**

```python
existing = db.scalar(
    select(MealRating).where(
        MealRating.user_id == user_id,
        MealRating.recipe_id == recipe_id
    )
)

if existing:
    existing.rating = new_rating
    existing.rated_at = now()
else:
    db.add(MealRating(...))
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Solver in Request Handler

**What people do:** Call solver directly in `POST /preferences` endpoint.

**Why it's wrong:**
- Solver may take 5-10 seconds
- FastAPI request timeout (30s default)
- Poor UX (user waits)

**Do this instead:** Use existing background task pattern (`BackgroundTasks`). Solver runs async, frontend polls.

### Anti-Pattern 2: Storing Ratings in Preference.raw_data JSONB

**What people do:** Add `{"ratings": {"recipe_id": 1}}` to existing JSONB field.

**Why it's wrong:**
- Can't query efficiently ("find all users who liked recipe X")
- No foreign key integrity
- No unique constraints

**Do this instead:** Dedicated `meal_ratings` table with proper indices.

### Anti-Pattern 3: Hard-Coding Threshold (10 ratings)

**What people do:** `if rating_count >= 10: use_solver()`

**Why it's wrong:**
- Threshold may need tuning based on user behavior
- No visibility into why threshold chosen

**Do this instead:** Environment variable + clear documentation.

```python
MIN_RATINGS_FOR_SOLVER = int(os.getenv("MIN_RATINGS_FOR_SOLVER", "10"))

# In code:
if rating_count >= MIN_RATINGS_FOR_SOLVER:
    # ... with comment explaining threshold
```

### Anti-Pattern 4: Solver Without Fallback

**What people do:** Return error to user if solver fails.

**Why it's wrong:**
- Solver may fail (infeasible constraints, timeout)
- User sees broken experience
- Degrades from working system

**Do this instead:** Always fallback to OpenAI on solver failure.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-1K users** | Current approach works. Single background worker. Solver runs inline. PostgreSQL handles rating lookups. |
| **1K-10K users** | **Bottleneck:** Solver cold start (loading 50K recipes from DB each time). **Fix:** Add Redis cache for filtered recipe DataFrames (keyed by budget + restrictions). Cache warm = solver startup <500ms. |
| **10K-100K users** | **Bottleneck:** Background task queue depth (FastAPI BackgroundTasks is in-memory). **Fix:** Migrate to Celery + Redis for distributed task processing. Solver still runs in <10s per task. Add task priority (paid users first). |
| **100K+ users** | **Bottleneck:** OR-Tools single-threaded solver. **Fix:** Pre-compute common plans (cache 7-day plans for popular preference combinations). Add collaborative filtering layer (recommend plans similar users liked). Consider batch solver runs (generate plans overnight for users with >10 ratings). |

### Immediate Optimization Opportunities

1. **Recipe DataFrame caching:** Load recipes once per hour, cache in memory
2. **Rating count caching:** Denormalize `rating_count` on User table (updated via trigger)
3. **Solver plan caching:** If two users have identical preferences + similar ratings → reuse plan

---

## Build Order & Dependencies

### Phase 1: Data Models (Week 1)
- Create `meal_ratings` table migration
- Create `meal_plan_history` table migration
- Add indices
- **Dependency:** None (pure database work)

### Phase 2: Rating API (Week 1)
- Add `POST /ratings` endpoint
- Add `GET /ratings` endpoint
- Add rating display to frontend (thumbs up/down buttons)
- **Dependency:** Phase 1 (needs tables)

### Phase 3: History Tracking (Week 2)
- Modify `_generate_plan_in_background` to call `_record_plan_history`
- Backfill existing plans into history table (optional)
- **Dependency:** Phase 1 (needs tables)

### Phase 4: Constraint Solver (Week 2-3)
- Create `solver.py` with OR-Tools integration
- Implement `solve_meal_plan_with_fallback()`
- Add unit tests (mock ratings, verify constraints enforced)
- **Dependency:** Phase 1, 3 (needs ratings data)

### Phase 5: Decision Router (Week 3)
- Create `generate_daily_plan_hybrid()` in `planner.py`
- Modify `_generate_plan_in_background` to call hybrid router
- Add solver metadata to `raw_data`
- **Dependency:** Phase 4 (needs solver)

### Phase 6: Frontend Integration (Week 4)
- Add rating UI to meal plan display
- Add "solver used" badge (optional transparency)
- Add rating history page
- **Dependency:** Phase 2 (needs rating API)

### Phase 7: Monitoring & Tuning (Ongoing)
- Log solver success/failure rates
- Track solver performance (time, objective score)
- A/B test: solver vs OpenAI user satisfaction
- **Dependency:** Phase 5 (needs hybrid system live)

---

## Performance Implications

### Solver Performance Budget

Based on [OR-Tools documentation](https://developers.google.com/optimization/cp) and [meal planning constraint solver examples](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/):

| Operation | Time Budget | Notes |
|-----------|-------------|-------|
| Load user ratings | <100ms | Simple SELECT (indexed on user_id) |
| Load filtered recipes | <500ms | ~5K recipes after filters; could cache |
| Build CP model | <1s | Create variables + constraints |
| Solve CP model | <10s | Timeout enforced; returns FEASIBLE or OPTIMAL |
| Extract solution | <100ms | Map solver variables to recipe IDs |
| **Total solver path** | **<12s** | Still within background task tolerance |
| OpenAI fallback | ~30-60s | Existing timeout (PLAN_GENERATION_TIMEOUT=180s) |

**Critical:** Solver must be faster than OpenAI to justify switch. **Target: <10s for 95th percentile.**

### Database Query Optimization

```sql
-- Rating count (decision router)
SELECT COUNT(*) FROM meal_ratings WHERE user_id = ?;
-- Index: meal_ratings(user_id)  ← CRITICAL

-- User ratings (solver)
SELECT recipe_id, rating FROM meal_ratings WHERE user_id = ?;
-- Index: meal_ratings(user_id, recipe_id)  ← ALREADY UNIQUE

-- Recent history (variety)
SELECT DISTINCT recipe_id FROM meal_plan_history
WHERE user_id = ? AND generated_at > NOW() - INTERVAL '14 days';
-- Index: meal_plan_history(user_id, generated_at)  ← ADD
```

**Recommendation:** Add composite index on `meal_plan_history(user_id, generated_at)` to support variety queries.

---

## Sources

### Constraint-Based Meal Planning Architecture
- [JMIR: Personalized Meal Recommendation System](https://formative.jmir.org/2024/1/e52170)
- [PMC: AI-based nutrition recommendation system](https://pmc.ncbi.nlm.nih.gov/articles/PMC12390980/)
- [PMC: Reinforcement Learning for Meal Plans](https://pmc.ncbi.nlm.nih.gov/articles/PMC10857145/)
- [MDPI: Healthy Personalized Recipe Recommendations](https://www.mdpi.com/2073-431X/13/1/1)

### Hybrid Recommendation Systems & Architecture
- [Clarifai: LLMs and AI Trends for 2026](https://www.clarifai.com/blog/llms-and-ai-trends)
- [arXiv: Agentic AI Survey](https://arxiv.org/html/2510.25445v1)
- [OpenAI: Reasoning Best Practices](https://platform.openai.com/docs/guides/reasoning-best-practices)

### Collaborative Filtering & User Ratings
- [PMC: Reinforcement Learning Meal Plans](https://pmc.ncbi.nlm.nih.gov/articles/PMC10857145/)
- [ScienceDirect: Systematic review on food recommender systems](https://www.sciencedirect.com/science/article/pii/S0957417423026684)
- [IEEE: Food Recommendation Based on Collaborative Filtering](https://ieeexplore.ieee.org/document/10205379/)
- [Nature: AI nutrition recommendation using ChatGPT](https://www.nature.com/articles/s41598-024-65438-x)

### Constraint Optimization with OR-Tools
- [Google OR-Tools: Constraint Programming Documentation](https://developers.google.com/optimization/cp)
- [Google OR-Tools: Python Guide](https://developers.google.com/optimization/introduction/python)
- [Tautvidas Sipavičius: Z3 Constraint Solver for Meal Planning](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/)

### Cold Start Problem & Decision Thresholds
- [freeCodeCamp: Cold Start Problem Guide](https://www.freecodecamp.org/news/cold-start-problem-in-recommender-systems/)
- [IEEE: User Cold Start Problem Survey](https://ieeexplore.ieee.org/document/10339320/)
- [MDPI: Addressing Cold-Start with Frequent Patterns](https://www.mdpi.com/1999-4893/16/4/182)

### PostgreSQL Data Modeling
- [Academia: Personalized Meal Planning Application](https://www.academia.edu/127916257/PERSONALIZED_MEAL_PLANNING_APPLICATION_BASED_ON_USER_MEDICAL_DAT)

---

*Architecture research for: Constraint-based recommendation engine integration*
*Researched: 2026-01-31*
*Confidence: HIGH (verified with official OR-Tools docs, recent academic research, and proven meal planning implementations)*
