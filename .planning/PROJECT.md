# Meal Planner

## What This Is

An AI-powered meal planning web application that generates personalized weekly meal plans. Users fill out a questionnaire with dietary preferences, and the system generates meal plans optimized for their nutrition goals. The app includes a comprehensive admin panel for managing users, recipes, and monitoring system activity.

## Core Value

Deliver personalized meal plans that users actually want to cook and eat, while hitting their nutritional targets.

## Current Milestone: v1.1 Personalized Recommendations

**Goal:** Enable users to rate meals and receive personalized meal plan recommendations based on their preferences and feedback.

**Target features:**
- Like/dislike rating system for meals
- User preference learning (track ratings per recipe)
- Custom constraint solver for personalized meal plan generation
- Hybrid approach: OpenAI for new users (<10 ratings), solver for experienced users (10+ ratings)
- Variety optimization: no weekly repeats, avoid recent meals, encourage diversity
- Optional explainability tooltips showing why meals were recommended
- Seamless fallback to OpenAI if solver cannot find valid solution

## Requirements

### Validated

**Core App (pre-v1.0):**
- ✓ User authentication via Clerk
- ✓ Meal plan generation with OpenAI
- ✓ Recipe database with Parquet dataset
- ✓ PostgreSQL with user/preference/recipe models
- ✓ Translation support (Norwegian/English)
- ✓ React 19 frontend with shadcn/ui components
- ✓ FastAPI backend with background tasks

**Admin Panel (v1.0):**
- ✓ Admin access control based on `is_admin` field
- ✓ 403 error page for non-admin access attempts
- ✓ Separate `/admin` route with dedicated layout and navigation
- ✓ Sidebar navigation with Dashboard, User Management, Recipe Database, Activity Logs
- ✓ Dashboard metrics API and UI (users, recipes, system health)
- ✓ User management: view, search, filter users
- ✓ User management: view user details (preferences, meal plans)
- ✓ User management: suspend/ban user accounts
- ✓ Recipe database: view, search, filter recipes
- ✓ Recipe database: add new recipes via form
- ✓ Recipe database: edit existing recipes
- ✓ Recipe database: delete recipes from system
- ✓ Recipe database: bulk import recipes from CSV/Parquet
- ✓ Activity logging: track admin actions, user activity, system events
- ✓ Activity log viewer with filters and pagination

### Active

- [ ] Meal rating system: like/dislike buttons on meals in weekly plan
- [ ] Rating storage: track user ratings per recipe in database
- [ ] Meal plan history: track which recipes were in which plans, when generated
- [ ] Custom constraint solver: Python optimization library for plan generation
- [ ] Solver logic: optimize for user ratings + macros + variety + dietary restrictions
- [ ] Hybrid generation: <10 ratings → OpenAI, 10+ ratings → Solver
- [ ] Variety constraints: no weekly repeats + avoid recent meals (2-3 weeks) + diversity bonus
- [ ] Explainability: optional tooltip showing why meal was recommended
- [ ] Fallback handling: seamlessly use OpenAI if solver cannot find valid solution

### Out of Scope

- Ingredient waste optimization (package sizes, portion tracking) — defer to v1.2+
- Collaborative filtering (learning from other users) — defer to v1.2+
- "Mark as cooked/eaten" tracking — defer to v1.2+
- Recipe export to CSV — defer to future admin updates
- Quick Actions dashboard widgets — defer to future admin updates
- Real-time activity log updates (WebSocket/SSE) — defer to future admin updates
- Dedicated Analytics page — defer to future admin updates
- Email notifications for admin actions — defer to future admin updates

## Context

**Existing Codebase:**
- React 19 frontend with Vite, TailwindCSS, shadcn/ui components
- FastAPI backend with SQLAlchemy ORM
- PostgreSQL database hosted on Neon
- Clerk authentication already integrated
- OpenAI API for meal plan generation
- Google Translate for Norwegian translation
- Deployed on Heroku (frontend + backend containers)
- Full admin panel (v1.0) for user/recipe management and activity logging

**Current Meal Plan Generation:**
- User fills questionnaire (age, gender, goals, dietary restrictions, cuisines)
- Backend calls OpenAI API with user preferences
- OpenAI generates daily macro targets and meal suggestions
- Backend matches suggestions to recipe database
- Plan stored in `Preference.raw_data["generated_plan"]`
- Frontend polls `/preferences/{id}` for plan status

**Recommendation System Requirements:**
- Need to track user ratings (like/dislike per recipe)
- Need to track meal plan history (which recipes in which plans)
- Constraint solver must optimize: ratings + macros + variety + restrictions
- Solver must run in <10 seconds for acceptable UX
- Fallback to OpenAI must be seamless (user shouldn't notice)

**Database Schema:**
- `users` table: id, clerk_user_id, email, created_at, is_admin
- `preferences` table: id, user_id, age, gender, nutrition_goal, raw_data (JSONB)
- `recipes` table: id, name, ingredients, instructions, nutrition, tags, is_breakfast, is_lunch, is_active
- `activity_logs` table: id, timestamp, action, actor_id, status
- Need new tables: `meal_ratings`, `meal_plan_history`

**Known Issues:**
- No automated tests exist (critical for recommendation algorithm)
- Recipe database lacks portion/yield data (needed for future ingredient optimization)
- Current meal plan only shows recipes, not amounts/portions

## Constraints

- **Tech Stack**: Must use existing React 19, FastAPI, PostgreSQL, Clerk auth
- **Design System**: Use shadcn/ui components, consistent with existing UI
- **Authentication**: Clerk JWT validation must be preserved
- **Database**: PostgreSQL on Neon, use existing connection pooling setup
- **Deployment**: Must work with existing Heroku Docker setup
- **Performance**: Constraint solver must generate plans in <10 seconds
- **Python Libraries**: Use PuLP, OR-Tools, or scipy.optimize for constraint solving
- **Backward Compatibility**: OpenAI generation must continue to work for new users
- **Testing**: Add tests for recommendation algorithm (critical business logic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate /admin route | Isolates admin UI from user-facing app, clearer access control | Implemented in 01-03 |
| Database field only for auth | Simpler than Clerk roles, sufficient for single admin level | Implemented in 01-01 |
| Skip Quick Actions in v1 | Focus on core management features first, add shortcuts later | Pending (revisit in dashboard phase) |
| Adapt screenshot design | Maintain consistency with existing app, leverage shadcn/ui | Implemented in 01-02 layout |
| 403 error page | Clear feedback to users who shouldn't access admin area | Implemented in 01-02 |
| Use User.created_at for weekly growth | Only timestamp available to approximate active users | Implemented in 02-01 |
| Recipe weekly growth placeholder | Recipes lack timestamps; weekly deltas fixed at 0 until schema adds created_at | Implemented in 02-01 |
| Health status based on DB query | Most critical dependency; avoid external checks for now | Implemented in 02-01 |

---
*Last updated: 2026-01-31 after milestone v1.1 started*
