# Admin & Officer Portal — Requirements & Issues

Two audits combined into one pending-work doc:

- **Admin Panel issues** — raised by the user 2026-09-09, after the Phase 3 Admin Portal work (Departments + System Monitoring, `docs/FRONTEND_UPGRADE_SPEC.md` §7) was already complete.
- **Officer Portal verification checklist** — a 9-point checklist the user asked to be verified against the actual code (Quick Actions, Profile, sidebar/logout, Governance Alert document evidence, 4-stage alert verification, Dismiss reason, Admin map, redundant Notifications, global language support), completed 2026-09-10.

Every item below was checked against the actual code (and, where noted, a live API call) before being logged — this is a punch list to work through, not a batch of guesses. Two items turned out to be the *same root cause* affecting both portals (sidebar/nav structure, i18n coverage) and are merged into one entry each under **Cross-Portal Issues** rather than listed twice.

---

## Coming Soon Placeholders — all three done (2026-09-10)

Straightforward "not built yet" screens — distinct from the issues below
(those are behavior/design gaps in already-*built* features; these three
were just missing pages/panels, each with a plain `ComingSoonCard` or
disabled placeholder card standing in for them).

### 1. Officer Portal → Documents

**Status: done, then merged into Assigned Requests (2026-09-10).** Originally built as its own cross-request document browser (`OfficerDocumentsPage.tsx`). Per the user's explicit follow-up ("the documents should be the part of either Assigned Requests or Governance Alerts as the requests are raised... or combine them"), that page was deleted and its capability folded into `frontend/src/pages/officer/AssignedRequestsPage.tsx`: the left column now groups every workflow by parcel (showing stored land-property papers, zoomable, plus every request against that parcel) with a "Pending only" toggle (on by default, preserving the original Assigned Requests view); clicking a request loads `WorkflowReviewPanel` on the right, unchanged. The old `/officer/documents` route now redirects to `/officer/requests` (`<Navigate replace>`, same pattern `CitizenPortal.tsx` already uses for moved routes), and its nav entry was removed.

### 2. Admin Dashboard → Workflow Oversight

**Status: done.** `frontend/src/pages/admin/AdminWorkflowOversightPage.tsx` (nav: "Workflows") lists every department's workflows (optionally filtered by department/pending-only) and opens `WorkflowReviewPanel` in its Admin oversight mode. That mode was redesigned per the user's explicit follow-up ("the admin dont have to approve the workflow... he can alert the officers for checking on some case at the earliest"): monitoring is the default, "Alert Officer" (a new `POST /workflows/:id/steps/:stepId/escalate` endpoint, ADMIN-only, notifies the responsible officer without deciding anything) is the primary action, and "Decide Myself" is an explicit opt-in that reveals the real Approve/Reject form only when clicked.

### 3. Admin Dashboard → Map Layer Authoring

**Status: done.** `frontend/src/pages/admin/AdminMapLayerAuthoringPage.tsx` (nav: "Map Layer Authoring") drives the zoning/restriction/infrastructure create-edit-delete APIs via a tabbed, config-driven `MapLayerManagement.tsx`. Also picked up two follow-up asks from the user: (1) a map-drawing tool (`LayerGeometryDrawMap.tsx`, `@mapbox/mapbox-gl-draw` on top of the existing `maplibre-gl` dependency) scoped only to this admin screen — draw a shape instead of hand-typing GeoJSON; (2) a 4th, **admin-only** layer ("Admin Notes", free-form annotations) — `backend/src/spatial/admin-map-note.entity.ts` + `/gis/admin-notes`, every endpoint ADMIN-gated including reads (unlike the other three, which are public-read), and never fetched by the shared citizen/officer map (`features/map/MapComponent.tsx`).

---

## Cross-Portal Issues (affect both Admin and Officer)

### A. No left sidebar anywhere; Logout lives in the shared top bar, not separated

**Requirement** (Officer checklist #3, generalizes Admin issue's old #5): a government-style **left sidebar** for the Officer (and, implicitly, Admin) interface, with **Logout at the bottom, separated from normal nav items**.

**Status: declined by the user (2026-09-10) — stays as-is.** Explicitly asked ("Skip - keep current navbar" vs. "Build it for Officer/Admin only"); the user chose to keep the single shared top navbar, consistent with their earlier explicit instruction ("i dont want 2 diffrent navbars, fit the things in the original navbar only"). No further action.

### B. Language change doesn't visibly affect Officer or Admin screens

**Requirement** (Officer checklist #9, generalizes Admin issue's old #7): language selector must work across Home, Citizen, Officer, and Admin pages alike, not just Home/Citizen.

**Status: done (2026-09-10).** The mechanism was already genuinely global (`frontend/src/i18n/config.ts`'s single `i18next` instance, persisted via `localStorage`); the gap was coverage, which is now closed. Every Officer/Admin file that had zero `t()` calls now routes its text through two new namespace pairs — `officerNav`/`officerPortal` and `adminNav`/`adminPortal` — in `frontend/src/i18n/locales/{en,hi}.json`, with real Hindi translations (not copies of the English text): `OfficerDashboardPage`, `OfficerProfilePage`, `AssignedRequestsPage`, `OfficerMapPage`, `OfficerDocumentsPage`, `HistoricalImageryPage`/`HistoricalImageryPanel`, `GovernanceAlertsPanel`, `GovernanceAlertDetailModal`, `GovernanceAlertReasonPrompt`, `WorkflowReviewPanel`, `AdminDashboardPage`, `AdminDepartmentsPage`, `SystemMonitoringPage`, `DepartmentManagement`, `SystemMonitoring`, `UserManagement`, `RecentActivity`, plus the three newly-built Coming Soon pages and their supporting components. `frontend/src/navConfig.ts`'s `OFFICER_NAV_ITEMS`/`ADMIN_NAV_ITEMS` switched from plain `label` strings to the same `labelKey` path `CITIZEN_NAV_ITEMS` already used. English display text was kept byte-identical to what was hardcoded before, so every existing test that asserted specific English strings kept passing unchanged (272/272) — only the mechanism changed, not the rendered output.

---

## Admin Panel Issues

### 1. Single active session per user + session timeout

**Status: not implemented.** JWT is stateless with a flat 24-hour expiry (`JWT_EXPIRES_IN = '24h'`, `backend/src/auth/jwt.constants.ts`, wired into `signOptions` in `backend/src/auth/auth.module.ts`). No session table, no server-side token tracking, no revocation, no idle timeout, no enforcement that a new login invalidates a prior token — for any role.

**Would need**: a real session concept (e.g. a `sessions` table keyed by user + token/jti, checked in `JwtStrategy`; login either revokes the previous session or the previous token stops validating) plus a shorter, enforced timeout distinct from the JWT's own expiry. Real auth-architecture change, worth scoping carefully.

### 2. Citizen-service actions leaking into Admin

**Status: done (2026-09-10).** The land-claim/document-verification/profile feature work required gating Parcel 360's "Request Documents"/"Report Issue"/"File a Dispute" buttons (`frontend/src/features/parcels/Parcel360View.tsx`) on the signed-in citizen actually owning that specific parcel (`isOwnParcel`, checked against `GET /parcels/mine`). That gate also means an admin/officer viewing the same screen no longer sees any of these three buttons, since `isOwnParcel` is never true for a non-citizen. Verified live in `Parcel360View.test.tsx`. The remaining piece, "Back to Search", stays visible to everyone (harmless browser-back navigation, not a citizen-only service action) but its label is now role-aware — "Back to Search" for a citizen, plain "Back" for Officer/Admin, since staff more often arrive at Parcel 360 from a workflow/alert/audit-log link than an actual search.

### 3. "Explain with AI" giving predefined answers

**Status: resolved, no action needed (confirmed by the user 2026-09-10).** Reported as broken, but not reproducible as described — tested live and it works. `POST /ai/parcels/:id/explain` returns genuinely distinct, data-grounded explanations for different parcels. No hardcoded/mock fallback path exists in `ai.service.ts`. Asked the user for specifics; they confirmed no further action needed.

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

**Status: done (2026-09-10).** The redundant "Quick Actions" grid and its `quickLinks` array were removed from `frontend/src/pages/officer/OfficerDashboardPage.tsx` — all four links already existed verbatim in the top nav.

### 2. Dedicated Profile section

**Status: done (2026-09-10).** Per the user's explicit choice ("Match Citizen's Profile pattern"), `OfficerProfilePage.tsx` now has the same editable depth as the Citizen Portal's `ProfilePage.tsx`: an editable Profile Details card (name/address/government ID/occupation) and verified email/mobile contact methods with the OTP flow, plus Member Since. `ContactMethodCard`/`ProfileDetailsCard` were extracted out of `ProfilePage.tsx` into `features/auth/` so both portals share the exact same components rather than duplicating them; `POST /auth/verify-otp`, `/auth/resend-otp`, `/auth/profile/contact`, `/auth/profile/details` were widened from `CITIZEN_ROLE`-only to every role (the underlying `AuthService` methods were already role-agnostic). No second "Documents" tab, unlike Citizen — an officer has no personal linked-parcel documents to show.

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

### 7. Officer notifications should route to, and select, the specific item — not just open Parcel 360

**Status: done (2026-09-10).** Two separate but related follow-ups from the user:

- *"the notification in officer must not lead to parcel 360 view... notification should lead to Assigned Requests / Governance Alerts these tabs"* — `NotificationFeed.tsx` now branches on whether the signed-in user is an officer (`useAuthUser()` + `OFFICER_ROLES`): officer notifications never open `/parcels/:id` any more. `GOVERNANCE_ALERT_*` types route to `/officer/alerts`; everything else (`WORKFLOW_*`) routes to `/officer/requests`. Citizen notifications are unchanged (still open the relevant parcel).
- *"it would be great if the notification that is leading to the respective tab is also selected there like there are workflow review and view details option"* — the route now also carries the specific id as a query param (`/officer/requests?workflow=<id>`, `/officer/alerts?alert=<id>`), and both destination pages read it on mount/change to auto-select that item: `AssignedRequestsPage.tsx` opens the matching `WorkflowReviewPanel`, `GovernanceAlertsPanel.tsx` opens the matching `GovernanceAlertDetailModal`. The alerts panel only queries *OPEN* alerts, so a `GOVERNANCE_ALERT_REVIEWED`/`DISMISSED` notification would otherwise point at an alert missing from that list — a fallback query (`GET /governance-alerts/:id`, enabled only once the OPEN list has settled and still doesn't contain the id) fetches it directly so the deep link still resolves.

**"Is the Parcel 360 view not accessible to the officer?"** — it still is. `/parcels/:id` is a public, unguarded route (not wrapped in `RequireAuth`), reachable via the Map, direct URL, etc. — notifications simply stopped being *one* of the paths there. To keep it conveniently reachable from the contexts where an officer is most likely to want it, an explicit "View Parcel" link (`MapPinned` icon) was added next to the parcel id in both `WorkflowReviewPanel.tsx` and `GovernanceAlertDetailModal.tsx`.

---

## Suggested sequencing — status as of 2026-09-10

Items 1–8 are done. The user explicitly confirmed decisions on 7 (declined),
8 (richer, matching Citizen's pattern), and Admin #3 (resolved, no repro) via
AskUserQuestion before this round started, and explicitly deferred all of 9.

1. **Coming Soon #1** (Officer → Documents) — ✅ done, later merged into Assigned Requests (see item 1 above).
2. **Coming Soon #2** (Admin → Workflow Oversight) — ✅ done.
3. **Coming Soon #3** (Admin → Map Layer Authoring) — ✅ done.
4. **Officer #1** (remove Quick Actions) — ✅ done.
5. **Admin #2** (gate citizen buttons) — ✅ done (the remaining "Back to Search" piece is now role-aware, not removed).
6. **Cross-Portal B** (i18n coverage for Officer + Admin) — ✅ done.
7. **Cross-Portal A** (sidebar + logout placement) — declined by the user, stays as the shared top navbar.
8. **Officer #2** (richer Profile) — ✅ done, matches Citizen's `ProfilePage.tsx` depth.
9. **Admin #1** (sessions), **Admin #4** (officer monitoring), **Officer #3** (alert document proof), **Officer #4** (four verification stages) — explicitly left out of this round by the user; genuine new features/architecture, each still worth its own planning pass whenever picked up.
10. **Admin #3** — resolved, no action needed (user confirmed after the original repro attempt came back clean); **Admin #5** and **Officer #5** — already done, no action needed.

Follow-up round after item 10 (not part of the original 10, raised separately by the user, all done 2026-09-10): Parcel 360's "Compare Years" now runs inline instead of redirecting to Historical Imagery; officer notifications no longer open Parcel 360 and instead deep-link to the specific workflow/alert on Assigned Requests / Governance Alerts (see **Cross-Portal Issues #7** above); Officer Documents merged into Assigned Requests (see item 1 above).
