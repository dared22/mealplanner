---
target: Meal Planner questionnaire + results
total_score: 30
p0_count: 0
p1_count: 3
timestamp: 2026-06-02T16-25-53Z
slug: src-pages-mealplanner-jsx
---
# Critique: Meal Planner questionnaire + results (`src/Pages/MealPlanner.jsx`)

Register: product. Context: no PRODUCT.md/DESIGN.md (inferred from CLAUDE.md).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Loading state is excellent (arc %, stage label, tips, notify-me); % is simulated, not real |
| 2 | Match System / Real World | 3 | P/C/F macro abbreviations in meal meta; otherwise plain, domain-fluent |
| 3 | User Control and Freedom | 3 | Back/cancel everywhere, but step dots are non-interactive (can't jump to a prior step) |
| 4 | Consistency and Standards | 3 | text-white vs token, "serif" naming with no serif, two swap behaviors, dead ProgressBar |
| 5 | Error Prevention | 3 | Good input constraints/validation; destructive resets have no confirm |
| 6 | Recognition Rather Than Recall | 3 | Icon-only meal actions rely on title only; onboarding shows no "Step X of Y" text |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; strictly linear wizard; can't edit one answer without full retake |
| 8 | Aesthetic and Minimalist Design | 3 | Clean overall; results page is card-heavy with one nested card |
| 9 | Error Recovery | 3 | Decent error surface + retry; some generic "Something went wrong" messages |
| 10 | Help and Documentation | 3 | Good contextual hints (goal hints, why-this-meal, tips); no dedicated help |
| **Total** | | **30/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment:** Mostly escapes AI slop. Genuine craft is present: a custom olive/forest palette in OKLCH with neutrals tinted toward the brand hue, a thoughtfully staged loading experience, a focus-trapped modal with scroll lock and Esc, localStorage progress persistence, and a real ARIA switch. The one category reflex is the palette itself: meal/health app -> green is the first-order wellness cliche. It's a tasteful muted olive rather than a bright wellness green, which softens the tell, but green-for-food is still the predictable pick. Mild template tells: the 5-up icon+title+description activity cards and the 3-up profile-summary stat cards.

**Deterministic scan:** Unavailable. `detect.mjs` runs but its bundled engine (`detect-antipatterns.mjs`) is missing from this install, and no browser automation is exposed this session. Did a manual ban-list pass instead:
- Side-stripe borders: none. The colored borders are bottom-borders (tab/underline pattern) on nav-link-item and day-card, which is standard, not a side stripe.
- Gradient text: none. Accent words use solid `text-primary`.
- Glassmorphism: header `backdrop-blur` and a `bg-white/95` recipe badge only; sticky-nav use is purposeful, not decorative glass cards.
- Hero-metric template: not present.
- Identical card grids: borderline. Activity (5 identical icon+title+desc cards) and profile-summary (3 identical stat cards).
- Modal as first thought: SwapModal, but a non-modal random-swap fallback also exists and the modal is a focused choice, so defensible.
- Em dashes: none found in UI copy.

**Visual overlays:** No reliable user-visible overlay available (no browser automation in session). Fallback: source + manual review only.

## Overall Impression
This is a competent, real product UI with a clear point of view, not a generated mockup. The single biggest opportunity is the seams between intent and execution: a "serif"-named type system with no serif, two reset actions with overlapping meaning, partial reduced-motion handling, and icon-only controls that quietly fail screen-reader and touch users. Tighten the seams and this jumps from "Good" to genuinely polished.

## What's Working
1. **The loading experience.** The progress arc, server-driven stage labels, rotating tips, extended-wait reassurance, and an opt-in Web Notification when the tab is backgrounded is a model anxiety-reducing wait. This is the strongest part of the app.
2. **Color discipline at the token layer.** OKLCH neutrals tinted toward hue 145, distinct light/dark themes, system-preference default. The foundation is right.
3. **The SwapModal is genuinely accessible.** Focus trap, Esc to close, scroll lock, focus restore to opener. Many teams ship modals without any of this.

## Priority Issues

- **[P1] Onboarding has no textual step indicator.** The live header shows only decorative dots; the user never sees "Step 3 of 6" or how much remains. A `ProgressBar.jsx` component that renders exactly that text exists in the repo but is never imported (and its default `totalSteps=6` disagrees with the 7-step flow). First-timers can't gauge length; screen readers get nothing.
  - **Why it matters:** Unknown-length forms raise abandonment; no SR progress feedback fails non-visual users.
  - **Fix:** Render a labeled step indicator ("Step X of 6") in the onboarding header, wire or delete the dead ProgressBar, and reconcile the count.
  - **Suggested command:** `/impeccable clarify`

- **[P1] Destructive resets have no confirmation or undo.** "Retake questionnaire" and "Restart" both call `resetQuestionnaire`, wiping all answers, the generated plan, and localStorage with one click and no way back.
  - **Why it matters:** One misclick destroys a plan the user waited ~45s to generate.
  - **Fix:** Confirm before reset, or replace with an undo toast that preserves the prior plan briefly.
  - **Suggested command:** `/impeccable harden`

- **[P1] Icon-only action buttons fail touch and assistive tech.** Meal swap, like, dislike, expand, and the "why this meal" info button convey meaning through `title` only, with no `aria-label`. `title` is not exposed on touch and is unreliable for screen readers. The like/dislike state leans on color (text-success / text-destructive). Targets are ~32px (`p-2` + w-4/w-5 icons), under the 44px touch minimum.
  - **Why it matters:** Sam (screen reader) hears "button"; Casey (mobile) can't discover what icons do and mis-taps.
  - **Fix:** Add `aria-label` to every icon button, raise hit areas to >=44px, and pair the like/dislike color with an aria-pressed state.
  - **Suggested command:** `/impeccable harden`

- **[P2] Reduced-motion handling is inconsistent, and entrance choreography taxes a task flow.** GoalsStep, DietaryStep, CuisineStep, and PreferencesStep gate animations on `useReducedMotion`; PersonalInfoStep and ActivityStep do not and always animate. Every step also runs staggered per-item entrance (e.g. 0.05*index across 5 activity cards, 0.1-0.25s on form fields), so users wait through choreography on each step. The product register warns against orchestrated load sequences in task UI.
  - **Why it matters:** Ignores an OS accessibility preference; adds repeated latency for everyone, power users especially.
  - **Fix:** Gate all step animations on `useReducedMotion`; drop or shorten the per-item stagger.
  - **Suggested command:** `/impeccable animate`

- **[P2] Token and palette inconsistencies undercut the disciplined foundation.** `text-white` and `rgba(0,0,0,...)` shadows appear where `--primary-foreground` and tinted shadows should; the `--font-serif` token and `.headline-serif` / `.section-title` classes resolve to a sans stack (no serif anywhere), so the naming misleads; macro data-viz mixes an OKLCH olive protein with raw Tailwind `#22c55e` / `#f97316` for carbs/fat, unrelated to the palette.
  - **Why it matters:** Erodes the consistency the OKLCH tokens worked to establish; the carbs green sits close to the primary green and can blur meaning.
  - **Fix:** Replace pure white/black with tokens, rename or restore the serif intent, and bring macro colors into the palette system.
  - **Suggested command:** `/impeccable colorize`

## Persona Red Flags

**Jordan (First-Timer):** No "Step X of 6" anywhere in onboarding, so the form feels endless. Three overlapping actions, Regenerate vs Retake questionnaire vs Restart, with no explanation of how they differ. Shuffle/like/dislike icons have no labels; on a first pass it's unclear that Shuffle swaps a meal. Continue is disabled with no inline reason when a selection is missing.

**Sam (Accessibility):** PersonalInfoStep and ActivityStep animate regardless of prefers-reduced-motion. Icon buttons expose no accessible name. Onboarding progress is purely visual (dots), never announced. Several 10-11px muted-foreground labels (day-kcal, recipe-tag) risk falling under 4.5:1. Good counterweights: focus-visible rings, the modal focus trap, and the sr-only switch input.

**Casey (Mobile):** Meal action targets are ~32px, below the 44px thumb minimum, and clustered together. Icon-only controls can't reveal their `title` on touch. Strong points: progress persists across interruptions via localStorage, the day timeline uses scroll-snap, and bottom nav respects safe-area-inset.

## Minor Observations
- `ProgressBar.jsx` is dead code (unused; default `totalSteps=6` vs the app's 7).
- Step dots are display-only; users can't click to revisit an earlier step.
- Loading percentage is simulated (eases to 0.95 over 45s), not tied to real progress.
- Global `html { scroll-behavior: smooth }` ignores reduced-motion.
- Macro meta uses bare P/C/F abbreviations; the MacroPanel spells them out, so it's a recognition gap only in the meal list.
- Results page stacks many `bg-card` panels and nests cards inside the `profile-summary` accent panel.

## Questions to Consider
- The wellness-green palette is the one category reflex left. What would this look like with a non-obvious accent (warm clay, deep aubergine, ink) and green demoted to a state color only?
- Three reset/redo actions exist. Which one does the user actually need, and can the other two disappear?
- The loading state is the best-crafted screen in the app. What if the results reveal earned the same level of care?
- If a power user wanted to change one answer, today they retake the whole questionnaire. Should step dots become a way back in?
