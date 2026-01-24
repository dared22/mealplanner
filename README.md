## Why I Built This

I always burn way too much time figuring out what to eat. It needs to be tasty, healthy, and the decision shouldn’t hijack my day. ChatGPT could generate a week of meals, but re-prompting every week, re-explaining goals, and swapping dishes I dislike got old fast. So I built a small web app (maybe iOS/Android someday 👀) that remembers my preferences, generates meal plans, and keeps everything in one place.

## How It Works

1. **Tell it what you want** – diet goals, dislikes, number of days, budget, etc., right in the planner UI.
2. **The backend does the heavy lifting** – the Vite frontend sends your preferences to the FastAPI service, which talks to ChatGPT to build a personalized plan.
3. **Plans show up instantly** – review the meals, swap anything you don’t like, and reuse the plan next week.

## Run It Locally

### Backend

```bash
cd Backend/fastapi_app
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://<user>:<password>@<host>/<db>?sslmode=require"
export CLERK_JWKS_URL="https://api.clerk.com/v1/jwks"
export CLERK_JWT_ISSUER="https://your-clerk-instance.clerk.accounts.dev"
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd Frontend
npm install
export VITE_CLERK_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
npm run dev
```

Then open http://localhost:5173 — the frontend talks to http://localhost:8000 by default. If your API lives somewhere else, set `VITE_API_URL` before running `npm run dev`.

## Hosted Version

Live demo: https://mealplanner-frontend-cc0005e5d9b0.herokuapp.com/

Be gentle, I’m a broke student paying for the ChatGPT API myself. If you generate 50 meal plans in one go, you’re literally eating my lunch. 😅
