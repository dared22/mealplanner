# CLAUDE.md

Guidance for Claude Code working in this repo. Keep this file short and true —
if it drifts from the code, fix the file.

## What this is

**Preppr** — a Norwegian-first, high-protein **budget meal-prep planner for one
person**. One questionnaire produces a personalized weekly plan tuned to the
user's calorie and protein goals, kept cheap, and built to meal-prep (batch
cooking + carry-forward leftovers). Product source of truth: [vision.md](vision.md)
and [PRODUCT.md](PRODUCT.md) (brand/UX). Design system: [DESIGN.md](DESIGN.md).
Planner internals: [planner_logic.md](planner_logic.md).

Personal/student project, deployed on Heroku. Current scope is **one person** —
not family/household planning (that's a later iteration). Three users to keep in
mind: the budget-conscious student/solo eater, the gym/nutrition-aware person
(protein + calorie goals), and the solo meal-prepper. Norwegian grocery deal
coverage (Kiwi/Rema 1000/Extra/Meny) is the planned differentiator, not built
yet (see [vision.md](vision.md) and [ROADMAP.md](ROADMAP.md)).

## Operating mode — Claude plans, Codex writes

**Claude is the orchestrator and planner. It does NOT author code or content
directly. Every file write — code, tests, docs, config — goes through a Codex
agent.** This is a standing rule, not a per-task choice.

Each task runs in three beats:

1. **Plan (Claude).** Read the code, resolve ambiguity (rules below), and write
   a concrete plan: the change, the exact files, and the check that proves it
   works. Plan before delegating anything non-trivial.
2. **Delegate the writing (Codex).** Hand each implementation chunk to Codex via
   the `codex:codex-rescue` agent (or the `/codex:rescue` skill) with a
   self-contained brief: goal, exact files/paths, constraints (the rules below),
   and how to verify. One focused brief per chunk; split big work into chunks.
3. **Review & verify (Claude).** Inspect what Codex wrote, run the check, and
   send follow-up briefs to close gaps. Don't "just fix it" by editing directly.

Claude still does these directly — they are not "writing": reading, searching,
planning, running tests/commands, git, and reviewing Codex's output.

If Codex is unavailable, surface it and ask before falling back — don't silently
write the code yourself. Check readiness with `/codex:setup`.

## How to work here (read first)

1. **Surface uncertainty.** State the assumptions you're making and ask when the
   request has more than one reading. Flag inconsistencies you notice instead of
   coding past them. Don't silently pick an interpretation.
2. **Keep it simple.** If 200 lines could be 50, write 50. No speculative
   flexibility, no abstractions for one caller, no features nobody asked for.
3. **Stay surgical.** Change only what the task needs. No drive-by reformatting,
   renaming, or refactoring of code you happened to read.
4. **Verify against a goal, not a vibe.** Prefer a runnable check — a test, a
   request, a command — over assuming it works. Say plainly when something is
   unverified.
5. **OpenAI calls cost money.** Plan generation hits the OpenAI API. Don't kick
   off generation loops casually; use small inputs when testing the path.

## Stack

- **Frontend:** React 19 + Vite, React Router, Clerk (auth), Tailwind +
  shadcn/ui, Framer Motion. i18n: English + Norwegian.
- **Backend:** FastAPI, SQLAlchemy 2.x, PostgreSQL (Neon, with `pgvector`
  column), OpenAI API, PuLP (optimization solver), googletrans (translation).
- **Deploy:** Docker, Heroku (separate frontend + backend dynos).

## Commands

```bash
# Backend (from Backend/fastapi_app, venv at Backend/.venv, Python 3.10)
source ../.venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # API + /docs (Swagger), /redoc
pytest                                     # tests live in tests/

# Frontend (from Frontend)
npm install
npm run dev        # Vite dev server
npm run build
npm run lint       # eslint . — there is no test runner wired up

# Both
docker-compose up [--build]
```

**Env vars.** Backend: `DATABASE_URL`, `OPENAI_API_KEY`, `CLERK_JWKS_URL`,
`CLERK_JWT_ISSUER` (optional model overrides: `OPENAI_PLAN_MODEL`,
`OPENAI_MEAL_MODEL`, `PLAN_BASE_LANGUAGE`). Frontend:
`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (defaults to `http://localhost:8000`).

## Backend architecture (`Backend/fastapi_app/`)

| File | Responsibility |
|------|----------------|
| `main.py` | FastAPI app, all routes, auth deps, background tasks, admin + ratings + recipe endpoints, plan persistence, activity logging |
| `planner.py` | Default generation path: OpenAI macro targets + random DB recipe selection (constraint relaxation ladder), carry-forward leftovers, ingredient scaling |
| `solver.py` | PuLP constraint solver: personalized optimization for users with rating history |
| `models.py` | SQLAlchemy models (see Data model) |
| `database.py` | Engine + session |
| `clerk_auth.py` | Clerk JWT verification, auto-create user on first login |
| `recipe_translator.py` | Per-meal translation of generated plans |
| `migrations/` | **Raw SQL** migrations, applied by hand. No Alembic in the repo — the CI `alembic upgrade head` step is orphaned and will fail; don't rely on it |

**Two-track plan generation** (gated in `_should_use_solver`):
- **< 10 ratings → random DB path** (`planner.py`): OpenAI computes daily
  calorie/macro targets, then recipes are picked **randomly from the DB** subject
  to constraints. A per-day **relaxation ladder** applies: L0 dietary/allergy +
  cuisine + budget + cooking time; L1 drops budget + cooking time; L2 also drops
  cuisine. Allergy/dietary is the only constraint never relaxed. Each day is
  filled to land within **±15%** of the calorie target (accepting the
  least-relaxed level that fits, else the nearest combo). **No AI meal
  generation** — recipes come only from the database.
- **≥ 10 ratings → solver path** (`solver.py`): Integer LP that maximizes liked
  recipes within macro (±10%), dietary, variety, and meal-type constraints.
- **Fallback chain:** solver → random DB path → partial plan → error. An
  impossible-constraint guard runs first (e.g. vegan + very high protein).

Generation and translation run as **background tasks**; the frontend polls.
Status lives in `Preference.raw_data` (`plan_status`, `translation_status`);
plans in `raw_data["generated_plan"]`, translations under
`generated_plan_translations[lang]`. `PlanRecipe` rows link a plan to recipes
(used for last-week variety avoidance).

**Routes** (`/docs` is authoritative): `POST /preferences`,
`GET /preferences/{id}?lang=`, `GET /auth/session`, recipe browse
(`GET /recipes`, `/recipes/alternatives/{id}` for meal swaps), ratings
(`POST /ratings`, `/ratings/me`, `/ratings/progress`), `GET /plans/history`,
and an admin suite under `/admin/*` (dashboard, users, recipes CRUD + CSV/parquet
import, activity logs). Everything except `/health` requires a Clerk token;
admin routes require `is_admin`.

## Frontend architecture (`Frontend/src/`)

- `App.jsx` — routes, split by Clerk `SignedIn`/`SignedOut`. Signed-in:
  `/planner` (default), `/recipes`, `/groceries`, `/more`, `/admin/*`,
  `/privacy-policy`, `/data-deletion`. Signed-out: `Login` + legal pages.
- `Pages/MealPlanner.jsx` — questionnaire orchestration.
- `components/questionnaire/` — step components + `ResultsStep.jsx` (the plan
  view; large), `validation.js`, `resultsPlanUtils.js`.
- `Pages/Admin*.jsx` + `components/admin/` — admin dashboard, users, recipe
  editor, logs, guarded by `AdminGuard`.
- `Entities/` — API client layer (`api.js` resolves the backend URL).
- `hooks/useRatings.js` — like/dislike state.
- `i18n/` — `translations.js` (en + no), language context.
- State: React hooks only, no global store. Plan fetched via polling.

## Data model (Postgres)

- **users** — `id`, `clerk_user_id`, `email`, `username`, `is_admin`,
  `is_active`, `password_hash` (legacy/unused with Clerk).
- **preferences** — structured questionnaire fields + `raw_data` JSONB (full
  payload, generated plan, translations, status).
- **recipes** — rich: `title`, `slug`, `ingredients`/`instructions` (JSONB),
  times, `portions`, `cuisine`, `meal_type`, `dietary_flags`, `allergens`,
  `nutrition`, `cost_per_serving_cents`, `cost_category` (`cheap` |
  `medium expensive`), `embedding` (pgvector, **currently dormant — not
  queried**), `tags`, scores, scrape metadata, `is_active`.
- **ratings** — `(user_id, recipe_id, is_liked)`, unique per pair.
- **plan_recipes** — plan ↔ recipe join (day, meal_type).
- **activity_logs** — admin audit trail.

Recipes live in Postgres, seeded/imported from `recipes.csv` (root, ~14MB) via
the admin import endpoint. There is **no `recipes.parquet`** despite older docs.

## Gotchas

- **Schema/migrations aren't automated.** Apply raw SQL in `migrations/` by
  hand; the CI `alembic upgrade head` step has no Alembic config and fails.
- **Budget today is a static recipe tier** (`cost_category`), not live prices.
  The vision's "mattilbud" deal integration is **not built yet** (see roadmap).
- **No grocery/shopping list is generated** — `/groceries` is a placeholder.
- **Translation** uses the unofficial `googletrans`; flaky and uncached.
- Base plan language is English; other languages are translated after.

## MCP — Neon DB access

`mcp-servers/neon-db` exposes `query`, `execute`, `list_tables`,
`describe_table`, `get_table_data`. Use it to inspect/debug data instead of
hand-writing SQL scripts. Setup: `cd mcp-servers/neon-db && ./setup.sh`, then
restart Claude Code.
