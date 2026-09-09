---
last_updated: 2026-09-09
---

# Deploy the recipe importer

This guide deploys the reviewed Instagram recipe-import workflow on Heroku. The
workflow runs database migrations in a release process, deploys the web and
worker process types, scales one worker, and checks the backend health endpoint.

## Configure the app

Start with the complete variable list in `.env.example`. Keep the importer
disabled while you configure and verify its provider credentials.

1. Export the secret values in your local shell. Don't commit these values.

2. Configure the required Heroku variables:

   ```bash
   heroku config:set \
     INSTAGRAM_IMPORTS_ENABLED=false \
     META_ACCESS_TOKEN="$META_ACCESS_TOKEN" \
     META_IG_USER_ID="$META_IG_USER_ID" \
     CLOUDINARY_CLOUD_NAME="$CLOUDINARY_CLOUD_NAME" \
     CLOUDINARY_API_KEY="$CLOUDINARY_API_KEY" \
     CLOUDINARY_API_SECRET="$CLOUDINARY_API_SECRET" \
     -a "$HEROKU_APP_BACKEND"
   ```

3. Optional: Configure `USDA_FDC_API_KEY` when you want USDA FoodData Central
   as a fallback for ingredients that Matvaretabellen doesn't match.

## Prepare the first migration

Alembic creates a fresh database automatically. An existing Preppr database
must be adopted once because its tables predate Alembic.

1. Create a restore point in Neon before you change the existing database.

2. Set the one-time adoption flag:

   ```bash
   heroku config:set ALEMBIC_ADOPT_EXISTING_SCHEMA=true \
     -a "$HEROKU_APP_BACKEND"
   ```

3. Deploy the current `main` branch. The release process stamps the verified
   baseline, applies the importer migration, and blocks the deployment if the
   migration fails.

4. Confirm that the workflow's **Clear one-time schema adoption flag** step
   succeeds. It removes the flag after the release completes.

> **Warning:** Don't set `ALEMBIC_ADOPT_EXISTING_SCHEMA` on a database whose
> existing tables don't match the baseline in
> `Backend/fastapi_app/alembic/versions/0001_existing_schema_baseline.py`.

## Verify and enable imports

Complete a smoke test before you enable new import jobs.

1. Confirm that the web and worker process types are running:

   ```bash
   heroku ps -a "$HEROKU_APP_BACKEND"
   ```

2. Confirm that the public health endpoint responds:

   ```bash
   curl --fail "https://${HEROKU_APP_BACKEND}.herokuapp.com/health"
   ```

3. Sign in as an administrator, open **Recipe Imports**, and verify that all
   setup checks are ready.

4. Enable imports only after every setup check passes:

   ```bash
   heroku config:set INSTAGRAM_IMPORTS_ENABLED=true \
     -a "$HEROKU_APP_BACKEND"
   ```

5. Add one permitted creator, scan a small batch, review a candidate, and
   confirm that the published recipe appears in the expected planner meal pool.

## Run locally with Docker Compose

`docker compose up` runs the migration service before it starts the API and
worker. For an existing local database that predates Alembic, create a backup
and adopt the baseline once:

```bash
ALEMBIC_ADOPT_EXISTING_SCHEMA=true docker compose run --rm migrate
docker compose up
```

Leave `ALEMBIC_ADOPT_EXISTING_SCHEMA=false` for all later starts.

## Pause imports

Turn off the feature flag to stop workers from claiming queued jobs. Existing
queued jobs remain available, and administrators can still cancel them.

```bash
heroku config:set INSTAGRAM_IMPORTS_ENABLED=false \
  -a "$HEROKU_APP_BACKEND"
```
