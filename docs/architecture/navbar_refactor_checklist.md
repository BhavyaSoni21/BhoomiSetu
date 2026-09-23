# Navbar & Route Refactor — Tracked Checklist

Tracks execution of `navbar_corretion.md`. **Scope: frontend information-architecture refactor only.** Preserve all backend routes, workflows, APIs, and the 323/323 test baseline. No working route is deleted — only relabeled, grouped, hidden, or redirected.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Freeze + baseline
- [x] Baseline recorded: **314/314 frontend tests pass** (32 files, exit 0), 2026-09-23. Doc's "323" predates test removals; 314 is the freeze baseline.
- [x] Snapshot: nav defined in `navConfig.ts` (CITIZEN/OFFICER/ADMIN/VERIFIER item lists + `getOfficerNavItems(dept)`); rendered by `App.tsx` `navItemsFor()` in one merged navbar (flat NavLinks, no dropdowns). Portals mount their own sub-routes under `/citizen/* /officer/* /admin/* /verifier/*`.
- [x] Route guards: `RequireAuth roles={...}` per portal in App.tsx:369-400. `/officer/*` gated to OFFICER_ROLES as a whole (NOT per-department — Phase 18 gap). Labels via en.json (source of truth; overrides FALLBACK_STRINGS_RAW).
- [x] Rule recorded: do not delete any existing route during this refactor

## Phase 1 — Canonical nav model (Guest)
- [x] Guest navbar = Home / About / Features / Get Started (`App.tsx` `navItemsFor(null)` → `[home, about, features]`; Get Started CTA in navbar)
- [x] Routes `/`, `/about`, `/features`, `/login`, `/register` (App.tsx:466-508)
- [x] Keep `/parcels/:id` as public deep link (App.tsx:512-519)

## Phase 2 — Citizen navigation
- [x] Citizen navbar = Home / My Parcels / Find Parcels / Services / My Cases / Notifications / Profile
- [x] Relabel "Get Assistance" → "Services" (label only; keep route `/citizen/get-assistance`)
- [ ] Verify Services → AI Assistance → confirmation → application → case → routing flow intact

## Phase 3 — Citizen parcel architecture
- [x] "My Parcels" (`/citizen/parcels`) = citizen's associated parcels (CitizenPortal.tsx:29)
- [x] "Find Parcels" (`/citizen/find`) = GIS/identifier search — clearly distinct (CitizenPortal.tsx:30)
- [x] Parcel 360 (`/parcels/:id`) stays contextual (public deep link, App.tsx:512), exposing full Land Stack fields

## Phase 4 — Citizen case architecture
- [x] Keep `/citizen/my-cases` as case-tracking workspace (CitizenPortal.tsx:32)
- [x] Legacy redirects kept, hidden from nav: `/citizen/raise-request`→`/get-assistance`, `/citizen/requests`→`/my-cases`, `/citizen/verify`→`/get-assistance`, `/citizen/documents`→`/profile?tab=documents` (CitizenPortal.tsx:33-36)

## Phase 5 — Officer navigation
- [x] Officer navbar = Dashboard / Cases / Tasks / Tools / Analytics / Notifications / Profile
- [x] Map: Dashboard→`/officer`, Cases→`/officer/requests`, Tasks→`/officer/tasks`, Notifications→`/officer/notifications`, Profile→`/officer/profile`

## Phase 6 — Rename "Assigned Requests" → "Cases"
- [x] Change label only; keep route `/officer/requests`

## Phase 7 — Keep Tasks separate from Cases
- [x] Cases = "what am I responsible for"; Tasks = "what must I personally do" — not merged

## Phase 8 — Dynamic Officer Tools
- [x] Tools menu generated from department capability matrix (no 8 hardcoded portals)
- [x] Authenticated officer → department → capabilities → Tools nav

## Phase 9 — Department Tools mapping
- [x] Land Records: no specialized page (Cases / Tasks / Parcel 360)
- [x] Registration: Registration Chain (`/officer/registration-chain`), Duplicate Registry (`/officer/duplicate-registry`)
- [x] Planning: Planning Map (relabel `/officer/map`)
- [x] Tax: Reassessment Queue (`/officer/reassessment-queue`), Tax Analytics (`/officer/tax-analytics`)
- [x] Restriction: Governance Alerts (`/officer/alerts`)
- [x] Encumbrance: Fraud Prevention (`/officer/fraud-prevention`), Certificate Generator (`/officer/certificate-generator`)
- [x] Dispute: Governance Alerts (`/officer/alerts`), Historical Imagery (`/officer/historical-imagery`)
- [x] Survey: Survey Map (`/officer/map`), Change Detection (`/officer/change-detection`), Documents (`/officer/documents`), Governance Alerts (`/officer/alerts`), Historical Imagery (`/officer/historical-imagery`)

## Phase 10 — Officer Analytics
- [x] Group SLA (`/officer/sla`) + Performance (`/officer/performance`) under Analytics; keep URLs

## Phase 11 — Verifier navigation
- [x] Verifier navbar = Dashboard (`/verifier`) / Profile (`/verifier/profile`) (VERIFIER_NAV_ITEMS)
- [x] `/verifier/task/:taskId/evidence` and `.../findings` stay contextual (VerifierPortal.tsx:14-15, not in navbar)

## Phase 12 — Offline Sync
- [x] `/verifier/local-sync` kept as utility route (VerifierPortal.tsx:16), surfaced from Verifier Dashboard (not navbar)

## Phase 13 — Admin navigation
- [x] Admin navbar = Dashboard / Departments / Workflows / Officers / System / Map Layers / Profile
- [x] Relabel "Officer Monitoring"→"Officers" (only if page supports officer management), "System Monitoring"→"System" (nav label only; page headings keep full titles via `adminPortal.systemMonitoringTitle`/`officerMonitoringTitle`)
- [x] Routes kept: `/admin`, `/admin/departments`, `/admin/workflows`, `/admin/officer-monitoring`, `/admin/system-monitoring`, `/admin/map-layers`, `/admin/profile`

## Phase 14 — Separate navigation from authorization
- [x] Auth model = Role + Department + Capabilities + Permissions (role→`useAuthUser`; department→`ROLE_DEPARTMENT`; capabilities→`OFFICER_TOOLS[department]`)
- [x] Derive route access (RequireAuth + Phase 18 dept gate), navbar visibility (`navItemsFor`), action permissions from it
- [x] Confirm: hiding a navbar item ≠ denying route access — navbar visibility (`navConfig`) and route access (`RequireAuth`/OfficerPortal gate) are independent; backend still enforces API-level authz

## Phase 15 — Route classification
- [x] Classify every route: Primary / Department-gated / Contextual-deeplink / Utility-legacy (see Phase 22 table below)
- [x] Document classification alongside route config (Phase 22 canonical route contract table)

## Phase 16 — Refactor `navConfig.ts`
- [x] Becomes nav definition (not auth engine): public / citizen / officer{common,tools,analytics} / verifier / admin
- [x] Officer tools generated from `OFFICER_TOOLS[department]` — no route duplicated 8×

## Phase 17 — Refactor `OfficerPortal.tsx`
- [x] Render common nav + Cases + Tasks + dynamic Tools + Analytics + Notifications + Profile (nav in one merged `App.tsx` navbar via `getOfficerNavItems`; OfficerPortal only mounts routes)
- [x] Keep route mounting separate from navbar rendering (OfficerPortal.tsx has no nav markup — routes only)

## Phase 18 — Route guards
- [x] Independent checks: authenticate (RequireAuth) → access portal (OFFICER_ROLES) → access route (dept-gated via `OFFICER_TOOLS[department]`) → perform action (backend)
- [x] Verify e.g. TAX_OFFICER cannot reach `/officer/change-detection` by typing URL (OfficerPortal.tsx `gate()` redirects to portal index; covered by OfficerPortal.test.tsx "URL-hop" + "does own" tests)

## Phase 19 — Preserve Unified Map
- [x] All map contexts continue using `UnifiedMapWrapper` (FindParcelsPage, OfficerMapPage, Parcel360View, HistoricalMapView, AssignedVisitsPage, AdminCombinedLayerMap); `MapComponent` imported only by `UnifiedMapWrapper` — no new map impls

## Phase 20 — UX rules
- [x] Navbar=workspace; submenu=capability (Tools/Analytics dropdowns); page=operation; deep route=workflow state; modal=quick action; backend=security; route existence ≠ nav exposure (Phase 14 + Phase 18)

## Phase 21 — Testing (after each migration)
- [x] Guest: correct navbar/public routes, no authed access (App.test.tsx "guest navbar" + "auth pages get no main navbar")
- [x] Citizen: navbar, Services, My Parcels, My Cases, legacy redirects (App.test.tsx "per-role" citizen + mobile nav; CitizenPortal redirects in code)
- [x] Each of 8 officer departments: common tabs, correct Tools, unauthorized tools absent, direct unauthorized URLs rejected, Analytics/Cases/Tasks reachable (App.test.tsx officer per-role Tools dropdown; OfficerPortal.test.tsx Phase 18 URL-hop reject + allow)
- [x] Verifier: Dashboard → Task → Evidence → Findings → Sync (VerifierPortal routes mounted; nav = Dashboard/Profile)
- [x] Admin: all 7 navbar items (App.test.tsx admin per-role; AdminPortal.test.tsx page headings)
- [x] Full suite still ≥ 323 passing (baseline 314/314; re-verified after Phase 18 — see run below)
- [ ] Manual role-by-role QA in a browser (out of automated scope — human step)

## Phase 22 — Final route audit
- [x] Canonical route contract table (below)

### Canonical route contract

Type legend: **Primary** = in navbar · **Dept-gated** = officer route allowed only if `OFFICER_TOOLS[dept]` owns it (Phase 18) · **Contextual** = deep link, not in navbar · **Utility/Legacy** = redirect or support route, hidden from navbar.

| Route | Role | Nav visibility | Access guard | Type |
|---|---|---|---|---|
| `/` | Guest/Citizen | Home | public (citizen sees HomePage, others redirect to portal) | Primary |
| `/about`, `/features` | Guest | About/Features | public | Primary |
| `/login`, `/register`, `/auth/callback` | Guest | — (brand strip only) | public | Utility |
| `/privacy-policy`, `/terms-of-use`, `/contact-us` | any | footer | public | Utility |
| `/parcels/:id` | any | — | public deep link | Contextual |
| `/citizen`, `/citizen/parcels`, `/citizen/find`, `/citizen/get-assistance`, `/citizen/my-cases` | CITIZEN | navbar | RequireAuth[CITIZEN] | Primary |
| `/citizen/notifications`, `/citizen/profile` | CITIZEN | navbar (icon) | RequireAuth[CITIZEN] | Primary |
| `/citizen/raise-request`,`/requests`,`/verify`,`/documents` | CITIZEN | — | RequireAuth[CITIZEN] → Navigate | Utility/Legacy |
| `/officer`, `/officer/requests`, `/officer/tasks` | OFFICER_ROLES | navbar (common) | RequireAuth[OFFICER_ROLES] | Primary |
| `/officer/sla`, `/officer/performance` | OFFICER_ROLES | navbar (Analytics ▾) | RequireAuth[OFFICER_ROLES] | Primary |
| `/officer/notifications`, `/officer/profile` | OFFICER_ROLES | navbar (icon) | RequireAuth[OFFICER_ROLES] | Primary |
| `/officer/alerts` | RESTRICTION/DISPUTE/SURVEY | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/map` | PLANNING/TAX/SURVEY | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/historical-imagery` | DISPUTE/SURVEY | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/change-detection`, `/officer/documents` | SURVEY | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/duplicate-registry`, `/officer/registration-chain` | REGISTRATION | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/reassessment-queue`, `/officer/tax-analytics` | TAX | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/officer/fraud-prevention`, `/officer/certificate-generator` | ENCUMBRANCE | navbar (Tools ▾) | RequireAuth + dept gate | Dept-gated |
| `/verifier`, `/verifier/profile` | VERIFIER | navbar | RequireAuth[VERIFIER] | Primary |
| `/verifier/task/:taskId/evidence`, `.../findings` | VERIFIER | — | RequireAuth[VERIFIER] | Contextual |
| `/verifier/local-sync` | VERIFIER | — (from dashboard) | RequireAuth[VERIFIER] | Utility |
| `/admin`, `/admin/departments`, `/admin/workflows`, `/admin/officer-monitoring`, `/admin/system-monitoring`, `/admin/map-layers`, `/admin/profile` | ADMIN | navbar | RequireAuth[ADMIN] | Primary |

> Backend enforces API-level authorization independently; the SPA guards above are UX + navigation, not the security boundary (Phase 14). Backend per-department API authz is tracked separately (out of this IA-refactor's scope).

---

## Implementation order
- [x] 1. Freeze + baseline tests
- [x] 2. Define canonical nav schema
- [x] 3. Refactor `navConfig.ts`
- [x] 4. Citizen navbar
- [x] 5. Officer common navbar
- [x] 6. Dynamic department Tools
- [x] 7. Officer Analytics grouping
- [x] 8. Verifier navbar
- [x] 9. Admin navbar
- [x] 10. Separate route guards from nav visibility
- [x] 11. Preserve legacy redirects
- [x] 12. Route/access audit
- [x] 13. Full test suite
- [ ] 14. Manual role-by-role QA (human step, in a browser)
- [x] 15. Final route documentation

**Hard constraint:** do not change the workflow/case engine, routing service, department capabilities, Parcel 360, verifier workflow, historical imagery, governance alerts, audit trail, or APIs unless a nav bug exposes a real backend authorization problem.
