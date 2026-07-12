# Impeccable Action Plan — Meal Planner UI

Source: `/impeccable critique` of `src/Pages/MealPlanner.jsx` + questionnaire steps + `ResultsStep`.
Baseline Design Health: **30/40 (Good)**. Snapshot: `.impeccable/critique/2026-06-02T16-25-53Z__src-pages-mealplanner-jsx.md`.

User decisions:
- **Priority:** all three P1s first.
- **Palette:** open to a bolder accent (demote green to a state color, explore a non-obvious primary).
- **Scope:** everything (P1s + P2s + minor observations).

Orchestration model: **Claude** plans and orchestrates; **Codex** writes the code. Progress is logged in the Execution Log at the bottom.

---

## Tasks

### 1. `harden` — P1 safety + accessibility (icon controls, destructive reset)
- Add `aria-label` to every icon-only button in `ResultsStep.jsx` (swap, like, dislike, expand/collapse, "why this meal" info, swap-modal close).
- Add `aria-pressed` to like/dislike; `aria-expanded` to the show-more toggle.
- Raise icon-button hit areas to >=44px (update `.meal-action` and `.btn-icon` in `styles.css`).
- Add an accessible confirmation before the destructive "Retake questionnaire" reset (`resetQuestionnaire` wipes answers + generated plan + localStorage with no undo).
- Address the decorative no-op `MoreHorizontal` button in the Week Overview header (remove or give it a real action + label).

### 2. `clarify` — P1 step indicator + action naming
- Show a visible, screen-reader-announced "Step X of 6" in the onboarding header (currently only decorative dots).
- Delete dead `ProgressBar.jsx` (no imports; default `totalSteps=6` disagreed with the 7-step flow).
- Disambiguate reset/redo copy (Regenerate vs Retake questionnaire) so their effects are clear.

### 3. `colorize` — bolder palette (P2)
- Explore demoting green to a state color and introducing a non-obvious primary (clay / aubergine / ink). Present options before committing.
- Replace `text-white` and `rgba(0,0,0,...)` with palette tokens (`--primary-foreground`, tinted shadows).
- Bring macro data-viz colors (`#22c55e`, `#f97316`) into the palette system; protein already uses OKLCH.

### 4. `animate` — consistent reduced-motion (P2)
- Gate `PersonalInfoStep` and `ActivityStep` entrance animations on `useReducedMotion` (other steps already do).
- Shorten or drop per-item entrance stagger in the task flow.
- Respect reduced-motion for global `html { scroll-behavior: smooth }`.

### 5. `layout` — results-page density (P2)
- Reduce stacked `bg-card` panels; remove the nested card inside the `profile-summary` accent panel.

### 6. `polish` — minor observations + final sweep
- Rename/restore the misleading `--font-serif` / `.headline-serif` / `.section-title` intent (resolves to sans today).
- Spell out P/C/F in the meal-list meta (MacroPanel already does).
- Remove remaining dead code; consistency check across the surface.

---

## Execution Log

Orchestration: Claude planned and verified each batch; Codex wrote the code. Every batch ended with `npm run lint` + `npm run build` clean (only a pre-existing `fetchRecipes` dep warning in `src/Pages/Recipes.jsx` and Vite chunk-size advisories remain).

### Batch 1 — Task 1 (`harden`) + Task 2 (`clarify`): all three P1s — DONE
Writer: Codex. Verified by Claude (git diff + grep + lint + build).

- **Icon-button accessibility** (`ResultsStep.jsx`): added `aria-label` to swap / like / dislike / expand / "why this meal" info buttons; `aria-pressed` on like+dislike (reflecting active rating); `aria-expanded` on the show-more toggle and the explainability tooltip.
- **Touch targets** (`styles.css`): `.meal-action` now `min-h-11 min-w-11` (≥44px); `.btn-icon` bumped `w-10 h-10` → `w-11 h-11`.
- **Dead control removed** (`ResultsStep.jsx`): deleted the no-op `MoreHorizontal` button in the Week Overview header and its unused import.
- **Destructive-reset confirmation** (`ResultsStep.jsx`): "Retake questionnaire" now opens a new accessible `RestartConfirmationDialog` (reuses the SwapModal pattern: focus trap, Esc, scroll lock, focus restore, `role="dialog"`/`aria-modal`). Reset only fires on explicit confirm; Cancel dismisses safely.
- **Step indicator** (`MealPlanner.jsx`): onboarding header now shows real, screen-reader-readable "Step X of 6" text (via existing `Step {current} of {total}` i18n key) beside the dots, only while `currentStep < 7`.
- **Dead code** removed: deleted unused `src/components/questionnaire/ProgressBar.jsx`.
- **i18n**: added Norwegian for `Retake questionnaire?`, the confirmation body string, and `Cancel`.

### Batch 2 — Task 4 (`animate`): reduced-motion consistency (P2) — DONE
Writer: Codex. Verified by Claude.

- `PersonalInfoStep.jsx` and `ActivityStep.jsx` now import/use `useReducedMotion` and gate container + per-item entrances (they previously animated unconditionally, ignoring the OS preference).
- Removed per-item entrance **stagger delays** across `PersonalInfoStep`, `ActivityStep`, `GoalsStep`, `DietaryStep`, `CuisineStep`, `PreferencesStep` so items appear together instead of as a sequence (less per-step latency in the task flow).
- `styles.css`: global `html { scroll-behavior: smooth }` now wrapped in `@media (prefers-reduced-motion: no-preference)`.

User decisions taken at this checkpoint: **warm clay/terracotta** primary (green demoted to a success-only state) and **a real serif display face** (Fraunces) for headlines.

### Batch 3 — Task 3 (`colorize`) + typography (P2) — DONE
Writer: Codex. Verified by Claude (grep + lint + build).

- **Re-themed all tokens** in `styles.css` from olive-green (hue ~145) to warm clay/terracotta (primary `oklch(0.55 0.13 45)` light / `oklch(0.68 0.13 50)` dark), with neutrals retinted toward warm hues. Light + dark fully replaced; all leftover hex (`#3D5A3D` etc.) removed.
- **Green demoted to a state color**: `--success` is the only green now (`oklch(0.60 0.14 150)`); `--warning` shifted toward yellow and `--destructive` toward a clearer red so the three warm signals stay distinct from terracotta.
- **Tokenized macro chart colors**: added `--macro-protein/-carbs/-fat` to both themes; `MACRO_COLORS` in `ResultsStep.jsx` now references `var(--macro-*)` (theme-aware) instead of `#22c55e`/`#f97316`.
- **Removed pure white/black**: `text-white` → `text-primary-foreground` (buttons, activity card, restart-confirm button); slider thumb `border: solid white` → `var(--card)`; pure-black slider shadows → warm-tinted. (`bg-white/95` recipe badge over a photo left intentionally.)
- **Real serif headlines**: added Fraunces (variable display serif, weights 400–700) via `index.html`; `--font-serif` now `'Fraunces', ui-serif, Georgia, …`; `.headline-serif` switched to `var(--font-serif)` (was hardcoded sans).

### Batch 4 — Task 5 (`layout`) + remaining Task 6 (`polish`) — DONE
Writer: Codex (edits applied; verification run by Claude after Codex hit its session limit). Lint + build pass.

- **De-nested the profile summary**: `.profile-summary-card` dropped its `bg-card`/border/shadow so the three stats are plain cells on the single accent panel (no more card-in-card).
- **Serif consistency**: the `ResultsStep` hero `<h1>` now carries `font-serif` so the results headline matches the onboarding headlines.
- **Spelled out macros**: meal-list meta now reads "Protein 30g · Carbs 40g · Fat 12g" (reusing existing i18n keys) instead of `P/C/F`; `.meal-meta` gained `flex-wrap` so it wraps cleanly on mobile.

---

## Status: all six tasks complete

All P1s, P2s, and minor observations from the critique have been implemented and verified (`npm run lint` clean except a pre-existing `fetchRecipes` dep warning in `src/Pages/Recipes.jsx`; `npm run build` succeeds). Changes are unstaged/uncommitted on branch `new_dev`.

**Suggested next step:** re-run `/impeccable critique` to re-score against the 30/40 baseline, then visually QA the new terracotta palette + Fraunces headlines in light and dark mode (a build-only check can't catch contrast or font-loading regressions).
