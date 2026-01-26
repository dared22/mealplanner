# Meal Planner - Admin Panel

## What This Is

An AI-powered meal planning web application that generates personalized weekly meal plans using ChatGPT. Users fill out a questionnaire with dietary preferences, and the backend generates meal plans that can be translated and saved for reuse. The application now needs a comprehensive admin panel to manage users, recipes, and monitor system activity.

## Core Value

Enable administrators to manage users and recipes efficiently while maintaining complete visibility into system activity and health.

## Requirements

### Validated

- ✓ User authentication via Clerk - existing
- ✓ Meal plan generation with OpenAI - existing
- ✓ Recipe database with Parquet dataset - existing
- ✓ PostgreSQL with user/preference/recipe models - existing
- ✓ Translation support (Norwegian/English) - existing
- ✓ React 19 frontend with shadcn/ui components - existing
- ✓ FastAPI backend with background tasks - existing

### Active

- [ ] Admin access control based on `is_admin` database field
- [ ] Admin dashboard with user stats, recipe stats, and system health metrics
- [ ] User management: view all users with filters
- [ ] User management: view user preferences and meal plans
- [ ] User management: suspend/ban user accounts
- [ ] Recipe database: add new recipes via form
- [ ] Recipe database: edit existing recipes
- [ ] Recipe database: delete recipes from system
- [ ] Recipe database: bulk import recipes from CSV/Parquet
- [ ] Recipe database: export recipes to CSV
- [ ] Activity logging: track admin actions (user suspensions, recipe changes)
- [ ] Activity logging: track user activity (signups, plan generations)
- [ ] Activity logging: track system events (errors, backups)
- [ ] Activity log viewer with filters and pagination
- [ ] 403 error page for non-admin access attempts
- [ ] Separate `/admin` route with dedicated layout
- [ ] Sidebar navigation matching screenshot design pattern

### Out of Scope

- Quick Actions dashboard widgets (Add Recipe button, Refresh Cache, Send Broadcast) — defer to v2
- Server traffic chart visualization — defer to v2
- Real-time activity log updates (WebSocket/SSE) — polling acceptable for v1
- Dedicated Analytics page — basic stats on dashboard sufficient for v1
- Meal Plan Logic editor — existing logic works, defer customization
- Admin user invitation system — manually set `is_admin` in database for v1
- Email notifications for admin actions — defer to v2
- Role-based permissions (super admin vs admin) — single admin role for v1

## Context

**Existing Codebase:**
- React 19 frontend with Vite, TailwindCSS, shadcn/ui components
- FastAPI backend with SQLAlchemy ORM
- PostgreSQL database hosted on Neon
- Clerk authentication already integrated
- OpenAI API for meal plan generation
- Google Translate for Norwegian translation
- Deployed on Heroku (frontend + backend containers)

**Admin Panel Design:**
- Reference screenshot shows green sidebar with navigation, stats cards, activity table
- Should adapt to existing design system (shadcn/ui components, current color scheme)
- Layout structure should match screenshot: sidebar + main content area

**Known Issues to Address:**
- No automated tests exist (recommend adding for admin features)
- googletrans library is unmaintained (acceptable for now, note in concerns)
- Frontend uses polling for plan generation status (acceptable for admin too)

**Database Schema:**
- `users` table already has `is_admin` field (boolean, default false)
- Need `activity_logs` table for admin action tracking
- Recipe model exists in DB, loaded from recipes.parquet

## Constraints

- **Tech Stack**: Must use existing React 19, FastAPI, PostgreSQL, Clerk auth
- **Design System**: Use shadcn/ui components, adapt screenshot design to existing style
- **Authentication**: Clerk JWT validation must be preserved, add is_admin check
- **Database**: PostgreSQL on Neon, use existing connection pooling setup
- **Deployment**: Must work with existing Heroku Docker setup
- **Timeline**: Prefer incremental deployment (dashboard first, then user mgmt, then recipes)
- **Testing**: No existing tests, but critical admin features should have basic coverage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate /admin route | Isolates admin UI from user-facing app, clearer access control | — Pending |
| Database field only for auth | Simpler than Clerk roles, sufficient for single admin level | — Pending |
| Skip Quick Actions in v1 | Focus on core management features first, add shortcuts later | — Pending |
| Adapt screenshot design | Maintain consistency with existing app, leverage shadcn/ui | — Pending |
| 403 error page | Clear feedback to users who shouldn't access admin area | — Pending |

---
*Last updated: 2026-01-26 after initialization*
