# Preppr

Preppr creates personalized weekly meal plans from dietary preferences,
nutrition goals, recipe data, and user feedback. It provides an English and
Norwegian React interface backed by a FastAPI service, Clerk authentication,
and PostgreSQL hosted on Neon.

## Architecture

The frontend is a Vite and React application. It collects preferences,
displays generated plans, supports plan translations, and provides the
administrator recipe-management screens.

The backend is a FastAPI application using SQLAlchemy, Alembic, and psycopg 3.
It calculates nutrition targets with OpenAI, selects recipes with the hybrid or
constraint-solver planning path, and stores plans in PostgreSQL. Clerk protects
all application endpoints except `GET /health`.

Production uses two Heroku container apps: one for the backend API and one for
the frontend. The backend connects to Neon; neither local development nor a
fork should use production credentials or production data.

## Prerequisites

You need the following tools and accounts to run a local instance:

- Python 3.11 or newer
- Node.js 20 or newer
- A PostgreSQL database, such as a Neon database you control
- An OpenAI API key
- A Clerk instance and its frontend publishable key

You also need a CSV of recipes before the planner can return useful results.
Import it through the administrator recipe screen after completing the admin
bootstrap described below.

## Local setup

Configure the backend before starting it. The application reads `DATABASE_URL`
when it imports the database module, so the variable must exist before running
Uvicorn, Alembic, or tests that import the app.

```bash
cd Backend/fastapi_app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL='postgresql://user:password@host/database?sslmode=require'
export OPENAI_API_KEY='your-openai-api-key'
export CLERK_JWKS_URL='https://api.clerk.com/v1/jwks'
export CLERK_JWT_ISSUER='https://your-instance.clerk.accounts.dev'
```

For a fresh database, create the schema with Alembic and start the API:

```bash
alembic upgrade head
uvicorn main:app --reload --port 8000
```

The backend listens on `http://localhost:8000`. Its interactive API reference
is available at `http://localhost:8000/docs`.

Set up the frontend in a second terminal:

```bash
cd Frontend
npm install

export VITE_CLERK_PUBLISHABLE_KEY='your-clerk-publishable-key'
export VITE_API_URL='http://localhost:8000'
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Database safety and recipe import

The initial Alembic revision only creates a fresh schema. For an existing,
unversioned database, first take and verify a restore point, inspect schema
compatibility, then mark the baseline before upgrading:

```bash
alembic stamp 0001_existing_schema
alembic upgrade head
```

Do not apply those commands, direct SQL, or recipe imports to production
without explicit authorization for that environment.

To bootstrap an administrator locally, sign in and visit `/admin` once so the
backend creates the user record. Then, in the database you control, update the
matching Clerk user ID:

```sql
UPDATE users
SET is_admin = TRUE
WHERE clerk_user_id = '<your-clerk-user-id>';
```

An administrator can import CSV recipe data from the admin recipe screen. The
importer requires a title column and accepts common aliases for ingredients,
instructions, nutrition, cuisine, meal type, dietary flags, and allergens.

## Docker Compose

Docker Compose starts the backend and frontend development services. Export the
same environment variables used for local setup, then run:

```bash
docker-compose up --build
```

The compose file mounts the source directories and enables backend reload and
Vite development mode. It is intended for local development, not production.

## Verification

Run the backend checks from the repository root with a test database URL:

```bash
python3 -m compileall -q Backend/fastapi_app
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/mealplanner_test' \
  python3 -m pytest Backend/fastapi_app/tests
```

Run the frontend checks from `Frontend`:

```bash
npm ci
npm run lint
npm run build
```

## Deployment

The GitHub Actions workflow in
[`.github/workflows/cd-heroku.yml`](.github/workflows/cd-heroku.yml) deploys
`main` after quality checks pass. It builds both container images before any
release, releases the backend, runs Alembic in the backend app, checks
`/health`, then releases the frontend and checks its root page.

Configure these GitHub secrets before enabling a deployment:

- `HEROKU_API_KEY`
- `HEROKU_EMAIL`
- `HEROKU_APP_BACKEND`
- `HEROKU_APP_FRONTEND`
- `VITE_CLERK_PUBLISHABLE_KEY`

Set the backend's runtime configuration in its Heroku app: `DATABASE_URL`,
`OPENAI_API_KEY`, `CLERK_JWKS_URL`, `CLERK_JWT_ISSUER`, and any required Clerk
audience or CORS settings. The frontend receives its API URL and Clerk
publishable key at image-build time.

Do not push, deploy, migrate production, or alter production configuration
without explicit authorization.

## Neon MCP server

The repository includes an optional MCP server for direct database inspection
and administration. Its setup, configuration expectations, available tools,
and safety guidance are in
[`mcp-servers/neon-db/README.md`](mcp-servers/neon-db/README.md).
