# Preppr

A web application that generates personalized weekly meal plans using AI. You
fill out a questionnaire with your dietary preferences, and the app creates
custom meal plans that you can save, translate, and reuse.

**Live demo:** https://mealplanner-frontend-cc0005e5d9b0.herokuapp.com/

> **Note:** The live demo is the primary way to use this app. Running your own
> instance requires setting up your own Neon database and populating it with
> recipe data. The demo uses a personal OpenAI API key for nutrition
> calculations, so please be considerate when testing.

## Features

- **Personalized meal plans:** Generate weekly meal plans based on your
  nutrition goals, dietary restrictions, and preferences
- **AI-powered nutrition targets:** Uses OpenAI's API to calculate optimal
  daily calorie and macro targets for your goals
- **Custom optimization algorithm:** Meal recommendations are generated using
  a proprietary algorithm that matches recipes to your nutrition targets and
  preferences
- **Multi-language support:** Available in English and Norwegian with
  automatic translation
- **Recipe database:** Access to a curated collection of recipes with
  nutritional information
- **Meal swapping:** Don't like a suggestion? Swap it for an alternative
- **Persistent preferences:** Your settings are saved for future use

## Tech stack

**Frontend:**
- React 19 with Vite
- React Router for navigation
- Clerk for authentication
- TailwindCSS with shadcn/ui components
- Framer Motion for animations

**Backend:**
- FastAPI (Python)
- PostgreSQL (Neon) with SQLAlchemy ORM
- OpenAI API for nutrition target recommendations
- Custom optimization algorithm for meal selection
- Background task processing for async operations

**Deployment:**
- Docker support
- Heroku hosting

## Using the app

The easiest way to use this app is through the live demo. If you want to run
your own instance, you'll need to set up your own Neon database, populate it
with recipe data, and configure your own API keys.

## Setting up your own instance

### Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- Your own Neon PostgreSQL database
- Recipe dataset (see Database setup below)
- OpenAI API key
- Clerk account for authentication

> **Note:** You cannot connect to the production database. You must create and
> populate your own Neon database with recipe data.

### Database setup

Before running the backend, you need to:

1. Create a Neon PostgreSQL database
2. Set up the database schema (users, preferences, recipes tables)
3. Load recipe data from `recipes.csv` into your recipes table
4. The recipe data must include nutrition information, tags, and meal type
   classifications for the optimization algorithm to work

### Backend setup

1. Navigate to the backend directory:

   ```bash
   cd Backend/fastapi_app
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables:

   ```bash
   export DATABASE_URL="your-neon-connection-string"  # From Neon dashboard
   export OPENAI_API_KEY="your-openai-api-key"
   export CLERK_JWKS_URL="https://api.clerk.com/v1/jwks"
   export CLERK_JWT_ISSUER="https://your-clerk-instance.clerk.accounts.dev"
   ```

5. Start the development server:

   ```bash
   uvicorn main:app --reload --port 8000
   ```

The API will be available at http://localhost:8000.

### Frontend setup

1. Navigate to the frontend directory:

   ```bash
   cd Frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set environment variables:

   ```bash
   export VITE_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
   export VITE_API_URL="http://localhost:8000"  # Optional, defaults to localhost:8000
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

The app will be available at http://localhost:5173.

### Docker setup

To run both frontend and backend using Docker Compose (requires configured
environment variables and your own Neon database):

```bash
docker-compose up
```

To rebuild containers after making changes:

```bash
docker-compose up --build
```

## Environment variables

All environment variables must be your own credentials. You cannot use the
production database or API keys.

### Backend

- `DATABASE_URL` (required): Your Neon PostgreSQL connection string
- `OPENAI_API_KEY` (required): Your OpenAI API key for nutrition target
  calculation
- `CLERK_JWKS_URL` (required): Clerk JWKS endpoint for authentication
- `CLERK_JWT_ISSUER` (required): Your Clerk issuer URL

### Frontend

- `VITE_CLERK_PUBLISHABLE_KEY` (required): Your Clerk publishable key
- `VITE_API_URL` (optional): Backend API URL (defaults to
  http://localhost:8000)

## Project structure

```
mealplanner/
├── Backend/
│   └── fastapi_app/
│       ├── main.py              # FastAPI app and routes
│       ├── models.py            # SQLAlchemy database models
│       ├── database.py          # Database session management
│       ├── clerk_auth.py        # Authentication middleware
│       ├── planner.py           # Meal plan generation logic
│       └── recipe_translator.py # Translation service
├── Frontend/
│   └── src/
│       ├── App.jsx              # Main app component
│       ├── Pages/
│       │   └── MealPlanner.jsx  # Meal planner page
│       ├── components/
│       │   └── questionnaire/   # Multi-step form components
│       └── i18n/                # Internationalization
├── docker-compose.yml           # Docker configuration
└── README.md
```

## How it works

1. You complete a questionnaire with your dietary preferences, nutrition goals,
   activity level, and other details
2. The backend sends your profile to OpenAI's API to calculate optimal daily
   calorie and macronutrient targets
3. A custom optimization algorithm selects meals from the recipe database that
   match your nutrition targets, dietary restrictions, and preferences
4. Your meal plan appears in the app, where you can review, translate, and swap
   individual meals
5. Plans are saved to your account for future reference and reuse

Meal plan generation and translation happen asynchronously in the background.
The frontend polls the API to retrieve results when they're ready.

## The optimization algorithm

The meal plan generator uses a sophisticated constraint-solving approach to
create personalized plans. Inspired by [Tautvidas Pranc's constraint-based meal
planning](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/),
the algorithm uses mathematical optimization to balance nutrition targets with
your preferences.

### Two-tier approach

The app uses different algorithms depending on how much it knows about your
preferences:

**For users with rating history (10+ rated recipes):**

The system formulates meal planning as an Integer Linear Programming problem
using the PuLP library. This finds the mathematically optimal combination of
meals that:

- Maximizes the number of recipes you've liked in the past
- Meets your daily calorie and macronutrient targets (within ±10%)
- Respects all dietary restrictions (vegan, gluten-free, etc.) as hard
  constraints
- Ensures meal variety (each recipe used at most once per week)
- Assigns appropriate meal types (breakfast recipes for breakfast, etc.)
- Considers your budget and cooking time preferences when possible

The solver evaluates hundreds of recipe combinations in seconds to find the
best match. If the solution quality doesn't meet thresholds (at least 50%
liked recipes and macros within 20% of targets), it falls back to the
alternative approach.

**For new users or fallback scenarios:**

When you don't have enough rating history, the system uses a greedy selection
algorithm that:

- Iterates through each meal slot sequentially
- Calculates remaining macro targets for the day
- Scores available recipes by how closely they match the remaining targets
- Randomly selects from the top 5 closest matches (adds variety)
- Tracks used recipes to prevent repetition

This approach always produces valid plans but may not be as personalized as
the constraint solver.

### Key constraints

The optimization algorithm enforces:

- **Daily macro targets:** Calories, protein, carbohydrates, and fat stay
  within acceptable ranges
- **Dietary restrictions:** Hard filters for vegan, vegetarian, gluten-free,
  dairy-free, and allergen restrictions
- **Meal appropriateness:** Breakfast foods for breakfast, dinner foods for
  dinner (with some flexibility for lunch)
- **Variety:** No recipe appears more than once in your weekly plan
- **Recency:** Recipes from your previous week's plan are excluded
- **User preferences:** Recipes you've disliked are never selected

### Why constraint solving?

Traditional recommendation systems might just pick "healthy recipes" or "top
rated meals," but constraint solving ensures your entire week works together
as a cohesive nutrition plan. It's like solving a complex puzzle where every
meal affects the next, and the algorithm finds the configuration that best
satisfies all requirements simultaneously.

The result is meal plans that feel personalized and actually hit your
nutrition goals without you having to think about macro calculations.

## API documentation

Once the backend is running, you can access the interactive API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

### Frontend commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend commands

- `uvicorn main:app --reload` - Start development server with hot reload
- `pytest` - Run tests (if configured)

## Authentication

All API endpoints except `/health` require authentication. The app uses Clerk
for user management and JWT-based authentication. User accounts are
automatically created on first login.

## Database

The app uses Neon (serverless PostgreSQL) with three main tables:

- **users:** User accounts (synced with Clerk)
- **preferences:** User preferences and generated meal plans
- **recipes:** Recipe database loaded from `recipes.csv`

The custom optimization algorithm queries the recipes table to build meal plans
that match your nutrition targets and preferences. Generated meal plans and
translations are stored as JSON in the `preferences.raw_data` field for
flexibility.

**Important:** To run your own instance, you must create and populate your own
Neon database with recipe data. The production database is not accessible for
local development or forking.

## Contributing

This is a personal project, but suggestions and feedback are welcome. If you
find issues or have ideas for improvements, feel free to open an issue.

## License

This project is for personal and educational use.
