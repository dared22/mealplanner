# Action Plan: `Frontend/src` Critique

**Companion to:** [`2026-06-02T14-24-12Z__frontend-src.md`](./2026-06-02T14-24-12Z__frontend-src.md)
**Score:** 21/40
**Priorities chosen:** P0 first → "soften but stay in-genre" tonal direction → full scope including minors

---

## 1. `/impeccable animate ResultsStep loading state`
**Addresses:** [P0] Twin spinners and dead air during 30-120s wait

Kill one of the two spinners (`ResultsStep.jsx:725-731` and `:776`). Replace the stage label with an elapsed-time progress arc tied to the polling clock. Add tip/fact rotation during the wait.

---

## 2. `/impeccable onboard plan-generation wait → dashboard handoff`
**Addresses:** [P0] continued

Anchor the wait to the user's choices ("Generating plan for: 28y, lose weight, Mediterranean + Asian, 30-60 min"). Stream day 1 first, then expand. Add "we'll save it if you close the tab" reassurance and a "notify me" option past 30s.

---

## 3. `/impeccable clarify MealPlanner step copy + GenerationBadge`
**Addresses:** [P1] AI-tell copy on left panel and step headlines

Rewrite the six step titles in `MealPlanner.jsx:56-87` ("Foundation of Growth", "Energy Calibration", "Goal Alignment", "Dietary Intelligence", "Flavor Profile", "Lifestyle Fit") into operational language:
- About you
- How active are you?
- What's your goal?
- Any food restrictions?
- What do you like to eat?
- Cooking time and budget

Strip every `—` em dash from JSX text, including `ResultsStep.jsx:116` GenerationBadge.

---

## 4. `/impeccable distill LeftPanel + PreferencesStep`
**Addresses:** [P1] continued

Cut the narrative LeftPanel (it's hidden under `lg` anyway and earns nothing on mobile). Consolidate `PreferencesStep` (three dropdowns + checkbox + 4-chip summary) into a single screen with the leftover-carry-forward toggle promoted above the fold.

---

## 5. `/impeccable layout DietaryStep + CuisineStep + GoalsStep + DayCarousel`
**Addresses:** [P1] Identical card grid is the entire UI vocabulary

Differentiate by intent:
- **Dietary** → segmented list with allergen-severity badges (it's filtering, not browsing)
- **Cuisine** → regional chip cloud with search and grouping
- **Goals** → 3 large committed choices instead of 4 equal cards
- **DayCarousel** → horizontal timeline with macro spark-bars instead of `min-200px` cards

---

## 6. `/impeccable typeset`
**Addresses:** "Soften but stay in-genre" tonal direction + heuristic #8

Keep `#3D5A3D` olive as primary. Drop Playfair Display from product UI surfaces (reserve for marketing). Replace `headline-serif` class on wizard step h1s with a system stack at heavier weight. Tint the neutral palette in `styles.css` (`#FAFAFA`, `#1A1A1A`, `#666666`) toward the brand hue with `chroma 0.005-0.01` in OKLCH.

---

## 7. `/impeccable harden DashboardLayout + SwapModal + Forbidden + Groceries`
**Addresses:** [P2] Dashboard nav overstuffed + accessibility minors

- Hoist a single `<AppShell>` to dedupe the two near-identical Headers in `DashboardLayout.jsx` and `MealPlanner.jsx`
- Remove the wired-but-dead `<input>` search in `DashboardLayout.jsx:22`
- Add `role="dialog"`, `aria-modal`, Esc handler, and focus trap to `SwapModal` (`ResultsStep.jsx:515`)
- Replace raw Tailwind (`text-gray-600`, `text-2xl font-bold`) in `Forbidden.jsx` and `Groceries.jsx` with token-based classes

---

## 8. `/impeccable adapt mobile nav`
**Addresses:** [P2] continued

Add a mobile bottom-nav for `/planner`, `/recipes`, `/more`. Currently `nav-section-center` is `hidden` on mobile, leaving the logo as the only way home from `/recipes`.

---

## 9. `/impeccable polish`
**Addresses:** [P3] Raw AI response leak + all minor observations

Cleanup sweep:
- Remove the "View AI Response" `<details>` (`ResultsStep.jsx:893-898`) from production
- Delete dead Vite-template files `index.css` and `App.css`
- Replace `MACRO_COLORS` literal `#3D5A3D` (`ResultsStep.jsx:84`) with `var(--primary)`
- Replace hardcoded `text-red-500 / green-500 / orange-500` with semantic `--color-error / --color-success` tokens
- Pick one logo identity (`Logo` emerald-gradient SVG vs `LogoInline` PNG)
- Audit `transition-all` usages for layout-property animation violations
- Add active-route highlight to dashboard nav

---

## 10. `/impeccable critique`
Re-run after the above to watch the score climb from 21/40.

---

## Notes

- Natural starting point: **#1 `/impeccable animate`** — it's the P0 and nothing else depends on it.
- Steps 3 and 4 (`clarify` + `distill`) pair well in one sitting since both touch step headings.
- Step 6 (`typeset`) should run before step 9 (`polish`) so token cleanup happens against the final type/color system.
- You can ask me to run these one at a time, all at once, or in any order.
