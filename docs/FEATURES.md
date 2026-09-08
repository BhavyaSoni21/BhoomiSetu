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

- **Backend:** `workflows/` — `POST /workflows` (CITIZEN-only as of the account-centric flow redesign in `docs/flow.md` §9 — creates a `Workflow` + auto-generates a 3-step pipeline `LAND_RECORDS → REGISTRATION → PLANNING`, all `PENDING`; a `DISPUTE_FILING` type gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead; `createdBy` defaults to the filing citizen's name when not given). **Restricted to the citizen's own parcels as of 2026-09-09** (`docs/FRONTEND_UPGRADE_SPEC.md` §4/§9 item 4) — 400 if the parcel doesn't exist, 403 if it exists but isn't linked to the filing citizen's `citizen_parcels`. `GET /workflows` (list/filter, officer/admin-only), `GET /workflows/:id`, `GET /workflows/mine` (CITIZEN-only, added 2026-09-09 — every workflow across every one of the citizen's own parcels), `PATCH /workflows/:id/status`, `PATCH /workflows/:workflowId/steps/:stepId` (the actual approve/reject action — recomputes overall status, enforces per-department role via RBAC, feature 13).
- **Frontend:** Citizen side — `features/parcels/ServiceRequestForm.tsx` ("Request Documents"/"Report Issue"/"File a Dispute" on Parcel 360, and on the Citizen Portal's own Raise Request page, `pages/citizen/RaiseRequestPage.tsx`, added 2026-09-09 — a parcel dropdown restricted to the citizen's own parcels with auto-fetched read-only details, rather than needing to already be viewing one specific parcel's Parcel 360), `features/parcels/RequestNotifications.tsx` ("Your Requests" live-status panel on Parcel 360), and the Citizen Portal's Requests page (`pages/citizen/RequestsPage.tsx`, added 2026-09-09 — every request across every parcel, backed by `GET /workflows/mine`, with per-department step status shown per request). Officer side — `features/officer/WorkflowReviewPanel.tsx` on the Officer Portal's Assigned Requests page (`pages/officer/AssignedRequestsPage.tsx`).

## 9. Document Verification (OCR)

A citizen uploads a photo/scan of a land document; it's OCR'd and cross-checked against the parcel's actual records.

- **Backend:** `document-verification/` — `POST /document-verification/verify` (multipart `document` image, 5MB cap, + `parcelId`; public, rate-limited to 20 req/min/IP since OCR is real CPU work). Uses `tesseract.js` locally (no external API/key). Checks every identifier on file, owner name, and area via the same interoperability layer as Parcel 360, with OCR-noise-tolerant matching (whitespace-insensitive identifier substring match, majority-of-words name match, area within 5%). Returns `overallVerdict`: `VERIFIED` / `PARTIAL_MATCH` / `MISMATCH` / `INSUFFICIENT_DATA`.
- **Frontend:** `features/document-verification/DocumentVerificationPanel.tsx` — the Citizen Portal's Verify Documents page (`pages/citizen/VerifyDocumentsPage.tsx`), with an optional dropdown of the signed-in citizen's own parcels to tie the check to one of them.

## 10. Governance Alerts

Officer-facing alerts generated from the change-detection and spatial/tax pipelines.

- **Backend:** `governance/` — `GET /governance-alerts` (filter by status/severity), `GET /governance-alerts/:id`, `PATCH /governance-alerts/:id/status` (officer marks `REVIEWED`/`DISMISSED`). Seeded from flood-zone overlap, the simulated change-detection event, and overdue tax; real ones also created by feature 18.
- **Frontend:** `features/officer/GovernanceAlertsPanel.tsx` + `features/officer/GovernanceAlertDetailModal.tsx` on the Officer Portal — a "View Details" popout per alert with the full record and an "Explain with AI" button (feature 17). Client-side paginated (5 alerts/page, added 2026-09-09) rather than rendering every open alert as one unbounded scroll.

## 11. Authentication

Real accounts (not the earlier client-side-only "pick a name and role" simulation) shared by officers, admin, and (optionally) citizens.

- **Backend:** `auth/` + `users/` — one `users` table (email, bcrypt hash, name, role). `POST /auth/login` → JWT (24h, `@nestjs/jwt`), uniform 401 for wrong password or unknown email (no user enumeration). `GET /auth/me` (passport-jwt guard, looks the user up fresh every call).
- **Frontend:** `pages/LoginPage.tsx` (one sign-in page for all three account kinds, redirects to `/admin`/`/officer`/`/citizen` by role) + `features/auth/RequireAuth.tsx` (route guard on `/officer/*`/`/admin`/`/citizen/*`) + `features/auth/auth.ts` (React Query-cached session state, read by `App.tsx`'s navbar). **As of 2026-09-09, signing in is required for the entire Citizen Portal** — search, the map, document verification, and My Parcels (feature 12), not just service requests — per `docs/FRONTEND_UPGRADE_SPEC.md` §1's "no guest search, anywhere in the flow". Only the public site (`/`, `/about`, `/features`) needs no account.

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

- **Backend:** `audit/` — an `audit_logs` table records `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED`, `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`. `GET /audit` (admin-only, filterable), `GET /parcels/:id/audit` (staff-only).
- **Frontend:** `features/admin/RecentActivity.tsx` — a live feed on the Admin Portal.

## 15. Admin Portal / User Management

Real staff-account administration, not a placeholder screen.

- **Backend:** `users/users.controller.ts` — `GET /users` (staff only, excludes citizens), `POST /users` (create Officer/Admin), `PATCH /users/:id/role`, `DELETE /users/:id` — all admin-only, all audit-logged, self-lockout prevented. `GET /analytics/summary` includes `totalUsers`/`recentLogins24h`.
- **Frontend:** `pages/AdminPortal.tsx` + `features/admin/UserManagement.tsx` (create/promote-demote/remove accounts) + `features/admin/RecentActivity.tsx` (feature 14) + real System Overview counts.

## 16. Officer Portal

Multi-page portal for an officer's day-to-day work once signed in — restructured 2026-09-09 from a single dashboard (`docs/FRONTEND_UPGRADE_SPEC.md` §5).

- **Backend:** composed from `workflows/`, `governance/`, `ai/` (see their own feature entries).
- **Frontend:** `pages/OfficerPortal.tsx` (layout shell + its own relative `<Routes>`) with pages under `pages/officer/`: Dashboard (real counts — pending/decided workflows, open alerts), Assigned Requests (`features/officer/WorkflowReviewPanel.tsx` — assigned workflows + approve/reject + remarks), Governance Alerts (`features/officer/GovernanceAlertsPanel.tsx`, feature 10), Map (general `MapComponent`, feature 1), and Documents/Notifications (`ComingSoonCard` placeholders) plus Profile. Gated by `RequireAuth` (feature 11). The Change Detection panel (feature 18) is not part of this portal's navigation as of this restructuring — see feature 18.

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
- **Frontend:** `features/change-detection/ChangeDetectionPanel.tsx` (file pickers, a bounds form with a one-click "Use Pune cluster bounds" fill, a result view linking affected parcels into Parcel 360) is **not currently mounted anywhere in the app** — it was previously an always-visible "Analyze Imagery" panel on the Officer Portal, removed from that portal's navigation 2026-09-09 per `docs/FRONTEND_UPGRADE_SPEC.md` §8 (the name overpromised real satellite-imagery analysis for what is actually a hand-rolled pixel diff; a scoped on-demand historical-comparison feature is planned as its replacement, not yet built). The component and the backend endpoint above are both untouched and still fully covered by `backend/test/change-detection.e2e-spec.ts` and `features/change-detection/ChangeDetectionPanel.test.tsx`.

## 19. Governance Analytics Dashboard

Platform-wide analytics, not just per-alert.

- **Backend:** `analytics/` — `GET /analytics/summary`, real SQL `GROUP BY` aggregation across tax status, registration status, land use, dispute case status, workflow status/type, alert severity/status, plus overall totals.
- **Frontend:** `features/analytics/AnalyticsDashboard.tsx` — an 8-chart `recharts` dashboard on the Admin Portal.

## 20. Predictive Analytics (Risk Score)

A transparent, explainable risk score per parcel — deliberately a hand-weighted heuristic, not a trained model (no labeled outcome data exists to train/validate one).

- **Backend:** `predictive-analytics/` — combines tax delinquency (0.4), dispute exposure (0.3), open governance alerts (0.2), land-use restriction (0.1), each with a plain-language rationale. `GET /parcels/:id/risk-score`, `GET /predictive-analytics/top-risk-parcels`.
- **Frontend:** the "Risk Assessment" card on Parcel 360 (`features/parcels/Parcel360View.tsx`) and `features/analytics/TopRiskParcels.tsx` ("Top At-Risk Parcels" list) on the Admin Portal.

## 21. Spatial Layer Write APIs

Admin-capable authoring of the demo overlay layers — built as tested API capability, no UI yet.

- **Backend:** `spatial/` — real `POST`/`PATCH`/`DELETE` for zoning overlays, restriction zones, and infrastructure features (admin-only), with geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure).
- **Frontend:** none — no map-drawing tool exists to author new zone geometry yet.

## 22. Multilingual UI (English / Hindi)

The full citizen-facing UI switches language live, with the choice remembered across visits.

- **Backend:** none — purely a frontend concern.
- **Frontend:** `i18n/config.ts` (`i18next` + `react-i18next` init, `localStorage`-backed persistence under `bhoomisetu_language`) + `i18n/locales/en.json` / `i18n/locales/hi.json`. Wired into the navbar language selector (`App.tsx`), the landing hero (`features/citizen/LandingHero.tsx`), parcel search (`features/parcels/ParcelSearch.tsx`), the Citizen Portal panels (`pages/CitizenPortal.tsx`), and the map — including its layer-toggle labels and click popup (`features/map/MapComponent.tsx`). Marathi/Kannada are scaffolded in `SUPPORTED_LANGUAGES` but intentionally not enabled until their locale files exist (adding a language needs no component changes, only a new JSON file).

## 23. Rate Limiting

Every endpoint is throttled; the costlier ones (AI, change detection, document OCR) are throttled tighter.

- **Backend:** `@nestjs/throttler` — global 200 req/min/IP default; 30 req/min/IP on `ai/` and `change-detection/`; 20 req/min/IP on `document-verification/`. `X-RateLimit-*` response headers included. `trust proxy` is set so per-IP limiting reads the real client IP behind a reverse proxy.
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

## Mock Data (underlies every feature above)

`backend/seed.ts` generates 220 parcels across 5 real regions (Pune 100, Chennai 40, Bangalore 40, New Delhi 20, Chandigarh 20 — the last added 2026-09-09 to represent both of the SIH "Land Stack" PS's actual named pilot locations, Tamil Nadu and Chandigarh) with irregular, topology-aware subdivision (`backend/src/common/parcel-generation/`) rather than a uniform grid — adjacent parcels share literal boundary coordinates, sized/shaped irregularly per cluster. Every parcel gets Registration/Planning/Tax/Restriction/Dispute/Encumbrance records, state-appropriate identifiers, and (Pune only) zoning/restriction/infrastructure/change-detection demo layers. ~50% of parcels also get a 1-3-entry ownership history chain. 5 officer/admin accounts + 20 citizen accounts, all password `Demo@123`.

## Where things aren't built yet

OAuth-based auth is the one item still open against the team's own spec (see `docs/FEATURE_AUDIT.md` §6/§8 item 15) — it needs a real OAuth app registered with an external provider, which only the user can provision.
