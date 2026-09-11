---
name: bhashiniflag-of-india
description: "Use when building, refactoring, or reviewing UI for bhashini.gov.in — BhashiniFlag of India brand design system. Transcend language barriers to ensure every citizen can effortlessly access digital services in t. Noto Sans, sans-serif, Noto Sans Meetei Mayek typography, light theme. Actions: build, generate, refactor, restyle, theme, port, match-brand, design-review, audit-tokens, implement-from-DESIGN.md, write-Tailwind-theme, write-CSS-variables. Stacks: React, Next.js, Vue, Svelte, Astro, Swif"
allowed-tools: Bash Read Write Edit
---

# BhashiniFlag of India — Design Skill

Standing instructions for any UI task that reads, applies, or audits the BhashiniFlag of India `DESIGN.md`. Read this once; follow it for every surface touching this brand.

## Brand Identity

Transcend language barriers to ensure every citizen can effortlessly access digital services in their own language, fostering digital inclusion and empowerment.
The challenge of simplifying complex language technology to be effortlessly accessible to all citizens, bridging a significant digital divide.

## When to Apply

### Must Use
- Implementing any page, screen, or component from this brand
- Setting up `:root` CSS custom properties or a Tailwind v4 `@theme` block
- Refactoring existing UI to match this brand
- Reviewing a diff for brand drift (off-token colors, fonts, radii, shadows)
- Writing component recipes (Primary Action Button, Default Toast Close Button, Light Toast Close Button, Large Button)

### Recommended
- Resolving "doesn't look on-brand" feedback when the cause is unclear
- Bringing third-party components (shadcn/ui, headlessui) into this codebase
- Picking iconography style, motion timing, or photography crop

### Skip
- Pure backend, infra, or non-visual work
- One-off marketing copy with no UI surface

**Decision rule:** if the change affects how a surface *looks, spaces, types, colors, or moves*, DESIGN.md is the source of truth.

## Section Map

Jump directly to the right section instead of skimming the whole file.

| Task | Read this section of DESIGN.md |
| --- | --- |
| Pick a color for text / surface / accent / border | Colors → Token Roles |
| Set up `:root` CSS variables | Quick Start → CSS Custom Properties |
| Set up Tailwind v4 theme | Quick Start → Tailwind v4 (`@theme`) |
| Choose font / weight / size for a heading or body | Typography → Hierarchy table |
| Style a named section (global_header, main_content_area, primary_action, Header, Main Content Section, Footer) | Layout → Section Treatment Map |
| Decide background / text / border for a page section | Layout → Section Treatment Map |
| Choose page rhythm, container width, gutters | Layout → Composition Principles |
| Apply shadows, elevation, or motion timing | Elevation & Depth |
| Pick a border radius for card / button / input | Shapes → Border Radius Scale |
| Build a component recipe | Components → Buildable Component Recipes |
| Determine hover / active / disabled / focus treatment | Components → State table |
| Avoid brand violations | Do's and Don'ts |
| Adapt across viewports | Responsive Behavior → Breakpoints table |
| Find aesthetic neighbors for visual mood | Similar Brands |
| Understand what NOT to invent | Known Gaps |

The YAML frontmatter is the canonical token store. If frontmatter and prose disagree, **frontmatter wins** for values; **prose wins** for intent.

## Standing Rules

### Token Discipline
- Every color, font, size, weight, radius, shadow, spacing, and component property in generated code **must trace to a key in the DESIGN.md frontmatter**.
- Write CSS as `var(--token-name)` from the Quick Start block — never raw hex.
- Write Tailwind using the `@theme` block from Quick Start — not arbitrary values.

### Never Invent
- Never introduce a color not present in `colors` in the frontmatter.
- Never add a font family, weight, or size not in `typography`.
- Never pick a radius, shadow, or spacing value outside the documented scales.
- Never invent a section background/text/border — use the Section Treatment Map.
- Never substitute a 'similar' color or font from training data — treat missing values as Known Gaps.
- Avoid excessive use of golden-brown (rgb(103, 73, 16)) for text, as it can make content appear heavy or dated; use sparingly to maintain a modern feel.
- Avoid introducing arbitrary spacing values that are not part of the established spacing token scale.
- Avoid introducing overly decorative or informal visual elements (e.g., complex, playful illustrations or non-functional animations) that could detract from the official and utilitarian brand personality.
- Avoid overusing the orange accent color (#f57c00), as it will dilute its highlighting effect and create a cluttered visual hierarchy.

### Preserve Brand Posture
- Re-read the Overview first; every decision must reinforce: “Transcend language barriers to ensure every citizen can effortlessly access digital services in their own language, fost”
- Layout rhythm, typographic scale, and motion are part of the brand — do not flatten to generic defaults when the DESIGN.md says otherwise (Functional, Clear, Official, Modern).
- Honor `theme: light` in the frontmatter — do not silently invert.
- Adhere strictly to the defined `rem` based spacing scale (e.g., .5rem, .75rem, 1rem, 1.5rem, 2rem, 2.5rem, 3rem, 4rem) to maintain consistent page rhythm.
- Do implement transitions with quick durations (e.g., 150ms-300ms) and common cubic-bezier easing functions to provide responsive and clear user feedback.
- Do maintain a consistent range of radii (e.g., 4px, 8px, 12px, 20px) for different component types, utilizing both pixel and rem units as observed for flexibility.

### Known Gaps
- The Known Gaps section lists what extraction could not determine. Do not silently fill — omit, ask the user, or mark `/* TODO: not in DESIGN.md */`.

## Workflow

### 1. Orient (every task)
1. Read `## Overview` → state brand posture in one sentence.
2. Scan frontmatter keys → confirm which token groups exist.
3. Use the Section Map above → jump to the relevant section.

### 2. Build / Refactor
1. Paste **Quick Start → CSS Custom Properties** or **Tailwind v4 `@theme`** into the global stylesheet first.
2. For each section (global_header, main_content_area, primary_action, Header, Main Content Section, Footer): consult the **Section Treatment Map** for background, text, border, media, and layout.
3. For each component: use the **Buildable Component Recipes** for anatomy, states, and motion.
4. Apply the **State table** to every interactive element.
5. Run the Pre-Delivery Checklist before returning code.

### 3. Review / Audit
For each visible value in the diff: *which DESIGN.md token does this trace to?* If none — it's a finding.
Group findings as: off-token value · section treatment violation · missing state · Do/Don't violation · Known Gap silently filled.

### 4. Restyle / Port
Replace frontmatter tokens and Quick Start blocks only; keep component anatomy unless the new DESIGN.md specifies different recipes.

## Pre-Delivery Checklist

- [ ] All colors trace to `colors` in the frontmatter (via CSS var or Tailwind class)
- [ ] All fonts / sizes / weights trace to `typography`
- [ ] All radii trace to `rounded`; all shadows to `shadows`; all spacing to `spacing` or `buildTokens`
- [ ] Each section uses the background / text / border from the Section Treatment Map
- [ ] Each interactive element has every state in the component's State table
- [ ] No item in Do's and Don'ts is violated
- [ ] Photography follows prescribed subject, crop, aspect ratio, and treatment
- [ ] Known Gaps are marked, not silently filled
- [ ] Brand posture from `## Overview` is still recognizable in the result

## Common Sticking Points

| Problem | Where to Look |
| --- | --- |
| Component feels 'off-brand' but I can't say why | `## Overview` posture + Similar Brands |
| Two valid colors for the same element | Colors → Token Roles (the role decides) |
| Don't know which radius to use | Shapes → Border Radius Scale → match component class |
| Hover / focus states unclear | Components → State table |
| Page rhythm feels cramped or sparse | Layout → Composition Principles + Spacing Tokens |
| Image looks generic or off-brand | Components → Photography & Media |
| Section background unclear | Layout → Section Treatment Map (by section role) |
| Token not in frontmatter | Known Gaps — ask user, don't invent |

## Example Prompts

1. Build a global_header section for BhashiniFlag of India following the Section Treatment Map: use the documented background, text color, and border. Media: none. Layout: full_width_fluid. Keep copy hierarchy faithful to the Overview; avoid unsupported decorative styles.
2. Implement the `Primary Action Button` component for BhashiniFlag of India using its exact recipe — match background, text, border, radius, and padding from the Buildable Component Recipes. Implement all states (hover, active, focus, disabled) from the State table. Check the misuse warnings before shipping.
3. Audit this BhashiniFlag of India implementation for brand drift: for each color, font, radius, and shadow in the code, verify it traces to a frontmatter token. Flag off-token values, section treatment violations, and any Do/Don't violations. Mark unresolved values as `/* TODO: not in DESIGN.md */` rather than inventing substitutes.
