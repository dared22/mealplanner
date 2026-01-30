# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- JavaScript/JSX 19 - Frontend React application, component definitions
- Python 3.11 - Backend FastAPI application, meal plan generation, database models

**Secondary:**
- TypeScript (optional) - Type checking available via @types packages in frontend

## Runtime

**Frontend:**
- Node.js 20 (Alpine) - Runtime for development and build processes
- Browser environment - React 19 client-side execution

**Backend:**
- Python 3.11 - FastAPI application server runtime

**Package Managers:**
- npm (frontend) - `Frontend/package.json`
- pip (backend) - `Backend/fastapi_app/requirements.txt`
- Lockfiles: `Frontend/package-lock.json` (present), `Backend/fastapi_app/requirements.txt` (pinned versions)

## Frameworks

**Frontend:**
- React 19.1.1 - Component library and application framework
  - Location: `Frontend/src/**/*.jsx`
  - Entry: `Frontend/src/main.jsx`
- React Router 7.13.0 - Client-side routing
  - Routes defined in `Frontend/src/App.jsx`
  - Protects routes with Clerk SignedIn/SignedOut guards
- Vite 7.1.7 - Build tool and dev server
  - Config: `Frontend/vite.config.js`
  - Commands: `npm run dev`, `npm run build`, `npm run preview`

**Backend:**
- FastAPI 0.111.0 - Web framework for API endpoints
  - App definition: `Backend/fastapi_app/main.py`
  - Server: Uvicorn 0.30.1
  - CORS middleware configured with origin allowlist
- SQLAlchemy 2.0.29 - ORM for database models
  - Models: `Backend/fastapi_app/models.py` (User, Preference, Recipe)
  - Session management: `Backend/fastapi_app/database.py`

**Testing:**
- No testing framework detected in current dependencies
- Frontend: ESLint 9.36.0 configured for code quality
  - Config: `.eslintrc.*` (if present)
  - Plugins: eslint-plugin-react-hooks, eslint-plugin-react-refresh

**Build/Dev:**
- Tailwind CSS 4.1.13 - Utility-first CSS framework
  - Config: `Frontend/tailwind.config.js`
  - PostCSS 8.5.6 with Autoprefixer 10.4.21
- Vite plugins:
  - @vitejs/plugin-react 5.0.3 - React Fast Refresh support

## Key Dependencies

**Frontend - Critical:**
- @clerk/clerk-react 5.24.1 - Authentication and user session management
  - Session tokens passed as Bearer tokens to backend
  - Clerk SignedIn/SignedOut components gate routes
- react-router-dom 7.13.0 - Client-side navigation
- @radix-ui/react-select 2.2.6, @radix-ui/react-label 2.1.7 - Accessible UI primitives
- framer-motion 12.23.21 - Animation library for UI transitions
- lucide-react 0.544.0 - Icon library

**Backend - Critical:**
- openai >= 1.37.0, < 2.0.0 - OpenAI API client for meal plan generation
  - Model: gpt-4o-mini (configurable via OPENAI_PLAN_MODEL env var)
  - Timeout: 120s (configurable via OPENAI_REQUEST_TIMEOUT)
  - Max tokens: 1000 (configurable via OPENAI_PLAN_MAX_TOKENS)
- psycopg[binary] 3.1.18 - PostgreSQL adapter for SQLAlchemy
  - Supports both direct connections and poolers (Neon pooler configured)
- PyJWT 2.8.0, cryptography 42.0.8 - JWT token verification for Clerk auth
- googletrans 4.0.2 - Translation service for meal plans (Google Translate API)
- pandas 2.2.2, pyarrow 16.1.0 - Data processing and Parquet file support
  - Recipes loaded from `recipes.parquet`

**Backend - Infrastructure:**
- pydantic - Data validation (implicit with FastAPI)
- sqlalchemy.dialects.postgresql - PostgreSQL-specific features (ARRAY, JSONB, UUID types)

## Configuration

**Environment Variables:**

*Frontend (`Frontend/.env.local` or build args):*
- `VITE_API_URL` - Backend API endpoint (default: http://localhost:8000)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key for client-side auth

*Backend (Backend/.env or docker-compose environment):*
- `DATABASE_URL` - PostgreSQL connection string (required, coerced from postgres:// or postgresql:// formats)
  - Neon pooler detection: uses NullPool if "pooler" in URL
  - Pool settings: DB_POOL_SIZE (default 5), DB_MAX_OVERFLOW (default 5), DB_DISABLE_POOL (disable pooling)
- `OPENAI_API_KEY` - OpenAI API key (required for meal plan generation)
- `OPENAI_PLAN_MODEL` - LLM model name (default: gpt-4o-mini)
- `OPENAI_REQUEST_TIMEOUT` - API request timeout in seconds (default: 120)
- `OPENAI_PLAN_MAX_TOKENS` - Max tokens for plan generation (default: 1000)
- `CLERK_JWKS_URL` - Clerk JWKS endpoint (default: https://api.clerk.com/v1/jwks)
- `CLERK_JWT_ISSUER` - Clerk issuer URL (required for token validation)
- `CLERK_AUDIENCE` - Clerk audience claim (optional, validated if set)
- `CLERK_AUTHORIZED_PARTIES` - Comma-separated list of authorized azp claims (optional)
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (optional, defaults include localhost and Heroku domains)
- `CORS_ALLOWED_ORIGIN_REGEX` - Regex pattern for dynamic CORS origin matching (optional)
- `FRONTEND_URL` - Frontend URL to add to CORS allowlist (optional)
- `ENSURE_SCHEMA_ON_STARTUP` - Auto-create database tables at startup (default: false)

**Build Configuration:**
- `Frontend/vite.config.js` - Vite bundler, React Fast Refresh, path alias `@` → `./src`
- `Frontend/tailwind.config.js` - TailwindCSS theming and component configuration
- `Frontend/package.json` - npm scripts (dev, build, lint, preview)
- `Backend/fastapi_app/requirements.txt` - Pinned Python dependencies

## Platform Requirements

**Development:**
- Node.js 20+ (frontend)
- Python 3.11+ (backend)
- PostgreSQL 14+ or compatible (Neon tested)
- OpenAI API key
- Clerk authentication setup (JWKS endpoint, issuer URL)

**Production:**
- Docker containers: `Frontend/Dockerfile` (Node 20 multi-stage), `Backend/fastapi_app/Dockerfile` (Python 3.11-slim)
- Heroku deployment: Both services containerized
  - Frontend builds with `npm ci && npm run build`, served with `serve` package
  - Backend runs Uvicorn on PORT environment variable (default 8000)
- PostgreSQL database: Neon (AWS us-east-1)
- Storage: File-based (recipes.parquet in project)
- CDN/static: Frontend served by Heroku (build artifacts in dist/)

---

*Stack analysis: 2026-01-26*
