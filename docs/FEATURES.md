# BhoomiSetu — Feature Reference

A feature-by-feature index of everything currently built: what it does, the backend logic behind it, and where it lives in the frontend. For requirement-vs-built gap analysis see `docs/FEATURE_AUDIT.md`; for API standards/schemas/architecture see `docs/STANDARD_TECHNICAL_DOCUMENT.md`. This file is the "what exists and where" reference.

All backend paths are relative to `backend/src/`, all frontend paths to `frontend/src/`. All API paths are relative to `/api/v1`.

---

## 1. GIS Map & Parcel Visualization

Interactive satellite/vector map showing real parcel polygons, colour-coded by state, over an OpenStreetMap base layer.

- **Backend:** `gis/` — `GET /gis/parcels` (bbox/zoom/state/district/limit/offset filtering; runs a real `ST_Intersects` on Postgres/PostGIS, skipped with a warning on SQLite), `GET /gis/parcel-at-location` (`ST_Contains` point lookup), `GET /gis/parcels/:id/geometry`. Geometry is stored as GeoJSON text (not a native PostGIS geometry column) so every consumer just `JSON.parse()`s it.
- **Frontend:** `features/map/MapComponent.tsx` — MapLibre GL JS map, mounted on the Citizen Portal's Find Parcels page (`pages/citizen/FindParcelsPage.tsx`, search-driven) and the Officer Portal's Map page (`pages/officer/OfficerMapPage.tsx`, general view). The old standalone `/map` route (unguarded, pre-dating the account-centric redesign) was removed 2026-09-09. Renders the base "search results" fill layer plus the contextual/overlay layers described in the next feature. Fully localized (English/Hindi) as of the multilingual pass — layer labels, loading/error states, and the click popup all route through `react-i18next`.

## 2. Contextual Spatial Layers (parcel network + overlays)

Clicking a parcel highlights it and loads its full spatial neighbourhood — not just that one polygon.

- **Backend:** `parcels/` — `GET /parcels/:id/context` returns `selectedParcel` + `cluster` + every parcel sharing its `clusterId` (`clusterParcels`, the whole connected network) + `adjacentParcels`/`nearbyParcels`. Relationships are precomputed at seed time in a `parcel_neighbours` table (exact shared edge = `TOUCHING`, small real gap = `NEARBY`), with a live `ST_Distance`/`ST_DWithin` (or JS fallback on SQLite) for parcels with no precomputed row. Four demo overlay layers (zoning, restriction, infrastructure, change-detection events) are read via `gis/` (`GET /gis/zoning-overlays`, `/restriction-zones`, `/infrastructure`, `/change-detection-events`), Pune-cluster only.
- **Frontend:** `features/map/MapComponent.tsx` — a 9-layer toggle panel (Selected/Adjacent/Nearby/Cluster/Same District/Zoning/Restriction/Infrastructure/Change Detection), buffered zoom-to-cluster on selection, click popup with parcel ID/ULPIN/state/district/area.

## 3. Parcel Search

Search parcels by any identifier a citizen might actually have on hand.

- **Backend:** `parcels/` — `GET /parcels?ulpin=&survey_number=&plot_number=&local_identifier=&state=&district=`.
- **Frontend:** `features/parcels/ParcelSearch.tsx` — the search form + results list on the Citizen Portal's Find Parcels page (`/citizen/find`). The old standalone `/parcels/search` route (unguarded, pre-dating the account-centric redesign) was removed 2026-09-09 — search is citizen-account-gated now, no guest path.

## 4. Parcel 360 (aggregated cross-department view)

One screen showing everything any department knows about a single parcel.

- **Backend:** `parcels/` — `GET /parcels/:id/360` returns the canonical envelope (`parcel_id`/`identifiers`/`location`/`spatial`/`sources`) plus a `departments` object aggregating all 6 mock department APIs (`null` where nothing is linked). Built by the interoperability layer (feature 7).
- **Frontend:** `features/parcels/Parcel360View.tsx` at route `/parcels/:id` — tabbed view (Land Records / Registration / Planning / Tax / Restriction / Dispute / Encumbrance / Ownership History), plus embedded panels for risk assessment (feature 20), request notifications (feature 8), and service-request actions.

## 5. Mock State Land Record Schemas

Two deliberately different state schemas, demonstrating the actual interoperability problem (not just two copies of one schema).

- **Backend:** `land-records/` — State A (rural/village: `surveyNumber`, `subdivisionNumber`, `ownerName`, `villageCode`, `areaHectares`) at `/state-a/land-records`; State B (urban plot: `plotId`, `holderName`, `localityId`, `landExtentSqft`, `recordCategory`) at `/state-b/land-records`. Full CRUD on both, no parcel foreign key by design — resolved to a canonical parcel by identifier via feature 7.
- **Frontend:** none directly — surfaced only through Parcel 360's "Land Records" tab (feature 4).

## 6. Mock Department APIs

Seven independent per-parcel department mocks, none aware of each other or of the canonical model.

- **Backend:** `departments/` — `GET /land-records/:parcelId`, `/registration/:parcelId`, `/planning/:parcelId`, `/tax/:parcelId` (assessed value/annual tax/status plus an independent `marketValueReference`/`valuationDate`/`valuationSource` valuation reference, added 2026-09-09), `/restriction/:parcelId`, `/dispute/:parcelId` (dispute seeded on ~12% of parcels, the rest return a real "no dispute" record rather than 404), `/encumbrance/:parcelId` (added 2026-09-09 — active mortgage/lien/charge flag, lender, instrument reference; seeded on ~17% of parcels, the rest return a real "no encumbrance" record).
- **Frontend:** none directly — each one is a tab inside Parcel 360 (feature 4).

## 6a. Ownership History

A parcel's chain of past owners, not just the current one — the mutation-history dimension a real Record of Rights carries. Added 2026-09-09.

- **Backend:** `parcels/ownership-history-record.entity.ts` + `ParcelsService`/`ParcelsController` — `GET /parcels/:id/ownership-history` returns rows ordered oldest-first (`ownerName`, `transactionType` `ORIGINAL`/`SALE`/`GIFT`/`INHERITANCE`/`PARTITION`, `transactionDate`, `documentReference`), seeded on a representative ~50% of parcels, the chain's final entry matching the owner name already on file in State A/B records where one exists. **Citizen-restricted**: staff (officer/admin) always see it; a citizen sees it only for a parcel actually in their own `citizen_parcels` association (403 otherwise) — a deliberate call, not a default, since previous-owner names are personal information about people other than the viewing citizen.
- **Frontend:** a new "Ownership History" tab on Parcel 360 (`features/parcels/Parcel360View.tsx`), fetched lazily only when that tab is opened; shows a plain-language "sign in as the associated citizen, or as staff" message on 401/403 rather than a generic error.

## 7. Interoperability Layer

Ties the two mock state schemas and seven department APIs into one canonical, cross-department view.

- **Backend:** `interoperability/` — identifier resolver (any identifier → canonical parcel UUID, and the reverse), State A/B adapters (unit/field-name mapping to canonical fields), canonical transformer (builds the `parcel_id`/`identifiers`/`location`/`spatial`/`sources` envelope), response aggregator (calls all 6 department APIs in parallel). Entirely surfaced through `GET /parcels/:id/360`.
- **Frontend:** none directly — this is what makes Parcel 360 (feature 4) possible.

## 8. Citizen Service Requests & Officer Review Workflow

A citizen files a request (document copy, correction, dispute); it becomes a real multi-step review pipeline an officer works through.

- **Backend:** `workflows/` — `POST /workflows` (CITIZEN-only as of the account-centric flow redesign in `docs/flow.md` §9 — creates a `Workflow` + auto-generates a 3-step pipeline `LAND_RECORDS → REGISTRATION → PLANNING`, all `PENDING`; a `DISPUTE_FILING` type gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead (and, as of 2026-09-10, is exempt from the "must own this parcel" association check below, since a dispute is definitionally about a parcel the filer doesn't hold); `LAND_CLAIM_REQUEST`/`DOCUMENT_VERIFICATION_REQUEST` get an automatic OCR pre-check against submitted/on-file evidence; `createdBy` defaults to the filing citizen's name when not given). **Restricted to the citizen's own parcels as of 2026-09-09** (`docs/FRONTEND_UPGRADE_SPEC.md` §4/§9 item 4) — 400 if the parcel doesn't exist, 403 if it exists but isn't linked to the filing citizen's `citizen_parcels` (except `DISPUTE_FILING`/`LAND_CLAIM_REQUEST`, which target unclaimed/disputed parcels by design). `GET /workflows` (list/filter, officer/admin-only), `GET /workflows/:id`, `GET /workflows/mine` (CITIZEN-only, added 2026-09-09 — every workflow across every one of the citizen's own parcels), `PATCH /workflows/:id/status`, `PATCH /workflows/:workflowId/steps/:stepId` (the actual approve/reject action — **`remarks` is mandatory as of 2026-09-09** (400 without one), not just UI-disabled; recomputes overall status, enforces per-department role via RBAC, feature 13 — `ADMIN` may decide any department's step). `POST /workflows/:workflowId/steps/:stepId/escalate` (ADMIN-only, added 2026-09-10) — notifies the step's assigned officer role to prioritize it without touching `status`/`action` at all; see the Admin Portal's Workflow Oversight mode under feature 15, which defaults to this rather than deciding on the officer's behalf.
- **Frontend:** Citizen side — `features/parcels/ServiceRequestForm.tsx` ("Request Documents"/"Report Issue"/"File a Dispute"/"Verify Documents" on Parcel 360, and on the Citizen Portal's own Raise Request page, `pages/citizen/RaiseRequestPage.tsx`, added 2026-09-09 — a parcel dropdown restricted to the citizen's own parcels with auto-fetched read-only details, rather than needing to already be viewing one specific parcel's Parcel 360), and the Citizen Portal's Requests page (`pages/citizen/RequestsPage.tsx`, added 2026-09-09 — every request across every parcel, backed by `GET /workflows/mine`, with per-department step status shown per request). The per-parcel "Your Requests" panel that used to sit on Parcel 360 (`RequestNotifications.tsx`) was removed 2026-09-10 per the user's explicit request — the Citizen Portal's Requests page above is the one place to see a citizen's own requests now. Officer side — `features/officer/WorkflowReviewPanel.tsx`, shared by the Officer Portal's Assigned Requests page (`pages/officer/AssignedRequestsPage.tsx` — as of 2026-09-10 also shows every workflow grouped by parcel with its stored documents, behind a "Pending only" toggle, absorbing the old standalone Officer Documents page) and the Admin Portal's Workflow Oversight page (feature 15) in a monitor-first "oversight" mode — "Alert Officer" (the escalate endpoint above) is the primary action, "Decide Myself" is an explicit opt-in that reveals the real Approve/Reject form.

## 9. Document Verification (OCR)

A citizen uploads a photo/scan of a land document; it's OCR'd and cross-checked against the parcel's actual records.

- **Backend:** `document-verification/` — `POST /document-verification/verify` (multipart `document` image, 5MB cap, + `parcelId`; public, rate-limited to 20 req/min/IP since OCR is real CPU work). Uses `tesseract.js` locally (no external API/key). Checks every identifier on file, owner name, and area via the same interoperability layer as Parcel 360, with OCR-noise-tolerant matching (whitespace-insensitive identifier substring match, majority-of-words name match, area within 5%). Returns `overallVerdict`: `VERIFIED` / `PARTIAL_MATCH` / `MISMATCH` / `INSUFFICIENT_DATA`.
- **Frontend:** `features/document-verification/DocumentVerificationPanel.tsx` — the Citizen Portal's Verify Documents page (`pages/citizen/VerifyDocumentsPage.tsx`), with an optional dropdown of the signed-in citizen's own parcels to tie the check to one of them.

## 10. Governance Alerts

Officer-facing alerts, every one generated by something that actually happened — never hand-seeded. Redesigned 2026-09-10 into a real 4-stage verification flow, per the user's explicit ask that alerts "need four verification stages, not just Mark Reviewed/Dismiss."

- **Backend:** `governance/` — `GET /governance-alerts` (filter by `severity`, and by `status` — either an exact value, or the pseudo-status `ACTIVE` meaning "not RESOLVED/DISMISSED"), `GET /governance-alerts/:id`, `PATCH /governance-alerts/:id/status`. `GovernanceAlert.status` is a real linear progression — **OPEN (Detected) → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED**, with **DISMISSED** reachable as an early exit from any of the first three — the same flat-status-advances-through-values modeling `Workflow.currentStatus` already uses (feature 8), not a new child-steps table. `GovernanceAlertsService.updateStatus`'s `VALID_TRANSITIONS` map rejects any out-of-order PATCH with 400, naming the alert's actual next stage(s). `reason` is mandatory on every transition (400 without one). The relevant department's officer(s) are notified only on final closure (RESOLVED/DISMISSED), not on every intermediate stage. **No alert is ever seeded/hand-fabricated** (removed 2026-09-10) — every alert comes from one of three real sources: an admin-authored `RestrictionZone` whose real spatial overlap against seeded parcels is computed at save time (`SpatialService.createRestrictionZone`/`updateRestrictionZone`, `alertType: RESTRICTION_ZONE_OVERLAP`), a real change-detection analysis (feature 18, `UNAUTHORIZED_CHANGE_DETECTED`), or a real year-over-year historical comparison (feature 26, `RESTRICTION_DETECTED`/`DISPUTE_DETECTED`, now restricted to exactly the most recent year pair — see feature 26).
- **Frontend:** `features/officer/GovernanceAlertsPanel.tsx` + `features/officer/GovernanceAlertDetailModal.tsx` on the Officer Portal — a "View Details" popout per alert with the full record, a 4-step progress stepper (Detected/Acknowledged/Field Verified/Resolved, current stage highlighted; Dismissed shown as a distinct early-exit note), only the action button(s) actually reachable from the alert's current stage, and an "Explain with AI" button (feature 17). Both panels also carry a "View Parcel" link into Parcel 360 (added 2026-09-10, once officer notifications stopped auto-opening it — see feature 27). Client-side paginated (5 alerts/page, added 2026-09-09) rather than rendering every open alert as one unbounded scroll. The shared stage config (`AlertStage`, `STAGE_CONFIG`, `NEXT_ACTIONS`, `STAGE_TRACK`, status badge styles) lives in `features/officer/GovernanceAlertReasonPrompt.tsx` so both panels stay in sync.

## 11. Authentication (+ Citizen Registration & OTP Verification)

Real accounts (not the earlier client-side-only "pick a name and role" simulation) shared by officers, admin, and citizens - plus, as of 2026-09-08, real citizen self-registration and mobile/email OTP verification (`docs/FRONTEND_UPGRADE_SPEC.md` §3).

- **Backend:** `auth/` + `users/` + `notifications/` — one `users` table (`email`/`mobileNumber` both nullable+unique, `emailVerified`/`mobileVerified`, `pendingEmail`/`pendingMobileNumber` for an in-progress change, bcrypt hash, name, role).
  - `POST /auth/login` → `{email|mobileNumber, password}` → JWT (24h), uniform 401/400 for wrong credentials/unknown identifier/malformed input (no user enumeration).
  - `POST /auth/register` (citizen-only) → a method-selector (`method: 'EMAIL'|'MOBILE'`), creates the account and returns a session immediately, fires that method's OTP.
  - `POST /auth/verify-otp` / `resend-otp` (citizen-only) → mobile OTP has no active provider as of 2026-09-10 (`SmsService` is built against Fast2SMS's shape, but Fast2SMS is not the chosen provider and stays unconfigured - calls 503 until a provider is chosen); email OTP is generated/bcrypt-hashed/checked locally (10-min expiry, 5-attempt lockout), sent via `EmailService` (plain SMTP/`nodemailer` - works with any SMTP-capable provider, not a specific vendor API) and is unaffected.
  - `POST /auth/profile/contact` (citizen-only) → add a missing method directly, or stage a change into `pendingEmail`/`pendingMobileNumber` (an already-verified value is never overwritten until the new one is itself confirmed).
  - Both notification services follow `GroqService`'s "unset config → 503 at call time" pattern (`FAST2SMS_API_KEY`/`FAST2SMS_OTP_ID`, `SMTP_HOST`) - a failed send never fails the surrounding request, since the account/contact value is already saved regardless.
  - `GET /auth/me` (passport-jwt guard, looks the user up fresh every call).
- **Frontend:** `pages/LoginPage.tsx`/`RegisterPage.tsx` (method-selector toggle, no main navbar - just a lightweight logo strip, per `App.tsx`'s `isAuthPage` check) + `features/auth/OtpEntryForm.tsx` (6-digit entry, expiry countdown, rate-limited resend - shared by post-registration verification and Profile's add/change flow) + `features/auth/RequireAuth.tsx` (route guard on `/officer/*`/`/admin`/`/citizen/*`) + `features/auth/auth.ts` (React Query-cached session state, read by `App.tsx`'s navbar). **As of 2026-09-09, signing in is required for the entire Citizen Portal** — search, the map, document verification, and My Parcels (feature 12), not just service requests — per `docs/FRONTEND_UPGRADE_SPEC.md` §1's "no guest search, anywhere in the flow". Only the public site (`/`, `/about`, `/features`) needs no account.

## 12. Citizen Sign-In / My Parcels

Optional citizen accounts linked to the parcels they actually own.

- **Backend:** `users/` — `CITIZEN` role reuses the auth in feature 11; a `citizen_parcels` join table links a citizen to 0-5 parcels (deliberately separate from a land record's own recorded owner name). `GET /parcels/mine` (citizen-only) returns them. Citizen accounts are excluded from the Admin Portal's staff-only user list/count.
- **Frontend:** `features/citizen/MyParcels.tsx`, its own page on the Citizen Portal (`pages/citizen/MyParcelsPage.tsx`) — the linked-parcel list, a sign-out link, and a link into Profile when signed in as a citizen.

## 13. Authorization (RBAC)

Stops a signed-in user from calling an endpoint their role shouldn't reach.

- **Backend:** `auth/roles.guard.ts` + `auth/roles.decorator.ts` — a `RolesGuard` reads `@Roles(...)` and checks it against the JWT-derived role (403 on mismatch, distinct from the 401 for no/invalid token). Officer/admin-only: workflow review/listing, governance alerts, change detection, AI alert-explanation, both analytics endpoints, staff user management. Citizen-only: `GET /parcels/mine`. The workflow step-review endpoint additionally checks the acting officer's role against that step's `assignedRole` (e.g. a `LAND_RECORD_OFFICER` gets a real 403 on a `REGISTRATION` step; `ADMIN` bypasses).
- **Frontend:** enforced indirectly — `features/auth/RequireAuth.tsx` gates routes by role; no separate RBAC UI.

## 14. Audit Logging

A real trail of who did what, when.

- **Backend:** `audit/` — an `audit_logs` table records `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED`, `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`, `DEPARTMENT_CREATED`/`UPDATED`/`DELETED`. `GET /audit` (admin-only, filterable by `entityType`/`userId`), `GET /parcels/:id/audit` (staff-only).
- **Frontend:** `features/admin/RecentActivity.tsx` — the full activity feed on the Admin Portal's System Monitoring page (feature 15), with an `entityType` filter dropdown.

## 15. Admin Portal

Multi-page portal for platform administration once signed in — restructured 2026-09-09 from a single dashboard into `Dashboard` / `Departments` / `System Monitoring` (`docs/FRONTEND_UPGRADE_SPEC.md` §7), then extended 2026-09-10 with three more real pages (`Workflow Oversight` / `Map Layer Authoring` / `Officer Monitoring`, all previously `ComingSoonCard` placeholders — see `docs/ADMIN_PANEL_ISSUES.md`). `Users`/`Governance Rules` remain planning-only, scoped as a separate engine-rewrite effort.

- **Backend:** `users/users.controller.ts` — `GET /users` (staff only, excludes citizens), `POST /users` (create Officer/Admin), `PATCH /users/:id/role`, `DELETE /users/:id` — all admin-only, all audit-logged, self-lockout prevented. `admin/departments-admin.controller.ts` — `GET/POST/PATCH/DELETE /admin/departments`, admin-only CRUD over a display/admin `departments` table (name/description/contact info, seeded one row per existing hardcoded department code), audit-logged the same way. `GET /analytics/summary` includes `totalUsers`/`recentLogins24h`; `GET /analytics/officer-monitoring` (added 2026-09-10, ADMIN-only) is the new Officer Monitoring endpoint — see below.
- **Frontend:** `pages/AdminPortal.tsx` (layout shell + its own relative `<Routes>`) with pages under `pages/admin/`:
  - **Dashboard** — `features/admin/UserManagement.tsx` (create/promote-demote/remove accounts) plus Governance Analytics (feature 19) and Top At-Risk Parcels (feature 20).
  - **Departments** — `features/admin/DepartmentManagement.tsx` (list/add/edit/delete departments).
  - **System Monitoring** — real System Overview counts + `features/admin/RecentActivity.tsx` (feature 14).
  - **Workflow Oversight** (`AdminWorkflowOversightPage.tsx`, added 2026-09-10) — every department's workflows, optionally filtered by department/pending-only, opened in `WorkflowReviewPanel`'s admin oversight mode (feature 8): monitoring by default, not approval — "Alert Officer" is the primary action, "Decide Myself" is an explicit opt-in.
  - **Map Layer Authoring** (`AdminMapLayerAuthoringPage.tsx`, added 2026-09-10) — the real UI for feature 21's write APIs, five tabs: Zoning Overlays / Restriction Zones / Infrastructure / **Admin Notes** (a 4th, admin-only layer — every endpoint including reads is ADMIN-gated, and it's never fetched by the shared citizen/officer map) / **Combined View** (`AdminCombinedLayerMap.tsx` — all four layers rendered together on one map with a togglable legend). A MapLibre-based drawing tool (`LayerGeometryDrawMap.tsx`, `@mapbox/mapbox-gl-draw`) is scoped only to this page — draw a shape instead of hand-typing GeoJSON. See feature 21 for the real spatial-overlap computation and no-overlap validation behind the create/edit forms.
  - **Officer Monitoring** (`AdminOfficerMonitoringPage.tsx` / `features/admin/OfficerMonitoring.tsx`, added 2026-09-10) — one row per officer: pending workload in their role's queue (a real SQL `GROUP BY` over `WorkflowStep`), approved/rejected decision counts and average time-to-decide (from `AuditLog`, the only place an individual officer — not just a role — is attributable to a decision), and last activity, including officers with zero activity (never silently omitted).

  Reachable from the global navbar's `ADMIN_NAV_ITEMS` (`navConfig.ts`), same pattern as the Officer/Citizen Portals.

## 16. Officer Portal

Multi-page portal for an officer's day-to-day work once signed in — restructured 2026-09-09 from a single dashboard (`docs/FRONTEND_UPGRADE_SPEC.md` §5), with the Quick Actions grid removed 2026-09-10 (all four links already existed in the top nav) and full English/Hindi coverage added the same day.

- **Backend:** composed from `workflows/`, `governance/`, `ai/`, `analytics/` (see their own feature entries).
- **Frontend:** `pages/OfficerPortal.tsx` (layout shell + its own relative `<Routes>`) with pages under `pages/officer/`: Dashboard (real counts — pending/decided workflows, open alerts), Assigned Requests (`features/officer/WorkflowReviewPanel.tsx` — assigned workflows grouped by parcel with stored documents, approve/reject + mandatory remarks; absorbed the old standalone Documents page 2026-09-10, `/officer/documents` now redirects here), Governance Alerts (`features/officer/GovernanceAlertsPanel.tsx`, feature 10), Historical Imagery (feature 26), Map (general `MapComponent`, feature 1), Notifications (feature 27), and Profile (`OfficerProfilePage.tsx`, given the same editable depth as the Citizen Portal's Profile 2026-09-10 — an editable Profile Details card and verified email/mobile contact methods, via components shared with the citizen page). Gated by `RequireAuth` (feature 11). The Change Detection panel (feature 18) is not part of this portal's navigation as of this restructuring — see feature 18.

## 17. AI Assistant (Groq)

Natural-language queries, plain-language parcel/alert explanations, and site-navigation help, backed by Groq (never called from the frontend).

- **Backend:** `ai/` — `GroqService` uses the official `openai` SDK pointed at Groq's OpenAI-compatible API; every response is Zod-validated before use (a failed validation is a 502, never silently trusted). Without `GROQ_API_KEY` set, endpoints return 503. Rate-limited to 30 req/min/IP.
  - `POST /ai/query` — one call answers either a data question (Groq extracts a structured filter — state/district/tax_status/has_restriction/land_use/registration_status — and the backend runs the real DB query; the LLM never touches SQL) or a "how do I use this site" question (answered from a system prompt grounded in the site's real features).
  - `POST /ai/parcels/:parcelId/explain` — plain-language `{summary, risk_level, findings[], recommended_action}` for a parcel's full 360 view.
  - `POST /ai/alerts/:alertId/explain` — the same shape for one governance alert (officer/admin-only).
- **Frontend:** `features/ai/AskAiWidget.tsx` — a floating, draggable chat widget mounted once at the app-shell level (persists across citizen-facing page navigation), plus `features/ai/AiExplanationCard.tsx` shared by the widget, Parcel 360's "Explain with AI" button, and the governance alert detail popout.

## 18. Change Detection

Compares two satellite/aerial images of the same area and flags which real parcels fall inside the changed region.

- **Backend:** `change-detection/` — `POST /change-detection/analyze` (multipart `before`/`after` images, 5MB cap each, + `minLng`/`minLat`/`maxLng`/`maxLat` real geographic bounds + optional description; rate-limited to 30 req/min/IP). `sharp` decodes/resizes both images; a hand-rolled pixel comparison (`image-diff.ts`) finds the bounding box of changed pixels and maps it to a geographic region. Every seeded parcel is tested against that region via a real `ST_Contains`/`ST_Centroid` query (Postgres) or JS point-in-polygon test (SQLite). Creates a `ChangeDetectionEvent` row and one `GovernanceAlert` per affected parcel.
- **Frontend:** `features/change-detection/ChangeDetectionPanel.tsx` (file pickers, a bounds form with a one-click "Use Pune cluster bounds" fill, a result view linking affected parcels into Parcel 360) is **not currently mounted anywhere in the app** — it was previously an always-visible "Analyze Imagery" panel on the Officer Portal, removed from that portal's navigation 2026-09-09 per `docs/FRONTEND_UPGRADE_SPEC.md` §8 (the name overpromised real satellite-imagery analysis for what is actually a hand-rolled pixel diff). Its on-demand replacement is feature 26. The component and the backend endpoint above are both untouched and still fully covered by `backend/test/change-detection.e2e-spec.ts` and `features/change-detection/ChangeDetectionPanel.test.tsx`.

## 19. Governance Analytics Dashboard

Platform-wide analytics, not just per-alert.

- **Backend:** `analytics/` — `GET /analytics/summary`, real SQL `GROUP BY` aggregation across tax status, registration status, land use, dispute case status, workflow status/type, alert severity/status, plus overall totals.
- **Frontend:** `features/analytics/AnalyticsDashboard.tsx` — an 8-chart `recharts` dashboard on the Admin Portal's Dashboard page.

## 20. Predictive Analytics (Risk Score)

A transparent, explainable risk score per parcel — deliberately a hand-weighted heuristic, not a trained model (no labeled outcome data exists to train/validate one).

- **Backend:** `predictive-analytics/` — combines tax delinquency (0.4), dispute exposure (0.3), open governance alerts (0.2), land-use restriction (0.1), each with a plain-language rationale. `GET /parcels/:id/risk-score`, `GET /predictive-analytics/top-risk-parcels`.
- **Frontend:** the "Risk Assessment" card on Parcel 360 (`features/parcels/Parcel360View.tsx`) and `features/analytics/TopRiskParcels.tsx` ("Top At-Risk Parcels" list) on the Admin Portal's Dashboard page.

## 21. Spatial Layer Authoring

Admin-capable authoring of the demo overlay layers, now with a real UI, a map-drawing tool, and — as of 2026-09-10 — real spatial computation instead of admin-typed data. See feature 15 for the page this lives on.

- **Backend:** `spatial/` — real `POST`/`PATCH`/`DELETE` for zoning overlays, restriction zones, infrastructure features, and (added 2026-09-10) **admin notes**, a 4th layer whose every endpoint including reads is ADMIN-gated (unlike the other three, which are public-read) and never fetched by the shared citizen/officer map. Geometry-type validation: `Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure, all three for admin notes.
  - **Real spatial computation (2026-09-10):** creating or editing a `RestrictionZone`/`ZoningOverlay` no longer trusts the admin-typed `affectedParcelIds`/`parcelIds` — `SpatialService` computes the real set server-side (centroid-in-ring against every seeded parcel, the same technique `ChangeDetectionService`'s change-region intersection already used) and, for restriction zones, creates a real `GovernanceAlert` for every newly-affected parcel (feature 10).
  - **No-overlap validation (2026-09-10):** two zones of the *same* layer type can no longer overlap — a new `ringsOverlap` polygon-vs-polygon test (`common/geo-utils.ts`, the codebase's first true overlap test — everything before it was point-in-polygon) rejects the create/edit with a 400 naming the conflicting zone. A restriction zone and a zoning overlay covering the same land is fine; only same-type overlap is rejected.
- **Frontend:** `features/admin/MapLayerManagement.tsx` (config-driven CRUD form + list, one config per layer type) and `features/admin/LayerGeometryDrawMap.tsx` (a MapLibre + `@mapbox/mapbox-gl-draw` drawing tool scoped only to this admin screen — draw a shape instead of hand-typing GeoJSON), both on the Map Layer Authoring page (feature 15). Since the server now computes `affectedParcelIds`/`parcelIds` authoritatively, the admin form no longer has an editable "Parcel IDs" field — the list view shows the real computed count instead.

## 22. Multilingual UI (English / Hindi)

The full UI switches language live, with the choice remembered across visits — as of 2026-09-10, this includes the Officer and Admin Portals, not just the citizen-facing surface.

- **Backend:** none — purely a frontend concern.
- **Frontend:** `i18n/config.ts` (`i18next` + `react-i18next` init, `localStorage`-backed persistence under `bhoomisetu_language`) + `i18n/locales/en.json` / `i18n/locales/hi.json`. Wired into the navbar language selector (`App.tsx`), the landing hero (`features/citizen/LandingHero.tsx`), parcel search (`features/parcels/ParcelSearch.tsx`), the Citizen Portal panels (`pages/CitizenPortal.tsx`), and the map — including its layer-toggle labels and click popup (`features/map/MapComponent.tsx`). **Officer and Admin Portal coverage (added 2026-09-10)**: every Officer/Admin page and component now routes its text through `t()` via two new namespace pairs, `officerNav`/`officerPortal` and `adminNav`/`adminPortal` (~180 keys total, real Hindi translations, not copies) — `navConfig.ts`'s `OFFICER_NAV_ITEMS`/`ADMIN_NAV_ITEMS` use the same `labelKey` pattern `CITIZEN_NAV_ITEMS` already did. i18next's CLDR `_one`/`_other` pluralization is used where a count is interpolated (e.g. `parcelsChangedStatus_one`/`_other`). Marathi/Kannada are scaffolded in `SUPPORTED_LANGUAGES` but intentionally not enabled until their locale files exist (adding a language needs no component changes, only a new JSON file).

## 23. Rate Limiting

Every endpoint is throttled; the costlier ones (AI, change detection, document OCR) are throttled tighter.

- **Backend:** `@nestjs/throttler` — global 200 req/min/IP default; 30 req/min/IP on `ai/`, `change-detection/`, and `historical-imagery/`; 20 req/min/IP on `parcels/identify-from-document` (the OCR-based land-claim lookup — there's no separate `document-verification/` module, it lives in `parcels`). `X-RateLimit-*` response headers included. `trust proxy` is set so per-IP limiting reads the real client IP behind a reverse proxy.
- **Frontend:** none.

## 24. PostGIS / Production Database Support

Real spatial SQL when connected to Postgres, transparent JS fallback on SQLite dev.

- **Backend:** `common/postgis.ts` decides which path runs from the actual connected TypeORM driver (not an env flag). Four call sites branch on it: `GisService.findAll` (bbox), `GisService.findParcelAtLocation`, `ParcelsService.getNeighbours`, `ChangeDetectionService.analyze`'s spatial intersection — each running real `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid` on Postgres, or the equivalent hand-rolled JS (`common/geo-utils.ts`) on SQLite. Live-verified end-to-end against a hosted Supabase Postgres+PostGIS instance.
- **Frontend:** none — entirely transparent to every feature above.

## 25. Docker / Deployment Hardening

A `docker compose up --build` that actually works from a fresh volume, plus public-demo safety defaults.

- **Backend/infra:** `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile` — 3 services (frontend behind nginx, backend, PostGIS). `main.ts` refuses to start under `NODE_ENV=production` with an unset/placeholder `JWT_SECRET`; CORS restricts to an explicit allowlist via `CORS_ORIGIN` when set; PostGIS's `5432` is no longer published to the host.
- **Frontend:** none — build-time/infra only.

---

## 26. Historical Imagery Comparison

On-demand, staff-only replacement for feature 18's always-on upload panel: compares two years of a cluster's own synthetic snapshot archive instead of requiring a fresh upload, and only alerts on changes nothing already explains. Redesigned 2026-09-08 to drop pixel-diffing entirely in favor of a real per-parcel data comparison, per-parcel LLM-phrased narratives instead of an aggregate percentage, and a 6-color category legend.

- **Backend:** `historical-imagery/` — `GET /historical-imagery/clusters` (which clusters/years have snapshots), `GET /historical-imagery/clusters/:clusterId/years/:year/image` (serves the stored PNG), `POST /historical-imagery/clusters/:clusterId/compare` (`{fromYear, toYear}`, rate-limited to 30 req/min). All three are staff-only (`ALL_STAFF_ROLES`). `common/parcel-generation/parcel-category.ts` defines `ParcelCategory` (`NONE`/`RESTRICTED`/`DISPUTE_OWNERSHIP`/`DISPUTE_BOUNDARY`/`DISPUTE_INHERITANCE`/`DISPUTE_ENCROACHMENT`, one color each) computed from real data — that year's `ParcelHistoricalState.restrictionStatus`, plus (current year only, since `DisputeRecord` has no per-year history) the parcel's real active dispute type; the same function colors the seed-time snapshot render and drives `HistoricalComparisonService`'s comparison, so a parcel is simply "affected" when its category differs between the two years — no pixel math, no bounding box, no spatial intersection. A newly-appearing or worsened category creates a `GovernanceAlert` (`DISPUTE_DETECTED` or `RESTRICTION_DETECTED`, `source: 'HISTORICAL_IMAGERY'`, severity `CRITICAL`/`HIGH`/`MEDIUM` by category and whether the parcel also has an active restriction); an improved category (e.g. a dispute resolved) is still reported but never gets a fresh alert. **`compare()` only accepts exactly `CURRENT_YEAR-1 → CURRENT_YEAR` as of 2026-09-10** (any other pair — even two purely historical years — gets a 400) — since this is the only place a historical comparison creates alerts, and the user's explicit ask was that alerts reflect "the 2025-2026 differences only," not any year pair an officer happens to pick. `NarrativeService` (OpenRouter, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, text-only) turns each affected parcel's real facts into one grounded sentence — e.g. "This parcel now has an active boundary dispute" — capped to the 20 most severe affected parcels to bound latency (a live test found the two snapshot images added 50-80s of latency for zero information gain once detection stopped depending on them, so they're no longer sent to this call); a failed/uncapped/unconfigured call falls back to the same real facts, plainly phrased. `ClusterHistoricalSnapshot` (one rendered PNG per cluster per year, 2022-2026) is generated at seed time by `common/parcel-generation/cluster-snapshot-generator.ts` (SVG polygons rasterized via `sharp`, each colored by its real `ParcelCategory`).
`GET /historical-imagery/clusters/:clusterId/years/:year/parcels` (added 2026-09-08) returns real parcel geometry + a real `ParcelCategory` per parcel for one year, so the frontend can render a cluster's actual boundaries on the live map instead of only the flat snapshot PNG — this browsing endpoint is unaffected by the year restriction above, only the alert-generating comparison is locked down.
- **Frontend:** `features/officer/HistoricalImageryPanel.tsx`, mounted at `/officer/historical-imagery` (`pages/officer/HistoricalImageryPage.tsx`) — pick a cluster, then a single year dropdown drives the real interactive map (`features/map/MapComponent.tsx`, extended with `parcelColors`/`parcelLabels` props) showing that year's actual parcel boundaries colored by category. The two-year comparison itself is `features/officer/HistoricalYearCompare.tsx` (extracted 2026-09-10 so Parcel 360 can embed it inline too — see below) — no year picker any more, it always compares the two most recent years in the cluster (matching the backend restriction) and shows one row per affected parcel: its category-change badge, its real narrative sentence, and an "Alert raised" tag where one was created. Deep-linkable from Parcel 360's "Compare Years & Generate Alerts" action (staff only, shown when the viewed parcel belongs to a cluster) via an inline expand/collapse — this used to navigate to `/officer/historical-imagery?cluster=`, but as of 2026-09-10 runs the comparison directly on Parcel 360 instead, per the user's explicit request that this analysis "should be done there only in the parcel 360."

## 27. In-App Notifications

A real per-user notification feed (docs/FRONTEND_UPGRADE_SPEC.md §11 item 5, resolved 2026-09-09: in-app only, not push/SMS/email) — replaces both portals' `ComingSoonCard` Notifications placeholders.

- **Backend:** `notification-feed/` (distinct from `notifications/`, which is OTP SMS/email delivery infra only) — a `Notification` entity (`userId`/`type`/`title`/`message`/`parcelId`/`workflowId`/`alertId`/`read`), `GET /notifications` and `PATCH /notifications/:id/read` (any authenticated role, scoped to the caller). Write paths: `WorkflowsService.notifyAssignedOfficers()` (a new request notifies every officer holding the assigned department's role), `WorkflowsService.notifyCitizenOfStepDecision()` (an officer's decision notifies the citizen back, resolved via `citizen_parcels` since `workflow.createdBy` is a display name, not a user id), `WorkflowsService.escalateStep()` (an admin's "Alert Officer" action, feature 8/15), and governance-alert closure (feature 10).
- **Frontend:** `features/notifications/NotificationFeed.tsx`, shared by `pages/citizen/NotificationsPage.tsx` and `pages/officer/OfficerNotificationsPage.tsx` — click-to-mark-read. Citizen notifications open the related parcel when one exists. **Officer notifications are role-aware as of 2026-09-10**: they never open Parcel 360 any more — `GOVERNANCE_ALERT_*` types route to `/officer/alerts?alert=<id>`, everything else routes to `/officer/requests?workflow=<id>`, and both destination pages read that query param to auto-select the specific item (not just land on the tab). Parcel 360 itself is unaffected — it's a public, unguarded route, still reachable via the map or an explicit "View Parcel" link on `WorkflowReviewPanel`/`GovernanceAlertDetailModal`; notifications simply stopped being one of the paths there.

## 28. AI-Based Request Routing

`POST /workflows` analyses a citizen's free-text request and picks the real department(s) it concerns, instead of always the same hardcoded default pipeline.

- **Backend:** `workflows/request-routing.service.ts` — Groq (`GroqService.completeJson`, extracted into its own `ai/groq.module.ts` so `WorkflowsModule` can reuse it without importing all of `AiModule`) classifies `requestDetails` against the 7 real department codes, returning `{departments, reason}`. Validated against a closed set (`DEPARTMENT_ROLE`, the reverse of `auth/roles.constants.ts`'s `ROLE_DEPARTMENT`); on any failure (unconfigured/error/malformed/empty) returns nothing and `WorkflowsService.create()` falls back to the original deterministic `pipelineFor()` unchanged — every existing workflow test still exercises that fallback path for real (no `GROQ_API_KEY` in the test environment). The AI's rationale is stored on the workflow (`routingNotes`) and surfaced in the assigned officer's notification. Required every department to have a real officer role first: `TAX_OFFICER`/`RESTRICTION_OFFICER`/`ENCUMBRANCE_OFFICER` added to `OFFICER_ROLES` (previously only 4 of the 7 departments had one), one seeded demo account each.
- Live-verified against the real Supabase database and real Groq API: a `CORRECTION_REQUEST` describing an overdue tax bill was correctly routed to `TAX` alone (not the generic default), with the officer notification carrying the AI's actual rationale.

## 29. Governance Alert Review Reason

**Superseded by feature 10's 4-stage rework (2026-09-10)** — kept here for history. `GovernanceAlert.reason` is mandatory on every stage transition now, not just the original two (Mark Reviewed/Dismiss); `alertDepartmentFor()` (`governance-alerts.service.ts`) still derives which department an alert concerns from its `alertType` and still notifies that department's officer(s) (feature 27), just only on final closure — see feature 10 for the current behavior.
- **Frontend:** `features/officer/GovernanceAlertReasonPrompt.tsx` — opens on any stage-advance/dismiss button press (row card or detail modal), reason mandatory, shown back afterward as a "Reviewer's note".

## Mock Data (underlies every feature above)

`backend/seed.ts` generates 220 parcels across 5 real regions (Pune 100, Chennai 40, Bangalore 40, New Delhi 20, Chandigarh 20 — the last added 2026-09-09 to represent both of the SIH "Land Stack" PS's actual named pilot locations, Tamil Nadu and Chandigarh) with irregular, topology-aware subdivision (`backend/src/common/parcel-generation/`) rather than a uniform grid — adjacent parcels share literal boundary coordinates, sized/shaped irregularly per cluster. Every parcel gets Registration/Planning/Tax/Restriction/Dispute/Encumbrance records, state-appropriate identifiers, and (Pune only) zoning/restriction/infrastructure/change-detection demo layers. ~50% of parcels also get a 1-3-entry ownership history chain. 8 officer/admin accounts (1 admin + 1 officer per department, all 7 departments covered as of 2026-09-09) + 20 citizen accounts, all password `Demo@123`. **No `GovernanceAlert` rows are seeded (removed 2026-09-10)** — the flood zone, simulated change-detection event, and tax records above are still seeded normally for their own features, but a governance alert is only ever created by something that actually happens at runtime (feature 10), never fabricated at seed time.

## Where things aren't built yet

OAuth-based auth is the one item still open against the team's own spec (see `docs/FEATURE_AUDIT.md` §6/§8 item 15) — it needs a real OAuth app registered with an external provider, which only the user can provision.
