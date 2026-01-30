# Requirements: Meal Planner Admin Panel

**Defined:** 2026-01-26
**Core Value:** Enable administrators to manage users and recipes efficiently while maintaining complete visibility into system activity and health.

## v1 Requirements

### Authentication & Access Control

- [ ] **AUTH-01**: Admin can access /admin route only if is_admin = TRUE in database
- [ ] **AUTH-02**: Non-admin users see 403 error page when accessing /admin
- [ ] **AUTH-03**: Admin authentication uses existing Clerk JWT + is_admin check
- [ ] **AUTH-04**: Backend /admin/* endpoints verify is_admin before processing

### Dashboard & Analytics

- [ ] **DASH-01**: Dashboard shows total active users count with growth percentage
- [ ] **DASH-02**: Dashboard shows new recipes this week count with growth percentage
- [ ] **DASH-03**: Dashboard shows system health status (healthy/degraded/down)
- [ ] **DASH-04**: Dashboard refreshes stats on page load

### User Management

- [x] **USER-01**: Admin can view paginated list of all users
- [x] **USER-02**: Admin can search users by name or email
- [x] **USER-03**: Admin can filter users by signup date range
- [x] **USER-04**: Admin can click user to view full details (preferences, meal plans)
- [x] **USER-05**: Admin can suspend/ban user accounts (toggle active status)
- [x] **USER-06**: Suspended users cannot log in or access the application

### Recipe Management

- [x] **RECIPE-01**: Admin can view paginated list of all recipes
- [x] **RECIPE-02**: Admin can search recipes by name or tags
- [x] **RECIPE-03**: Admin can add new recipe with form (name, ingredients, instructions, nutrition, tags, meal type)
- [x] **RECIPE-04**: Admin can edit existing recipe fields
- [x] **RECIPE-05**: Admin can delete recipe with confirmation dialog
- [x] **RECIPE-06**: Admin can bulk import recipes from CSV/Parquet file
- [x] **RECIPE-07**: Deleted recipes are removed from future meal plan generation

### Activity Logging

- [x] **LOG-01**: System logs admin actions (user suspension, recipe add/edit/delete)
- [x] **LOG-02**: System logs user activity (signups, plan generations, errors)
- [x] **LOG-03**: System logs system events (API failures, database errors)
- [x] **LOG-04**: Admin can view paginated activity log table
- [x] **LOG-05**: Admin can filter logs by date range
- [x] **LOG-06**: Admin can filter logs by action type (admin/user/system)
- [x] **LOG-07**: Admin can filter logs by status (success/warning/error/critical)
- [x] **LOG-08**: Activity log shows timestamp, action, administrator/user, status

### User Interface & Navigation

- [ ] **UI-01**: Admin panel has left sidebar with navigation (Dashboard, User Management, Recipe Database, Activity Logs)
- [ ] **UI-02**: Admin panel has header bar showing admin name and logout button
- [ ] **UI-03**: Header includes global search bar for users, recipes, logs
- [ ] **UI-04**: UI matches screenshot layout structure (sidebar + main content area)
- [ ] **UI-05**: UI uses existing shadcn/ui components and design tokens
- [ ] **UI-06**: Navigation highlights active section

## v2 Requirements

### Quick Actions & Shortcuts

- **QA-01**: Dashboard has "Add New Recipe" quick action button
- **QA-02**: Dashboard has "Export CSV" quick action for bulk data export
- **QA-03**: Dashboard has "Refresh Cache" quick action (if caching implemented)
- **QA-04**: Dashboard has "Send Broadcast" notification feature

### Advanced Analytics

- **ANALYTICS-01**: Dedicated Analytics page with charts and graphs
- **ANALYTICS-02**: Server traffic chart showing requests over time
- **ANALYTICS-03**: Meal plan success rate tracking
- **ANALYTICS-04**: Popular recipes report
- **ANALYTICS-05**: User retention metrics

### Enhanced Features

- **ENH-01**: Real-time activity log updates (WebSocket/SSE)
- **ENH-02**: Admin user invitation system via email
- **ENH-03**: Role-based permissions (super admin vs regular admin)
- **ENH-04**: Meal Plan Logic editor for customizing generation algorithm
- **ENH-05**: Email notifications for critical admin actions
- **ENH-06**: Bulk user operations (bulk suspend, bulk delete)
- **ENH-07**: Recipe version history and rollback
- **ENH-08**: Export activity logs to CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile admin app | Web-first, mobile browser sufficient |
| Custom chart library | Use existing visualization or defer to v2 |
| Advanced role permissions | Single admin level sufficient for v1 |
| Recipe recommendations AI | Focus on management, not generation improvements |
| User impersonation | Security risk, not needed for debugging |
| Scheduled reports | Manual export sufficient for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| DASH-03 | Phase 2 | Pending |
| DASH-04 | Phase 2 | Pending |
| USER-01 | Phase 3 | Complete |
| USER-02 | Phase 3 | Complete |
| USER-03 | Phase 3 | Complete |
| USER-04 | Phase 3 | Complete |
| USER-05 | Phase 3 | Complete |
| USER-06 | Phase 3 | Complete |
| RECIPE-01 | Phase 4 | Complete |
| RECIPE-02 | Phase 4 | Complete |
| RECIPE-03 | Phase 4 | Complete |
| RECIPE-04 | Phase 4 | Complete |
| RECIPE-05 | Phase 4 | Complete |
| RECIPE-06 | Phase 4 | Complete |
| RECIPE-07 | Phase 4 | Complete |
| LOG-01 | Phase 5 | Complete |
| LOG-02 | Phase 5 | Complete |
| LOG-03 | Phase 5 | Complete |
| LOG-04 | Phase 5 | Complete |
| LOG-05 | Phase 5 | Complete |
| LOG-06 | Phase 5 | Complete |
| LOG-07 | Phase 5 | Complete |
| LOG-08 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35/35
- Unmapped: 0

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-26 after roadmap creation*
