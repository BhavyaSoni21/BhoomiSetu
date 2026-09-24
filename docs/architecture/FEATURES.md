# BhoomiSetu — Feature Reference

> **⚠ Stack note (added 2026-09-24 — read first):** The backend has since been ported from NestJS/TypeORM to **FastAPI + SQLAlchemy 2.0 + GeoAlchemy2** with Alembic migrations (`backend-py/app/**`). This file is partially reconciled — some entries already carry `backend-py` notes, others still describe the NestJS as-built (`@nestjs/throttler`, TypeORM, `backend/src/**` paths, `main.ts`, SQLite/JS spatial fallback). Where a backend detail here conflicts with the current code, the FastAPI code and [`KNOWN_RISKS.md`](KNOWN_RISKS.md) §2 / `README.md` §10 are authoritative. Frontend descriptions remain current.

A feature-by-feature index of everything currently built: what it does, the backend logic behind it, and where it lives in the frontend. For system architecture/API standards/schemas see `docs/architecture/SYSTEM_ARCHITECTURE.md`; for a per-feature library/endpoint/file lookup see `docs/architecture/FEATURE_TECH_MAP.md`; for what's still open see `docs/architecture/BACKLOG.md`. Historical planning/audit records (including the original requirement-vs-built gap analysis) live in `docs/archive/`. This file is the "what exists and where" reference.

All backend paths are relative to `backend/src/`, all frontend paths to `frontend/src/`. All API paths are relative to `/api/v1`.

---

## 1. GIS Map & Parcel Visualization

Interactive satellite/vector map showing real parcel polygons, colour-coded by state, over an OpenStreetMap base layer.

- **Backend:** `gis/` — `GET /gis/parcels` (bbox/zoom/state/district/limit/offset filtering; runs a real `ST_Intersects` on Postgres/PostGIS, skipped with a warning on SQLite), `GET /gis/parcel-at-location` (`ST_Contains` point lookup), `GET /gis/parcels/:id/geometry`. Geometry is stored as GeoJSON text (not a native PostGIS geometry column) so every consumer just `JSON.parse()`s it.
- **Frontend:** `features/map/MapComponent.tsx` — MapLibre GL JS map, mounted on the Citizen Portal's Find Parcels page (`pages/citizen/FindParcelsPage.tsx`, search-driven) and the Officer Portal's Map page (`pages/officer/OfficerMapPage.tsx`, general view). The old standalone `/map` route (unguarded, pre-dating the account-centric redesign) was removed 2026-09-09. Renders the base "search results" fill layer plus the contextual/overlay layers described in the next feature. Fully localized (all 11 shipped languages) as of the multilingual pass — layer labels, loading/error states, and the click popup all route through `LanguageContext`'s `t()` (see feature 22).

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

- **Backend:** `workflows/` — `POST /workflows` (CITIZEN-only as of the account-centric flow redesign in `docs/flow.md` §9 — creates a `Workflow` + auto-generates a 3-step pipeline `LAND_RECORDS → REGISTRATION → PLANNING`, all `PENDING`; a `DISPUTE_FILING` type gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead (and, as of 2026-09-10, is exempt from the "must own this parcel" association check below, since a dispute is definitionally about a parcel the filer doesn't hold); `LAND_CLAIM_REQUEST`/`DOCUMENT_VERIFICATION_REQUEST` get an automatic OCR pre-check against submitted/on-file evidence; `createdBy` defaults to the filing citizen's name when not given). **Restricted to the citizen's own parcels as of 2026-09-09** (`docs/FRONTEND_UPGRADE_SPEC.md` §4/§9 item 4) — 400 if the parcel doesn't exist, 403 if it exists but isn't linked to the filing citizen's `citizen_parcels` (except `DISPUTE_FILING`/`LAND_CLAIM_REQUEST`, which target unclaimed/disputed parcels by design). `GET /workflows` (list/filter, officer/admin-only), `GET /workflows/:id`, `GET /workflows/mine` (CITIZEN-only, added 2026-09-09 — every workflow across every one of the citizen's own parcels), `PATCH /workflows/:id/status`, `PATCH /workflows/:workflowId/steps/:stepId` (the actual approve/reject action — **`remarks` is mandatory as of 2026-09-09** (400 without one), not just UI-disabled; recomputes overall status, enforces per-department role via RBAC, feature 13 — `ADMIN` may decide any department's step). `POST /workflows/:workflowId/steps/:stepId/escalate` (ADMIN-only, added 2026-09-10) — notifies the step's assigned officer role to prioritize it without touching `status`/`action` at all; see the Admin Portal's Workflow Oversight mode under feature 15, which defaults to this rather than deciding on the officer's behalf. `POST /workflows/:workflowId/steps/:stepId/reopen` (ADMIN-only, added 2026-09-10) — the inverse of escalate: resets an already-decided step (`APPROVED`/`REJECTED`) back to `PENDING`, clearing its `action`/`remarks`/`completedAt` and recomputing the workflow's overall `currentStatus`, then notifies the responsible officer with the admin's reason (400 if the step is still `PENDING`).
- **Frontend:** Citizen side — `features/parcels/ServiceRequestForm.tsx` ("Request Documents"/"Report Issue"/"File a Dispute"/"Verify Documents" on Parcel 360, and on the Citizen Portal's own Raise Request page, `pages/citizen/RaiseRequestPage.tsx`, added 2026-09-09 — a parcel dropdown restricted to the citizen's own parcels with auto-fetched read-only details, rather than needing to already be viewing one specific parcel's Parcel 360), and the Citizen Portal's Requests page (`pages/citizen/RequestsPage.tsx`, added 2026-09-09 — every request across every parcel, backed by `GET /workflows/mine`, with per-department step status shown per request). The per-parcel "Your Requests" panel that used to sit on Parcel 360 (`RequestNotifications.tsx`) was removed 2026-09-10 per the user's explicit request — the Citizen Portal's Requests page above is the one place to see a citizen's own requests now. Officer side — `features/officer/WorkflowReviewPanel.tsx`, shared by the Officer Portal's Assigned Requests page (`pages/officer/AssignedRequestsPage.tsx` — as of 2026-09-10 also shows every workflow grouped by parcel with its stored documents, behind a "Pending only" toggle, absorbing the old standalone Officer Documents page) and the Admin Portal's Workflow Oversight page (feature 15) in a monitor-first "oversight" mode — "Alert Officer" (the escalate endpoint above) is the primary action, "Decide Myself" is an explicit opt-in that reveals the real Approve/Reject form. Already-decided steps get their own row with "Send Back for Re-Review" (the reopen endpoint above) — resets the step to `PENDING` and notifies the officer with a required reason, so a questionable decision gets a mandatory second look.

## 9. Document Verification (OCR)

A citizen uploads a photo/scan of a land document; it's OCR'd and cross-checked against the parcel's actual records.

- **Backend:** `document-verification/` — `POST /document-verification/verify` (multipart `document` image, 5MB cap, + `parcelId`; public, rate-limited to 20 req/min/IP since OCR is real CPU work). Uses `tesseract.js` locally (no external API/key). Checks every identifier on file, owner name, and area via the same interoperability layer as Parcel 360, with OCR-noise-tolerant matching (whitespace-insensitive identifier substring match, majority-of-words name match, area within 5%). Returns `overallVerdict`: `VERIFIED` / `PARTIAL_MATCH` / `MISMATCH` / `INSUFFICIENT_DATA`.
- **Frontend:** `features/document-verification/DocumentVerificationPanel.tsx` — the Citizen Portal's Verify Documents page (`pages/citizen/VerifyDocumentsPage.tsx`), with an optional dropdown of the signed-in citizen's own parcels to tie the check to one of them.
- **Added 2026-09-16 (`backend-py` only, `docs/architecture/BACKLOG.md` item 15, done):** `app/document_verification/authenticity.py`'s `check_authenticity()` — an OpenCV tamper/authenticity heuristic (Laplacian sharpness, Canny edge-density, noise level) — runs alongside OCR at both `backend-py` call sites that actually do document OCR (`parcels_service.identify_from_document()` and the workflow evidence-upload path in `routers/workflows.py`, whose real route is `/parcels/identify-from-document` and `POST /workflows`, not the `document-verification/verify` route this feature entry otherwise describes — see feature 13's rate-limiting note for the same NestJS-vs-`backend-py` route naming gap). A soft "may be edited/rescanned" signal only, not a hard accept/reject gate; stored on `Workflow.evidence_authenticity_suspicious`/`evidence_authenticity_reasons` and surfaced as a warning badge in `WorkflowReviewPanel.tsx` (feature 8).

## 10. Governance Alerts

Officer-facing alerts, every one generated by something that actually happened — never hand-seeded. Redesigned 2026-09-10 into a real 4-stage verification flow, per the user's explicit ask that alerts "need four verification stages, not just Mark Reviewed/Dismiss."

- **Backend:** `governance/` — `GET /governance-alerts` (filter by `severity`, `status` — either an exact value, or the pseudo-status `ACTIVE` meaning "not RESOLVED/DISMISSED" — and an opt-in `department` narrowing param), `GET /governance-alerts/:id`, `PATCH /governance-alerts/:id/status`. Every alert response carries a `department` field, derived from `alert_type` via `governance_alerts_service.alert_department_for()` (added 2026-09-16, BACKLOG.md item 26) — used for a department badge on the frontend, not for restricting who can see the alert: every staff role sees every alert regardless of department by design (confirmed via this endpoint's own test suite), `department` is opt-in filtering only. `GovernanceAlert.status` is a real linear progression — **OPEN (Detected) → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED**, with **DISMISSED** reachable as an early exit from any of the first three — the same flat-status-advances-through-values modeling `Workflow.currentStatus` already uses (feature 8), not a new child-steps table. `GovernanceAlertsService.updateStatus`'s `VALID_TRANSITIONS` map rejects any out-of-order PATCH with 400, naming the alert's actual next stage(s). `reason` is mandatory on every transition (400 without one). The relevant department's officer(s) are notified only on final closure (RESOLVED/DISMISSED), not on every intermediate stage. **No alert is ever seeded/hand-fabricated** (removed 2026-09-10) — every alert comes from one of three real sources: an admin-authored `RestrictionZone` whose real spatial overlap against seeded parcels is computed at save time (`SpatialService.createRestrictionZone`/`updateRestrictionZone`, `alertType: RESTRICTION_ZONE_OVERLAP`), a real change-detection analysis (feature 18, `UNAUTHORIZED_CHANGE_DETECTED`), or a real year-over-year historical comparison (feature 26, `RESTRICTION_DETECTED`/`DISPUTE_DETECTED`, now restricted to exactly the most recent year pair — see feature 26).
- **Frontend:** `features/officer/GovernanceAlertsPanel.tsx` + `features/officer/GovernanceAlertDetailModal.tsx` on the Officer Portal — a "View Details" popout per alert with the full record, a department badge next to the alert-type label, a 4-step progress stepper (Detected/Acknowledged/Field Verified/Resolved, current stage highlighted; Dismissed shown as a distinct early-exit note), only the action button(s) actually reachable from the alert's current stage, and an "Explain with AI" button (feature 17). Both panels also carry a "View Parcel" link into Parcel 360 (added 2026-09-10, once officer notifications stopped auto-opening it — see feature 27). Client-side paginated (5 alerts/page, added 2026-09-09) rather than rendering every open alert as one unbounded scroll. The shared stage config (`AlertStage`, `STAGE_CONFIG`, `NEXT_ACTIONS`, `STAGE_TRACK`, status badge styles) lives in `features/officer/GovernanceAlertReasonPrompt.tsx` so both panels stay in sync.

## 11. Authentication (+ Citizen Registration, OTP Verification, Google OAuth, Bilingual Notifications)

Real accounts shared by officers, admin, and citizens - plus citizen self-registration, mobile/email OTP verification, **Google OAuth 2.0**, and **bilingual SMS/Email notifications** for citizen workflow events.

- **Backend:** `auth/` + `users/` + `notifications/` — one `users` table (`email`/`mobileNumber` both nullable+unique, `emailVerified`/`mobileVerified`, `pendingEmail`/`pendingMobileNumber` for in-progress change, `preferred_language` (default `hi`), `oauth_provider`, `oauth_subject`, bcrypt hash, name, role).
  - `POST /auth/login` → `{email|mobileNumber, password}` → JWT (no expiry - session ends only via explicit Logout)
  - `POST /auth/oauth/google` — exchanges Google ID token for BhoomiSetu JWT
  - `POST /auth/register` (citizen-only) → method-selector (`method: 'EMAIL'|'MOBILE'`), creates account + returns session immediately, fires OTP
  - `POST /auth/verify-otp` / `resend-otp` (citizen-only) — mobile OTP via **TextBee**, email OTP via **SMTP/Zoho**
  - `POST /auth/profile/contact` (citizen-only) — add/change contact with OTP verification
  - `POST /auth/profile/details` — updates `preferred_language` (called from frontend on language switch)
  - `GET /auth/me` (JWT guard, looks up user fresh every call)
- **Frontend:** `pages/LoginPage.tsx`/`RegisterPage.tsx` (method-selector + **"Continue with Google"** button), `features/auth/OtpEntryForm.tsx`, `features/auth/RequireAuth.tsx`, `features/auth/auth.ts`. **Full Citizen Portal requires sign-in** (search, map, document verification, My Parcels). Language dropdown in navbar syncs `preferred_language` to backend.

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
  - **Workflow Oversight** (`AdminWorkflowOversightPage.tsx`, added 2026-09-10) — every department's workflows, optionally filtered by department/pending-only, opened in `WorkflowReviewPanel`'s admin oversight mode (feature 8): monitoring by default, not approval — "Alert Officer" is the primary action, "Decide Myself" is an explicit opt-in, and an already-decided step can be sent back for re-review.
  - **Map Layer Authoring** (`AdminMapLayerAuthoringPage.tsx`, added 2026-09-10) — the real UI for feature 21's write APIs, five tabs: Zoning Overlays / Restriction Zones / Infrastructure / **Admin Notes** (a 4th, admin-only layer — every endpoint including reads is ADMIN-gated, and it's never fetched by the shared citizen/officer map) / **Combined View** (`AdminCombinedLayerMap.tsx` — all four layers rendered together on one map with a togglable legend). A MapLibre-based drawing tool (`LayerGeometryDrawMap.tsx`, `@mapbox/mapbox-gl-draw`) is scoped only to this page — draw a shape instead of hand-typing GeoJSON. See feature 21 for the real spatial-overlap computation and no-overlap validation behind the create/edit forms.
  - **Officer Monitoring** (`AdminOfficerMonitoringPage.tsx` / `features/admin/OfficerMonitoring.tsx`, added 2026-09-10) — one row per officer: pending workload in their role's queue (a real SQL `GROUP BY` over `WorkflowStep`), approved/rejected decision counts and average time-to-decide (from `AuditLog`, the only place an individual officer — not just a role — is attributable to a decision), and last activity, including officers with zero activity (never silently omitted).

  Reachable from the global navbar's `ADMIN_NAV_ITEMS` (`navConfig.ts`), same pattern as the Officer/Citizen Portals.

## 16. Officer Portal

Multi-page portal for an officer's day-to-day work once signed in — restructured 2026-09-09 from a single dashboard (`docs/FRONTEND_UPGRADE_SPEC.md` §5), with the Quick Actions grid removed 2026-09-10 (all four links already existed in the top nav) and full English/Hindi coverage added the same day.

- **Backend:** composed from `workflows/`, `governance/`, `ai/`, `analytics/` (see their own feature entries).
- **Frontend:** `pages/OfficerPortal.tsx` (layout shell + its own relative `<Routes>`) with pages under `pages/officer/`: Dashboard (`OfficerDashboardPage.tsx` — real counts of pending/decided workflows; the open-alerts metric card is shown only for departments a governance alert type can actually map to — `DEPARTMENT_HAS_ALERTS` added 2026-09-16, BACKLOG.md item 26 — LAND_RECORDS/RESTRICTION/TAX/DISPUTE see it, REGISTRATION/PLANNING/ENCUMBRANCE don't, rather than always showing a misleading 0), Assigned Requests (`features/officer/WorkflowReviewPanel.tsx` — assigned workflows grouped by parcel with stored documents, approve/reject + mandatory remarks; absorbed the old standalone Documents page 2026-09-10, `/officer/documents` now redirects here), Governance Alerts (`features/officer/GovernanceAlertsPanel.tsx`, feature 10), Historical Imagery (feature 26), Map (general `MapComponent`, feature 1), Notifications (feature 27), and Profile (`OfficerProfilePage.tsx`, given the same editable depth as the Citizen Portal's Profile 2026-09-10 — an editable Profile Details card and verified email/mobile contact methods, via components shared with the citizen page). Gated by `RequireAuth` (feature 11). The Change Detection panel (feature 18) is not part of this portal's navigation as of this restructuring — see feature 18.

## 17. AI Assistant (Groq)

Natural-language queries, plain-language parcel/alert explanations, and site-navigation help, backed by Groq (never called from the frontend).

- **Backend:** `ai/` — `GroqService` uses the official `openai` SDK pointed at Groq's OpenAI-compatible API; every response is Zod-validated before use (a failed validation is a 502, never silently trusted). Without `GROQ_API_KEY` set, endpoints return 503. Rate-limited to 30 req/min/IP.
  - `POST /ai/query` — one call answers either a data question (Groq extracts a structured filter — state/district/tax_status/has_restriction/land_use/registration_status — and the backend runs the real DB query; the LLM never touches SQL) or a "how do I use this site" question (answered from a system prompt grounded in the site's real features).
  - `POST /ai/parcels/:parcelId/explain` — plain-language `{summary, risk_level, findings[], recommended_action}` for a parcel's full 360 view.
  - `POST /ai/alerts/:alertId/explain` — the same shape for one governance alert (officer/admin-only).
- **Frontend:** `features/ai/AskAiWidget.tsx` — a floating, draggable chat widget mounted once at the app-shell level (persists across citizen-facing page navigation), plus `features/ai/AiExplanationCard.tsx` shared by the widget, Parcel 360's "Explain with AI" button, and the governance alert detail popout.

## 18. Change Detection

Compares two satellite/aerial images of the same area and flags which real parcels fall inside the changed region.

- **Backend (originally NestJS, ported to `backend-py` — see `PYTHON_MIGRATION_PROGRESS.md`):** `app/routers/change_detection.py` + `app/services/change_detection_service.py` — `POST /change-detection/analyze` (multipart `before`/`after` images, 5MB cap each, + `minLng`/`minLat`/`maxLng`/`maxLat` real geographic bounds + optional description; rate-limited to 30 req/min/IP). Pillow decodes/resizes both images; a pixel comparison (`app/services/image_diff.py`) finds the bounding box of changed pixels and maps it to a geographic region. Every parcel is tested against that region via a real `ST_Contains`/`ST_Centroid` PostGIS query. Creates a `ChangeDetectionEvent` row and one `GovernanceAlert` per affected parcel. **Added 2026-09-14:** `POST /change-detection/analyze-satellite` — the same pipeline fed real Google Earth Engine Sentinel-2 NDVI imagery (`app/services/earth_engine_service.py`) instead of an upload, for a given bounds/date pair; degrades to a clean `503` (not a raw `500`) if Earth Engine isn't configured or the GCP project isn't registered for EE access. **Added 2026-09-16:** `GET /change-detection/clusters` (state/village picker data — real PostGIS-extent bounds per seeded cluster, for the frontend below) and `GET /change-detection/clusters/:clusterId/satellite-image?date=` (a true-color, not NDVI, Earth Engine photo — reused by feature 26's Satellite Photo toggle).
- **Frontend:** `features/change-detection/ChangeDetectionPanel.tsx`, mounted at `/officer/change-detection` (`pages/officer/ChangeDetectionPage.tsx`, linked from `OFFICER_NAV_ITEMS`) as of 2026-09-16 (`docs/architecture/BACKLOG.md` item 9, done) — an Upload/Satellite source toggle switches the form between file pickers and before/after date inputs. Satellite mode's bounds are picked via a state → city/village dropdown (backed by `GET /change-detection/clusters` above) instead of hand-typed lat/lng, and the satellite request uses a longer (90s) client timeout than the app default (10s) since it involves two sequential live Earth Engine fetches. Confirmed end-to-end against real Earth Engine (project registered on the Community quota tier): a real run over the seeded Pune cluster returned `changeDetected: true`, 75 parcels matched, 75 alerts created. Result view still links affected parcels into Parcel 360.

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

## 22. Multilingual UI (11 languages, Bhashini-backed)

**Rebuilt 2026-09-15**, replacing the earlier `i18next`/`react-i18next` (English/Hindi only) setup entirely. The full UI switches language live across all three portals, with the choice remembered across visits, now backed by [Bhashini](https://bhashini.gov.in/) (Government of India multilingual AI) instead of hand-maintained locale files — see `docs/architecture/BHASHINI_INTEGRATION.md` for the full design writeup.

- **Backend:** `app/services/bhashini.py` (translation/transliteration/TTS/ASR against Bhashini's ULCA/Dhruva APIs, config-driven service discovery, retry/backoff) and `app/routers/multilingual.py` — notably `GET /api/v1/multilingual/ui-text/{lang}`, which serves a pre-translated, cached `static/ui_strings_<lang>.json` (one file per language, ~694 keys each) rather than calling Bhashini live for static UI text.
- **Frontend:** `context/LanguageContext.tsx` (`LanguageProvider` + `useTranslation()`, `localStorage`-backed persistence under `bhoomisetu_lang`) fetches the cached UI-text file from the endpoint above on every language switch. Wired into the navbar language selector (`App.tsx`) and every page/component across all three portals (`t(key)` call sites unchanged from the old `react-i18next` signature, so the migration was mostly an import swap — see the integration doc's §6 for the file-by-file migration notes). **11 languages shipped**: English + the 10 with full Translation+ASR+TTS coverage on the project's Bhashini account (`bn, gu, hi, kn, ml, mr, or, pa, ta, te`) — a deliberate choice so every language in the dropdown has consistent feature support. `t(key)` falls back to the raw key if a translation is missing, never crashes.
- `SpeakerButton` (TTS playback) and `MicButton` (ASR voice input) components are built and wired into 8+ call sites (`ServiceRequestForm.tsx`, `ParcelSearch.tsx`, `WorkflowReviewPanel.tsx`, `AskAiWidget.tsx`, `RequestsPage.tsx`, `CitizenDashboardPage.tsx`, `GovernanceAlertReasonPrompt.tsx`) as of 2026-09-16. **Search transliteration is also wired**: `ParcelSearch.tsx` detects a Roman-script `local_identifier` query while the active UI language is non-English, calls `POST /multilingual/transliterate` to convert it to the current script before searching, and shows a "Searching as: …" hint with the converted text.

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

On-demand, staff-only replacement for feature 18's always-on upload panel: compares two years of a cluster's own real per-parcel historical state instead of requiring a fresh upload, and only alerts on changes nothing already explains. Redesigned 2026-09-08 to drop pixel-diffing entirely in favor of a real per-parcel data comparison, per-parcel LLM-phrased narratives instead of an aggregate percentage, and a 6-color category legend. The `ClusterHistoricalSnapshot` table/seed-time-rendered-PNG approach described below was itself removed 2026-09-15 (`docs/architecture/BACKLOG.md` item 10, done) now that feature 9's live Google Earth Engine imagery is the real satellite source — this comparison never depended on the snapshot pixels anyway (see the `NarrativeService` note below), so nothing about the comparison logic itself changed.

- **Backend:** `app/routers/historical_imagery.py` — `GET /historical-imagery/clusters` (which clusters have real parcel data, with a fixed `[2022, 2023, 2024, 2025, CURRENT_YEAR]` year list per cluster), `POST /historical-imagery/clusters/:clusterId/compare` (`{fromYear, toYear}`, rate-limited to 30 req/min). Both are staff-only (`ALL_STAFF_ROLES`); the old `GET .../years/:year/image` route that served a stored snapshot PNG is gone. `app/common/parcel_generation/parcel_category.py` defines `ParcelCategory` (`NONE`/`RESTRICTED`/`DISPUTE_OWNERSHIP`/`DISPUTE_BOUNDARY`/`DISPUTE_INHERITANCE`/`DISPUTE_ENCROACHMENT`, one color each) computed from real data — that year's `ParcelHistoricalState.restriction_status`, plus (current year only, since `DisputeRecord` has no per-year history) the parcel's real active dispute type; the same function drives `historical_comparison_service.py`'s comparison, so a parcel is simply "affected" when its category differs between the two years — no pixel math, no bounding box, no spatial intersection, and never was pixel-based for the comparison itself even before the snapshot removal. A newly-appearing or worsened category creates a `GovernanceAlert` (`DISPUTE_DETECTED` or `RESTRICTION_DETECTED`, `source: 'HISTORICAL_IMAGERY'`, severity `CRITICAL`/`HIGH`/`MEDIUM` by category and whether the parcel also has an active restriction); an improved category (e.g. a dispute resolved) is still reported but never gets a fresh alert. **`compare()` only accepts exactly `CURRENT_YEAR-1 → CURRENT_YEAR`** (any other pair — even two purely historical years — gets a 400) — since this is the only place a historical comparison creates alerts, and the user's explicit ask was that alerts reflect "the 2025-2026 differences only," not any year pair an officer happens to pick. `NarrativeService` (OpenRouter, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, text-only) turns each affected parcel's real facts into one grounded sentence — e.g. "This parcel now has an active boundary dispute" — capped to the 20 most severe affected parcels to bound latency; a failed/uncapped/unconfigured call falls back to the same real facts, plainly phrased.
`GET /historical-imagery/clusters/:clusterId/years/:year/parcels` (added 2026-09-08) returns real parcel geometry + a real `ParcelCategory` per parcel for one year, so the frontend can render a cluster's actual boundaries on the live map — this browsing endpoint is unaffected by the year restriction above, only the alert-generating comparison is locked down.
- **Frontend:** `features/officer/HistoricalImageryPanel.tsx`, mounted at `/officer/historical-imagery` (`pages/officer/HistoricalImageryPage.tsx`) — pick a cluster, then a single year dropdown drives the real interactive map (`features/map/MapComponent.tsx`, extended with `parcelColors`/`parcelLabels` props) showing that year's actual parcel boundaries colored by category. As of 2026-09-16, `features/officer/HistoricalMapView.tsx` (the shared map component embedded here and in Parcel 360) also has an officer-only "Parcel Map" / "Satellite Photo" toggle — the latter fetches a real true-color Earth Engine photo for the selected year from `GET /change-detection/clusters/:clusterId/satellite-image?date=`, on demand (not auto-fetched, to conserve Earth Engine quota), as a genuine visual alternative to the category-colored map. The two-year comparison itself is `features/officer/HistoricalYearCompare.tsx` (extracted 2026-09-10 so Parcel 360 can embed it inline too — see below) — no year picker any more, it always compares the two most recent years in the cluster (matching the backend restriction) and shows one row per affected parcel: its category-change badge, its real narrative sentence, and an "Alert raised" tag where one was created. Deep-linkable from Parcel 360's "Compare Years & Generate Alerts" action (staff only, shown when the viewed parcel belongs to a cluster) via an inline expand/collapse — this used to navigate to `/officer/historical-imagery?cluster=`, but as of 2026-09-10 runs the comparison directly on Parcel 360 instead, per the user's explicit request that this analysis "should be done there only in the parcel 360."

## 27. In-App + External Notifications (Bilingual SMS & Email)

A real per-user notification feed with optional bilingual SMS/Email delivery for citizens.

- **Backend:** `notification-feed/` — a `Notification` entity (`userId`/`type`/`title`/`message`/`parcelId`/`workflowId`/`alertId`/`read`), `GET /notifications` and `PATCH /notifications/:id/read` (any authenticated role, scoped to the caller). Write paths: `WorkflowsService.notifyAssignedOfficers()` (new request notifies every officer holding the assigned department's role), `WorkflowsService.notifyCitizenOfStepDecision()` (officer's decision notifies the citizen back, resolved via `citizen_parcels`), `WorkflowsService.escalateStep()` (admin's "Alert Officer" action), and governance-alert closure.

  **Bilingual external delivery** (`app/services/external_notifications.py`): When a citizen is notified (workflow submission, step decision), a background thread:
  1. Takes the English message
  2. Calls Bhashini Translation API to translate to the citizen's `preferred_language` (from `User.preferred_language`, default `hi`)
  3. Combines into a single bilingual message: `[English]\n\n[Translated]`
  4. Delivers via **SMS (TextBee)** and **Email (SMTP)** if citizen has verified contacts

- **Frontend:** `features/notifications/NotificationFeed.tsx`, shared by `pages/citizen/NotificationsPage.tsx` and `pages/officer/OfficerNotificationsPage.tsx` — click-to-mark-read. Citizen notifications open the related parcel when one exists. **Officer notifications are role-aware**: `GOVERNANCE_ALERT_*` types route to `/officer/alerts?alert=<id>`, everything else to `/officer/requests?workflow=<id>`.

- **Language sync:** `LanguageContext.setLanguage()` pushes `preferredLanguage` to backend via `POST /auth/profile/details` on every UI language switch.

## 28. AI-Based Request Routing

`POST /workflows` analyses a citizen's free-text request and picks the real department(s) it concerns, instead of always the same hardcoded default pipeline.

- **Backend:** `workflows/request-routing.service.ts` — Groq (`GroqService.completeJson`, extracted into its own `ai/groq.module.ts` so `WorkflowsModule` can reuse it without importing all of `AiModule`) classifies `requestDetails` against the 7 real department codes, returning `{departments, reason}`. Validated against a closed set (`DEPARTMENT_ROLE`, the reverse of `auth/roles.constants.ts`'s `ROLE_DEPARTMENT`); on any failure (unconfigured/error/malformed/empty) returns nothing and `WorkflowsService.create()` falls back to the original deterministic `pipelineFor()` unchanged — every existing workflow test still exercises that fallback path for real (no `GROQ_API_KEY` in the test environment). The AI's rationale is stored on the workflow (`routingNotes`) and surfaced in the assigned officer's notification. Required every department to have a real officer role first: `TAX_OFFICER`/`RESTRICTION_OFFICER`/`ENCUMBRANCE_OFFICER` added to `OFFICER_ROLES` (previously only 4 of the 7 departments had one), one seeded demo account each.
- Live-verified against the real Supabase database and real Groq API: a `CORRECTION_REQUEST` describing an overdue tax bill was correctly routed to `TAX` alone (not the generic default), with the officer notification carrying the AI's actual rationale.

## 29. Governance Alert Review Reason

**Superseded by feature 10's 4-stage rework (2026-09-10)** — kept here for history. `GovernanceAlert.reason` is mandatory on every stage transition now, not just the original two (Mark Reviewed/Dismiss); `alertDepartmentFor()` (`governance-alerts.service.ts`) still derives which department an alert concerns from its `alertType` and still notifies that department's officer(s) (feature 27), just only on final closure — see feature 10 for the current behavior.
- **Frontend:** `features/officer/GovernanceAlertReasonPrompt.tsx` — opens on any stage-advance/dismiss button press (row card or detail modal), reason mandatory, shown back afterward as a "Reviewer's note".

## Mock Data (underlies every feature above)

**Rewritten 2026-09-18** with standard Indian residential plot sizes, road-snapping to local OSM PBF roads, and expanded parcel counts — 6,120 parcels across 58 clusters in 30 districts. `backend-py/scripts/seed.py` (module form: `python -m scripts.seed`) generates parcels across `app/common/parcel_generation/cluster_generator.py`'s `CLUSTER_CONFIGS` — 5 hand-tuned clusters (Pune 150, Chennai 80, Bangalore 80, New Delhi 50, Chandigarh 50) plus one auto-generated city (state capital, 150 parcels) + one auto-generated village cluster (70 parcels) per remaining Indian state (53 auto-generated clusters, 5,710 parcels). `app/common/parcel_generation/osm_roads.py` queries the local `road_networks` table (313,927 highways extracted from 6 Geofabrik India zone PBF files, Sep 2026) for each cluster's dominant road bearing — no Overpass API calls. The irregular topology-aware subdivision is oriented along real roads, and **parcel boundaries are snapped to nearby road edges (30m radius)**. **Standard Indian residential plot sizes**: Small 600-1,000 sq ft (55-93 sq m, 45%), Medium 1,200-1,500 sq ft (111-139 sq m, 30×40/30×50 ft, 35%), Large 2,400+ sq ft (223+ sq m, 40×60 ft, 20%). Regional units: Guntha (1,089 sq ft, MH/KA), Cent (435.6 sq ft, South), Ground (2,400 sq ft, TN). Every parcel gets Registration/Planning/Tax/Restriction/Dispute/Encumbrance records, state-appropriate identifiers, and (Pune only) zoning/restriction/infrastructure/change-detection demo layers. ~50% of parcels also get a 1-3-entry ownership history chain. 8 officer/admin accounts (1 admin + 1 officer per department) + 2 demo Verifier accounts (feature added 2026-09-16, see `docs/architecture/BACKLOG.md` item 19) + 20 citizen accounts, all password `Demo@123`. **No `GovernanceAlert` rows are seeded** — a governance alert is only ever created by something that actually happens at runtime, never fabricated at seed time. Per-parcel document image generation is skipped by default (`SKIP_PARCEL_DOCUMENT_IMAGES` in `seed.py`) to keep a full reseed fast; the removed `ClusterHistoricalSnapshot` seed step (feature 26) is gone entirely, not just skipped.

## 30. Verifier Role & Field Evidence Capture

A separate role from Officer/Admin/Citizen: a Verifier's only job is collecting geotagged, timestamped field-visit photo evidence for a workflow an Officer/Admin explicitly assigned them to — never deciding the case. Built 2026-09-16 (`docs/architecture/BACKLOG.md` item 19, done).

- **Backend:** `VERIFIER_ROLE` (`app/auth/roles.py`) — deliberately excluded from `OFFICER_ROLES`/`ALL_STAFF_ROLES`, which is what structurally guarantees a Verifier account can never call the workflow-approve endpoints (no extra enforcement code needed for that separation-of-duty rule — it falls out of the role split itself). New `VerificationEvidence` model/table (see `SYSTEM_ARCHITECTURE.md`). `PATCH /workflows/:id/assign-verifier` (staff-only), `GET /workflows/assigned-to-me` (Verifier-only), `POST /workflows/:id/field-evidence` (Verifier-only, multipart photo + `latitude`/`longitude`/`capturedAt`/`notes`), `GET /workflows/:id/field-evidence` (staff-only, for the reviewing officer). Every `WorkflowOut` also carries a computed `requiresFieldVerification: bool` (`Workflow.requires_field_verification`, `app/models/workflow.py` — a deterministic set over the app's fixed workflow types, added 2026-09-16, BACKLOG.md item 26) — informational only, not enforced server-side: assignment is intentionally still allowed for any workflow type (confirmed by this endpoint's own test suite, which assigns a Verifier to a plain `ROR_COPY_REQUEST`), since an admin may still want a field visit for an edge case.
- **Frontend:** a separate `/verifier` portal (`pages/VerifierPortal.tsx`), deliberately narrow — an Assigned Visits list (`pages/verifier/AssignedVisitsPage.tsx`) and a capture form (`features/verifier/FieldEvidenceCaptureForm.tsx`, using `navigator.geolocation.getCurrentPosition()`). `WorkflowReviewPanel.tsx` (feature 8) gained an Assign Verifier control and a Field Evidence section so the reviewing officer sees submitted evidence before deciding; the Assign Verifier control shows a soft hint (not a block) when `requiresFieldVerification` is false. 2 demo Verifier accounts seeded, pre-assigned to some seeded workflows for immediate demoability.

## 31. On-Demand Official Document PDF

A Village Form 7 (Record of Rights) + Form 12 (Register of Crops) style PDF, generated fresh per request from real data — not a seed-time rendered image, not mock data at render time. Layout rewritten 2026-09-16 to exactly mirror a reference Form 7/12 implementation the user supplied, wired to real rows instead of that reference's own hardcoded mock data.

**Status: Core renderer complete — end-to-end integration has critical gaps** (see `docs/architecture/official-document-code-review.md` for full code review).

- **Data-mapping layer:** `app/services/land_record_pdf_service.py`'s `build_land_record_pdf_data()` — assembles a `LandRecordPDFData` tree from `Parcel`/`ParcelIdentifier`/`OwnershipHistoryRecord`/`RegistrationRecord`/`TaxRecord`/`CropRecord`/`Workflow`/`WorkflowStep`. **Critical gap:** does not read the authenticated user's profile (name, email, mobile, address, government ID, occupation) — the `User` model has these fields but they are never passed into the PDF data contract. The applicant/approval strip uses the latest approved workflow creator, which may not match the actual citizen requesting the document.
- **PDF generator:** `app/common/parcel_generation/official_document_generator.py` (`reportlab` + `qrcode[pil]`) — complete Form 7/12 layout with English/Hindi, emblem box, QR code, ownership table, crop register, footer. **Critical gap:** single-page canvas approach can overflow when ownership/crop history grows; no multi-page handling. Profile data not rendered even if available.
- **Endpoint:** `GET /parcels/{id}/documents/official-pdf?lang=en|hi` (staff always, or a citizen only for a parcel linked to their account) streams PDF inline. **Critical gap:** `Content-Disposition: attachment` forces download; no `inline` support for a View flow. No profile data passed.
- **Frontend:** "Download Official Document" button only on Parcel 360. **Critical gaps:** no **View Official Document** action; no PDF viewer modal; no zoom capability; object URL revoked immediately after download click (brittle); no error state for failed generation.
- **Tests:** Only verify PDF signature (`%PDF-`), not that real values (owner name, survey number, ULPIN, mutation, tax, crop) are rendered.

### Required Fixes (from code review)
1. **Backend:** Add `ProfileInfo` to `LandRecordPDFData`, pass authenticated `User` through assembler, render profile block, make layout multi-page safe (Platypus or `showPage()`), return `inline` disposition
2. **Frontend:** Add `OfficialPdfViewerModal` with iframe viewer, separate View/Download actions, proper object URL lifecycle, error handling
3. **Tests:** Add `pypdf` text extraction assertions for real values; add integration test with full fixture data; add security test for 403 on unrelated citizen; add overflow test with 25+ rows

## 32. Case Management (Unified Workflow)

A parcel-centric, case-based governance engine replacing the prior fixed request-type model. One citizen issue → one or more parcels → one or more department workflows → resolution.

- **Backend:** `app/models/case.py` (10 models: Case, DepartmentTask, Application, AIAnalysis, RoutingDecision, SLAConfig, Appointment, CaseTimelineEvent, Feedback, CaseParcelGeometryVersion), `app/services/case_service.py` (case engine), `app/routers/cases.py` (API endpoints), `app/schemas/case.py` (Pydantic schemas). Registered in `app/main.py` as `POST /api/v1/cases/from-application`, `GET /api/v1/cases/:id/application` (Phase 2); plus all Phase 1 endpoints: `GET/POST /api/v1/cases`, `GET/PATCH /api/v1/cases/:id`, `GET/POST /api/v1/cases/:id/detail`, `POST /api/v1/cases/:id/tasks`, `POST /api/v1/cases/:id/ai-analysis`, `POST /api/v1/cases/:id/routing`, `POST /api/v1/cases/:id/appointments`, `GET/POST /api/v1/cases/:id/timeline`, `GET/POST /api/v1/cases/:id/feedback`, `GET /api/v1/cases/:id/ai-analysis`, `GET /api/v1/cases/:id/routing`, `GET /api/v1/cases/:id/sla`, `GET /api/v1/cases/:id/active`, `GET /api/v1/cases/my`, `GET /api/v1/cases/parcel/:parcel_id`.
  - **Invariant 1** (§6): `create_case()` and `create_case_from_application()` enforce no duplicate active cases for same citizen + parcel — returns `ACTIVE_CASE_EXISTS` (409) if one exists.
  - **Lifecycle** (§59): `CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED` — validated by `CASE_STATUS_TRANSITIONS` in `case_service.py`.
  - **Authorization** (§38, §63): Officers/staff manage any case; citizens only cases on their own parcels via `_can_manage_case()` + `parcels_service.is_citizen_associated_with_parcel()`.
  - **Audit trail**: Every case creation/status change linked to case via `audit_service.log()`.
  - **Timeline** (§57): `CaseTimelineEvent` records Who/When/What/Previous/New/Case/Task for every material event.
  - **AI integration**: `create_ai_analysis()` stores structured understanding, fact/claim separation, departments identified, and application draft (§11, §15).
  - **Routing** (§17): `create_routing_decision()` persists department routing and workflow assignment per department.
  - **Department tasks** (§18): `add_department_task()` creates per-department work items within a case.
  - **Appointments** (§45, §46): `create_appointment()` links appointments to cases.
  - **Feedback** (§51, §52): `submit_feedback()` supports multi-officer ratings with structured reasons.
  - **Geometry versioning** (§43): `CaseParcelGeometryVersion` tracks proposed/current geometry states per case.
  - **Phase 2 — AI-Assisted Request Flow (§9–18):**
    - **AI conversation service** (`app/services/ai_service.py`): `understand_request()` (§10, §11.1) produces structured understanding with intent, issues, database facts vs citizen statements (§15), follow-up questions, and initial application draft. `generate_application_draft()` (§11.2, §13) generates a formal one-paragraph application with explicit fact/claim separation. `generate_routing_decision()` (§17) determines departments, workflows, required capabilities, and priority, with deterministic fallback.
    - **AI API endpoints** (`app/routers/ai.py`): `POST /api/v1/ai/understand`, `POST /api/v1/ai/application-draft`, `POST /api/v1/ai/route` — all citizen-facing, rate-limited, 502 on AI validation failure.
    - **AI schemas** (`app/schemas/ai.py`): `UnderstandRequestIn`, `UnderstandRequestOut`, `ApplicationDraftIn`, `ApplicationDraftOut`, `RoutingDecisionIn`, `RoutingDecisionOut`, `FactStatement`, `DepartmentRouting`.
    - **Case creation from confirmed application** (`case_service.py`): `create_case_from_application()` creates Case → AIAnalysis → Application (with version history per §14) → RoutingDecision → DepartmentTasks → transitions to ACTIVE. Exposed via `POST /api/v1/cases/from-application`.
    - **Application versioning** (§14, §16): `Application` model (`case_applications` table) preserves original_input, conversation, ai_interpretation, ai_draft, citizen_edited_version, final_submitted_version, citizen_confirmation, and generated document path. `GET /api/v1/cases/:id/application` retrieves the artifact.
- **Frontend:** To be built in Phase 2 (citizen AI workflow) and Phase 4 (officer workspace).

## Where things aren't built yet

OAuth-based auth is the one item still open against the team's own spec (see `docs/archive/FEATURE_AUDIT.md` §6/§8 item 15) — it needs a real OAuth app registered with an external provider, which only the user can provision. See `docs/architecture/BACKLOG.md` for the full current list of open items, including session/timeout handling and the Users/Governance-Rules engine rework.
