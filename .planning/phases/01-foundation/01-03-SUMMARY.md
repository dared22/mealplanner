---
phase: 01-foundation
plan: 03
subsystem: frontend-routing
tags: [react, react-router, clerk, admin, auth-guard]
requires: [01-01, 01-02]
provides: [admin-guard, admin-routes, admin-placeholder-pages]
affects: [phase-2-dashboard, phase-3-user-management, phase-4-recipe-management, phase-5-activity-logging]
duration: 2min
completed: 2026-01-26
---

# Phase 01 Plan 03: Frontend Admin Routing + Guard Summary

Admin routes are now gated by Clerk-authenticated admin checks hitting the backend `/admin/session` endpoint. Authorized admins render the admin layout and nested pages; non-admins see the 403 Forbidden page.

## What Was Built
- **AdminGuard** (`Frontend/src/components/admin/AdminGuard.jsx`): Calls `GET /admin/session` with Clerk token, gates rendering between `AdminLayout + Outlet` vs `Forbidden`, and wires logout to Clerk `signOut` then home redirect.
- **Admin routes** (`Frontend/src/App.jsx`): Nested `/admin` routes (dashboard, users, recipes, logs) using `AdminGuard` as the parent element; `/forbidden` route exposed for direct navigation.
- **Placeholder admin pages** (`Frontend/src/Pages/AdminDashboard.jsx`, `AdminUsers.jsx`, `AdminRecipes.jsx`, `AdminLogs.jsx`): Minimal headings and copy to prove routing and layout until feature phases add real UI.

## Behavior Verified
- `/admin` hits backend session check; admins see panel, non-admins hit `Forbidden`.
- Sidebar + header render via `AdminLayout` and nested `Outlet` routes.
- Existing user-facing routes (`/planner`, `/recipes`, `/groceries`) remain unchanged.
- Vite build passes (`npx vite build --mode development`).

## Decisions
- Treat network/401 errors as forbidden in UI to avoid leaking state while keeping UX simple.
- Place admin routes before existing routes in the signed-in router to ensure correct matching under `/admin/*`.

## Files Touched
- Created: `Frontend/src/components/admin/AdminGuard.jsx`
- Created: `Frontend/src/Pages/AdminDashboard.jsx`, `AdminUsers.jsx`, `AdminRecipes.jsx`, `AdminLogs.jsx`
- Modified: `Frontend/src/App.jsx`

## Next Phase Readiness
- Admin shell is fully wired; Phase 2 can add dashboard data components inside the placeholder pages.
- Still need manual promotion of at least one user (`UPDATE users SET is_admin = TRUE WHERE email = '...';`) before testing admin access.
