---
name: Preppr
description: A warm, plain-spoken meal planner that turns a short questionnaire into a trusted weekly plan.
colors:
  primary: "#3D5A3D"
  primaryLight: "#E8F4E8"
  accent: "#E6F2E6"
  accentDark: "#C8E0C8"
  background: "#FAFBFA"
  card: "#FDFEFD"
  foreground: "#1B1F1B"
  mutedForeground: "#6E726D"
  border: "#E1E5E0"
  ring: "#3D5A3D"
  darkPrimary: "#6B9B6B"
  darkBackground: "#1A1E1A"
typography:
  fontSans: "\"Inter\", ui-sans-serif, system-ui, -apple-system, sans-serif"
  fontSerif: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif"
  headlineSerif:
    family: "{typography.fontSerif}"
    weight: 700
    letterSpacing: "-0.01em"
    fontFeatureSettings: "\"ss01\", \"cv11\""
  scale:
    xs: "0.75rem"
    sm: "0.875rem"
    base: "1rem"
    md: "1.125rem"
    lg: "1.35rem"
    xl: "1.625rem"
    2xl: "1.95rem"
    3xl: "2.34rem"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.25rem"
  3xl: "1.5rem"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.full}"
    padding: "16px 32px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  cuisine-chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  cuisine-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  goal-slab:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  goal-slab-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  day-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    height: "92px"
    width: "104px"
---

## 1. Overview

"The Weeknight Kitchen Counter" is the creative north star: calm, useful,
lived-in, and ready for a real evening. Preppr is warm, capable, and
plain-spoken, but the interface must never perform wellness. It helps the user
move from scattered food decisions to a usable weekly plan.

The product register is functional. Density is allowed when it improves
comparison, scanning, and repeated use. The questionnaire must feel like a
smart conversation, not a ceremony. The results dashboard must feel like a plan
the user can cook from tonight, not a generated report.

The system rejects **Wellness-template slop**, **Generic corporate SaaS**, and
**Clinical / medical dashboards**. No serif wellness theater, no navy
hero-metric AI template, no sterile clinical shorthand. Preppr earns trust
through plain labels, clear progress, visible constraints, and consistent
controls.

**Key Characteristics:**

- Warm copy, restrained visuals, and practical pacing.
- One committed olive accent, used rarely and deliberately.
- Tinted neutrals, soft sage fills, and no pure black or pure white.
- Inter everywhere in product UI, including display, labels, and data.
- Distinct questionnaire controls by intent, not repeated icon-card grids.
- Honest loading states tied to the user's choices.

## 2. Colors

The palette is a restrained kitchen-counter system: green-tinted neutrals,
quiet sage surfaces, and one meaningful olive accent.

Primary is Preppr Olive, `#3D5A3D`, canonical `#3D5A3D`. It is the single
committed accent for primary actions, selected states, active navigation, focus
rings, and confirmed choices. In dark theme, the primary shifts to `#6B9B6B`
for contrast.

Secondary and accent colors are the sage workhorses. Pale Sage is `#E8F4E8`.
Soft Sage is `#E6F2E6`, canonical `oklch(0.95 0.04 145)`. Sage Pressed is
`#C8E0C8`. Use them for selected-adjacent fills, hover states, chip
backgrounds, quiet panels, and gentle grouping.

Neutrals are tinted toward hue 145, with chroma near `0.005`. Countertop is
`#FAFBFA`, canonical `oklch(0.985 0.005 145)`. Card is `#FDFEFD`, canonical
`oklch(0.995 0.003 145)`. Ink is `#1B1F1B`, canonical
`oklch(0.21 0.005 145)`. Muted Ink is `#6E726D`, canonical
`oklch(0.5 0.008 145)`. Hairline is `#E1E5E0`, canonical
`oklch(0.9 0.006 145)`. Dark Countertop is `#1A1E1A`, canonical
`oklch(0.18 0.005 145)`.

**The One Olive Rule:** Primary olive appears only on selected, active, focus,
and primary-action states. It is never decoration, never a page wash, and never
more than 10 percent of any screen. Sage is the quiet workhorse for fills,
hover states, and grouping.

## 3. Typography

Preppr uses one family in product UI: Inter with system fallbacks. Display,
body, labels, data, navigation, chips, and buttons all use the same family so
the product feels practical and coherent.

The historical `serif` token now resolves to a system sans stack:
`-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui,
sans-serif`. Display serif fonts are retired from product UI. Playfair is only
allowed on marketing surfaces, if used at all.

Use this scale: xs `0.75rem`, sm `0.875rem`, base `1rem`, md `1.125rem`, lg
`1.35rem`, xl `1.625rem`, 2xl `1.95rem`, and 3xl `2.34rem`. Product chrome
stays compact. Reserve 2xl and 3xl for page-level orientation, not cards,
chips, labels, or metric blocks.

Body copy must sit between 65 and 75 characters per line on wide screens. Use
weight, spacing, and size to create hierarchy. Avoid all-caps labels unless the
component already uses them consistently and the text remains readable in both
Norwegian and English.

**The No-Display-Font-In-Chrome Rule:** Product navigation, controls, panels,
tables, chips, metrics, loading states, and data labels always use Inter.
Decorative display fonts are prohibited in application chrome.

## 4. Elevation

Preppr is flat at rest. Surfaces are separated by tinted backgrounds, hairline
borders, spacing, and state changes before shadow.

Cards can use `shadow-sm` at rest when they need separation from the page.
Interactive cards may rise to `hover:shadow-lg` only as a response to hover or
active state. Focus uses `ring-2 ring-primary`, not glow effects, heavy
outlines, or decorative shadows.

**Flat at rest; shadow is a response to state.** A resting dashboard must feel
settled. Elevation appears when the user points, focuses, selects, opens,
drags, or confirms.

## 5. Components

Components must share one vocabulary across the questionnaire, results
dashboard, recipe browser, and navigation. A user who learns one control must
recognize the next one without rereading the interface.

Buttons use full-radius pills. The canonical primary button uses olive
background with near-white text, generous horizontal padding, and clear hover,
focus, active, disabled, and loading states. Secondary buttons use card
background, foreground text, a hairline border, and the same pill geometry.
The codebase currently has `.btn-primary` and shadcn `<Button>` patterns.
Consolidate toward one canonical button system.

Chips cover cuisine choices, filters, and compact selections. They use pill
geometry, sage fills at rest, and olive fills only when active. Goal slabs are
larger, tappable choice surfaces with rounded-xl corners, card backgrounds,
hairline borders, and olive active states. Chips are for scanning many options;
goal slabs are for choosing among a few meaningful paths.

Cards and containers use rounded-2xl corners, card background, hairline border,
and soft shadow only when separation is needed. Cards must contain one clear
unit of work: a day, a meal, a recipe, a macro panel, or a saved plan. Nested
cards are prohibited.

Inputs in the wizard use the underline-style `.input-underline` treatment.
Focus shifts the border to primary and adds a visible focus state. Labels use
plain language, required states are explicit, and errors name the fix.

Navigation uses a top bar with `nav-link-item`, `aria-current` for the active
route, a discoverable language toggle, and a mobile layout that collapses the
center navigation without hiding core actions. Active navigation can use olive;
inactive navigation stays quiet.

Signature components carry Preppr's vocabulary. The day timeline with macro
spark-bars turns the week into something scannable. The dietary segmented list
with severity dots distinguishes allergies, restrictions, and preferences. The
cuisine chip cloud with search makes preference entry fast without forcing a
grid. Goal slabs give major choices weight without turning every step into an
identical card grid.

## 6. Do's and Don'ts

Do keep Preppr warm through copy, pacing, and useful confirmations. Do keep the
visual system restrained, calm, and functional.

Do keep the single olive accent rare and meaningful. Do tint every neutral
toward hue 145. Do use Inter as a one-family product UI system. Do use
full-radius pills for buttons and rounded-2xl corners for cards. Do provide
default, hover, focus, active, disabled, and loading states for every
interactive control. Do honor reduced motion, WCAG 2.1 AA contrast, and
visible focus rings with `ring-2 ring-primary`.

Do make the generation wait reassuring. Tie progress to the user's choices,
show honest status, and keep the user oriented while the plan is created. Do
differentiate controls by intent: timeline for days, segmented list for dietary
severity, searchable chip cloud for cuisines, slabs for major goals.

Don't reach for **Wellness-template slop** or the **wellness template**:
serif headline, sage card grid, cream gradient, and grandiose noun-phrase
titles. Name it, reject it, and rewrite the surface.

Don't build identical icon-card grids as the entire UI vocabulary. The old
Goals, Activity, Dietary, and Cuisine sameness is prohibited. Differentiate by
intent, interaction, and information density.

Don't use **Generic corporate SaaS** hero-metric templates, navy gradients, or
AI-slop landing patterns. Preppr is not a generic dashboard wrapper.

Don't use **Clinical / medical dashboards** as a model. No sterile white and
teal, no bureaucratic clinical tone, and no unexplained BMR or P-C-F
abbreviations without a glossary.

Don't use em dashes in UI copy. Don't ship `border-left` or `border-right`
greater than 1px as colored stripes. Don't use gradient text with
`background-clip:text`. Don't use default glassmorphism. Don't use `#000` or
`#fff`, use tinted neutrals. Don't keep two competing button systems. Don't use
display fonts in chrome, labels, or data.

Don't animate layout properties. Audit `transition-all` before shipping. Use
transform and opacity only, with ease-out timing. Respect reduced-motion
preferences every time.
