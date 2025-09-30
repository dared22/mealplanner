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
   export DATABASE_URL="postgresql+psycopg://pasha:@localhost:5432/mealplanner"
   ```
   If `DATABASE_URL` is not set, the value above is used as the default (`postgres:postgres`).
   If you are upgrading from a previous schema, drop the old table first so the new
   structured schema (integer ids and minute precision timestamps) can be created:
    ```bash
    psql -U <user> -d mealplanner -c "DROP TABLE IF EXISTS preferences;"
    ```
4. Run the server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Database migrations (Alembic)

1. Create a new migration after modifying models:
   ```bash
   alembic revision --autogenerate -m "describe change"
   ```
2. Apply migrations:
   ```bash
   alembic upgrade head
   ```
3. Inspect history:
   ```bash
   alembic history --verbose
   ```

Alembic reads the same `DATABASE_URL` environment variable as the app. The configuration
files live in `alembic.ini` and the `alembic/` folder inside `fastapi_app`.

The API exposes:
- `GET /health` – health check
- `POST /preferences` – persists structured questionnaire data to PostgreSQL and returns an integer identifier
- `GET /preferences/{id}` – retrieves a stored entry by identifier (structured fields + raw payload)

The frontend expects the API to be available at `http://localhost:8000`. You can override this by setting the `VITE_API_URL` environment variable in the Vite project.
