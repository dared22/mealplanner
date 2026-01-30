-- Migration: Normalize ingredient quantity/unit values inside recipes.ingredients (JSONB)
-- Date: 2026-01-30
-- Notes:
--  - Parses leading quantity + unit from original_text/name (e.g., "300gkokt skinke" -> qty 300, unit g, name "kokt skinke").
--  - Preserves existing quantity/unit if already populated.
--  - Leaves notes and other fields untouched.

-- Helper to normalize a single ingredient JSON object
CREATE OR REPLACE FUNCTION normalize_ingredient(item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    base           jsonb;
    original_text  text;
    qty_text       text;
    unit_raw       text;
    rest_name      text;
    qty_numeric    numeric;
    unit_normal    text;
    name_normal    text;
    existing_qty   jsonb;
    existing_unit  jsonb;
BEGIN
    IF item IS NULL THEN
        RETURN item;
    END IF;

    IF jsonb_typeof(item) = 'string' THEN
        base := jsonb_build_object(
            'name', item::text,
            'original_text', item::text
        );
    ELSIF jsonb_typeof(item) = 'object' THEN
        base := item;
    ELSE
        base := jsonb_build_object(
            'name', item::text,
            'original_text', item::text
        );
    END IF;

    original_text := coalesce(base ->> 'original_text', base ->> 'name', '');

    -- Capture: quantity, unit, remainder-of-name
    SELECT m[1], m[2], m[3]
      INTO qty_text, unit_raw, rest_name
      FROM regexp_matches(
               original_text,
               '^[[:space:]]*([0-9]+(?:[.,][0-9]+)?(?:/[0-9]+)?)(?:[[:space:]]*)([[:alpha:]]+)?[[:space:]]*(.*)$',
               'i'
           ) AS m
      LIMIT 1;

    -- Quantity -> numeric (supports fractions like 1/2)
    qty_numeric := NULL;
    IF qty_text IS NOT NULL THEN
        BEGIN
            IF qty_text LIKE '%/%' THEN
                qty_numeric := nullif(split_part(qty_text, '/', 1), '')::numeric
                               / nullif(split_part(qty_text, '/', 2), '')::numeric;
            ELSE
                qty_numeric := replace(qty_text, ',', '.')::numeric;
            END IF;
        EXCEPTION WHEN others THEN
            qty_numeric := NULL;
        END;
    END IF;

    -- Normalize unit
    unit_normal := NULL;
    IF unit_raw IS NOT NULL THEN
        unit_raw := lower(unit_raw);
        unit_normal := CASE
            WHEN unit_raw IN ('g', 'gr', 'gram', 'grams') THEN 'g'
            WHEN unit_raw IN ('kg') THEN 'kg'
            WHEN unit_raw IN ('mg') THEN 'mg'
            WHEN unit_raw IN ('l') THEN 'l'
            WHEN unit_raw IN ('dl') THEN 'dl'
            WHEN unit_raw IN ('cl') THEN 'cl'
            WHEN unit_raw IN ('ml') THEN 'ml'
            WHEN unit_raw IN ('ss', 'ss.', 'sp', 'spiseskje', 'tbsp') THEN 'ss'
            WHEN unit_raw IN ('ts', 'ts.', 'tsp', 'teskje') THEN 'ts'
            WHEN unit_raw IN ('stk', 'st', 'st.', 'pc', 'pcs') THEN 'stk'
            WHEN unit_raw IN ('fedd') THEN 'fedd'
            WHEN unit_raw IN ('klype') THEN 'klype'
            WHEN unit_raw IN ('bat', 'baat', 'bat.', 'baat.') THEN 'bat'
            ELSE unit_raw
        END;
    END IF;

    name_normal := coalesce(NULLIF(btrim(rest_name), ''), base ->> 'name', original_text);

    existing_qty := base -> 'quantity';
    existing_unit := base -> 'unit';

    RETURN base || jsonb_build_object(
        'name', name_normal,
        'quantity', CASE WHEN existing_qty IS NULL OR existing_qty::text IN ('null', '""', '') THEN qty_numeric ELSE existing_qty END,
        'unit', CASE WHEN existing_unit IS NULL OR existing_unit::text IN ('null', '""', '') THEN unit_normal ELSE existing_unit END,
        'original_text', original_text
    );
END;
$$;

-- Update all recipes with normalized ingredients
WITH updated AS (
    SELECT
        r.id,
        COALESCE(
            jsonb_agg(normalize_ingredient(elem)),
            '[]'::jsonb
        ) AS new_ingredients
    FROM recipes r
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(r.ingredients) = 'array' THEN r.ingredients
            ELSE '[]'::jsonb
        END
    ) AS elem
    WHERE r.ingredients IS NOT NULL
    GROUP BY r.id
)
UPDATE recipes AS r
SET ingredients = u.new_ingredients,
    updated_at = now()
FROM updated u
WHERE r.id = u.id;

-- Keep the helper around for potential future imports/maintenance
