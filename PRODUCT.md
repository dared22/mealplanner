# Product

## Register

product

## Users

Preppr serves one person planning a full week of their own meals. It fits into
ordinary kitchens, tired evenings, short planning windows, and tight budgets —
solo weekly eating, not family dinner planning. Today every plan, portion, and
cost is sized for a single eater.

Three core users carry the most weight:

- **The student / budget-conscious solo eater.** Wants to spend as little as
  possible and stop thinking about food. Their job: get one credible week of
  cheap meals, shop once, and meal-prep so they aren't re-deciding dinner every
  night. Budget is a headline reason they're here.
- **The gym / nutrition-aware eater.** Wants meals that hit their targets —
  calories and protein above all — to lose fat, build muscle, or maintain,
  without turning nutrition into homework. Their job: trust that the week fits
  their goal and stays sustainable, ideally without overspending.
- **The solo meal-prepper.** Cooks for themselves and wants to batch-cook, carry
  leftovers forward, and eat well across the week from a few cooking sessions.
  Their job: a plan that's realistic for one person to actually shop for and
  cook.

The same person is often all three at once. Two needs cut across them:

- **Dietary constraints must be safe, not just preferences.** Allergies,
  intolerances, and religious restrictions are hard constraints; dislikes are
  soft. Meals must be clearly tagged and trustworthy before cooking.
- **Norwegian or English, no guessing.** The language toggle lets users answer
  the questionnaire, read the plan, and reuse saved meals in the language they
  understand best.

Household / multi-person planning is a deliberate *later* direction (see
[ROADMAP.md](ROADMAP.md)), not part of the current product.

## Product Purpose

Preppr turns one short questionnaire into a personalized **weekly meal plan for
one person**. It uses the user's stats, nutrition goal, budget, diet, cuisine
preferences, and cooking constraints to answer a different question than family
meal-planners do: not *"what's for dinner tonight for the household?"* but
*"what should I eat this week to hit my protein and calorie goals without
overspending — and how do I shop once and prep for it?"*

The plan is built around the user's calorie and macro targets (protein first),
supports batch cooking and carry-forward leftovers so it's realistic to meal-prep
for one, and respects a budget. Today budget is a recipe cost tier; live
Norwegian store prices across Kiwi, Rema 1000, Extra, and Meny are the intended
differentiator and the next major build, not a current capability.

Success means one sitting produces a week a solo eater can trust enough to shop
from, prep, cook, save, and refine over time — goal-fit and affordable in the
same plan. The product reduces planning friction; it does not replace the user's
judgment or make nutrition feel like homework.

## Brand Personality

Preppr is warm, capable, and plain-spoken. Warmth comes from human copy,
supportive pacing, and useful confirmations. The visual system stays calm,
functional, and task-led.

This tension is non-negotiable: Preppr feels encouraging because it sounds like
a capable friend who cooks, never because it borrows sage-green serif
"wellness template" decoration. The emotional goal is relief and quiet
confidence, not hype, guilt, optimization theater, or lifestyle aspiration.

## Anti-references

Preppr must actively reject patterns that make the product feel generic,
fragile, or insincere.

- **Wellness-template slop**: serif headlines, sage or forest cards, cream
  gradients, and grandiose noun-phrase step titles such as "Foundation of
  Growth," "Energy Calibration," or "Dietary Intelligence." This is the
  biggest tell and it is prohibited.
- **Generic corporate SaaS**: hero-metric templates, endless identical
  icon-card grids, navy gradients, and AI-slop landing patterns. Preppr is a
  working planning tool, not a generic dashboard demo.
- **Clinical / medical dashboards**: sterile white and teal, bureaucratic
  clinical tone, and unexplained abbreviations such as BMR or P/C/F with no
  glossary. Preppr can use nutrition data, but it must not sound like a chart
  note.

## Design Principles

These principles guide product decisions, copy, interaction, and visual
direction.

- **Warmth through words, not wellness decoration.** Tone carries the
  friendliness. The interface remains calm, plain, and functional.
- **Speak the user's kitchen vocabulary.** Use concrete labels such as "What's
  your goal?" and "Any food restrictions?" Never use marketing noun-phrases or
  unexplained clinical jargon.
- **The wait is the product's worst moment; make it the most reassuring.**
  During the 30 to 120 second generation window, anchor progress to the user's
  own choices, state what is happening honestly, and never abandon the user to
  a spinner.
- **One vocabulary, screen to screen.** Use one button system, one card
  treatment, and consistent affordances across the questionnaire, results, and
  saved-plan flows. Consistency is the affordance.
- **Respect the time-pressed cook.** Every step must earn its place. The
  fastest path to a usable plan wins over ceremony, decoration, or cleverness.
- **Show the cost plainly, never as a game.** Budget is a headline reason people
  use Preppr, so cost must be legible and honest. State the number; do not
  gamify it, inflate it, or turn saving money into optimization theater. When
  store-deal savings ship, they follow the same rule.

## Accessibility & Inclusion

Preppr targets WCAG 2.1 AA across product surfaces. Contrast must pass for
text, icons, controls, charts, selected states, disabled states, and translated
strings.

Every interactive control must support full keyboard navigation, visible focus
states, and non-color state indicators. Focus rings must be easy to see.
Motion must honor reduced-motion preferences, and layout changes must remain
understandable without animation.

All user-facing strings must run through i18n. Norwegian and English must stay
complete, and the language toggle must be discoverable in the main navigation
on desktop and mobile. State must never rely on color alone.
