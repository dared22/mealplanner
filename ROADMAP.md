# Preppr — Roadmap & Status Map

Snapshot of what's built, what needs refinement, and what's still to build,
mapped against the product iterations in [vision.md](vision.md). Companion to
[PRODUCT.md](PRODUCT.md) (brand/UX) and [planner_logic.md](planner_logic.md)
(planner internals). Last audited: 2026-06-09.

The product is deliberately scoped to **one person** right now. Family /
multi-person scaling is a later iteration, not a current gap.

Legend: ✅ done · 🔧 needs refinement · 🏗 build from scratch · ⚠ decision needed

---

## Iteration map

- **Iteration 1 — One-person weekly planner (foundation).** *Largely built.*
  Questionnaire → goal-fit one-person plan, calorie/protein targeting, meal-prep
  orientation (batch portions + carry-forward leftovers), ratings, swaps, plan
  history. A **basic consolidated shopping list** is in scope for this iteration
  and is **not built yet** (see Priority gaps).
- **Iteration 2 — Norwegian deal-driven shopping.** *Not started — top priority.*
  Live weekly offers from **Kiwi, Rema 1000, Extra, and Meny**, meal selection
  weighted toward what's on sale, and a real shopping list with an **estimated
  basket cost**. The core differentiator and the biggest gap between vision and
  reality.
- **Iteration 3 — Personalized recommendations.** *Partially present:*
  ratings-driven optimization + similarity-based swaps exist; a true "recommends
  new recipes you'll like" discovery engine does not.
- **Later — Household / multi-person scaling.** Portions, cost, and shopping for
  more than one eater. Deliberately deferred until the solo wedge is solid.

## Priority gaps (highest leverage first)

1. **Full macro fit for new-user plans** — the random DB path bands daily
   calories (±15%) but does not constrain protein/carbs/fat; only the solver
   enforces full macros. Goal-fit (especially protein) is the core promise, so
   this is the most important correctness gap. (🔧 #1.)
2. **Budget enforcement** — now a relaxable hard filter in the random path
   (dropped first when constraints can't all be met) over a coarse static
   `cost_category` tier, not real prices. A headline reason people use Preppr,
   so it needs to bite harder. (🔧 #2.)
3. **Consolidated one-person shopping list** — "shop once" is core; nothing
   generates a list yet and `/groceries` is a placeholder. (🏗 #2.)
4. **Live Norwegian deal integration (Kiwi / Rema 1000 / Extra / Meny)** — the
   Iteration 2 differentiator; budget today is a static tier, not real prices.
   (🏗 #1.)
5. **Mobile-first web UX** — the primary users (students, gym-goers) live on a
   phone. The layout is responsive, but mobile should be the design target, not
   desktop-with-breakpoints. Audit and harden. (🔧 #10.)

---

## ✅ Done

The backend is substantially more complete than early docs implied.

**Generation**
- Two-track plan generation gated by rating count (`_should_use_solver`, ≥10 ratings):
  - Random DB recipe selection for new users with a constraint relaxation ladder (allergy/cuisine/budget/cooking time, ±15% calorie band) — [planner.py](Backend/fastapi_app/planner.py).
  - PuLP Integer-LP constraint solver for engaged users ([solver.py](Backend/fastapi_app/solver.py)).
  - Fallback chain: solver → random DB path → partial → error.
- OpenAI-derived daily calorie/macro targets (protein-first goals).
- Impossible-constraint guard (e.g. vegan + very high protein) before any API spend.
- Carry-forward leftovers, per-serving ingredient scaling, last-week variety avoidance (`plan_recipes`) — the meal-prep backbone for a single eater.

**Product surface**
- Ratings (like/dislike) + progress (`POST /ratings`, `/ratings/me`, `/ratings/progress`).
- Recipe browser ([Recipes.jsx](Frontend/src/Pages/Recipes.jsx)) — built, not a placeholder.
- Meal swap via `/recipes/alternatives/{id}` (content similarity, respects diet, excludes disliked).
- Plan history (`/plans/history`).
- Multi-step questionnaire + results view ([MealPlanner.jsx](Frontend/src/Pages/MealPlanner.jsx), [ResultsStep.jsx](Frontend/src/components/questionnaire/ResultsStep.jsx)).
- i18n (English + Norwegian) with background translation.
- Full admin suite: dashboard metrics, user management, recipe CRUD + CSV/parquet import, activity logs.
- Clerk auth, Docker + Heroku deploy.

**Cleanup (done 2026-06-03)**
- Removed dead legacy `Backend/server.js` (standalone Express OpenAI proxy, superseded by FastAPI) plus its `package.json`, `package-lock.json`, and `node_modules/`.

This roughly covers **Iteration 1** (one-person weekly planner) and a meaningful slice of **Iteration 3** (ratings-driven personalization).

---

## 🔧 Needs refinement

Built, but with known gaps. Most are catalogued in [planner_logic.md](planner_logic.md) ("Remaining Issues").

| # | Item | Impact | Priority |
|---|------|--------|----------|
| 1 | **Macro drift for new users** — the random DB path bands daily calories (±15%) but does not constrain protein/carbs/fat; only the solver enforces full macros. | Vision promises goal-fit plans; new-user plans only fit calories. | High |
| 2 | **Coarse budget enforcement** — budget is a relaxable hard filter in the random path and a soft filter in the solver, over a static two-tier `cost_category` (cheap / medium-expensive), not real prices. | Budget is a headline vision pillar but only coarsely enforced. | High |
| 3 | **Translation reliability** — `googletrans` is unofficial, flaky, uncached. | Norwegian is the primary market. | Medium |
| 4 | **Solver tuning** — O(n) DataFrame lookups per LP variable; 50%-liked quality threshold too strict near the 10-rating boundary (users never benefit from the solver). | Perf + personalization. | Medium |
| 5 | **Variety is name-based** — misses semantic duplicates. | Repetitive-feeling plans. | Low |
| 6 | **Snack aggregation drops recipe IDs** — snacks aren't deduped next week. | Repeats. | Low |
| 7 | **Generation latency** — the old 14–35s per-day AI latency is gone (new-user plans are now pure in-memory DB selection over one pool query); the solver still runs a ~10s LP for engaged users. | Latency. | Low |
| 8 | **Code health** — `main.py` (3.4k lines) monolith; `ResultsStep.jsx` (1.3k lines); no frontend test runner wired despite `*.test.js` files. | Maintainability. | Low |
| 9 | **Broken CI migration step** — `.github/workflows/cd-heroku.yml` runs `alembic upgrade head`, but there is no Alembic config anywhere; schema is really raw SQL in `migrations/`. | Deploy step fails / misleads. | Medium |
| 10 | **Mobile-first web UX** — primary users are on phones; the layout is responsive but designed desktop-first. Mobile needs to be the target, audited and hardened. | Core users use it on mobile. | Medium |

---

## 🏗 Build from scratch

Ordered by vision alignment.

1. **Live Norwegian deal integration (Kiwi / Rema 1000 / Extra / Meny)** — *Iteration 2, the core differentiator.* Not started. Budget today is a static `cost_category` tier, not this week's actual sale prices at real stores. Biggest gap between vision and reality.
2. **Consolidated one-person shopping list + real `/groceries` page** — *core to "shop once".* No shopping list is generated anywhere; `/groceries` is a placeholder. (The removed `server.js` once produced one — logic gone, needs rebuilding inside FastAPI / plan output.) Pairs with #1 to surface an estimated basket cost.
3. **True recommendation / discovery engine** — *Iteration 3.* What exists is preference-weighted optimization + similarity-based swaps, not a "recommends new recipes you'll like" discovery feed. The `pgvector` `embedding` column exists but is **never queried** — dormant infrastructure ready to activate for semantic recs.
4. **TODO.md features** — pin/save favorite recipes, custom calorie override, the "receipt idea" (receipt scanning?), new Stitch-based UI.
5. **Later — household / multi-person scaling** — per-serving scaling exists at the recipe level, but there is no household *profile* (portions, cost, and shopping for more than one eater). Deliberately deferred until the solo wedge is solid. Other future bets: macro/progress tracking over time, pantry awareness, and multi-region deal sources beyond the initial Norwegian chains.

---

## ⚠ Decisions needed

Candidates I did **not** touch — they need your call before removal/change:

- **CI `alembic upgrade head` step** — remove it, or actually adopt Alembic? (Editing the deploy pipeline is yours to approve.)
- **`users.password_hash` column** — legacy/unused with Clerk. Dropping a column is a destructive migration.
- **`recipes.embedding` (pgvector)** — keep as future-feature scaffolding (recommended) or drop until needed?
- **`clerk_users.json` (repo root)** — looks like a one-off export/seed; confirm before deleting.
