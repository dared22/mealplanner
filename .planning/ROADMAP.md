# Roadmap: Meal Planner

## Milestones

- ✅ **v1.0 Admin Panel** - Phases 1-5 (shipped 2026-01-31)
- 🚧 **v1.1 Personalized Recommendations** - Phases 6-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 Admin Panel (Phases 1-5) - SHIPPED 2026-01-31</summary>

### Phase 1: Foundation
**Goal**: Administrators can securely access a dedicated admin panel with navigation structure
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

</details>

### 🚧 v1.1 Personalized Recommendations (In Progress)

**Milestone Goal:** Enable users to rate meals and receive personalized meal plan recommendations based on their preferences and feedback.

#### Phase 6: Rating Infrastructure
**Goal**: Users can rate meals and system tracks their preferences
**Depends on**: Phase 5
**Requirements**: RATE-01, RATE-02, RATE-03, RATE-04, RATE-05, RATE-06, HIST-01, HIST-02, HIST-03, HIST-04, DATA-01, DATA-04, PERF-01
**Success Criteria** (what must be TRUE):
  1. User can like or dislike any meal in their weekly plan
  2. User can change their rating (like to dislike or vice versa)
  3. User can see how many ratings they've made toward unlocking personalized plans
  4. System tracks which recipes appeared in which plans and when
  5. Ratings persist across sessions and devices
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Backend rating infrastructure (Rating + PlanRecipe models, rating API endpoints, plan history)
- [ ] 06-02-PLAN.md — Frontend rating UI (like/dislike buttons, progress indicator, useRatings hook)

#### Phase 7: Constraint Solver Engine
**Goal**: System generates personalized meal plans using constraint optimization
**Depends on**: Phase 6
**Requirements**: SOLVER-01, SOLVER-02, SOLVER-03, SOLVER-04, SOLVER-05, SOLVER-06, SOLVER-07, SOLVER-08, SOLVER-09, SOLVER-10, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Users with 10+ ratings receive solver-generated plans instead of OpenAI plans
  2. Generated plans respect user ratings (prefer liked recipes, avoid disliked ones)
  3. Generated plans meet macro targets within acceptable tolerance
  4. Generated plans respect dietary restrictions (vegan, gluten-free, etc.)
  5. No duplicate meals appear in same weekly plan
  6. Plan generation completes in under 15 seconds (including fallback if needed)
  7. If solver cannot find solution, system automatically falls back to OpenAI
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Constraint solver core (PuLP-based optimization module)
- [x] 07-02-PLAN.md — Solver integration (hybrid routing, fallback logic, activity logging)
- [x] 07-03-PLAN.md — Frontend progress feedback (stage-based UI during generation)

#### Phase 8: Personalization UI
**Goal**: Users can understand and control their personalized recommendations
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, DATA-02, DATA-03, PERF-02
**Success Criteria** (what must be TRUE):
  1. User can swap individual meals with alternatives matching same meal type and restrictions
  2. Swap interface loads 3-5 alternatives in under 2 seconds
  3. User can view their past meal plans
  4. User can see why a meal was recommended (e.g., "You liked 5 Italian pasta dishes")
  5. Plan view indicates whether plan was AI-generated or personalized by solver
  6. Rating changes appear in next plan generation
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-01-26 |
| 2. Dashboard | v1.0 | 2/2 | Complete | 2026-01-26 |
| 3. User Management | v1.0 | 3/3 | Complete | 2026-01-27 |
| 4. Recipe Management | v1.0 | 5/5 | Complete | 2026-01-27 |
| 5. Activity Logging | v1.0 | 3/3 | Complete | 2026-01-27 |
| 6. Rating Infrastructure | v1.1 | 0/2 | Not started | - |
| 7. Constraint Solver Engine | v1.1 | 3/3 | Complete | 2026-02-02 |
| 8. Personalization UI | v1.1 | 0/2 | Not started | - |
