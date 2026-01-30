-- Migration: Align schema with dev (users admin flags, relaxed FKs/indexes)
-- Date: 2026-01-30
-- Notes:
--  - Adds is_admin/is_active columns on users and sets username default to false (matches dev).
--  - Removes username uniqueness and preferences.user_id index (not present in dev).
--  - Makes preferences.user_id cascade on delete; drops questionnaire_answers.user_id FK entirely.

BEGIN;

-- Users: admin/active flags and username default
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.users
  ALTER COLUMN username SET DEFAULT false,
  ALTER COLUMN username SET NOT NULL;

-- Users: extra unique constraint on id (present in dev)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_id_uuid_unique'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_id_uuid_unique UNIQUE (id);
    END IF;
END$$;

-- Users: username is no longer unique in dev
DROP INDEX IF EXISTS uq_users_username;

-- Preferences: drop user_id index (dev does not have it)
DROP INDEX IF EXISTS ix_preferences_user_id;

-- Preferences: enforce ON DELETE CASCADE on user_id FK
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'preferences_user_id_fkey'
          AND conrelid = 'public.preferences'::regclass
    ) THEN
        ALTER TABLE public.preferences
            DROP CONSTRAINT preferences_user_id_fkey;
    END IF;

    ALTER TABLE public.preferences
        ADD CONSTRAINT preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON DELETE CASCADE;
END$$;

-- Questionnaire answers: drop FK to users (absent in dev)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'questionnaire_answers_user_id_fkey'
          AND conrelid = 'public.questionnaire_answers'::regclass
    ) THEN
        ALTER TABLE public.questionnaire_answers
            DROP CONSTRAINT questionnaire_answers_user_id_fkey;
    END IF;
END$$;

COMMIT;
