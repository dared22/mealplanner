# Meal Planner FastAPI Backend

## Setup

1. Create and activate a virtual environment (recommended).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Provision a PostgreSQL database and create a connection string, e.g.
   ```bash
   createdb mealplanner
   ```
   Then export it so the app can reach the database (adjust credentials as needed):
   ```bash
   export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/mealplanner"
   ```
   If `DATABASE_URL` is not set, the value above is used as the default.
4. Run the server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Docker Compose (full stack)

1. Install Docker Desktop (or Docker Engine) and ensure `docker compose` is available.
2. From the repository root, start all services:
   ```bash
   docker compose up --build
   ```
   This launches PostgreSQL, the FastAPI backend with live reload, and the Vite frontend dev server.
3. Open the app at [http://localhost:5173](http://localhost:5173). The backend is exposed on [http://localhost:8000](http://localhost:8000).
4. When you are finished, stop everything with `Ctrl+C`, then remove containers (and the Postgres volume if desired):
   ```bash
   docker compose down
   # or to wipe the Postgres data volume as well
   docker compose down -v
   ```

The API exposes:
- `GET /health` – health check
- `POST /preferences` – persists questionnaire data to PostgreSQL and returns an identifier
- `GET /preferences/{id}` – retrieves a stored entry by identifier

The frontend expects the API to be available at `http://localhost:8000`. You can override this by setting the `VITE_API_URL` environment variable in the Vite project.
