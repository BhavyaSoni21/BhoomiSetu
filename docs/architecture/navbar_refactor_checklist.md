# Navbar & Route Refactor — Tracked Checklist

Tracks execution of `navbar_corretion.md`. **Scope: frontend information-architecture refactor only.** Preserve all backend routes, workflows, APIs, and the 323/323 test baseline. No working route is deleted — only relabeled, grouped, hidden, or redirected.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Freeze + baseline
- [ ] Confirm 323/323 tests passing (record as baseline)
- [ ] Snapshot current routes, `navConfig.ts`, `OfficerPortal.tsx`, `CitizenPortal.tsx`, `AdminPortal.tsx`, `VerifierPortal.tsx`
- [ ] Snapshot route guards, role/department mapping, capability checks, existing redirects
- [ ] Rule recorded: do not delete any existing route during this refactor

## Phase 1 — Canonical nav model (Guest)
- [ ] Guest navbar = Home / About / Features / Get Started
- [ ] Routes `/`, `/about`, `/features`, `/login`, `/register`
- [ ] Keep `/parcels/:id` as public deep link

## Phase 2 — Citizen navigation
- [ ] Citizen navbar = Home / My Parcels / Find Parcels / Services / My Cases / Notifications / Profile
- [ ] Relabel "Get Assistance" → "Services" (label only; keep route `/citizen/get-assistance`)
- [ ] Verify Services → AI Assistance → confirmation → application → case → routing flow intact

## Phase 3 — Citizen parcel architecture
- [ ] "My Parcels" (`/citizen/parcels`) = citizen's associated parcels
- [ ] "Find Parcels" (`/citizen/find`) = GIS/identifier search — clearly distinct
- [ ] Parcel 360 (`/citizen/parcels/:id`) stays contextual, exposing full Land Stack fields

## Phase 4 — Citizen case architecture
- [ ] Keep `/citizen/my-cases` as case-tracking workspace (parcel/request/dept/stage/status/timeline/docs/actions/resolution)
- [ ] Legacy redirects kept, hidden from nav: `/citizen/raise-request`→`/get-assistance`, `/citizen/requests`→`/my-cases`, `/citizen/verify`→`/get-assistance`, `/citizen/documents`→`/profile?tab=documents`

## Phase 5 — Officer navigation
- [ ] Officer navbar = Dashboard / Cases / Tasks / Tools / Analytics / Notifications / Profile
- [ ] Map: Dashboard→`/officer`, Cases→`/officer/requests`, Tasks→`/officer/tasks`, Notifications→`/officer/notifications`, Profile→`/officer/profile`

## Phase 6 — Rename "Assigned Requests" → "Cases"
- [ ] Change label only; keep route `/officer/requests`

## Phase 7 — Keep Tasks separate from Cases
- [ ] Cases = "what am I responsible for"; Tasks = "what must I personally do" — not merged

## Phase 8 — Dynamic Officer Tools
- [ ] Tools menu generated from department capability matrix (no 8 hardcoded portals)
- [ ] Authenticated officer → department → capabilities → Tools nav

## Phase 9 — Department Tools mapping
- [ ] Land Records: no specialized page (Cases / Tasks / Parcel 360)
- [ ] Registration: Registration Chain (`/officer/registration-chain`), Duplicate Registry (`/officer/duplicate-registry`)
- [ ] Planning: Planning Map (relabel `/officer/map`)
- [ ] Tax: Reassessment Queue (`/officer/reassessment-queue`), Tax Analytics (`/officer/tax-analytics`)
- [ ] Restriction: Governance Alerts (`/officer/alerts`)
- [ ] Encumbrance: Fraud Prevention (`/officer/fraud-prevention`), Certificate Generator (`/officer/certificate-generator`)
- [ ] Dispute: Governance Alerts (`/officer/alerts`), Historical Imagery (`/officer/historical-imagery`)
- [ ] Survey: Survey Map (`/officer/map`), Change Detection (`/officer/change-detection`), Documents (`/officer/documents`), Governance Alerts (`/officer/alerts`), Historical Imagery (`/officer/historical-imagery`)

## Phase 10 — Officer Analytics
- [ ] Group SLA (`/officer/sla`) + Performance (`/officer/performance`) under Analytics; keep URLs

## Phase 11 — Verifier navigation
- [ ] Verifier navbar = Dashboard (`/verifier`) / Profile (`/verifier/profile`)
- [ ] `/verifier/task/:taskId/evidence` and `.../findings` stay contextual (not in navbar)

## Phase 12 — Offline Sync
- [ ] `/verifier/local-sync` kept as utility route, surfaced from Verifier Dashboard (not navbar)

## Phase 13 — Admin navigation
- [ ] Admin navbar = Dashboard / Departments / Workflows / Officers / System / Map Layers / Profile
- [ ] Relabel "Officer Monitoring"→"Officers" (only if page supports officer management), "System Monitoring"→"System"
- [ ] Routes kept: `/admin`, `/admin/departments`, `/admin/workflows`, `/admin/officer-monitoring`, `/admin/system-monitoring`, `/admin/map-layers`, `/admin/profile`

## Phase 14 — Separate navigation from authorization
- [ ] Auth model = Role + Department + Capabilities + Permissions
- [ ] Derive route access, navbar visibility, action permissions from it
- [ ] Confirm: hiding a navbar item ≠ denying route access; backend enforces

## Phase 15 — Route classification
- [ ] Classify every route: Primary / Department-gated / Contextual-deeplink / Utility-legacy
- [ ] Document classification alongside route config

## Phase 16 — Refactor `navConfig.ts`
- [ ] Becomes nav definition (not auth engine): public / citizen / officer{common,tools,analytics} / verifier / admin
- [ ] Officer tools generated from `OFFICER_TOOLS[department]` — no route duplicated 8×

## Phase 17 — Refactor `OfficerPortal.tsx`
- [ ] Render common nav + Cases + Tasks + dynamic Tools + Analytics + Notifications + Profile
- [ ] Keep route mounting separate from navbar rendering

## Phase 18 — Route guards
- [ ] Independent checks: authenticate → access portal → access route → perform action
- [ ] Verify e.g. TAX_OFFICER cannot reach `/officer/change-detection` by typing URL

## Phase 19 — Preserve Unified Map
- [ ] All map contexts continue using `UnifiedMapWrapper`, configured per context (no new map impls)

## Phase 20 — UX rules
- [ ] Navbar=workspace; submenu=capability; page=operation; deep route=workflow state; modal=quick action; backend=security; route existence ≠ nav exposure

## Phase 21 — Testing (after each migration)
- [ ] Guest: correct navbar/public routes, no authed access
- [ ] Citizen: navbar, Services, My Parcels, My Cases, legacy redirects
- [ ] Each of 8 officer departments: common tabs, correct Tools, unauthorized tools absent, direct unauthorized URLs rejected, Analytics/Cases/Tasks reachable
- [ ] Verifier: Dashboard → Task → Evidence → Findings → Sync
- [ ] Admin: all 7 navbar items
- [ ] Full suite still ≥ 323 passing

## Phase 22 — Final route audit
- [ ] Produce canonical route contract table (Route / Role / Visibility / Access / Type)

---

## Implementation order
- [ ] 1. Freeze + baseline tests
- [ ] 2. Define canonical nav schema
- [ ] 3. Refactor `navConfig.ts`
- [ ] 4. Citizen navbar
- [ ] 5. Officer common navbar
- [ ] 6. Dynamic department Tools
- [ ] 7. Officer Analytics grouping
- [ ] 8. Verifier navbar
- [ ] 9. Admin navbar
- [ ] 10. Separate route guards from nav visibility
- [ ] 11. Preserve legacy redirects
- [ ] 12. Route/access audit
- [ ] 13. Full test suite
- [ ] 14. Manual role-by-role QA
- [ ] 15. Final route documentation

**Hard constraint:** do not change the workflow/case engine, routing service, department capabilities, Parcel 360, verifier workflow, historical imagery, governance alerts, audit trail, or APIs unless a nav bug exposes a real backend authorization problem.
