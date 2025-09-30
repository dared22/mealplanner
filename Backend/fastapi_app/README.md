# Meal Planner FastAPI Backend

## Setup

1. Create and activate a virtual environment (recommended).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API exposes:
- `GET /health` – health check
- `POST /preferences` – stores questionnaire data in memory and returns an identifier
- `GET /preferences/{id}` – retrieves a stored entry by identifier

The frontend expects the API to be available at `http://localhost:8000`. You can override this by setting the `VITE_API_URL` environment variable in the Vite project.
