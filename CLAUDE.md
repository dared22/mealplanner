# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a meal planning web application that generates personalized weekly meal plans using ChatGPT. Users fill out a questionnaire with their dietary preferences, and the backend generates meal plans that can be translated and saved for reuse.

**Stack:**
- Frontend: React 19 + Vite, React Router, Clerk (auth), TailwindCSS + shadcn/ui components
- Backend: FastAPI (Python), PostgreSQL (Neon), SQLAlchemy ORM, OpenAI API
- Deployment: Docker, Heroku

## Development Commands

### Backend (FastAPI)

```bash
cd Backend/fastapi_app
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run locally
uvicorn main:app --reload --port 8000

# Required environment variables (see .env):
# - DATABASE_URL: PostgreSQL connection string
# - OPENAI_API_KEY: OpenAI API key for meal plan generation
# - CLERK_JWKS_URL: Clerk JWKS endpoint
# - CLERK_JWT_ISSUER: Clerk issuer URL
```

### Frontend (Vite + React)

```bash
cd Frontend
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Required environment variables:
# - VITE_CLERK_PUBLISHABLE_KEY: Clerk publishable key
# - VITE_API_URL: Backend API URL (defaults to http://localhost:8000)
```

### Docker Compose

```bash
# Run both frontend and backend
docker-compose up

# Rebuild containers
docker-compose up --build
```

## Architecture

### Backend Architecture

**Entry point:** `Backend/fastapi_app/main.py`

**Core modules:**
- `main.py` - FastAPI app, routes, CORS, background task orchestration
- `models.py` - SQLAlchemy models: `User`, `Preference`, `Recipe`
- `database.py` - Database session management and engine setup
- `clerk_auth.py` - Clerk JWT verification and user session handling
- `planner.py` - Meal plan generation using OpenAI API and recipe database
- `recipe_translator.py` - Translation service for meal plans

**Data flow:**
1. User submits preferences via `/preferences` POST endpoint
2. Preferences stored in DB, background task triggered for plan generation
3. `planner.py` queries OpenAI for daily macro targets and meal plans
4. Plans are matched against recipe database (`recipes.parquet`)
5. Plan stored in `raw_data` JSONB field on `Preference` model
6. Frontend polls `/preferences/{id}` to retrieve generated plan
7. If language differs from base language, translation background task triggered

**Key patterns:**
- Background tasks used for long-running operations (plan generation, translation)
- Plan and translation status tracked via JSONB fields: `plan_status` (pending/success/error), `translation_status`
- Auth: Clerk JWT extracted from Authorization header, verified, user auto-created if new
- All generated plans stored in `Preference.raw_data["generated_plan"]`
- Translations stored in `Preference.raw_data["generated_plan_translations"][lang]`

### Frontend Architecture

**Entry point:** `Frontend/src/main.jsx` → `App.jsx`

**Routing structure:**
- `/` - Redirects to `/planner`
- `/planner` - Main meal planner (MealPlanner.jsx)
- `/recipes` - Recipe browser (placeholder)
- `/groceries` - Grocery list (placeholder)

**Key components:**
- `App.jsx` - Router setup, Clerk authentication wrapper
- `Pages/MealPlanner.jsx` - Main planner page, questionnaire orchestration
- `components/questionnaire/` - Multi-step form components:
  - `PersonalInfoStep.jsx` - Age, gender, height, weight
  - `GoalsStep.jsx` - Nutrition goals, meals per day
  - `ActivityStep.jsx` - Activity level, cooking time, budget
  - `DietaryStep.jsx` - Dietary restrictions
  - `CuisineStep.jsx` - Preferred cuisines
  - `PreferencesStep.jsx` - Additional preferences
  - `ResultsStep.jsx` - Display generated meal plan
- `components/DashboardLayout.jsx` - Layout wrapper with navigation
- `i18n/LanguageContext.jsx` - Language switching (Norwegian/English)
- `i18n/translations.js` - Translation strings

**State management:**
- No global state library; uses React hooks (useState, useEffect)
- User preferences stored in local component state
- Meal plan fetched via API polling in ResultsStep

**API communication:**
- API base URL: `import.meta.env.VITE_API_URL` or defaults to `http://localhost:8000`
- Auth: Clerk session token passed in Authorization header
- Endpoints used:
  - POST `/preferences` - Submit user preferences
  - GET `/preferences/{id}?lang={lang}` - Fetch generated plan
  - GET `/auth/session` - Verify current user session

### Database Schema

**Users table:**
- `id` (PK), `clerk_user_id` (unique), `email` (unique), `created_at`
- Clerk handles auth; users auto-created on first login

**Preferences table:**
- `id` (PK), `user_id` (FK to users), `submitted_at`
- Structured fields: age, gender, height_cm, weight_kg, activity_level, nutrition_goal, meals_per_day, budget_range, cooking_time_preference, dietary_restrictions, preferred_cuisines
- `raw_data` (JSONB) - Stores full request payload plus generated plans and translations

**Recipes table:**
- Loaded from `recipes.parquet` (2MB dataset)
- Fields: name, ingredients, instructions, nutrition, tags, type, price_tier
- Meal type flags: `is_breakfast`, `is_lunch` (inferred from tags)

## MCP Tools

This project includes an MCP server for direct Neon database access:

**Setup:**
```bash
cd mcp-servers/neon-db
./setup.sh
```

Then restart Claude Code. Available tools:
- `query` - Execute SELECT queries on the database
- `execute` - Execute write operations (INSERT, UPDATE, DELETE)
- `list_tables` - List all tables and their schemas
- `describe_table` - Get detailed schema for a table
- `get_table_data` - Fetch table data with filtering

Use these tools to inspect data, debug issues, or make database changes without writing Python/SQL code manually.

## Important Notes

- **OpenAI API costs:** The app uses OpenAI's API for meal plan generation. Be mindful of usage costs.
- **Clerk auth:** All endpoints except `/health` require valid Clerk session token.
- **Background tasks:** Plan generation and translation happen asynchronously. Frontend should poll for results.
- **JSONB storage:** Plans and translations stored as nested JSON in `Preference.raw_data` for flexibility.
- **Language support:** Currently supports Norwegian (no/nb/nn) and English (en). Translation uses `googletrans`.
- **Recipe dataset:** Recipes are loaded from a Parquet file into the database. The dataset is static and not user-editable.
