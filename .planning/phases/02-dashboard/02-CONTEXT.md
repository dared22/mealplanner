# Phase 2: Dashboard - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Administrators can view key system metrics and health status at a glance.

</domain>

<decisions>
## Implementation Decisions

### Metrics layout & density
- Two metric cards (Users, Recipes) with a separate health status strip.
- Metric cards include a small icon alongside label/value/delta.
- Card order: Users first, then Recipes.
- Balanced card density with helper text (not ultra-minimal, not compact tiles).

### Growth change presentation
- Label growth as "Last 7 days."
- Use signed whole-number percentages (e.g., +3%, -1%).
- Use green up/red down with arrows for trend direction.
- If growth is zero or unavailable, show 0% in neutral styling.

### Health status presentation
- Health status appears as a strip below the two metric cards.
- Use a colored pill badge with status text only.
- Show a "last checked" timestamp in the strip.

### Loading and refresh states
- Show a relative "last updated" time for metrics.
- If a metric value is missing, display "N/A."

### Claude's Discretion
- Loading indicator style (skeletons vs spinners vs single loader).
- Error message placement if the metrics API fails (banner vs inline vs subtle text).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-dashboard*
*Context gathered: 2026-01-27*
