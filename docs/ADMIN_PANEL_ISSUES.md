# Admin & Officer Portal — Requirements & Issues (open, not yet started)

Two audits combined into one pending-work doc:

- **Admin Panel issues** — raised by the user 2026-09-09, after the Phase 3 Admin Portal work (Departments + System Monitoring, `docs/FRONTEND_UPGRADE_SPEC.md` §7) was already complete.
- **Officer Portal verification checklist** — a 9-point checklist the user asked to be verified against the actual code (Quick Actions, Profile, sidebar/logout, Governance Alert document evidence, 4-stage alert verification, Dismiss reason, Admin map, redundant Notifications, global language support), completed 2026-09-10.

Every item below was checked against the actual code (and, where noted, a live API call) before being logged — this is a punch list to work through, not a batch of guesses. Two items turned out to be the *same root cause* affecting both portals (sidebar/nav structure, i18n coverage) and are merged into one entry each under **Cross-Portal Issues** rather than listed twice.

---

## Coming Soon Placeholders (still shown to users, added 2026-09-10, first priority)

Straightforward "not built yet" screens — distinct from the issues below
(those are behavior/design gaps in already-*built* features; these three
are just missing pages/panels, each with a plain `ComingSoonCard` or
disabled placeholder card standing in for them today).

### 1. Officer Portal → Documents

**Status: not built.** `frontend/src/pages/officer/OfficerDocumentsPage.tsx` — full `ComingSoonCard` placeholder: *"Documents submitted alongside a request, grouped by parcel and request, with inline review — not built yet."* Most of the underlying capability already exists via `frontend/src/features/officer/WorkflowReviewPanel.tsx` (an officer reviewing a Land Claim/Verify Documents/Dispute request already sees the stored papers + citizen-submitted evidence, zoomable) — this page would be a dedicated cross-request document browser (all documents, across every request, in one place), which was never built as its own page.

### 2. Admin Dashboard → Workflow Oversight

**Status: not built.** `frontend/src/pages/admin/AdminDashboardPage.tsx:72-95` — disabled, dashed-border placeholder card. The backend already allows an Admin to act on any department's workflow step (`WorkflowsController.reviewStep` has no department restriction for the `ADMIN` role), but there is no review screen for it in the Admin Portal yet.

### 3. Admin Dashboard → Map Layer Authoring

**Status: not built.** `frontend/src/pages/admin/AdminDashboardPage.tsx:97-117` — disabled, dashed-border placeholder card (this is also the "map section" Admin issue #6 below refers to — there is no *functioning* map anywhere in Admin, just this). Zoning, restriction, and infrastructure map layers already have working create/edit/delete APIs (`backend/src/gis/gis.controller.ts`); there's no admin screen to drive them yet.

---

## Cross-Portal Issues (affect both Admin and Officer)

### A. No left sidebar anywhere; Logout lives in the shared top bar, not separated

**Requirement** (Officer checklist #3, generalizes Admin issue's old #5): a government-style **left sidebar** for the Officer (and, implicitly, Admin) interface, with **Logout at the bottom, separated from normal nav items**.

**Status: not implemented — and this reverses an earlier, deliberate design decision.** There is no sidebar anywhere in this codebase for any role. `frontend/src/App.tsx`'s `AppShell` (lines 199-256) renders one shared horizontal **top** navbar for Citizen/Officer/Admin alike. This was an explicit prior decision, documented in the code itself: `frontend/src/navConfig.ts:1-7` — *"no separate portal-owned sub-nav any more... the user's explicit follow-up: 'i dont want 2 diffrent navbars fit the things in the orignal navbar only'"*. "Sign Out" is a plain text link inside the top utility bar (`App.tsx:175-178`), sitting between the language selector and theme toggle — not a sidebar, nothing at a "bottom." Logout **functionality itself works correctly** (`handleLogout` → `useLogout()` clears the shared auth cache/token → redirects to `/`) — this is a placement/structure issue, not a broken feature.

**Would need**: confirm intent before building, since it directly reverses the "one navbar, no sidebar" decision above. If confirmed, a real Officer/Admin-specific left sidebar component, with routing unchanged (`OfficerPortal.tsx`/`AdminPortal.tsx`'s existing `<Routes>`), and Logout moved out of the top utility bar into the sidebar's own bottom section for those two roles specifically (Citizen Portal presumably keeps the current top navbar, unless told otherwise).

### B. Language change doesn't visibly affect Officer or Admin screens

**Requirement** (Officer checklist #9, generalizes Admin issue's old #7): language selector must work across Home, Citizen, Officer, and Admin pages alike, not just Home/Citizen.

**Status: mechanism is genuinely global; coverage is not.** `frontend/src/i18n/config.ts` initializes one `i18next` instance; `App.tsx`'s navbar calls `i18n.changeLanguage()` on that shared instance and persists the choice to `localStorage` (`bhoomisetu_language`), re-read on load — a language choice **does** survive navigation and reloads, via a real global provider (`react-i18next`), not per-page state. This part is not fake.

The actual gap is **coverage**: `grep -c '\bt\('` returns **0** across all of `frontend/src/features/officer/**` and `frontend/src/pages/officer/**`, **0** across `frontend/src/features/admin/**`, and only **9** (all in one file — `AdminDashboardPage.tsx`'s two "coming soon" placeholder cards) across `frontend/src/pages/admin/**`. Every other Officer/Admin file is 100% hardcoded English: `OfficerDashboardPage`, `OfficerProfilePage`, `AssignedRequestsPage`, `OfficerMapPage`, `OfficerDocumentsPage`, `HistoricalImageryPage`/`HistoricalImageryPanel`, `GovernanceAlertsPanel`, `GovernanceAlertDetailModal`, `GovernanceAlertReasonPrompt`, `WorkflowReviewPanel`, `AdminDepartmentsPage`, `SystemMonitoringPage`, `DepartmentManagement`, `SystemMonitoring`, `UserManagement`. `frontend/src/navConfig.ts` documents this as deliberate: `OFFICER_NAV_ITEMS`/`ADMIN_NAV_ITEMS` use a plain `label` string, not the i18n `labelKey` path `CITIZEN_NAV_ITEMS` uses. Net effect: switching to Hindi visibly changes Home/Citizen Portal/shared navbar chrome, but changes nothing inside Officer or Admin screens — matching what the user observed, even though the underlying plumbing is global.

**Would need**: add i18n keys for every hardcoded Officer + Admin string (mirroring the `citizenPortal.*`/`citizenNav.*` pattern in `frontend/src/i18n/locales/{en,hi}.json`) and switch both `OFFICER_NAV_ITEMS` and `ADMIN_NAV_ITEMS` from `label` to `labelKey`. Mechanical but touches many files across both portals.

---

## Admin Panel Issues

### 1. Single active session per user + session timeout

**Status: not implemented.** JWT is stateless with a flat 24-hour expiry (`JWT_EXPIRES_IN = '24h'`, `backend/src/auth/jwt.constants.ts`, wired into `signOptions` in `backend/src/auth/auth.module.ts`). No session table, no server-side token tracking, no revocation, no idle timeout, no enforcement that a new login invalidates a prior token — for any role.

**Would need**: a real session concept (e.g. a `sessions` table keyed by user + token/jti, checked in `JwtStrategy`; login either revokes the previous session or the previous token stops validating) plus a shorter, enforced timeout distinct from the JWT's own expiry. Real auth-architecture change, worth scoping carefully.

### 2. Citizen-service actions leaking into Admin

**Status: 3 of 4 fixed (2026-09-09), as a side effect of unrelated work.** The land-claim/document-verification/profile feature work required gating Parcel 360's "Request Documents"/"Report Issue"/"File a Dispute" buttons (`frontend/src/features/parcels/Parcel360View.tsx`) on the signed-in citizen actually owning that specific parcel (`isOwnParcel`, checked against `GET /parcels/mine`). That gate also means an admin/officer viewing the same screen no longer sees any of these three buttons, since `isOwnParcel` is never true for a non-citizen. Verified live in `Parcel360View.test.tsx`.

**Still open**: "Back to Search" is untouched (plain `window.history.back()`, not tied to a specific parcel). Small separate change if still wanted.

### 3. "Explain with AI" giving predefined answers

**Status: reported as broken, but not reproducible as described — tested live and it works.** `POST /ai/parcels/:id/explain` returns genuinely distinct, data-grounded explanations for different parcels. No hardcoded/mock fallback path exists in `ai.service.ts`.

**Open question, not yet resolved**: needs the user to specify exactly where they saw this.

### 4. Officer monitoring (how officers handle citizen issues)

**Status: does not exist.** No officer-specific view anywhere in the backend or Admin Portal. Only the generic audit feed (`RecentActivity`) exists, with no per-officer aggregation.

**Would need**: a real new feature — backend aggregation over `workflows`/`workflow_steps` grouped by officer/department, plus a new Admin Portal page. Scoped as new work.

### 5. Duplicate Logout / Sign Out

**Status: already fixed.** Exactly one "Sign Out" control exists, in the shared global navbar. If still being seen, it's from a build predating that change.

### 6. Admin dashboard "map section"

**Status: nothing to remove — it's a disabled placeholder, not a functioning map.** Grepped `frontend/src/pages/admin/*` and `frontend/src/features/admin/*` for `MapComponent`/`maplibre` — zero matches. `AdminDashboardPage.tsx:97-117` has one dashed-border, `disabled`-button, "Coming Soon"-badged **"Map Layer Authoring"** placeholder card — no data fetched, no live map, no API calls.

**Open question**: if the user is still seeing something they'd call a "map," it's most likely this placeholder card (or possibly confused with `TopRiskParcels`/`AnalyticsDashboard` on the same dashboard, neither of which imports any map component either). Confirm exactly what was seen before removing anything.

---

## Officer Portal Issues (verification checklist, 2026-09-10)

### 1. Remove Quick Actions

**Status: not done — confirmed fully redundant.** `frontend/src/pages/officer/OfficerDashboardPage.tsx:99-113` has a "Quick Actions" grid (Assigned Requests, Governance Alerts, Map, Notifications) — all four already exist verbatim in the top nav (`frontend/src/navConfig.ts:28-37`, `OFFICER_NAV_ITEMS`).

**Would need**: delete the Quick Actions block (lines 99-113) and its `quickLinks` array (lines 43-48). Small, safe, no design decision needed.

### 2. Dedicated Profile section

**Status: partially done.** `frontend/src/pages/officer/OfficerProfilePage.tsx` exists as its own page, separate from dashboard content, reachable via nav (`/officer/profile`). Shows Name/Email/Role/Department. But it's minimal — no edit capability, no extra fields, no visual richness compared to the Citizen Portal's `ProfilePage.tsx` (tabs, editable details, documents).

**Would need**: a scope decision on how much richer it should be (edit fields? more info?) before building further.

### 3. Governance Alert must show the user's submitted document as proof

**Status: not done — and the premise doesn't match this app's architecture.** `backend/src/governance/governance-alert.entity.ts` has no document/file column at all (`parcelId, alertType, severity, source, status, explanation, reason, createdAt` only). Alerts are generated by **automated backend monitoring** (`source: RESTRICTION_MONITOR | CHANGE_DETECTION | TAX_MONITOR | HISTORICAL_IMAGERY`), never by a citizen uploading a document — there is no "user who submitted a document that triggered this alert" concept anywhere in the system. `GovernanceAlertDetailModal.tsx` shows only the text `explanation` + optional AI explanation + the reviewer's own reason.

**Important**: the capability described (real citizen document + AI explanation as a supplement, zoomable) **already exists — for Workflows**, not Governance Alerts: `frontend/src/features/officer/WorkflowReviewPanel.tsx` shows a Land Claim/Verify Documents/Dispute request's stored papers and citizen-submitted evidence with a zoom viewer (`AuthenticatedDocumentImage`/`ImageLightbox`), correctly linked to the right parcel/workflow.

**Open question**: confirm whether the user meant the Workflow review screen (already done) or genuinely wants Governance Alerts to also carry a document — the latter is new work, since alerts have no document-producing source today.

### 4. Governance Alerts need four verification stages, not just Mark Reviewed/Dismiss

**Status: not done.** Only two actions exist: "Mark Reviewed" and "Dismiss" (`GovernanceAlertsPanel.tsx`, `GovernanceAlertDetailModal.tsx:118-132`). `status` is a 3-value enum (`OPEN|REVIEWED|DISMISSED`) with no multi-stage concept anywhere in the entity, service, or UI.

**Would need**: a real new data model (what are the 4 stages? what does "evidence" mean per stage?) plus new UI — scoped as its own design pass, not a small fix.

### 5. Dismiss requires a reason

**Status: done.** Frontend: `GovernanceAlertReasonPrompt.tsx` blocks submission with an inline error until non-empty. Backend: `backend/src/governance/dto/governance-alert.dto.ts` — `reason` has `@IsString() @IsNotEmpty()` (real 400, not just UI). `GovernanceAlertsService.updateStatus` requires it as a non-optional string and persists it to `alert.reason`; shown back in the detail modal as "Reviewer's note." Applies to both Dismiss *and* Mark Reviewed. No action needed.

### 6. Redundant Notifications navigation item

**Status: partially done / premise doesn't fully hold.** `NotificationFeed.tsx`'s notification types include `WORKFLOW_ASSIGNED`/`WORKFLOW_STEP_APPROVED`/`WORKFLOW_STEP_REJECTED` — new citizen requests assigned to the officer and decisions on them — which have nothing to do with Governance Alerts and appear nowhere on `/officer/alerts`. It also includes `GOVERNANCE_ALERT_REVIEWED`/`GOVERNANCE_ALERT_DISMISSED`, sent to a *different* department than the one that acted (`governance-alerts.service.ts:64-85`).

**Would need**: nothing removed wholesale — Notifications is the only in-app signal for new work assignments. If anything, only the governance-alert-review notification type is the genuinely-redundant slice; removing just that (not the whole page) would need confirming with the user first.

---

## Suggested sequencing (not yet agreed with the user)

**First priority** — the three Coming Soon placeholders (added 2026-09-10, explicitly called out as first priority):
1. **Coming Soon #1** (Officer → Documents) — real page needed; can lean on `WorkflowReviewPanel`'s existing document/evidence display rather than starting from scratch.
2. **Coming Soon #2** (Admin → Workflow Oversight) — backend already supports it; needs a review screen.
3. **Coming Soon #3** (Admin → Map Layer Authoring) — backend APIs already exist; needs an admin screen.

Then, cheapest/safest first:
4. **Officer #1** (remove Quick Actions) — small, contained, no design decision.
5. **Admin #2** (gate citizen buttons) — 3 of 4 done; "Back to Search" is the one small remaining piece if still wanted.
6. **Cross-Portal B** (i18n coverage for Officer + Admin) — mechanical, no design decisions needed, but touches many files.
7. **Cross-Portal A** (sidebar + logout placement) and **Admin #6**/**Officer #6** — need scope decisions first (see open questions above).
8. **Officer #2** (richer Profile) — needs a scope decision on how much richer.
9. **Admin #1** (sessions), **Admin #4** (officer monitoring), **Officer #3** (alert document proof), **Officer #4** (four verification stages) — genuine new features/architecture, each worth its own planning pass.
10. **Admin #3** — blocked on the user clarifying where they saw the issue; **Admin #5** and **Officer #5** — already done, no action needed.
