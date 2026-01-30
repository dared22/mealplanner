# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Duplicate JSON serialization in main.py:**
- Issue: Lines 202-203 in `main.py` call `_json_safe(plan_result)` twice on the same data unnecessarily
- Files: `Backend/fastapi_app/main.py`
- Impact: Redundant processing reduces performance during plan persistence; no functional impact
- Fix approach: Remove the duplicate line and keep only one serialization call

**Silent exception swallowing in background tasks:**
- Issue: Multiple background task handlers (`_generate_plan_in_background`, `_translate_plan_in_background`) catch broad `Exception` with only logging, then silently continue
- Files: `Backend/fastapi_app/main.py` (lines 293-297, 319-323)
- Impact: Translation or generation failures are only logged; frontend has no guaranteed way to detect persistent failures beyond timeout
- Fix approach: Implement explicit failure state tracking in `raw_data` JSONB field with max_retries logic

**Uncontrolled polling with hard timeouts:**
- Issue: Frontend polls for plan generation for max 120 seconds (60 attempts × 2s), then gives "timed out" error regardless of actual backend status
- Files: `Frontend/src/Pages/MealPlanner.jsx` (lines 345-393)
- Impact: Plans generating in >120s are marked failed even if succeeding in background; user loses generated data
- Fix approach: Implement server-sent events or WebSockets for real-time plan status instead of polling

**Username generation infinite loop guard insufficient:**
- Issue: Username generation stops at suffix > 50, but if all candidates fail, falls back to random UUID which changes on every attempt
- Files: `Backend/fastapi_app/main.py` (lines 140-155)
- Impact: User could get different usernames on multiple login attempts if collision avoidance fails
- Fix approach: Generate username once on creation and enforce uniqueness at DB level only

## Known Bugs

**Recipe filtering doesn't handle missing nutrition data gracefully:**
- Symptoms: When recipes lack `calories_kcal` and other nutrition fields, scoring fails or returns 0 values
- Files: `Backend/fastapi_app/planner.py` (lines 319-356)
- Trigger: Import recipes without full nutrition info; planner still selects them with zero nutrition targets
- Workaround: Ensure all recipes in `recipes.parquet` have complete nutrition objects

**Language normalization edge case in translation:**
- Symptoms: Non-English plans with unspecified language default to Norwegian; requesting English translation of Norwegian plan requests retranslation
- Files: `Backend/fastapi_app/main.py` (lines 449-460), `Frontend/src/Pages/MealPlanner.jsx` (lines 355-395)
- Trigger: Submit preferences without language field, then switch frontend language to English
- Workaround: Always include `language` field in preference submission

**CORS allows all methods/headers with regex patterns:**
- Symptoms: If `CORS_ALLOWED_ORIGIN_REGEX` is set, it bypasses specific origin list entirely
- Files: `Backend/fastapi_app/main.py` (lines 344-358)
- Trigger: Configure both regex and origin list; regex takes precedence
- Workaround: Use either regex OR specific origins, never both

**Meal type detection fragile with tag matching:**
- Symptoms: Recipes without proper tags or meal type flags may be misclassified for meals
- Files: `Backend/fastapi_app/planner.py` (lines 498-514, 523-547)
- Trigger: Recipes with non-standard tags or missing `is_breakfast`/`is_lunch` flags
- Workaround: Ensure recipe dataset has consistent meal type classification

## Security Considerations

**Clerk JWT validation missing issuer enforcement by default:**
- Risk: If `CLERK_JWT_ISSUER` env var is missing, issuer validation is disabled, allowing tokens from other issuers
- Files: `Backend/fastapi_app/clerk_auth.py` (lines 22-23, 46)
- Current mitigation: Warning logged if issuer is missing; validation still happens for signature
- Recommendations: Make `CLERK_JWT_ISSUER` required environment variable, fail fast on startup if missing

**Authorization party validation can be bypassed:**
- Risk: `CLERK_AUTHORIZED_PARTIES` accepts comma-separated list but empty list silently skips validation
- Files: `Backend/fastapi_app/clerk_auth.py` (lines 14-18, 55-61)
- Current mitigation: If list is empty, azp check is skipped (by design)
- Recommendations: Document that omitting this env var disables azp validation; consider strict validation mode

**User isolation not enforced at database level:**
- Risk: Preferences table has `user_id` FK but no unique constraint; user could have multiple preferences
- Files: `Backend/fastapi_app/models.py` (lines 12-40)
- Current mitigation: Backend checks `current_user.id` before returning preferences (lines 538-539 in main.py)
- Recommendations: Add database-level checks or add unique constraints if single-preference-per-user is intended

**Password field in User model is unused but persists:**
- Risk: `password_hash` field exists but is never set; leftover from older auth scheme
- Files: `Backend/fastapi_app/models.py` (line 54)
- Current mitigation: Clerk provides auth; password field ignored
- Recommendations: Remove `password_hash` field to eliminate confusion and reduce schema surface area

**Recipe data exposed without pagination limits:**
- Risk: `/recipes` endpoint defaults to limit 50 but max is 100; no rate limiting on endpoint
- Files: `Backend/fastapi_app/main.py` (lines 556-590)
- Current mitigation: Pagination enforced in query; endpoint is unauthenticated
- Recommendations: Add rate limiting; consider requiring auth for recipe access if sensitive

**Database connection pool exhaustion on Heroku:**
- Risk: Neon pooler + psycopg combination can drop idle connections; NullPool is used but may cause connection storms under high load
- Files: `Backend/fastapi_app/database.py` (lines 24-42)
- Current mitigation: Pool recycling (300s) and pre-ping enabled for non-pooler configs
- Recommendations: Monitor connection pool metrics; consider connection limits if load increases

## Performance Bottlenecks

**DataFrame-based recipe matching is O(n*m) for macro scoring:**
- Problem: Every meal slot computes score for all recipes; 7 days × ~4 meals = 28 iterations over full recipe DataFrame
- Files: `Backend/fastapi_app/planner.py` (lines 517-568)
- Cause: No spatial indexing or pre-filtering by calorie range before scoring
- Improvement path: Pre-filter recipes by calorie range (±20%) before scoring; cache sorted recipe subsets by meal type

**Translation happens synchronously in background task:**
- Problem: Google Translate requests block background task thread; multiple translations queue sequentially
- Files: `Backend/fastapi_app/main.py` (lines 246-297), `Backend/fastapi_app/recipe_translator.py` (lines 37-70)
- Cause: AsyncIO loop is spawned in thread but single-threaded executor with thread pool
- Improvement path: Implement request batching for translations; use asyncio-based HTTP client (httpx) instead of asyncio wrapper around sync library

**Frontend polling causes unnecessary API calls:**
- Problem: Frontend polls `/preferences/{id}` every 2 seconds for up to 120 seconds; generates 30-60 unnecessary DB queries
- Files: `Frontend/src/Pages/MealPlanner.jsx` (lines 345-403)
- Cause: No event-driven notification system; client-side polling is only available mechanism
- Improvement path: Implement Server-Sent Events (SSE) or WebSocket for real-time updates; reduce polling interval detection

**Local storage writes on every form change:**
- Problem: Frontend persists entire form state + plan on each keystroke
- Files: `Frontend/src/Pages/MealPlanner.jsx` (lines 395-398)
- Cause: useEffect dependency array includes all form data; triggers on every `updateFormData` call
- Improvement path: Debounce localStorage writes; use JSON diff to skip redundant persists

**Recipe parquet file is read into memory on every plan generation:**
- Problem: 2MB `recipes.parquet` is loaded fully into DataFrame for each preference
- Files: `Backend/fastapi_app/planner.py` (lines 262-292)
- Cause: No caching of recipe DataFrame between requests
- Improvement path: Load recipes once on app startup and cache in memory; invalidate on schedule or explicit trigger

## Fragile Areas

**Meal slot assignment logic (breakfast/lunch/dinner/snack classification):**
- Files: `Backend/fastapi_app/planner.py` (lines 381-391, 498-547)
- Why fragile: Classification depends on keyword matching in tags and brittle meal type detection; if tags change format, recipes misassign
- Safe modification: Add explicit unit tests for tag matching; add meal type to database schema with enum validation
- Test coverage: No dedicated tests for `_tag_matches` or `_pick_recipe` logic visible

**JSONB field handling for raw_data/generated_plan:**
- Files: `Backend/fastapi_app/main.py` (lines 174-207, 246-297)
- Why fragile: Deep nested dict operations without schema validation; typos in keys silently fail
- Safe modification: Create Pydantic models for plan structure; validate on persistence
- Test coverage: No validation of generated plan structure before storage

**Language normalization across frontend/backend:**
- Files: `Backend/fastapi_app/main.py` (lines 105-113), `Frontend/src/Pages/MealPlanner.jsx` (lines 449-461)
- Why fragile: Language codes normalized differently; "en" vs "en-US" vs "english" treated as equivalent
- Safe modification: Define canonical language code enum; document mapping explicitly
- Test coverage: No visible tests for language code normalization edge cases

**Recipe column discovery via fuzzy matching:**
- Files: `Backend/fastapi_app/planner.py` (lines 215-228)
- Why fragile: `_find_column` uses loose substring matching with normalization; "calories" could match "caloriesPerDay" or misspelled variants
- Safe modification: Use exact column name mapping; fail fast with clear error if expected columns missing
- Test coverage: No unit tests for column discovery visible

## Scaling Limits

**Single-threaded recipe DataFrame operations:**
- Current capacity: Works fine for 2MB recipe dataset (~10k recipes); noticeable lag at ~50k recipes
- Limit: DataFrame operations are synchronous; macro scoring becomes seconds-long for large datasets
- Scaling path: Partition recipe data by meal type; pre-compute nutrition indices; use vectorized scoring with NumPy

**Database pool exhaustion under concurrent preference submissions:**
- Current capacity: DB pool configured to 5 size + 5 overflow (default); sustains ~50 concurrent requests
- Limit: Neon pooler + psycopg drops idle SSL connections after 60s; high concurrency + slow plans cause pool thrash
- Scaling path: Increase pool size; use PgBouncer for connection pooling; implement request queue on backend

**Frontend polling scales poorly with many users:**
- Current capacity: 100 users polling every 2s = 50 req/sec to `/preferences/{id}` endpoint
- Limit: No connection pooling on frontend; each poll is separate HTTP connection
- Scaling path: Implement WebSocket gateway; batch status updates; add caching layer (Redis) for preference status

**Translation queue blocks on single thread:**
- Current capacity: ~1-2 translations per second with Google Translate; queue builds immediately
- Limit: `concurrent.futures.ThreadPoolExecutor` with default workers (5-10) serializes translation tasks
- Scaling path: Use asyncio-native translation library; implement translation job queue (Celery/RQ); batch translate multiple meals

## Dependencies at Risk

**googletrans 4.0.2 - Unmaintained, fragile reverse-engineering:**
- Risk: Library reverse-engineers Google Translate API; breaks frequently when API changes
- Impact: Meal translations fail silently; users see English meals in Norwegian interface
- Migration plan: Replace with official Google Translate API (requires API key); implement fallback to untranslated content

**pandas 2.2.2 - Heavy dependency for lightweight operations:**
- Risk: Adds 100MB+ to Docker image; large transitive dependency tree
- Impact: Slow Docker builds; large container size; overkill for simple recipe filtering/scoring
- Migration plan: Replace DataFrame operations with list comprehensions or Polars library; eliminate pandas if only used for recipe data

**pyarrow 16.1.0 - Implicit pandas dependency:**
- Risk: Pulled in by pandas for parquet reading; version mismatches can cause segfaults
- Impact: Unpredictable crashes during recipe loading
- Migration plan: Use direct Parquet library (pyarrow-only or DuckDB); test parquet loading separately

**PyJWT 2.8.0 - Crypto operations:**
- Risk: Depends on `cryptography` library; security updates require frequent patching
- Impact: CVEs in cryptography could affect token validation
- Migration plan: Keep dependencies current; monitor security advisories; consider using PyJWT >= 2.9 for newer crypto

## Missing Critical Features

**No way to regenerate individual meals:**
- Problem: User can regenerate entire plan, but cannot swap single meal without full regeneration
- Blocks: Improvements to user experience for plan customization
- Fix: Add POST `/preferences/{id}/meals/{day}/{meal_type}` endpoint to regenerate single meal

**No plan caching/favorites system:**
- Problem: Once a plan is closed, generating same preferences generates different plan
- Blocks: User ability to reference previous plans or save favorites
- Fix: Add `saved_plans` table; allow users to tag and retrieve historical preferences

**No grocery list export/sharing:**
- Problem: `/groceries` page exists but routes to placeholder; no export functionality
- Blocks: Core feature indicated in UI but not implemented
- Fix: Implement meal aggregation to shopping list format; add CSV/PDF export

**No macro/nutrition editing:**
- Problem: Generated plans show macros but user cannot adjust targets
- Blocks: Advanced users who want custom macro targets
- Fix: Add POST `/preferences/{id}` to override macro targets; regenerate plan with new constraints

## Test Coverage Gaps

**No tests for meal type classification:**
- What's not tested: `_tag_matches()`, `_pick_recipe()`, meal slot assignment logic
- Files: `Backend/fastapi_app/planner.py` (lines 498-568)
- Risk: Recipe filtering bugs go undetected; meal assignments may be wrong
- Priority: High - directly affects plan quality

**No tests for background task error handling:**
- What's not tested: Retry logic, exception handling in `_generate_plan_in_background`, `_translate_plan_in_background`
- Files: `Backend/fastapi_app/main.py` (lines 246-324)
- Risk: Failed plans/translations leave user with "pending" status forever
- Priority: High - affects user experience directly

**No tests for JWT token validation edge cases:**
- What's not tested: Missing issuer, invalid audience, expired tokens, malformed tokens
- Files: `Backend/fastapi_app/clerk_auth.py`
- Risk: Auth bypasses or crashes in production
- Priority: High - security-critical

**No tests for frontend polling timeout behavior:**
- What's not tested: Timeout after 120s, retry logic, translation polling, language switching during pending
- Files: `Frontend/src/Pages/MealPlanner.jsx` (lines 345-403)
- Risk: Frontend hangs or shows incorrect status on slow plans
- Priority: Medium - edge case but impacts user experience

**No integration tests for preference submission flow:**
- What's not tested: Full flow from form submission → preference creation → plan generation → retrieval
- Files: `Backend/fastapi_app/main.py` (lines 372-419), `Frontend/src/Pages/MealPlanner.jsx` (lines 432-471)
- Risk: End-to-end bugs undetected; auth/API mismatches
- Priority: Medium - critical user path

**No tests for database connection pool edge cases:**
- What's not tested: Connection exhaustion, pool recycling, timeout handling
- Files: `Backend/fastapi_app/database.py`
- Risk: Production crashes under high load
- Priority: Medium - affects reliability at scale

---

*Concerns audit: 2026-01-26*
