# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
mealplanner/
├── Backend/                           # FastAPI backend application
│   ├── fastapi_app/
│   │   ├── main.py                   # FastAPI app, routes, background tasks
│   │   ├── models.py                 # SQLAlchemy ORM models (User, Preference, Recipe)
│   │   ├── database.py               # Database session, connection pooling
│   │   ├── clerk_auth.py             # Clerk JWT verification
│   │   ├── planner.py                # Meal plan generation logic (OpenAI)
│   │   ├── recipe_translator.py      # Translation service (Google Translate)
│   │   ├── recipes.parquet           # Static recipe dataset (2MB)
│   │   ├── requirements.txt          # Python dependencies
│   │   ├── Dockerfile                # Docker container definition
│   │   └── __pycache__/
│   ├── package.json                  # Node.js server config (unused in current setup)
│   └── server.js                     # Placeholder Node.js server
├── Frontend/                          # React + Vite frontend application
│   ├── src/
│   │   ├── main.jsx                  # Entry point, React DOM render
│   │   ├── App.jsx                   # Router setup, Clerk auth wrapper
│   │   ├── App.css                   # Global component styles
│   │   ├── index.css                 # Base styles
│   │   ├── styles.css                # TailwindCSS output
│   │   ├── Pages/                    # Route pages
│   │   │   ├── MealPlanner.jsx       # Main questionnaire orchestrator
│   │   │   ├── Login.jsx             # Login placeholder (Clerk handles auth)
│   │   │   ├── Recipes.jsx           # Recipe browser (placeholder)
│   │   │   ├── Groceries.jsx         # Grocery list (placeholder)
│   │   │   └── MealTips.jsx          # Meal tips (placeholder)
│   │   ├── Entities/                 # API client layer
│   │   │   ├── api.js                # API URL configuration
│   │   │   └── UserPreferences.js    # Preference API client (POST/GET)
│   │   ├── components/               # Reusable UI components
│   │   │   ├── DashboardLayout.jsx   # Main layout wrapper with nav
│   │   │   ├── questionnaire/        # Multi-step form steps
│   │   │   │   ├── ProgressBar.jsx   # Step progress indicator
│   │   │   │   ├── PersonalInfoStep.jsx    # Age, gender, height, weight
│   │   │   │   ├── ActivityStep.jsx        # Activity level, cooking time, budget
│   │   │   │   ├── GoalsStep.jsx           # Nutrition goals, meals per day
│   │   │   │   ├── DietaryStep.jsx         # Dietary restrictions
│   │   │   │   ├── CuisineStep.jsx         # Preferred cuisines
│   │   │   │   ├── PreferencesStep.jsx     # Additional preferences
│   │   │   │   └── ResultsStep.jsx         # Meal plan display
│   │   │   └── ui/                   # shadcn/ui components
│   │   │       ├── button.jsx
│   │   │       ├── input.jsx
│   │   │       ├── label.jsx
│   │   │       └── select.jsx
│   │   ├── i18n/                     # Internationalization
│   │   │   ├── LanguageContext.jsx   # Language provider (en/no)
│   │   │   └── translations.js       # Translation strings
│   │   ├── lib/                      # Utilities
│   │   │   └── utils.js              # Helper functions (clsx, cn)
│   │   └── assets/                   # Static images/icons
│   ├── public/                        # Public static assets
│   ├── dist/                          # Build output (gitignored)
│   ├── node_modules/                 # Dependencies (gitignored)
│   ├── vite.config.js                # Vite build configuration
│   ├── tailwind.config.js            # TailwindCSS configuration
│   ├── postcss.config.js             # PostCSS configuration
│   ├── jsconfig.json                 # JavaScript config, path aliases
│   ├── components.json               # shadcn/ui components config
│   ├── eslint.config.js              # ESLint configuration
│   ├── index.html                    # HTML entry point
│   ├── package.json                  # Node dependencies
│   ├── package-lock.json             # Dependency lock file
│   └── Dockerfile                    # Docker container definition
├── mcp-servers/                       # Model Context Protocol servers
│   ├── neon-db/                      # Neon database access MCP
│   │   └── venv/                     # Python virtual environment
│   └── README.md
├── CLAUDE.md                          # Claude AI instructions
├── README.md                          # Project documentation
├── docker-compose.yml                # Docker Compose orchestration
├── clerk_users.json                  # Clerk user dump (development)
└── .planning/
    └── codebase/                      # Analysis documents (this directory)
```

## Directory Purposes

**Backend/fastapi_app/:**
- Purpose: Python FastAPI backend application
- Contains: Route handlers, database models, authentication, business logic
- Key files: `main.py` (routes), `models.py` (ORM), `planner.py` (meal generation), `recipe_translator.py` (translation)
- Runs on: Port 8000 (default)

**Frontend/src/:**
- Purpose: React application source code
- Contains: Components, pages, state management, API clients, internationalization
- Compiled to: `Frontend/dist/` during build
- Runs on: Port 5173 (dev), port 4173 (preview)

**Frontend/src/Pages/:**
- Purpose: Route-level components
- Contains: Main pages (MealPlanner, Login, Recipes, Groceries)
- Pattern: One component per route
- Key: MealPlanner.jsx orchestrates all questionnaire logic

**Frontend/src/components/questionnaire/:**
- Purpose: Multi-step form components for preference collection
- Contains: 7 step components + progress bar
- Pattern: Controlled components with onChange handlers
- Flow: PersonalInfo → Activity → Goals → Dietary → Cuisine → Preferences → Results

**Frontend/src/Entities/:**
- Purpose: API client layer
- Contains: UserPreferences (POST /preferences, GET /preferences/{id})
- Pattern: Simple fetch wrapper with auth headers
- Used by: MealPlanner.jsx, ResultsStep.jsx

**Frontend/src/i18n/:**
- Purpose: Language switching and translation strings
- Contains: LanguageContext provider, translations dictionary
- Supported languages: English (en), Norwegian (no)
- Storage: localStorage key `mealplanner_lang`

## Key File Locations

**Entry Points:**

- **Backend:** `Backend/fastapi_app/main.py` (FastAPI app initialization, routes)
- **Frontend:** `Frontend/src/main.jsx` (React DOM render), `Frontend/src/App.jsx` (App component)

**Configuration:**

- **Backend:** `Backend/fastapi_app/database.py` (DB connection, pooling)
- **Frontend:** `Frontend/vite.config.js` (build config), `Frontend/jsconfig.json` (path aliases), `Frontend/tailwind.config.js` (CSS)
- **Root:** `docker-compose.yml` (service orchestration)

**Core Logic:**

- **Meal Planning:** `Backend/fastapi_app/planner.py` (OpenAI meal plan generation)
- **Translation:** `Backend/fastapi_app/recipe_translator.py` (Google Translate wrapper)
- **Authentication:** `Backend/fastapi_app/clerk_auth.py` (Clerk JWT verification)

**Testing:**

- No test files detected in current structure
- Manual testing via Postman/curl or frontend UI recommended

## Naming Conventions

**Files:**

- **Backend Python:** `snake_case.py` (main.py, database.py, models.py, planner.py)
- **Frontend React:** `PascalCase.jsx` for components (MealPlanner.jsx, ResultsStep.jsx)
- **Frontend JavaScript:** `camelCase.js` for utilities (LanguageContext.jsx, translations.js, utils.js)
- **Config:** Descriptive names with extensions (vite.config.js, tailwind.config.js, eslint.config.js)

**Directories:**

- **Backend:** Single-word or snake_case (fastapi_app, models, planner)
- **Frontend:** Plural for collections (Pages, components, Entities), descriptive subfolders (questionnaire, ui, i18n)

**Component Naming:**

- React components: `PascalCase` (PersonalInfoStep, ProgressBar, DashboardLayout)
- Props/internal functions: `camelCase` (onChange, handleNumberChange, validatePersonalInfo)
- State hooks: `camelCase` (useState, useLanguage, useAuth)

## Where to Add New Code

**New Backend Route:**
- Location: `Backend/fastapi_app/main.py` (add @app.get/post/put/delete decorator and handler)
- Dependency injection: Add `db: Session = Depends(get_session)` and/or `user: User = Depends(current_user_dependency)` for auth
- Return: Dict serialized with `_json_safe()` for numpy type handling
- Example: Lines 372-419 (save_preferences), lines 422-519 (get_preferences)

**New Frontend Page:**
- Location: `Frontend/src/Pages/` (create PascalCasePageName.jsx)
- Routing: Add route to `Frontend/src/App.jsx` in AppRoutes component
- Layout: Wrap with DashboardLayout component for consistency
- Language support: Use `useLanguage()` hook for translations

**New Questionnaire Step:**
- Location: `Frontend/src/components/questionnaire/` (create StepName.jsx)
- Pattern: Export validation function, memoized component with onChange handler
- Example: PersonalInfoStep.jsx (lines 5-46), ActivityStep.jsx
- Add to: MealPlanner.jsx STEP_META array and step rendering

**New Utility:**
- Shared functions: `Frontend/src/lib/utils.js`
- API operations: `Frontend/src/Entities/` (new file or extend UserPreferences.js)
- Business logic: `Backend/fastapi_app/planner.py` or new module in fastapi_app/

**New Database Model:**
- Location: `Backend/fastapi_app/models.py` (add SQLAlchemy class extending Base)
- Session access: `db: Session = Depends(get_session)` in route handlers
- Queries: Use SQLAlchemy 2.0 style (select(), where(), scalars())
- Example: User model (lines 43-60), Preference model (lines 12-40), Recipe model (lines 63-80)

**New Translation Feature:**
- Location: `Backend/fastapi_app/recipe_translator.py`
- Extend: RecipeTranslator or PlanTranslator class
- Pattern: Implement `_translate_text()` and `_translate_list()` methods
- Return: TranslationResult(data, error) object

## Special Directories

**Backend/fastapi_app/__pycache__/:**
- Purpose: Python bytecode cache
- Generated: Yes (automatically by Python)
- Committed: No (gitignored)
- Action: Safe to delete, regenerated on next run

**Frontend/node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (npm install)
- Committed: No (gitignored)
- Size: ~700MB
- Action: Run `npm install` to restore

**Frontend/dist/:**
- Purpose: Production build output
- Generated: Yes (`npm run build`)
- Committed: No (gitignored)
- Used by: Docker production container, Heroku deployment
- Action: Safe to delete, regenerated on build

**mcp-servers/neon-db/venv/:**
- Purpose: Python virtual environment for MCP server
- Generated: Yes (`./setup.sh`)
- Committed: No (gitignored)
- Used by: Claude Code for direct database access
- Action: Run `./setup.sh` to restore

**Backend/recipes.parquet:**
- Purpose: Static recipe dataset (2MB, ~4000 recipes)
- Generated: No (checked in)
- Committed: Yes
- Loaded into: PostgreSQL recipes table at runtime or via data migration
- Update: Replace file and reload DB to add/update recipes

---

*Structure analysis: 2026-01-26*
