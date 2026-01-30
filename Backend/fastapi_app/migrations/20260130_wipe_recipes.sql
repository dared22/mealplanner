-- Migration: Remove all recipes data (full wipe before re-import)
-- Date: 2026-01-30
-- WARNING: This irreversibly deletes every row in recipes (and any dependent rows via CASCADE).

BEGIN;
TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;
COMMIT;
