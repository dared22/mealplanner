# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**OpenAI API (Meal Plan Generation):**
- Service: OpenAI GPT-4o-mini for nutritional planning
- What it's used for: Generate daily macro targets and personalized meal plans based on user preferences
- SDK/Client: `openai >= 1.37.0, < 2.0.0`
- Auth: Environment variable `OPENAI_API_KEY`
- Implementation: `Backend/fastapi_app/planner.py`
  - Model: gpt-4o-mini (configurable via `OPENAI_PLAN_MODEL`)
  - System prompt: Nutrition coach role, returns JSON with calorie and macro targets
  - Timeout: 120 seconds (configurable via `OPENAI_REQUEST_TIMEOUT`)
  - Max tokens: 1000 (configurable via `OPENAI_PLAN_MAX_TOKENS`)
  - Used in background task: `_generate_plan_in_background()` in `Backend/fastapi_app/main.py`

**Google Translate API (Meal Plan Translation):**
- Service: Google Translate for translating meal plans
- What it's used for: Translate generated meal plans to Norwegian or other languages
- SDK/Client: `googletrans 4.0.2`
- Auth: None (public API, no key required)
- Implementation: `Backend/fastapi_app/recipe_translator.py`
  - Class: `PlanTranslator` (extends `_GoogleTranslateBase`)
  - Translatable fields: name, ingredients, instructions, tags
  - Runs async in thread pool executor to prevent blocking
  - Used in background task: `_translate_plan_in_background()` in `Backend/fastapi_app/main.py`
  - Status tracking: `generated_plan_translations_status` (pending/success/error)

**Clerk Authentication (Auth Provider):**
- Service: Clerk for user authentication and session management
- What it's used for: User login/signup, JWT session validation, user metadata
- SDK/Client: `@clerk/clerk-react 5.24.1` (frontend), PyJWT 2.8.0 + cryptography (backend)
- Frontend Auth: `Frontend/src/App.jsx`
  - Components: `<SignedIn>`, `<SignedOut>`, `useUser()` hook
  - Session tokens automatically managed by Clerk React SDK
- Backend Auth: `Backend/fastapi_app/clerk_auth.py`
  - JWKS endpoint: Fetched from `CLERK_JWKS_URL` (default: https://api.clerk.com/v1/jwks)
  - Issuer: `CLERK_JWT_ISSUER` (required env var)
  - Audience: `CLERK_AUDIENCE` (optional, validated if set)
  - Authorized parties: `CLERK_AUTHORIZED_PARTIES` (optional, validates `azp` claim)
  - Token extraction: Bearer token from Authorization header or `__session` cookie
  - User creation: Auto-creates user on first login (identity mapping via clerk_user_id)
- Configuration: `Backend/fastapi_app/main.py` lines 325-358 (CORS allowlist includes Heroku frontend domain)

## Data Storage

**PostgreSQL Database:**
- Provider: Neon (managed PostgreSQL on AWS us-east-1)
- Connection: `DATABASE_URL` environment variable
  - Dev: `ep-shy-mountain-ahu3nrdi-pooler.c-3.us-east-1.aws.neon.tech/neondb`
  - Prod: `ep-misty-mountain-ahhlty33-pooler.c-3.us-east-1.aws.neon.tech/neondb`
- Client: SQLAlchemy 2.0.29 with psycopg[binary] 3.1.18
- Connection pooling: NullPool for Neon pooler, QueuePool with pre-ping/recycle for direct connections
- SSL mode: Required (`sslmode=require&channel_binding=require`)
- Tables:
  - `users` - Clerk integration, auto-created users
  - `preferences` - User meal plan requests with JSONB `raw_data` storage
  - `recipes` - Recipe database from Parquet file

**File Storage:**
- Type: Local filesystem only
- Recipe dataset: `recipes.parquet` (2MB, loaded into PostgreSQL recipes table)
- Images: Stored as URLs in recipe.images or recipe.local_images arrays
- No cloud storage integration (S3, GCS, etc.)

**Caching:**
- None detected
- Frontend cache control: `cache: 'no-store'` on preference fetches
- Polling pattern: Frontend polls `/preferences/{id}` to check plan generation status

## Authentication & Identity

**Auth Provider:**
- Clerk (https://clerk.com/)

**Implementation Approach:**
1. Frontend: Clerk React SDK handles login/signup UI and session management
2. Token flow:
   - User logs in via Clerk UI
   - Clerk SDK obtains session token (JWT)
   - Token automatically included in requests to backend via Authorization header
   - Backend verifies token signature using Clerk JWKS
   - Backend extracts user info (clerk_user_id, email) from JWT payload
3. User lifecycle: `Backend/fastapi_app/main.py` lines 36-84 (`optional_current_user()`)
   - First login: Auto-create user in database with clerk_user_id, email, generated username
   - Subsequent logins: Fetch existing user or link to existing email-based user
   - Username generation: Prefers Clerk username, falls back to email prefix, then generates unique suffix
4. Email extraction: Handles multiple Clerk payload formats (email, email_address, email_addresses array)
5. Protected endpoints: All endpoints except `/health` require valid Clerk token

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, etc.)

**Logs:**
- Python logging module: `Backend/fastapi_app/main.py`, `planner.py`, `recipe_translator.py`
- Log levels: INFO (plan generation, translations), WARNING (missing config), EXCEPTION (errors)
- Frontend: Browser console logs only (no client-side error tracking)
- No centralized logging service configured

## CI/CD & Deployment

**Hosting:**
- Heroku (dyno-based deployment)
- Frontend: https://mealplanner-frontend-cc0005e5d9b0.herokuapp.com
- Backend: https://mealplanner-backend-d6ab87c9c7b5.herokuapp.com

**Containerization:**
- Docker Compose (local development): `docker-compose.yml`
  - Services: backend (FastAPI), frontend (Node dev server)
  - Volume mounts for live reload
- Heroku Dockerfile deployment:
  - Frontend: `Frontend/Dockerfile` - Node 20 multi-stage build, `serve` runner
  - Backend: `Backend/fastapi_app/Dockerfile` - Python 3.11-slim, Uvicorn runner

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, Jenkins config)
- Manual deployment via git push or Docker push to Heroku

**Build Environment:**
- Frontend: `npm ci && npm run build` (creates optimized dist/)
- Backend: `pip install -r requirements.txt`
- Env vars passed at build time (frontend) and runtime (backend)

## Environment Configuration

**Required Environment Variables:**

*Frontend:*
```
VITE_API_URL=http://localhost:8000  # or backend Heroku URL
VITE_CLERK_PUBLISHABLE_KEY=pk_test_*
```

*Backend:*
```
DATABASE_URL=postgresql://...  # Neon connection string
OPENAI_API_KEY=sk-proj-*
CLERK_JWKS_URL=https://valued-lemur-53.clerk.accounts.dev/.well-known/jwks.json
CLERK_JWT_ISSUER=https://valued-lemur-53.clerk.accounts.dev
```

**Secrets Location:**
- `.env` files (local development) - **NOT committed to git**
- Environment variables on Heroku config vars
- GitHub Actions secrets (if CI/CD added in future)

**Sensitive Values in .env (example):**
```
OPENAI_API_KEY - OpenAI API secret key
DATABASE_URL - Database credentials embedded in URL
VITE_CLERK_PUBLISHABLE_KEY - Clerk public key (non-secret, safe in frontend)
CLERK_JWKS_URL, CLERK_JWT_ISSUER - Clerk public endpoints (non-secret)
```

## Webhooks & Callbacks

**Incoming:**
- None detected
- No webhook endpoints for Clerk events, OpenAI callbacks, etc.

**Outgoing:**
- None detected
- Google Translate called synchronously (async inside thread pool)
- OpenAI called synchronously in background task

**Background Tasks:**
- Framework: FastAPI BackgroundTasks
- Tasks in `Backend/fastapi_app/main.py`:
  1. `_generate_plan_in_background(pref_id)` - Calls OpenAI, stores result in `raw_data`
  2. `_translate_plan_in_background(pref_id, lang)` - Calls Google Translate, updates `raw_data` translations
- State tracking: Status fields in `Preference.raw_data` (plan_status, translation_status)
- Polling: Frontend polls `/preferences/{id}?lang={lang}` to check task completion

## CORS Configuration

**Allowed Origins:**
- Default: localhost:5173, localhost:4173 (Vite), Heroku frontend domain
- Configurable via env vars:
  - `CORS_ALLOWED_ORIGINS` - Comma-separated list
  - `CORS_ALLOWED_ORIGIN_REGEX` - Regex pattern for dynamic matching
  - `FRONTEND_URL` - Single URL to add to allowlist
- Implementation: `Backend/fastapi_app/main.py` lines 325-358

---

*Integration audit: 2026-01-26*
