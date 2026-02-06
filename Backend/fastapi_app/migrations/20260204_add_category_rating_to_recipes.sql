-- Migration: Add category and rating columns to recipes
-- Date: 2026-02-04

ALTER TABLE IF EXISTS recipes
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS rating numeric;
