# BhoomiSetu Design System

**Status: implemented.** This document captured the settled visual language before the site-wide Bauhaus redesign; that redesign is now built across every portal (Citizen/Officer/Admin) and the public site — see `docs/FEATURES.md` for what's built where. Kept as the living reference for the visual language itself (color tokens, typography, dark mode, component conventions) — still accurate for that purpose, just no longer "not yet implemented."

---

## 1. Design Philosophy

The brief is **Bauhaus / constructivist modernism** — "form follows function," pure geometric composition, hard offset shadows, thick borders, bold color blocking. Adopted wholesale, that style is tuned for marketing/product sites (SaaS landing pages, portfolios). BhoomiSetu is a **government land-records platform** — three role-gated portals (Citizen/Officer/Admin), bilingual (English/Hindi, more languages planned), data-dense (tables, workflow steps, audit logs, maps). So this is Bauhaus **applied to a trust-critical civic system**, not a poster site:

- Geometry is used for **structure and wayfinding** (status badges, section markers, role identity), not decoration for its own sake.
- The existing tricolor government trust bar, helpline, and official tone stay — they get redrawn in the geometric language, not removed.
- Hard shadows and thick borders replace the current soft-shadow/rounded-2xl card language, but data tables and forms stay legible first, graphic second.
- One genuinely nice fit: **land parcels are already geometry.** Squares, triangles, and diamonds subdividing a plot is literally what the map and the logo (a patchwork of green/brown field shapes) show. Bauhaus shape language isn't a costume here — it echoes the product's actual subject matter.

**Vibe**: Constructivist, geometric, earthy, official-but-bold, architectural.

---

## 2. Color System — derived from the BhoomiSetu logo

The provided spec uses pure primaries (red/blue/yellow). Per your instruction, those three "slots" are **re-grounded in the logo's actual palette** — deep forest green, soil brown/terracotta, and gold — instead of generic RGB primaries. The logo's stray red/yellow/green background wash is a rendering artifact of the source image, not brand color, and is excluded.

Good news: the frontend already has a hand-picked earth-tone palette in [tailwind.config.js](frontend/tailwind.config.js) (`bhoomi.*`) that matches the logo closely. The plan is to **keep those literal values** and layer semantic Bauhaus "slot" names on top via CSS variables, so light/dark mode is a variable swap, not a rewrite.

### Literal palette (unchanged, from `bhoomi.*`)

| Token | Hex | Role |
|---|---|---|
| `bhoomi-dark` | `#0a1a13` | Near-black ink / dark-mode background |
| `bhoomi-spruce` | `#0e241b` | Dark-mode header/nav surface |
| `bhoomi-forest` | `#1b4332` | Deep green — primary (Bauhaus "blue" slot) |
| `bhoomi-card` | `#142f24` | Dark-mode card surface |
| `bhoomi-border` | `#234e3b` | Dark-mode hairline/divider |
| `bhoomi-leaf` | `#2d6a4f` | Mid green |
| `bhoomi-sprout` | `#40916c` | Bright green accent |
| `bhoomi-mint` | `#52b788` | Brightest green — links/active states |
| `bhoomi-soil` | `#7c3f1d` | Dark terracotta — secondary (Bauhaus "red" slot) |
| `bhoomi-clay` | `#935116` | Mid terracotta |
| `bhoomi-sand` | `#c68b59` | Light terracotta/tan |
| `bhoomi-gold` | `#e8963c` | Amber — accent (Bauhaus "yellow" slot) |
| `bhoomi-paper` | `#f5f6f2` | Off-white background / dark-mode ink |

### Semantic slots (what components actually reference)

Bauhaus components are always written in terms of `primary` / `secondary` / `accent` / `ink` / `background`, never raw hex. Each slot is a CSS variable so the same class (e.g. `bg-primary`) repaints for dark mode automatically.

| Slot | Light mode | Dark mode | Bauhaus spec equivalent |
|---|---|---|---|
| `background` | `bhoomi-paper` `#f5f6f2` | `bhoomi-dark` `#0a1a13` | `background` |
| `surface` (cards/panels) | `#ffffff` | `bhoomi-card` `#142f24` | (card white) |
| `ink` (text + borders) | `bhoomi-dark` `#0a1a13` | `bhoomi-paper` `#f5f6f2` | `foreground` / `border` |
| `primary` | `bhoomi-forest` `#1b4332` | `bhoomi-mint` `#52b788` | Bauhaus blue |
| `primary-strong` (hover/press) | `bhoomi-leaf` `#2d6a4f` | `bhoomi-sprout` `#40916c` | — |
| `secondary` | `bhoomi-clay` `#935116` | `bhoomi-sand` `#c68b59` | Bauhaus red |
| `secondary-strong` | `bhoomi-soil` `#7c3f1d` | `bhoomi-clay` `#935116` | — |
| `accent` | `bhoomi-gold` `#e8963c` | `bhoomi-gold` `#e8963c` | Bauhaus yellow |
| `muted` | `#e7e2d3` (warm parchment) | `bhoomi-border` `#234e3b` | `muted` |

**Why terracotta replaces red and gold replaces yellow, specifically:** in the current app, soil/clay already marks officer-facing and transactional actions (CTA button, admin badge) and gold already marks highlights — this is just formalizing an existing instinct into the 3-slot Bauhaus system rather than inventing new meaning.

### Role color mapping (new, for wayfinding)

Bauhaus asks for a geometric logo mark built from a circle/square/triangle in the three primaries. BhoomiSetu has three portals, which maps onto that directly instead of being arbitrary decoration:

- **Circle + Primary (green)** → Citizen Portal
- **Square + Secondary (terracotta)** → Officer Portal
- **Triangle + Accent (gold)** → Admin Portal

Use this consistently: portal switcher icons, role badges, dashboard section markers, the "app launcher" grid in the nav.

### Dark-mode shadow rule (non-obvious, easy to get wrong)

Bauhaus hard shadows are specified as solid black (`shadow-[8px_8px_0px_0px_black]`). A literal black offset shadow is **invisible on a near-black dark background**. Rule: shadow color is always the *opposite* end of the `ink` variable — light mode shadows are `ink` (near-black), dark mode shadows are `bhoomi-paper` (cream) at full opacity, or a saturated `primary`/`accent` for emphasis elements (e.g. a gold shadow behind a highlighted stat card). Implement as a `--shadow-color` CSS variable, not a hardcoded `black` in every class.

---

## 3. Typography

Spec calls for **Outfit** (geometric sans). Constraint the spec doesn't know about: **Outfit has no Devanagari glyphs**, and this app ships real Hindi UI text today ([frontend/src/i18n/config.ts](frontend/src/i18n/config.ts)), with Marathi/Kannada planned. Solution: a layered font stack, not a font swap — `font-family: 'Outfit', 'Noto Sans', sans-serif`. CSS font fallback is resolved **per-glyph**, so Latin characters render in Outfit and Devanagari characters automatically fall through to Noto Sans in the same sentence, with no JS/locale branching required.

| Use | Stack |
|---|---|
| Display/headline (`font-display`) | `'Outfit', 'Noto Sans', sans-serif` — weight 900 |
| Body/UI (`font-sans`) | `'Outfit', 'Noto Sans', sans-serif` — weight 500 |
| Data/mono (ULPIN codes, IDs) | keep existing `'IBM Plex Mono'` |

Scale (mobile → tablet → desktop), matching the spec's extreme contrast:

- Display: `text-4xl` → `text-6xl` → `text-8xl`, `font-black`, `uppercase`, `tracking-tighter`, `leading-[0.9]` — reserve for the landing hero only; a full civic dashboard at `text-8xl` everywhere reads as noise, not confidence.
- Section headings: `text-2xl` → `text-3xl` → `text-4xl`, `font-bold`, `uppercase`
- Body: `text-base` → `text-lg`, `font-medium`, `leading-relaxed`
- Labels/badges/status pills: `text-xs`/`text-sm`, `font-bold`, `uppercase`, `tracking-widest`

Hindi/Devanagari renders taller and denser than Latin at the same pixel size — headline components should use `leading-[0.9]` only for the Latin-script brand wordmark ("BhoomiSetu"), and a slightly looser `leading-tight` for translated headline copy so Devanagari glyphs don't clip.

---

## 4. Radius, Borders, Shadows

Straight from spec, kept binary:

- **Radius**: `rounded-none` (cards, buttons, inputs, tables) or `rounded-full` (avatars, status dots, pill badges, icon roundels). No `rounded-xl`/`rounded-2xl` — this is the biggest visual break from the current UI, and it's deliberate.
- **Border width**: `border-2` mobile → `border-4` desktop, always the `ink` token, never gray.
- **Shadows**: `shadow-[3px_3px_0px_0px_var(--shadow-color)]` (small) / `6px` (medium) / `8px` (large), offset shadows only, never blurred.
- **Interaction physics**: buttons press (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`), cards lift (`hover:-translate-y-1`).

---

## 5. Dark Mode

- Tailwind `darkMode: 'class'` (currently unset — defaults to `media`, which doesn't allow a manual toggle). Needs adding to [tailwind.config.js](frontend/tailwind.config.js).
- A `<html data-theme="dark">` / class toggle, persisted to `localStorage` (same pattern already used for language in `i18n/config.ts`), defaulting to `prefers-color-scheme` on first visit.
- All semantic slot colors (§2) are CSS variables on `:root` and re-declared under `.dark`/`[data-theme="dark"]` — components reference `bg-background`, `text-ink`, `border-ink`, `bg-primary` etc., never literal `bhoomi-*` hex classes directly, so no component needs a `dark:` variant of its own.
- Toggle control: a sun/moon icon button in the utility bar next to the language selector — same visual weight as the existing language `<select>`.

---

## 6. Iconography & Imagery

- **Library**: `lucide-react` — not currently a dependency, needs adding.
- Icons live inside bordered geometric containers (square or circle per §2's role mapping), stroke-width 2 default / 3 for emphasis.
- Logo/brand mark: the existing raster logo stays as-is in the nav (it's the real brand asset), but decorative geometric echoes of it (circle/square/triangle in primary/secondary/accent) are used as section markers and background texture — same idea as the spec's "geometric logo," expressed through the product's own parcel-shape motif instead of an abstract face/composition.
- Photography/imagery (if any is added later): grayscale by default, full color on hover, matching spec.

---

## 7. Components (styling direction, not final markup)

- **Buttons**: Primary = `bg-primary text-white`, Secondary = `bg-secondary text-white`, Accent = `bg-accent text-ink`, Outline = `bg-surface text-ink`, all `border-2/4 border-ink shadow-[…_var(--shadow-color)]`, uppercase/bold/tracking-wider, square by default, pill (`rounded-full`) reserved for primary CTAs.
- **Cards**: `bg-surface border-4 border-ink shadow-[8px_8px_0px_0px_var(--shadow-color)]`, small role-colored geometric shape in the top-right corner, `hover:-translate-y-1`.
- **Status badges / workflow steps** (this app has many: request status, dispute status, verification verdicts): uppercase pill or square tag, background = semantic status color (approved→primary, pending→accent, rejected→secondary), not the current soft `/10`-opacity chip style.
- **Tables** (Officer/Admin data views, audit log): thick `border-ink` outer border, `divide-y-2 divide-ink` rows — no soft gray zebra striping; use a light `muted` background band instead if row separation is needed.
- **Accordion** (FAQ, expandable workflow steps): closed = white/`surface` + `border-4` + small shadow; open header = `bg-secondary text-white`; expanded body = light accent tint (`bhoomi-gold` at low opacity) with `border-t-4`.
- **Forms/inputs**: square, `border-2 border-ink`, focus = `border-primary` + small persistent offset shadow instead of a soft focus ring — reads as "the field lifts," consistent with the button press metaphor.
- **Government trust bar**: keep content (tricolor mark, helpline, language switcher, sign-in), redraw the tricolor swatch as three stacked `border` blocks instead of rounded stripes — a very natural fit for the "geometric blocking" mandate, no invention needed.
- **AskAiWidget** (floating): circular `rounded-full` FAB in primary, with a squared-off `border-4` expanded panel — circle-to-square is itself a small piece of Bauhaus choreography.

---

## 8. Layout & Spacing

Unchanged in spirit from spec, matches what's already in place:

- Container: `max-w-7xl` (already used throughout `App.tsx`/`CitizenPortal.tsx`)
- Section padding: `py-12 px-4` → `py-16 px-6` → `py-24 px-8`
- Section dividers: `border-b-4 border-ink` between major page sections (Bauhaus rhythm, also solves "where does one civic-data section end and the next begin" more clearly than the current shadow-only separation)
- Grids: Citizen dashboard sections (My Parcels / Search / Map / Verify) become a bordered, divided grid (`divide-x-4 divide-y-4 border-4 border-ink` container) rather than independently-floating soft cards — turns the existing 2-column layout into one constructed composition instead of four separate boxes.

---

## 9. Responsive Strategy

- Breakpoints unchanged: mobile `<640px`, tablet `640–1024px`, desktop `>1024px` (matches existing Tailwind defaults already used in `App.tsx`).
- Border/shadow scale down on mobile (`border-2`/`shadow-[3px…]`) and up on desktop (`border-4`/`shadow-[8px…]`), per spec.
- Existing hamburger nav behavior (`lg:hidden`) stays; it just gets re-skinned square instead of rounded.
- Data-heavy views (tables in Officer/Admin) get a horizontal-scroll container on mobile rather than column-collapsing — geometry holds up better than reflowed tables at small widths.

---

## 10. Animation

- `duration-200`/`duration-300`, `ease-out` — mechanical, not soft.
- Button press / card lift / accordion rotate exactly as spec'd in §8 there.
- No animated background patterns (spec says static; also better for a government-facing site's motion-reduction expectations).

---

## 11. Implementation notes for later (not doing this yet)

- Add `lucide-react` to `frontend/package.json`.
- Add `darkMode: 'class'` to `tailwind.config.js`; introduce the CSS-variable layer for the semantic slots in `index.css`, keep the literal `bhoomi.*` scale as-is underneath.
- Add `Outfit` to the Google Fonts import alongside the existing `Noto Sans`/`IBM Plex Mono` (need to check how fonts are currently loaded — likely `index.html` — before wiring this in).
- This is a real visual break from the current soft-shadow/rounded-2xl UI across every page (Landing, Citizen/Officer/Admin portals, Login, Parcel 360, Map, all panels/forms). Given the number of pages, the upcoming flow should sequence this rather than reskin everything at once.

---

## Open questions for the upcoming flow

- Sequencing: which surface first — landing/hero, the shared nav+trust bar (used everywhere), or one full portal end-to-end?
- Does the geometric role-mapping (circle/square/triangle = Citizen/Officer/Admin) extend into each portal's internal accent color, or stay limited to the switcher/nav?
- Any pages explicitly staying as-is (e.g., is the map itself, being MapLibre-rendered, out of scope for the border/shadow treatment)?

*Waiting on the implementation flow before touching any component.*
