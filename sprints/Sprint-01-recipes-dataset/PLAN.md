# Sprint 01 - Recipes Dataset Build Plan

## Goal
Build a legally sourced, scalable recipes table suitable for future recommendation models.

## Deliverables
- A repeatable ingestion pipeline that produces `recipes.parquet` in the current schema.
- A documented list of approved sources and ingestion methods.
- Data quality checks (schema, duplicates, nutrition fields, tag consistency).

## Scope
- Expand coverage of breakfast, lunch, vegan/vegetarian, and higher price tiers.
- Add variety in cuisines and meal types using consistent tags.
- Keep data structure compatible with current app (no breaking schema changes).

## Data model (current schema)
Fields to include:
- `source` (str)
- `url` (str)
- `name` (str)
- `ingredients` (list[str])
- `instructions` (list[str])
- `nutrition` (dict: `calories_kcal`, `carbs_g`, `fat_g`, `protein_g`)
- `images` (list[str])
- `tags` (list[str])
- `local_images` (list[str])
- `type` (str: `familien` | `rask` | `sunn` | `kos` | `gjester`)
- `price_tier` (str: `cheap` | `medium` | `expensive`)
- `url_norm` (str)
- `is_breakfast` (bool)
- `is_lunch` (bool)

If we need extra fields for recommendation later (prep time, servings, cuisine, difficulty),
we can add them in a compatible, optional way and default them for older rows.

## Source strategy (where to scrape / obtain data)
Only use sources with explicit permission or open licenses. Options:

1) Open datasets (best for volume)
   - Open recipe datasets with clear licenses (e.g., open data portals or datasets that allow reuse).
   - Validate license terms and store license metadata alongside each source.

2) First-party content (best for long-term safety)
   - Manually curated recipes.
   - User-submitted recipes with a clear consent/licensing checkbox.

3) Partner sources (best for quality + legality)
   - Partner agreements with publishers or blogs.
   - Use their provided feeds/APIs if available.

Do NOT scrape sites that prohibit automated use in their terms/robots.txt. Keep proof of permission.

## What to collect
For each recipe, capture:
- Name, ingredients, instructions
- Nutrition (if missing, estimate later using ingredient mapping)
- Tags: meal type, dietary (vegan/vegetarian/gluten-free/lactose-free), cuisine, method
- Price tier (estimate from ingredient cost buckets)
- Meal flags (breakfast/lunch)

## Ingestion pipeline (high-level)
1) Source selection and approval
   - Create a `sources.yml` with name, base URL, license, and allowed usage.

2) Extraction
   - For each source: build a scraper or importer.
   - Respect robots.txt, rate limits, and caching.

3) Parsing & normalization
   - Normalize ingredient units, separators, and formatting.
   - Split instructions into clean step lists.
   - Normalize URLs (`url_norm`).

4) Enrichment
   - Add tags and meal flags using rule-based heuristics.
   - Estimate `price_tier` from ingredient lists.
   - Fill missing nutrition via ingredient mapping or external nutrition sources.

5) Deduplication
   - Normalize recipe names.
   - Hash ingredients + instructions for near-duplicate detection.

6) Validation
   - Schema checks (types, required fields).
   - Missing-field audits.
   - Tag distribution checks (avoid skew).

7) Export
   - Write parquet with stable schema.
   - Keep versioned datasets (e.g., `recipes_YYYYMMDD.parquet`).

## Tagging rules (initial)
- `is_breakfast`: true if tags include Frokost or if name matches breakfast heuristics.
- `is_lunch`: true if tags include Lunsj/Smørbrød/Salat/Wrap or similar.
- `type` mapping:
  - `rask`: quick meals (short instruction length / low prep time)
  - `sunn`: low calorie or veggie-heavy
  - `kos`: desserts, sweets, indulgent
  - `familien`: family-friendly main meals
  - `gjester`: higher effort or premium ingredients

## Quality targets
- Breakfast: at least 300 recipes
- Lunch: at least 300 recipes
- Vegan: 200+
- Vegetarian: 400+
- `price_tier` more balanced (at least 10% medium, 5% expensive)

## Risks / constraints
- Licensing and content usage must be verified.
- Nutrition estimation requires consistent ingredient parsing.
- Over-tagging or weak tags reduce recommendation quality.

## Next decisions needed
- Which specific sources are allowed (per license/permission)?
- Preferred cuisines or regional focus?
- Acceptable automation level vs. manual curation?

