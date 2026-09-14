# BhoomiSetu — Frontend Redesign Prompt (Final, Consolidated)

## CONTEXT — READ FIRST

The backend is already fully built by a teammate: a NestJS (TypeScript) app with SQLite (dev) / PostgreSQL+PostGIS (prod), running at `http://localhost:3000/api/v1`, Swagger docs at `http://localhost:3000/api`.

**Do not modify, rebuild, or scaffold any backend code.** Your job is to build a brand-new `frontend/` React application from scratch and wire it to the existing backend's real endpoints (Part C). Assume the backend is running when you write integration code — use real `fetch`/Axios calls, not mocks, against the documented endpoints. No hardcoded/mock JSON once the backend is live.

This is a **Government of India / State Government land-governance platform** (GIS-based, SVAMITVA-scheme aligned). In addition to the visual spec below, the build must follow **GIGW 3.0 (Guidelines for Indian Government Websites)** baseline accessibility and compliance rules — see Part F. Treat Part F as equally mandatory as Parts A–E.

---

## PART A — Stack & Setup

- React (TypeScript) + Vite
- Tailwind CSS
- TanStack Query (server state/caching for all GETs)
- Axios (base URL from `VITE_API_BASE_URL`, default `http://localhost:3000/api/v1`)
- MapLibre GL JS (GIS map)
- i18next / react-i18next (English + Hindi, persisted language choice, must set `<html lang="en">` / `lang="hi"` dynamically)
- lucide-react (icons)
- recharts (Admin analytics charts)
- zustand, react-hook-form, zod — installed, wired only where genuinely needed (forms, auth state)
- Vitest + React Testing Library for component tests

Fonts (Google Fonts): **Montserrat** (headings), **Inter** (body/UI), **JetBrains Mono** (identifiers/coordinates/codes/scores — no exceptions).

Scaffold at `frontend/`, dev server on `http://localhost:5173`, calling the backend at port 3000 directly or via Vite proxy. Ship `.env.example` with `VITE_API_BASE_URL=http://localhost:3000/api/v1`. App must run standalone via `npm install && npm run dev` against the already-running backend — no backend changes required.

---

## PART B — Design Tokens (exact — do not deviate)

```css
:root {
  --page-bg:#F7FAF5; --surface-1:#FFFFFF; --surface-2:#F1F5EF;
  --nav-bg:#0F3D2E; --nav-text:#FFFFFF;
  --brand-900:#0F3D2E; --brand-700:#166534; --brand-600:#15803D; --brand-300:#86EFAC;
  --action-700:#B45309; --action-600:#D97706; --action-500:#F59E0B; --action-text-on:#16241A;
  --earth-700:#92400E; --earth-500:#B45309; --earth-300:#D6A46F;
  --text-heading:#0F3D2E; --text-primary:#34413A; --text-secondary:#53635A; --text-muted:#718078;
  --border:#DDE5DF; --success:#16A34A; --warning:#D97706; --error:#DC2626; --info:#0F766E;
  --focus: var(--action-500);
}
.dark {
  --page-bg:#071A14; --surface-1:#0D261D; --surface-2:#123126;
  --nav-bg:#06150F; --nav-text:#F0FDF4;
  --brand-700:#153D2C; --brand-600:#34D399; --brand-300:#BBF7D0;
  --action-700:#C2820D; --action-600:#F59E0B; --action-500:#FBBF24; --action-text-on:#16241A;
  --earth-700:#8A6039; --earth-500:#B9824E; --earth-300:#D6A46F;
  --text-heading:#F0FDF4; --text-primary:#DCEBE2; --text-secondary:#B9CCC1; --text-muted:#91A39A;
  --border:#244438; --success:#4ADE80; --warning:#FBBF24; --error:#F87171; --info:#2DD4BF;
  --focus: var(--action-500);
}
```

**Rule:** Green = structure/identity/navigation. Amber = the *only* interactive/highlight color (CTAs, active states, selected map parcel, focus rings). Never mix both saturated in one component.

Typography rules (strict):
- Headings & brand: Montserrat bold (700). Uppercase **only** for the hero headline; everywhere else sentence case, weight 600 max.
- Body: Inter regular/medium, 16–18px, line-height 1.6.
- Identifiers, coordinates, codes, scores: JetBrains Mono, always, no exceptions.

---

## PART C — Page-by-Page Layout Spec

### Navbar
Floating glassmorphism pill, detached ~16px from top, `rgba(255,255,255,0.10)` + 40px blur, 1px white/25 border, `rounded-2xl`, ~56px tall. Left: logo (two overlapping outlined rounded squares) + "BhoomiSetu" wordmark. Center: About · Features · Citizen Portal · Officer Login (Inter medium, white/75). Right: EN/हिंदी pill toggle (active side amber background), theme toggle (sun/moon). On scroll: transitions to solid `#0F3D2E`/95 background. Mobile: hamburger → dark glass dropdown. Must include a **visually-hidden "Skip to main content" link** as the very first focusable element (see Part F).

### Hero (full-bleed, ~92vh)
- Background: real aerial farmland photo, completely untinted, natural color — no green filter over the image anywhere.
- Scrim: left-to-right linear gradient only — `rgba(6,21,15,0.95)` at far left fading to fully transparent by ~62% width, plus a subtle top/bottom vignette. Right half of the photo must look like an ordinary, unedited photograph.
- One field mid-right gets an amber dotted-outline highlight + drop-pin marker (the parcel metaphor) — the only place amber appears on the image itself.
- Content (left-aligned, vertically centered):
  - Eyebrow: "GIS-BASED LAND GOVERNANCE" (uppercase, 0.3em tracking, medium weight, warm off-white).
  - Headline: "ONE PARCEL." / "EVERY RECORD." (Montserrat bold uppercase, ~72px desktop, line-height 1.12, white).
  - Body: "Connecting fragmented land data into a single, verifiable view." (Inter 17–18px, white/85, max-width ~28rem).
- CTA 1 "Search a Parcel" — pill, brushed-metal light-gray gradient (`#C9C9C9` → `#909090`), dark text, inset highlight/shadow, search icon, no glow.
- CTA 2 "Sign in to Citizen Portal" — transparent glass pill, 1px white/25 border, backdrop blur, white text.
- Floating parchment badge, bottom-left: `#E9DDC2` bg, `#D9CAA5` border, dark-green nested-square logo + "BhoomiSetu" wordmark.
- Trust row (hairline above/below): "GOVERNMENT OF MAHARASHTRA | DIGITAL INDIA | SVAMITVA SCHEME" — uppercase, tracked, white/80, thin vertical pipe dividers. **Only use official emblems/logos here if the team has authorization to display them per Government of India emblem-usage rules** — otherwise render as text-only, no fabricated seals or crests.

### Trust Stats Strip (light theme, hairline dividers, 4 columns)
- `220+` — "PARCELS MAPPED"
- `5` — "PILOT STATES"
- `7` — "DEPARTMENT FEEDS"
- `Live` (word, not a number) — "GIS LAYERS"

Numbers/word in large Montserrat bold; labels uppercase, tracked, muted gray, mono not required here (these are display numbers, not identifiers).

### How It Works
Amber mono eyebrow "HOW IT WORKS", Montserrat heading "Four steps from plot to proof." Four numbered white cards, each: icon in soft green rounded-square top-left, number (`01`–`04`) top-right in muted mono, bold green title, gray description:
1. **Search a Parcel** — "Look up any plot by ULPIN, survey number, or local ID."
2. **View Parcel 360** — "See ownership, departments, and records in one unified view."
3. **Verify Documents** — "OCR-check any land document against canonical records."
4. **File a Request** — "Raise a workflow with any department and track it live."

### Map Preview
Left column: "LIVE GIS PREVIEW" eyebrow, heading "One map. Five states. Zero ambiguity.", copy paragraph, legend row with colored dots: Verified=green, Selected=amber, Pending=amber-dashed, Disputed=red, High-Risk=dark amber. **Per Part F, each legend item must also carry a distinct icon/pattern, not rely on color alone** (e.g. check / pin / dashed-outline / alert-triangle / warning-diamond).

Right column: white card, header row "📍 Pune Cluster" left + mono coordinates "18.52°N, 73.85°E" right. Body: grid of colored parcel cells (mostly green/"verified"), one amber cell with a drop-pin marker ("selected"), one dashed-amber cell ("pending"), one red cell ("disputed"), one dark-amber cell ("high-risk") — built from the real MapLibre render of the backend's Pune cluster geometry (`GET /gis/parcels`), not a static image. Footer row: mono "ULPIN: MH-PUN-0012-2019" left, green "Verified" badge right.

### Interoperability Band
Centered "INTEROPERABILITY" eyebrow, heading "Seven department feeds. One record." Seven white bordered pill badges with icons, wrapped and centered: Land Records, Registration, Planning, Tax, Restriction, Dispute, Encumbrance.

### Land & Agriculture Section
Earth-tone eyebrow "LAND & AGRICULTURE", heading "The land, beyond the ledger.", copy: "BhoomiSetu layers agricultural metadata — extent, land use, mutation history, and valuation — alongside legal records, so every parcel tells its full story." Left: large earth-tone gradient image card, bottom-left mono label "PARCEL SNAPSHOT" + bold white caption "Survey No. 142 — Kharif & Rabi cycles tracked since 2019." Right: 2×2 metadata cards (icon + label + mono value): Canonical extent `2.31 ha`, Land use `Double-crop agri`, Last mutation `Mar 2024`, Valuation band `Tier-II`.

### Closing CTA
Rounded-3xl amber panel. Dark heading "Ready to see your land, clearly?" Body: "Search any parcel by ULPIN, survey number, or plot number — and get a single, verifiable view in seconds." Two buttons: dark-green filled "Search a Parcel", outline "Sign in to Citizen Portal →".

### Footer (deep green)
Brand column: logo + "BhoomiSetu" + one-line description. Link columns:
- **Platform**: Search a Parcel, Parcel 360, Verify Documents, Live Map
- **Portals**: Citizen Portal, Officer Portal, Admin Portal
- **About**: Mission, Pilot States, Interoperability, Contact

Bottom row: "© [current year] BhoomiSetu · Government land governance initiative" (left), and statutory links "Privacy · Terms · Accessibility Statement" (right) — see Part F for what these pages must contain.

### Global behavior
Smooth scroll, fade-up-on-scroll (once only, ~0.5s, 20px offset), fully responsive, light/dark toggle, **no glow/parallax/autoplay video/autoplay carousels** (GIGW disallows auto-updating content that can't be paused).

---

## PART D — Real Backend Integration

Base URL: `${VITE_API_BASE_URL}` (default `http://localhost:3000/api/v1`)

- **Auth** — `POST /auth/login`, `POST /auth/register`, `POST /auth/verify-otp`, `POST /auth/resend-otp`, `POST /auth/profile/contact`, `GET /auth/me`. Store JWT (24h expiry) in memory/zustand, attach as `Authorization: Bearer` via Axios interceptor. `RequireAuth` route guard checks role for `/citizen/*`, `/officer/*`, `/admin/*`.
- **Parcel search & 360** — `GET /parcels?ulpin=&survey_number=&plot_number=&local_identifier=&state=&district=`, `GET /parcels/:id`, `GET /parcels/:id/geometry`, `GET /parcels/:id/360`, `GET /parcels/:id/neighbours`, `GET /parcels/:id/context`, `GET /parcels/:id/ownership-history` (403-handle for non-linked citizens), `GET /parcels/mine` (citizen-only).
- **Map/GIS** — `GET /gis/parcels?bbox=&zoom=&state=&district=`, `GET /gis/parcel-at-location`, `GET /gis/zoning-overlays`, `GET /gis/restriction-zones`, `GET /gis/infrastructure`, `GET /gis/change-detection-events`.
- **Document Verification** — `POST /document-verification/verify` (multipart: image + parcelId) → render `{overallVerdict, fieldChecks[], ocrConfidence, extractedText}`.
- **Workflows** — `POST /workflows` (citizen files request), `GET /parcels/:id/workflows`; officer: `GET /workflows?department=&stepStatus=`, `GET /workflows/:id`, `PATCH /workflows/:id/status`, `PATCH /workflows/:workflowId/steps/:stepId`.
- **Governance Alerts** — `GET /governance-alerts?status=&severity=` (paginate client-side, 5/page), `GET /governance-alerts/:id`, `PATCH /governance-alerts/:id/status`.
- **AI** — `POST /ai/query`, `POST /ai/parcels/:parcelId/explain`, `POST /ai/alerts/:alertId/explain` → shared `AiExplanationCard` component for all three.
- **Historical Imagery** (officer-only) — `GET /historical-imagery/clusters`, `GET /historical-imagery/clusters/:clusterId/years/:year/image`, `GET /historical-imagery/clusters/:clusterId/years/:year/parcels`, `POST /historical-imagery/clusters/:clusterId/compare`.
- **Analytics/Admin** — `GET /analytics/summary` (8-chart recharts dashboard), `GET/POST/PATCH/DELETE /users`, `GET/POST/PATCH/DELETE /admin/departments`, `GET /audit`, `GET /parcels/:id/audit`.

Handle every endpoint's real response shape and error codes (401/403/404/502/503) with proper empty/error/loading states — no fake data, no hardcoded mock JSON once the backend is running.

---

## PART E — Full Route Map

- **Public**: `/` `/about` `/features` `/search` `/parcel/:id` `/verify-documents` `/login` `/register`
- **Citizen**: `/citizen/search` `/citizen/map` `/citizen/parcels` `/citizen/parcel/:id` `/citizen/verify-documents` `/citizen/requests` `/citizen/profile`
- **Officer**: `/officer/dashboard` `/officer/requests` `/officer/alerts` `/officer/map` `/officer/historical-imagery` `/officer/documents` `/officer/notifications` `/officer/profile`
- **Admin**: `/admin/dashboard` `/admin/departments` `/admin/monitoring`

Global: floating, draggable "Ask AI" widget mounted at app-shell level on all public + citizen routes.

---

## PART F — Government of India Compliance (GIGW 3.0 baseline) — MANDATORY

This is a government-facing platform; the following are not optional polish, they're compliance requirements:

1. **Accessibility (WCAG 2.1 Level AA)**: full keyboard navigation, visible focus rings using `--focus` token, correct heading hierarchy (one `<h1>` per page), `alt` text on all meaningful images, ARIA labels on icon-only buttons and the MapLibre canvas, form inputs with associated `<label>`s and inline error messages tied via `aria-describedby`.
2. **"Skip to main content" link**: first focusable element on every page, visually hidden until focused.
3. **Never convey status by color alone**: the map legend (Verified/Selected/Pending/Disputed/High-Risk) and any status badges must pair color with a distinct icon and/or text label so colorblind users can distinguish them.
4. **Bilingual by default, not by afterthought**: every user-facing string routed through i18next (English + Hindi), `<html lang>` attribute updates on language switch, persisted in localStorage.
5. **Statutory footer pages**: Privacy Policy, Terms of Use, and an **Accessibility Statement** (stating conformance level and a feedback/contact channel for reporting accessibility issues) must exist as real routes, not placeholders.
6. **No disorienting motion**: no autoplay video, no parallax, no auto-advancing carousels; any animation must respect `prefers-reduced-motion`.
7. **Responsive & device-agnostic**: functional down to 320px width; the map and dashboards must have usable mobile/tablet layouts, not just a scaled-down desktop view.
8. **Session & security transparency** (citizen/officer/admin portals): visible session-expiry warning before the 24h JWT expires, clear logout affordance, no sensitive data (Aadhaar-like IDs, full ownership history) rendered for unauthenticated or unauthorized roles — respect the 403s from the backend in the UI, don't just hide the button.
9. **Printable records**: parcel 360 view and verification results should have a clean print stylesheet (for citizens who need a physical copy of a record/certificate).
10. **No fabricated government insignia**: use "Government of Maharashtra / Digital India / SVAMITVA Scheme" as text only unless the team has actual authorization and correct official assets for emblems/crests — do not generate a National Emblem or state seal graphic.

---

## PART G — Delivery Instructions

1. Scaffold `frontend/` fresh — do not touch any existing backend folder.
2. Set up Tailwind config with the exact CSS variables above as theme extensions.
3. Build shared layout components first: Navbar (incl. skip link), Footer, Sidebar, RequireAuth, AiWidget — then the landing page exactly per Part C, then every route in Part E wired to its Part D endpoint(s).
4. Use TanStack Query for every GET; mutations for POST/PATCH/DELETE with optimistic UI only where safe (e.g., workflow status updates).
5. All identifiers/coordinates/scores render in JetBrains Mono, everywhere, no exceptions.
6. Ship `.env.example` with `VITE_API_BASE_URL=http://localhost:3000/api/v1`.
7. Confirm the app runs standalone with `npm install && npm run dev` against the already-running backend — no backend changes required.
8. Run an accessibility pass (axe or equivalent) before calling any page "done."
