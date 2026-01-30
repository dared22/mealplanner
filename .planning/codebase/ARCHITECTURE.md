# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Client-Server with Async Task Processing

**Key Characteristics:**
- Separated frontend (React SPA) and backend (FastAPI REST API)
- Asynchronous background task processing for long-running operations (meal plan generation, translation)
- Stateless API design with Clerk JWT authentication
- JSONB storage for flexible plan and translation data in PostgreSQL

## Layers

**Frontend (React + Vite):**
- Purpose: User interface, form handling, plan display, language switching
- Location: `Frontend/src/`
- Contains: React components (Pages, questionnaire steps, UI), routing, language context, API client logic
- Depends on: Clerk for auth, FastAPI backend via REST API
- Used by: Browser clients (authenticated Clerk users)

**Backend API Layer (FastAPI):**
- Purpose: Request handling, route definitions, authentication middleware, response serialization
- Location: `Backend/fastapi_app/main.py`
- Contains: Route handlers, dependency injection (auth, DB session), CORS middleware, response building
- Depends on: Models, Database, Clerk Auth, Business Logic (planner, translator)
- Used by: Frontend, external API calls

**Authentication Layer:**
- Purpose: Clerk JWT verification, user session management, auto-user creation
- Location: `Backend/fastapi_app/clerk_auth.py`
- Contains: JWT extraction, verification, user payload extraction
- Depends on: PyJWT, Clerk JWKS endpoint
- Used by: Main API routes via dependency injection

**Data Access Layer (SQLAlchemy ORM):**
- Purpose: Database abstraction, model definitions, session management
- Location: `Backend/fastapi_app/models.py` (models), `Backend/fastapi_app/database.py` (session management)
- Contains: User, Preference, Recipe ORM models; session factory; connection pooling logic
- Depends on: SQLAlchemy, PostgreSQL
- Used by: All routes that need DB operations

**Business Logic Layer:**
- **Planner:** `Backend/fastapi_app/planner.py` - OpenAI meal plan generation
- **Translator:** `Backend/fastapi_app/recipe_translator.py` - Google Translate for plans and recipes
- Location: `Backend/fastapi_app/`
- Contains: Meal plan generation from preferences, recipe matching, translation logic
- Depends on: OpenAI API, Google Translate API, Recipe data
- Used by: Background tasks triggered from API routes

**Data Storage Layer:**
- Purpose: Recipe data and user-generated content persistence
- Location: `Backend/fastapi_app/recipes.parquet` (static recipe dataset), PostgreSQL database
- Contains: Users, Preferences, Recipes tables

**Frontend State Layer:**
- Purpose: Form state, progress persistence, language context
- Location: `Frontend/src/Pages/MealPlanner.jsx`, `Frontend/src/i18n/LanguageContext.jsx`, `Frontend/src/Entities/`
- Contains: React hooks for questionnaire progress, localStorage persistence, language provider
- Depends on: React hooks, localStorage API
- Used by: All pages and components

## Data Flow

**Meal Plan Generation Flow:**

1. User fills out 7-step questionnaire on frontend (PersonalInfoStep → ResultsStep)
2. Frontend collects preferences: age, weight, height, activity level, nutrition goal, dietary restrictions, cuisines, budget, cooking time
3. Frontend calls `POST /preferences` with collected data + auth token from Clerk
4. Backend validates auth via Clerk JWT verification in `optional_current_user` dependency
5. Backend creates `Preference` record with raw_data JSONB field containing full request payload
6. Backend enqueues background task `_generate_plan_in_background(pref_id)` and returns immediately with status: "pending"
7. Background task calls `generate_daily_plan_for_preference()` which:
   - Queries OpenAI for macro targets based on user profile
   - Loads recipes from database
   - Matches recipes to generate 7-day meal plan with macros
   - Returns structured plan JSON
8. Plan result is JSON-serialized and stored in `Preference.raw_data["generated_plan"]`
9. Frontend polls `GET /preferences/{id}` until plan_status = "success"
10. Frontend displays meal plan with recipe details

**Translation Flow:**

1. Frontend receives plan in base language (inferred from preferences or defaulted to Norwegian)
2. If user requests different language, frontend queries `GET /preferences/{id}?lang={target_lang}`
3. Backend checks if plan exists in target language in `Preference.raw_data["generated_plan_translations"][lang]`
4. If translation missing, backend enqueues `_translate_plan_in_background(pref_id, lang)` and returns translation_status: "pending"
5. Background task calls `PlanTranslator.translate_plan()` which uses Google Translate API
6. Translation stored in `Preference.raw_data["generated_plan_translations"][lang]`
7. Frontend polls until translation_status = "success"

**User Session Flow:**

1. Frontend authenticates via Clerk UI, obtains JWT session token
2. Frontend includes token in `Authorization: Bearer <token>` header
3. Backend extracts token via `get_session_token(request)` (from header or `__session` cookie)
4. Token verified with Clerk JWKS, JWT claims extracted
5. If user exists by `clerk_user_id`, retrieved; otherwise new User created with auto-generated username
6. User object passed to handlers via `current_user_dependency`

**State Management:**

- Frontend form state: Stored in React component state (useState) in MealPlanner.jsx
- Progress persistence: Saved to localStorage with version check, keys like `mealplanner_pref_{user_id}`
- Language preference: Stored in localStorage as `mealplanner_lang` (en/no)
- Backend preference data: Stored in PostgreSQL with JSONB raw_data for flexibility
- Plan status tracked via JSONB fields: `plan_status` (pending/success/error), `translation_status`, error messages in `generated_plan.error`

## Key Abstractions

**PreferenceDTO:**
- Purpose: Normalize preference data from multiple sources (Preference model, raw_data dict, frontend payload)
- Location: `Backend/fastapi_app/planner.py` lines 55-68
- Pattern: Data class for type-safe preference handling
- Used by: `_normalize_preference()` in planner for flexible data extraction

**Preference Model (JSONB):**
- Purpose: Flexible storage of user preferences and generated data
- Location: `Backend/fastapi_app/models.py` lines 12-40
- Pattern: Structured fields for common queries + JSONB `raw_data` for extensibility
- Stores: User preferences, generated plans, translations, error states

**Recipe Model:**
- Purpose: Represent recipes from static dataset
- Location: `Backend/fastapi_app/models.py` lines 63-80
- Pattern: ORM mapping to recipes.parquet data
- Contains: Nutrition data, ingredients, instructions, meal type flags

**User Model with Auto-Creation:**
- Purpose: Clerk integration with local user records
- Location: `Backend/fastapi_app/models.py` lines 43-60
- Pattern: Lazy user creation on first login, username auto-generation with collision avoidance
- Logic: `optional_current_user()` in main.py handles creation/linking

**TranslationResult:**
- Purpose: Consistent error handling for translation operations
- Location: `Backend/fastapi_app/recipe_translator.py` lines 16-19
- Pattern: Data class with result + optional error field

## Entry Points

**Frontend Entry Point:**
- Location: `Frontend/src/main.jsx`
- Triggers: Browser page load
- Responsibilities: Import React, ReactDOM, render App component to #root element

**Frontend App Component:**
- Location: `Frontend/src/App.jsx`
- Triggers: Mounted by main.jsx
- Responsibilities: Clerk authentication wrapper, Router setup, LanguageProvider wrapping, conditional routing (SignedIn/SignedOut)

**Frontend Primary Route:**
- Location: `Frontend/src/Pages/MealPlanner.jsx`
- Triggers: Navigation to `/planner` by authenticated users
- Responsibilities: Orchestrate multi-step questionnaire, manage form state, call API, display results

**Backend Entry Point:**
- Location: `Backend/fastapi_app/main.py` line 95
- Triggers: `uvicorn main:app` server startup
- Responsibilities: FastAPI app initialization, middleware setup (CORS), startup schema creation

**Backend Health Check:**
- Location: `Backend/fastapi_app/main.py` lines 361-363
- Triggers: `GET /health` request
- Responsibilities: Simple status check, no auth required

**Backend Preference Routes:**
- `POST /preferences` (main.py lines 372-419): Accept user preferences, create record, enqueue generation task
- `GET /preferences/{id}` (main.py lines 422-519): Retrieve preference + plan, enqueue translation if needed
- `GET /auth/session` (main.py lines 522-529): Verify current authenticated user

## Error Handling

**Strategy:** Async error isolation with status tracking

**Patterns:**

**In Background Tasks** (`_generate_plan_in_background`, `_translate_plan_in_background`):
- Exceptions caught at top level with logging
- Error state stored in JSONB: `preference.raw_data["generated_plan"]["error"]` or `generated_plan_translations_error[lang]`
- DB rollback on failure to maintain consistency
- Session closed in finally block
- Frontend polling detects error status and displays message

**In Synchronous Routes:**
- Dependency injection failures raise HTTPException (401/403/404)
- Invalid request data raises HTTPException(400)
- Database failures propagate as 500 (unhandled)
- Response serialization via `_json_safe()` handles numpy types and unconvertible values

**In Frontend:**
- API call failures caught in try/catch, error displayed in ResultsStep
- Validation errors shown per-field in questionnaire steps
- Polling loop handles network timeouts with retry logic

## Cross-Cutting Concerns

**Logging:**
- Backend: Python logging module configured per file (`logger = logging.getLogger(__name__)`)
- Frontend: Console logging only (no structured logging configured)
- Key events logged: Background task start/completion, API failures, preference retrieval

**Validation:**

- **Frontend:** Client-side validation in questionnaire steps (PersonalInfoStep.jsx lines 5-46)
  - Age: 10-100 range
  - Height: 140-210cm range
  - Weight: 30-400kg range
  - BMI sanity check
  - Gender required

- **Backend:** Server-side preference creation accepts all values, normalization in planner
  - Preference fields mapped from payload (models.py lines 22-32)
  - PreferenceDTO normalization handles None/missing values (planner.py)

**Authentication:**
- Clerk JWT verified on protected routes via `current_user_dependency` (main.py lines 87-92)
- `/health` endpoint public, `/preferences` endpoints auth-required
- JWT extraction from Bearer header or `__session` cookie (clerk_auth.py lines 26-32)
- JWKS endpoint caching for performance

**Language Handling:**
- Frontend: LanguageContext provider (i18n/LanguageContext.jsx) stores language in localStorage
- Backend: Language normalized to "en" or "no" (main.py lines 105-113)
- Plans generated in base language, translated on demand
- Translation API uses googletrans library (recipe_translator.py)

---

*Architecture analysis: 2026-01-26*
