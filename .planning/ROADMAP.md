# Roadmap: Meal Planner Admin Panel

## Overview

This roadmap delivers a comprehensive admin panel for the meal planner application. Starting with authentication and UI foundation, we build dashboard analytics, user management capabilities, recipe database operations, and finally complete observability through activity logging. Each phase delivers a coherent admin capability that can be independently verified and used.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Admin access control and UI structure
- [ ] **Phase 2: Dashboard** - Analytics and system health monitoring
- [x] **Phase 3: User Management** - User administration capabilities
- [ ] **Phase 4: Recipe Management** - Recipe database operations
- [ ] **Phase 5: Activity Logging** - System observability and audit trail

## Phase Details

### Phase 1: Foundation
**Goal**: Administrators can securely access a dedicated admin panel with navigation structure
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Admin user with is_admin=TRUE can access /admin route and see admin panel
  2. Non-admin user attempting to access /admin sees 403 error page
  3. Admin panel displays left sidebar with navigation sections (Dashboard, User Management, Recipe Database, Activity Logs)
  4. Header bar shows admin name, global search bar, and logout button
  5. Active navigation section is highlighted when selected
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Backend admin auth (is_admin field + admin dependency + /admin/session endpoint)
- [x] 01-02-PLAN.md — Frontend admin layout (sidebar, header, 403 page)
- [x] 01-03-PLAN.md — Frontend admin routing + auth guard (wires backend to frontend)

### Phase 2: Dashboard
**Goal**: Administrators can view key system metrics and health status at a glance
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard displays total active users count with week-over-week growth percentage
  2. Dashboard displays new recipes this week count with week-over-week growth percentage
  3. Dashboard displays system health status indicator (healthy/degraded/down)
  4. Dashboard stats refresh automatically when page is loaded
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Backend dashboard metrics API
- [x] 02-02-PLAN.md — Frontend dashboard metrics UI

### Phase 3: User Management
**Goal**: Administrators can view, search, and manage user accounts
**Depends on**: Phase 2
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05, USER-06
**Success Criteria** (what must be TRUE):
  1. Admin can view paginated list of all users with search and date range filters
  2. Admin can click on any user to view their full details including preferences and meal plans
  3. Admin can suspend/ban a user account and suspended users cannot log in
  4. User list shows user status (active/suspended) and basic info (name, email, signup date)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Backend user management APIs + suspension enforcement
- [x] 03-02-PLAN.md — Admin user list UI with filters and pagination
- [x] 03-03-PLAN.md — Admin user detail view + suspend/activate controls

### Phase 4: Recipe Management
**Goal**: Administrators can manage the recipe database through CRUD operations
**Depends on**: Phase 3
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04, RECIPE-05, RECIPE-06, RECIPE-07
**Success Criteria** (what must be TRUE):
  1. Admin can view paginated list of all recipes with search by name or tags
  2. Admin can add new recipe via form with all required fields (name, ingredients, instructions, nutrition, tags, meal type)
  3. Admin can edit existing recipe and changes are saved to database
  4. Admin can delete recipe with confirmation dialog and deleted recipes no longer appear in meal plan generation
  5. Admin can bulk import recipes from CSV or Parquet file
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Admin recipe list/detail + create/update API
- [x] 04-02-PLAN.md — Recipe delete + active-only filtering
- [x] 04-03-PLAN.md — Bulk import API (CSV/Parquet)
- [x] 04-04-PLAN.md — Admin recipe list UI with delete
- [x] 04-05-PLAN.md — Admin recipe editor + bulk import UI

### Phase 5: Activity Logging
**Goal**: Administrators can monitor and audit all system activity
**Depends on**: Phase 4
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08
**Success Criteria** (what must be TRUE):
  1. System automatically logs admin actions (user suspensions, recipe changes) with timestamp and administrator name
  2. System automatically logs user activity (signups, plan generations) and errors
  3. Admin can view paginated activity log table with filters for date range, action type, and status
  4. Activity log displays timestamp, action description, user/admin identifier, and status (success/warning/error/critical)
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Activity log model + baseline event logging
- [x] 05-02-PLAN.md — Admin activity logs API with filters
- [x] 05-03-PLAN.md — Activity Logs admin UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Done | 2026-01-26 |
| 2. Dashboard | 2/2 | Done | 2026-01-26 |
| 3. User Management | 3/3 | Done | 2026-01-27 |
| 4. Recipe Management | 5/5 | Done | 2026-01-27 |
| 5. Activity Logging | 3/3 | Done | 2026-01-27 |
