# Preppr — Product Vision

## One-liner
A Norwegian high-protein, budget meal-prep planner for one person: fill out one
questionnaire and get a full week of cheap, goal-fit meals built around your
calories, protein target, budget, and what's at the store — so you shop once and
prep for the week instead of re-deciding dinner every night.

## The problem
Eating well for *one person* is a recurring, low-reward decision. If you're a
student, training in the gym, or just cooking for yourself, every week you're
trying to answer *"what should I eat?"* while juggling three things that usually
fight each other:

1. **Decision load** — deciding meals over and over is exhausting, so people
   default to repetitive or junk choices, or to ordering in.
2. **Nutrition goals** — hitting a calorie and protein target to lose fat, build
   muscle, or maintain takes planning most people won't sustain by hand.
3. **Cost** — eating well *and* cheap means knowing what's affordable and
   shopping deliberately, which nobody has time for.

Existing tools each pick one. Recipe apps ignore your budget and your macros.
Macro trackers ignore the grocery bill. Family meal-planners (Mambeno and the
like) are built around *dinner for a household* — not a solo eater's weekly
protein target, budget ceiling, and meal-prep routine. Nobody connects *a single
person's nutrition goal* to *a cheap weekly plan* to *what's actually on sale
near them*.

## Where we focus
Preppr is deliberately **not** competing on family dinners. We focus where
household planners are weakest: **one person, eating to a goal, on a budget, who
meal-preps.** The questions we answer:

- *What should I eat this week?*
- *How do I hit my protein and calorie goals without overspending?*
- *How do I shop once and prep for the week?*

## Target user
One person planning their own week. Three profiles, in priority order:

- **The student / budget solo eater** — wants the cheapest credible week,
  shopped in one trip, with as little ongoing decision-making as possible.
- **The gym / nutrition-aware eater** — wants meals that hit calorie and protein
  targets for fat loss, muscle gain, or maintenance, without nutrition becoming a
  second job.
- **The solo meal-prepper** — cooks for themselves, batch-cooks, and wants to eat
  well across the week from a few cooking sessions.

These overlap constantly — the same person is often all three. The wedge is
serving them at once: a plan that is goal-fit **and** cheap **and** prep-friendly
for one person, generated automatically.

## Core value proposition
> Fill out a short questionnaire once → get a complete one-person weekly plan that
> fits your calorie and protein goals, stays within budget, and is built to
> meal-prep → eventually, one consolidated shopping trip optimized around
> Norwegian store deals → repeat, with the plan learning your tastes over time.

## How it works
1. **Onboarding questionnaire** — captures the inputs that constrain the plan:
   personal stats (age, sex, height, weight), goal (lose fat / build muscle /
   maintain / eat healthier), meals per day, activity level, cooking-time
   tolerance, budget, dietary restrictions, and cuisine preferences.
2. **Goal-fit targeting** — derives daily calorie and macro targets (protein
   first) from the profile and goal.
3. **Plan generation** — assembles a week of single-person meals that hit those
   targets, with batch-cook portions and carry-forward leftovers so it's
   realistic to prep.
4. **Budget** — biases toward cheaper recipes (today via a static cost tier).
5. **Deal-aware planning** *(the differentiator — see roadmap; not built yet)* —
   pull current weekly offers from Norwegian stores (**Kiwi, Rema 1000, Extra,
   Meny**) and weight meal selection toward what's on sale, then output one
   consolidated shopping list with an estimated basket cost.
6. **Reuse & adapt** — plans are saved; over time recommendations keep the
   rotation fresh based on what you've liked.

## Feature scope by iteration

**Iteration 1 — One-person weekly planner (foundation)** *(largely built)*
- Questionnaire → personalized one-person weekly plan.
- Calorie/macro targeting (protein-first) from profile + goal.
- Meal-prep orientation: batch portions + carry-forward leftovers.
- Weekly plan view, basic budget tier, ratings/swaps, plan history.
- Norwegian + English.

**Iteration 2 — Norwegian deal-driven shopping** *(highest-priority gap)*
- Integrate this week's offers from **Kiwi, Rema 1000, Extra, and Meny**.
- Weight meal selection toward on-sale ingredients to cut cost.
- A real consolidated weekly shopping list with estimated basket cost and savings.

**Iteration 3 — Personalized recommendations**
- Capture taste signals (likes, swaps, repeats).
- Recommend new recipes aligned to preferences without losing goal-fit or budget.

## Future direction
- Tighter macro/progress tracking over time (the getting-in-shape loop).
- **Household / multi-person scaling** — portions, costs, and shopping for more
  than one eater. Deliberately *after* the solo wedge is solid.
- Multi-store / multi-region deal sources beyond the initial Norwegian chains.
- Pantry awareness (plan around what you already have).

## What makes it different
The combination, for one person: **goal-fit nutrition (protein-first) + a real
budget + meal-prep-friendly weeks + Norwegian store deals + learns your taste.**
Each part exists somewhere; tying *a solo eater's calorie/protein goal* to *a
cheap, prep-ready week* built around *this week's Norwegian store prices* is the
unclaimed middle.
