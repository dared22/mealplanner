# Sprint 02 - Migrate to Neon (DB) + Clerk (Auth)

## Goal
Move the project’s database to Neon and authentication to Clerk with minimal downtime and
a clean local/dev/staging/prod configuration.

## Deliverables
- Neon project + database configured and reachable from local/dev/prod.
- Clerk project configured with frontend + backend integration.
- Backend updated to use Neon connection string and Clerk auth verification.
- Deployment env vars updated (local `.env`, Heroku/Vercel/etc).
- Migration plan for existing data (if any).

## Assumptions (verify)
- Backend is FastAPI.
- Frontend is a separate app (Vite).
- Current DB is local Postgres or SQLite.
- Deployment target is Heroku for backend.

## Architecture decisions to confirm
- Clerk auth mode: session cookies vs JWT.
- API auth strategy: middleware that validates Clerk JWT on each request.
- Nothing important to migrate.

## High-level steps
1) Inventory current auth and DB usage.
2) Create Neon project + databases.
3) Create Clerk application (frontend + backend).
4) Update backend to use Neon (connection + migrations).
5) Update frontend to use Clerk (providers + sign-in).
6) Wire backend auth validation with Clerk.
7) Update deployment config and secrets.
8) Test end-to-end.
9) Cutover.

## Database migration plan (Neon)
1) Create Neon project
   - Set region close to your users.
   - Create `dev` and `prod` branches (Neon supports branching).

2) Connection strings
   - Store connection strings in `.env` for local.
   - Add `DATABASE_URL` for dev/prod deployments.

3) Schema migration
   - If using SQLAlchemy/Alembic: generate migrations and apply to Neon.
   - If using raw SQL: run schema SQL against Neon.

4) Data migration
   - If existing data is important: export from current DB and import to Neon.
   - Validate row counts and critical tables.

5) Update application config
   - Replace local DB URL with Neon `DATABASE_URL`.
   - Ensure pooling and SSL (Neon requires SSL).

## Auth migration plan (Clerk)
1) Create Clerk application
   - Configure allowed domains and redirect URLs.

2) Frontend integration
   - Install Clerk SDK for frontend.
   - Wrap app in Clerk provider.
   - Add sign-in/sign-up routes.
   - Replace custom auth UI with Clerk components.

3) Backend integration
   - Add Clerk JWT verification to FastAPI.
   - Protect API routes via dependency/guard.
   - Map Clerk user ID to local user records (if needed).

4) Session strategy
   - If using JWT: backend verifies token from `Authorization` header.
   - If using cookies: backend verifies `__session` cookie.

## Env vars to add (example)
- `DATABASE_URL` (Neon connection string)
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER` (if using JWT verification)
- `CLERK_FRONTEND_API` or `CLERK_DOMAIN` (if required by SDK)

## Validation checklist
- App can read/write from Neon.
- Authenticated endpoints reject unauthenticated calls.
- Logged-in user can access their data.
- Local dev works with local `.env`.
- Production deployment has all required secrets.

## Risks / pitfalls
- Missing SSL settings for Neon.
- Incorrect JWT issuer or token audience.
- Frontend/Backend environments not aligned (keys/issuer mismatch).
- DB pool limits with serverless (use pooling).

## Next decisions needed
- Confirm current DB engine and migration tooling.
- Confirm deployment platform(s).
- Decide on Clerk auth flow (JWT vs cookies).

