# Phase 7: Constraint Solver Engine - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate personalized weekly meal plans using constraint optimization that respects user ratings (likes/dislikes), macro nutritional targets, and dietary restrictions. This replaces OpenAI generation for users with 10+ ratings. Plan generation must complete in under 15 seconds with automatic fallback to OpenAI if solver fails.

</domain>

<decisions>
## Implementation Decisions

### Constraint priority & trade-offs
- **Hard constraint:** Dietary restrictions (vegan, gluten-free, etc.) are NEVER violated
- **Secondary priority:** Flexible balance between macro targets and user preferences
  - Macro tolerance: ±10% (calories, protein, carbs, fat)
  - Preference target: 70%+ of meals should be from liked recipes
  - Willing to bend either constraint to satisfy the other within these ranges
- **Variety vs favorites:** Mixed approach
  - Allow maximum 1 repeat per week within same plan
  - Spread favorite recipes across different weeks
  - Rotate through liked recipe pool rather than over-indexing on top favorites

### Solver behavior & user feedback
- **Progress feedback:** Show stage-based progress during generation
  - Stages: "Finding recipes...", "Optimizing nutrition...", "Finalizing plan..."
  - NOT percentage-based, NOT silent spinner
- **Timeout UX:** If generation approaches 15 seconds (>10 seconds elapsed):
  - Show extended message: "This is taking longer than usual, almost done..."
  - Reassure user without offering skip option
- **Explainability:** Claude's discretion
  - Determine if/how to show why meals were chosen
  - May include per-meal explanations or overall summary if feasible
- **Plan attribution:** Claude's discretion
  - Determine whether to show "Personalized Plan" vs "AI-Generated" indicators
  - User may or may not need to know which generation method was used

### Fallback & failure handling
- **Fallback triggers:** Both time-based AND quality-based
  - Time: If solver doesn't complete in 15 seconds
  - Quality: If solver result has macros >±20% off target OR <50% liked recipes
- **Fallback transparency:** Silent to user, logged for admin
  - Don't notify user when fallback occurs
  - Seamlessly use OpenAI plan instead
  - Log fallback event in activity logs for monitoring
- **Impossible constraints:** Return error message to user
  - Example: 1500 cal/day + vegan + 200g protein is mathematically impossible
  - Show: "Your goals may be incompatible. Please adjust preferences or targets."
  - Do NOT generate a plan, do NOT fall back to OpenAI
  - User must modify their constraints

### Recipe selection logic
- **Scoring approach:** Binary (liked vs neutral)
  - All liked recipes treated equally
  - No weighting by rating frequency or recency
  - Simple: prefer liked over neutral
- **Historical avoidance:** Avoid last week's meals
  - Track previous week's plan (if exists)
  - Don't repeat any recipe from last week
  - Only 1-week lookback, not longer history
- **Insufficient liked recipes:** Mixed strategy
  - Allow 1 repeat within the week if needed
  - Fill remaining slots with neutral (unrated) recipes
  - Maintain 70%+ liked target when possible
- **Budget and cooking time:** Soft preference
  - Prefer recipes matching user's budget tier and cooking time preference
  - Willing to bend these if needed to meet macros or variety goals
  - Not hard constraints, just nice-to-haves

### Claude's Discretion
- Exact solver algorithm choice (constraint programming library, optimization approach)
- Explainability features (whether to show per-meal reasoning)
- Plan attribution indicators (whether to distinguish solver vs OpenAI plans)
- Progress estimation accuracy (how to map solver stages to UI feedback)
- Neutral recipe selection criteria when filling gaps

</decisions>

<specifics>
## Specific Ideas

- User experience priority: Plan generation should feel fast and reliable
- Tolerance philosophy: Better to have moderate flexibility on both macros and preferences than to be rigid on one
- Error handling principle: Surface truly impossible scenarios to user rather than silently degrading quality
- Transparency approach: Log backend details for admin monitoring, keep user-facing UX simple

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-constraint-solver-engine*
*Context gathered: 2026-02-02*
