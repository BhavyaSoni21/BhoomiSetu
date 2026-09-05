# BhoomiSetu - GIS-based Land Governance Platform

BhoomiSetu is a GIS-based, parcel-centric land governance and interoperability platform designed to connect fragmented land-related datasets through a unified digital framework.

## Project Structure

```
SIH_2026_BhoomiSetu/
├── backend/                 # NestJS backend application
├── frontend/                # React frontend application
├── docker-compose.yml       # Docker Compose configuration (see Docker note below)
├── init-postgis.sql         # PostGIS database initialization script
├── BHOOMISETU.md            # Project vision and overview
├── Tech.md                  # Technical architecture and specifications
└── README.md                # This file
```

## Technology Stack

### Backend
- **Runtime**: Node.js 22+
- **Framework**: NestJS (TypeScript)
- **Database**: SQLite for development, PostgreSQL + PostGIS for production
- **ORM**: TypeORM
- **Validation**: class-validator (HTTP request DTOs), Zod (validating Groq's AI output before it's trusted - see Groq AI Endpoints below)
- **AI**: Groq, via the OpenAI-compatible `openai` SDK (backend-only, never called from the frontend)
- **API Documentation**: Swagger/OpenAPI (served at `/api`)
- **Testing**: Jest + Supertest (e2e)

### Frontend
- **Framework**: React (TypeScript)
- **Build Tool**: Vite
- **Server State**: TanStack Query
- **GIS Map**: MapLibre GL JS
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Testing**: Vitest + React Testing Library

> `zustand`, `react-hook-form`, `recharts`, and `zod` are installed as dependencies for upcoming phases but aren't wired into any component yet.

### Database
- **Primary (dev)**: SQLite (file-based, zero setup)
- **Primary (production)**: PostgreSQL 16+ with PostGIS 3+
- **Spatial Data**: GeoJSON (stored as text in SQLite dev mode; native `geometry` column in PostGIS)

## Getting Started

### Prerequisites
- Node.js 22+ and npm

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BhavyaSoni21/BhoomiSetu.git
   cd BhoomiSetu
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env   # defaults use SQLite, no edits needed for local dev
   npm run seed            # populate ./data/dev.sqlite with 200 mock parcels
   npm run start:dev       # start on http://localhost:3000
   ```

3. **Frontend setup** (in a second terminal)
   ```bash
   cd frontend
   npm install
   npm run dev              # start on http://localhost:5173
   ```

4. **Open the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api/v1
   - Swagger docs: http://localhost:3000/api

### Running Tests

```bash
# Backend e2e tests (Jest + Supertest, isolated in-memory SQLite)
cd backend
npm test

# Frontend component tests (Vitest + React Testing Library)
cd frontend
npm test
```

### Production / PostgreSQL

To run against PostgreSQL + PostGIS instead of SQLite, set `USE_SQLITE=false` and the `DB_*` variables in `backend/.env`, then run `init-postgis.sql` against your database before starting the backend.

`docker-compose.yml` runs the real three-service architecture (frontend behind nginx, the single backend, PostGIS) - `docker compose up --build` should build and run all three (`Dockerfile`s exist for both `backend/` and `frontend/`), but this hasn't been through a live build yet on this machine; see `docs/STANDARD_TECHNICAL_DOCUMENT.md` §9 for the two bugs static review already caught and fixed. The compose file reads `GROQ_API_KEY`/`JWT_SECRET` from your shell environment. Set `GROQ_API_KEY` if you want AI working (it has no usable default - unset, those 3 endpoints just 503). `JWT_SECRET` does have a working fallback baked into the compose file itself (`change_this_in_production`), so login works out of the box, but set a real value in your shell for anything beyond local testing.

## API Endpoints

Implemented and covered by the backend test suite. Every endpoint is rate-limited (`@nestjs/throttler`, 200 requests/minute/IP by default, `X-RateLimit-*` response headers included) - see Groq AI Endpoints below for the tighter override on the two costlier endpoints.

### GIS Endpoints
- `GET /api/v1/gis/parcels` - Get parcels with optional filtering (bbox, zoom, state, district, limit, offset)
- `GET /api/v1/gis/parcel-at-location` - Find parcel at specific coordinates (lat, lng) — placeholder until PostGIS spatial queries are enabled
- `GET /api/v1/gis/parcels/:id/geometry` - Get parcel geometry as a GeoJSON Feature
- `GET /api/v1/gis/parcels/:id/restrictions` - Get restrictions for a parcel (placeholder, returns `[]`)

### Parcel Endpoints
- `GET /api/v1/parcels` - Search parcels by identifiers (ulpin, survey_number, plot_number, local_identifier, state, district)
- `GET /api/v1/parcels/:id` - Get parcel by ID
- `GET /api/v1/parcels/:id/geometry` - Get parcel geometry as a GeoJSON Feature (404 if not found)
- `GET /api/v1/parcels/:id/neighbours` - Adjacent (`TOUCHING`) and nearby (`NEARBY`) parcels, each as a GeoJSON Feature with relationship + distance. Prefers precomputed relationships (see `parcel_neighbours` below); `?distance=` (metres, default 200) only applies to the live-geometry fallback used for parcels with none
- `GET /api/v1/parcels/:id/context` - Full spatial context: `selectedParcel` + `cluster` + `clusterParcels` (every parcel sharing the selected parcel's `clusterId` - the whole connected network, not just its neighbours) + `adjacentParcels`/`nearbyParcels`
- `GET /api/v1/parcels/:id/360` - Aggregated Parcel 360: the Tech.md #15 canonical envelope (`parcel_id`/`identifiers`/`location`/`spatial`/`sources`) plus a `departments` object with the real data from all 5 department APIs below (`null` for any department with nothing linked to this parcel) - see Interoperability below
- `GET /api/v1/parcels/:id/workflows` - Service requests submitted for this parcel, newest first (404 if the parcel doesn't exist) - see Workflows below

### Spatial Demo Layers (Pune cluster only)
Read-only, filterable by `?state=&district=`; populated by `backend/seed.ts`, no write API yet:
- `GET /api/v1/gis/zoning-overlays`
- `GET /api/v1/gis/restriction-zones`
- `GET /api/v1/gis/infrastructure`
- `GET /api/v1/gis/change-detection-events`

### Mock State Land Record Schemas
Two deliberately different schemas (Tech.md #12/#13), full CRUD, demonstrating the interoperability challenge - no parcel foreign key on either by design; resolved to a canonical parcel by identifier via the Interoperability layer below:
- `POST|GET /api/v1/state-a/land-records` (list supports `?survey_number=&village_code=`), `GET|PATCH|DELETE /api/v1/state-a/land-records/:id` - rural/village schema (surveyNumber, subdivisionNumber, ownerName, villageCode, areaHectares)
- `POST|GET /api/v1/state-b/land-records` (list supports `?plot_id=&locality_id=`), `GET|PATCH|DELETE /api/v1/state-b/land-records/:id` - urban plot schema (plotId, holderName, localityId, landExtentSqft, recordCategory)

### Mock Department APIs
Six independent department mocks (five from Tech.md #16, plus Dispute - added to close the SIH problem statement's own required workflow list, see `docs/FEATURE_AUDIT.md`), each `GET .../:parcelId`, none aware of each other or of the canonical model - that aggregation is the Interoperability layer below, via `GET /api/v1/parcels/:id/360`, not these:
- `GET /api/v1/land-records/:parcelId` - resolves the parcel to its Phase 3 state schema record (MH via SURVEY_NUMBER, DL via PLOT_NUMBER); 404 for states with no schema configured (TN/KA) or no matching identifier
- `GET /api/v1/registration/:parcelId` - registration status, registration number/date, last transaction
- `GET /api/v1/planning/:parcelId` - land use, zoning classification, master plan reference, building permission status
- `GET /api/v1/tax/:parcelId` - assessed value, annual tax, tax status, outstanding amount
- `GET /api/v1/restriction/:parcelId` - environmental/protected-area/flood-prone restriction flag (a per-parcel business record - distinct from the GIS `restriction-zones` polygon layer above)
- `GET /api/v1/dispute/:parcelId` - active-dispute flag, dispute type (ownership/boundary/inheritance/encroachment), case status, filing/resolution dates - seeded on ~12% of parcels, the rest return a real "no dispute" record (not a 404), matching the other four departments' convention

### Interoperability
`backend/src/interoperability/` (Tech.md #14/#15/#22) ties the mock state schemas and department APIs together into one canonical view, surfaced entirely through `GET /api/v1/parcels/:id/360` (no separate `/integrations/...` namespace - Plan.md's Phase 5 checklist only asked to expand `/360`):
- **Identifier resolver** - any identifier (canonicalParcelId, ulpin, survey_number, plot_number, local_identifier) → canonical parcel UUID, and the reverse (parcel → the identifier a given department would recognise it by)
- **State A/B adapters** - map each state schema's own field names/units to canonical fields exactly per Tech.md #14 (area_hectares × 10000, land_extent_sqft ÷ 10.7639)
- **Canonical transformer** - builds the Tech.md #15 envelope (`parcel_id`, `identifiers`, `location`, `spatial`, `sources` - deliberately snake_case, matching that spec's JSON verbatim)
- **Response aggregator** - calls all 6 department APIs in parallel, adapts Land Records through whichever state adapter applies, and returns the canonical envelope plus a `departments` object with each department's real data (`null` where nothing is linked for that parcel)

### Workflows (Citizen Service Requests + Officer Review)
`backend/src/workflows/` (Tech.md #23/#24/#25) - a citizen request (e.g. "send me a copy of the RoR", a correction request) creates a `Workflow` and auto-generates a 3-step simulated review pipeline (`LAND_RECORDS → REGISTRATION → PLANNING`, all starting `PENDING`). A `DISPUTE_FILING` request gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead - every other `workflowType` still gets the default 3-step pipeline:
- `POST /api/v1/workflows` - create a request (`parcelId`, `workflowType`, optional `createdBy`/`requestDetails`); 400 if the parcel doesn't exist. Stays public - the citizen service-request flow has never required an account
- `GET /api/v1/workflows` - list workflows, optionally filtered to `?department=&stepStatus=` (e.g. "workflows where my department's step is still PENDING") - powers the Officer Portal dashboard below. Officer/admin-only (see Authorization (RBAC) below)
- `GET /api/v1/workflows/:id` - a workflow with its steps. Officer/admin-only
- `PATCH /api/v1/workflows/:id/status` - directly override `currentStatus` (+ optional `remarks`). Officer/admin-only
- `PATCH /api/v1/workflows/:workflowId/steps/:stepId` - **the actual officer review action** (Phase 7): `{action: 'APPROVE'|'REJECT', remarks?}` decides one step (400 if it's already been decided), then recomputes the workflow's overall `currentStatus` - any `REJECTED` step rejects the whole workflow, all `APPROVED` steps approves it, otherwise `IN_PROGRESS`. Officer/admin-only, with per-department enforcement (see Authorization (RBAC) below)

The citizen portal's Parcel 360 view ("Request Documents" / "Report Issue" buttons) submits directly to this API and shows the created workflow's reference ID and live step statuses. A "Your Requests" panel on the same Parcel 360 view (`frontend/src/features/parcels/RequestNotifications.tsx`, `docs/FEATURE_AUDIT.md` §8 item 12 - the citizen notification MVP) then keeps showing plain-language live status for every request on that parcel by reusing the existing public `GET /api/v1/parcels/:id/workflows` endpoint - refreshes immediately when a new request is filed, no manual reload or new backend route needed.

### Governance Alerts
`backend/src/governance/` (Tech.md #34) - the officer-facing output of the AI/change-detection pipeline that Phase 8/9 will build. Seeded now from spatial/tax data `seed.ts` already computes (flood restriction-zone overlap, the simulated change-detection event, overdue tax) rather than hand-picked, so the Officer Portal has real alerts to act on before that pipeline exists:
- `GET /api/v1/governance-alerts` - list, optionally filtered by `?status=&severity=`, newest first
- `GET /api/v1/governance-alerts/:id` - a single alert
- `PATCH /api/v1/governance-alerts/:id/status` - officer marks it `REVIEWED` or `DISMISSED`

### Authentication
`backend/src/auth/` + `backend/src/users/` (Plan.md Phase 10, `docs/FEATURE_AUDIT.md` §8 item 9) - real accounts, replacing what was previously a client-side-only "pick a name and role" session with no password:
- `users` table: email, bcrypt password hash, name, role (`ADMIN` or one of the 4 officer roles). Seeded by `seed.ts` with 5 demo accounts, all sharing password `Demo@123` (listed on the login page itself)
- `POST /api/v1/auth/login` - `{email, password}` → a JWT (24h expiry, `@nestjs/jwt`) plus the public user shape; wrong credentials or an unknown email both 401 uniformly (no user enumeration)
- `GET /api/v1/auth/me` - behind a `passport-jwt` guard; looks the user up fresh on every call (not just trusting the token payload), so a deleted account stops working immediately
- Frontend: a single real sign-in page (`frontend/src/pages/LoginPage.tsx`) for Officer + Admin (the Citizen Portal has no account concept and stays anonymous - it never had a "session" to migrate); `RequireAuth` (`frontend/src/features/auth/RequireAuth.tsx`) gates the `/officer` and `/admin` routes and redirects to `/login` when signed out or wrong-role; session state is a React Query cache (`useAuthUser`/`useLogin`/`useLogout`, `frontend/src/features/auth/auth.ts`) shared across every component that needs it, backed by a JWT in `localStorage`
- Fixed along the way: `DISPUTE_OFFICER` existed in the workflow pipeline (`workflows.service.ts`) but was never a selectable officer role, so dispute filings had no one who could log in to review them - added as a 5th officer role and demo account. Also fixed a pre-existing bug in `apiService.ts`'s response interceptor: it hard-redirected to `/login` on *any* 401, including a failed login attempt itself, which reloaded the page before the "Invalid email or password" message could ever show.
- Real admin UI to manage these accounts now exists too - see Admin Portal / User Management below (`docs/FEATURE_AUDIT.md` §8 item 11).

### Authorization (RBAC)
`backend/src/auth/roles.guard.ts` + `roles.decorator.ts` (`docs/FEATURE_AUDIT.md` §8 item 5) - authentication alone only proves *who* is calling; this is what actually stops a signed-in officer from calling an endpoint their role shouldn't reach:
- `RolesGuard` reads a `@Roles(...)` decorator via `Reflector` and checks it against the JWT-derived `req.user.role`; a mismatch is a `403` (Nest's own default for a guard returning `false`), distinct from `JwtAuthGuard`'s `401` for no/invalid token at all
- Officer/admin-only now for real: workflow review and listing, governance alerts, change-detection analysis, the AI alert-explanation endpoint, and both analytics endpoints. Citizen-facing routes (parcel search/360/risk-score, AI query and parcel-explanation, workflow creation) stay public - that's the app's real UX boundary, not an oversight
- Finer-grained on the one route that needed it: `PATCH /workflows/:workflowId/steps/:stepId` checks the acting officer's role against that specific step's `assignedRole` - a `LAND_RECORD_OFFICER` gets a real `403` trying to decide a `REGISTRATION` step. `GET /workflows`'s `department` filter is also silently forced to the caller's own department for any non-`ADMIN` role. `ADMIN` bypasses both restrictions
- Live-verified: curl across no-token/wrong-role/right-role for several endpoints, and a full Playwright run logging in as both a regular officer and the `DISPUTE_OFFICER` to approve a real workflow step through the actual UI

### Audit Logging
`backend/src/audit/` (Tech.md §27, `docs/FEATURE_AUDIT.md` §8 item 10) - a real trail of who did what, sitting between "officer decision" and "citizen notification" the way Tech.md's own workflow diagram always assumed something would:
- A real `audit_logs` table (`AuditLog` entity) records `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED` (with department + remarks), `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, and `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED` (see Admin Portal below) - every state-mutating officer/admin action RBAC now gates
- `GET /api/v1/audit` (admin-only, filterable by `?entityType=&userId=`) and `GET /api/v1/parcels/:id/audit` (staff-only) read it back
- Frontend: a "Recent Activity" feed on the Admin Portal (`frontend/src/features/admin/RecentActivity.tsx`)

### Admin Portal / User Management
`frontend/src/features/admin/` + `backend/src/users/users.controller.ts` (Tech.md §38's "User Management"/"Role Management", `docs/FEATURE_AUDIT.md` §8 item 11) - real accounts now exist (see Authentication above); this is the admin UI and API to actually manage them:
- `GET /api/v1/users`, `POST /api/v1/users` (create an Officer/Admin account), `PATCH /api/v1/users/:id/role`, `DELETE /api/v1/users/:id` - all admin-only, all audit-logged. An admin cannot change their own role or delete their own account (400) - a deliberate self-lockout guard
- `GET /api/v1/analytics/summary` gained `totalUsers` (a real count) and `recentLogins24h` (a count of `AUTH_LOGIN` audit entries in the last 24h - an honest activity proxy, not a claim of tracking concurrent sessions, which stateless JWTs structurally can't do without a session store this project doesn't have)
- Frontend: a "User Management" card (`UserManagement.tsx` - create/promote-demote/delete accounts) and the "Recent Activity" card above, both on the Admin Portal; the "Total Users"/"Logins (24h)" System Overview cards now show these real counts instead of static `0`s
- Fixed along the way: creating or deleting a user didn't refresh the Recent Activity feed elsewhere on the same page until a manual reload, since its query cache key was never invalidated - only a live Playwright pass caught it, since the unit tests mock each component in isolation

### Officer Portal
`frontend/src/pages/OfficerPortal.tsx` + `frontend/src/features/officer/` - gated by real login (see Authentication above). Once signed in:
- **Dashboard** - real counts (not placeholders): pending workflows assigned to the officer's department, steps that department decided today, total decided all-time, and open governance alerts
- **Assigned Workflows** - every workflow with a `PENDING` step in the officer's own department; selecting one loads its full review panel
- **Workflow Review** - every step's status/remarks/decision time, plus an Approve/Reject + remarks form for the officer's own step (only while it's still `PENDING`)
- **Governance Alerts** - every `OPEN` alert with severity/type/explanation, with Mark Reviewed / Dismiss actions

### Groq AI Endpoints
`backend/src/ai/` (Tech.md #28-#32) - Groq is called only from the backend (`GroqService`, the official `openai` SDK pointed at Groq's OpenAI-compatible API); every response is Zod-validated before it reaches application logic, and a response that fails validation is a 502, never silently trusted. Without a `GROQ_API_KEY` configured, all three return 503 rather than crashing. Rate-limited tighter than the rest of the API (30 requests/minute/IP vs. the app-wide 200) since every call costs a real Groq API request:
- `POST /api/v1/ai/query` - `{query: string}` → Groq converts it to a structured filter (`state`/`district`/`tax_status`/`has_restriction`/`land_use`/`registration_status`, all optional) → the backend runs the actual DB query against those fields (the LLM never touches SQL). Returns `{filters, totalMatches, results}`
- `POST /api/v1/ai/parcels/:parcelId/explain` - a plain-language summary of that parcel's full 360 view (identifiers, location, all 5 departments), structured as `{summary, risk_level, findings[], recommended_action}`; 404 for an unknown parcel
- `POST /api/v1/ai/alerts/:alertId/explain` - the same structured shape explaining one governance alert; 404 for an unknown alert

Frontend touchpoints (`frontend/src/features/ai/`), all sharing one `AiExplanationCard` renderer: an "Ask AI" natural-language search box on the Citizen Portal, an "Explain with AI" button on Parcel 360, and an "Explain" button on each governance alert in the Officer Portal. Each shows a specific message if the server has no `GROQ_API_KEY` configured rather than a generic error.

### Change Detection
`backend/src/change-detection/` (Tech.md #33) - built in Node/TypeScript in the existing backend rather than a separate Python/OpenCV service (an explicit stack decision, see docs/Plan.md's Phase 9 note):
- `POST /api/v1/change-detection/analyze` - multipart fields `before`/`after` (images, any common format, 5MB cap each) plus `minLng`/`minLat`/`maxLng`/`maxLat` (the real geographic bounds the two images cover) and an optional `description`. Rate-limited to 30 requests/minute/IP (vs. the app-wide 200) since decode/resize/diff is real CPU work per request.
- `sharp` decodes/resizes both images to a fixed grid; a hand-rolled pixel comparison (`image-diff.ts`) finds the bounding box of pixels that actually changed and maps it back to a real geographic region
- Every seeded parcel's centroid is tested against that region with a real point-in-polygon check (`common/geo-utils.ts`, PostGIS-ready) - genuine spatial intersection, not hand-picked
- A real `ChangeDetectionEvent` row and one `GovernanceAlert` per affected parcel are created (`UNAUTHORIZED_CHANGE_DETECTED`/`CHANGE_DETECTION`, same convention the seed-time alerts already use), immediately visible in the Officer Portal and explainable via the AI endpoints above

Frontend: an "Analyze Imagery" panel in the Officer Portal (`frontend/src/features/change-detection/ChangeDetectionPanel.tsx`) with file pickers, a bounds form (one-click "Use Pune cluster bounds" fill), and a result view linking affected parcels into Parcel 360.

### Governance Analytics
`backend/src/analytics/` - closes the "analytics-driven governance insights" item named in the SIH problem statement's required-solution text (see `docs/FEATURE_AUDIT.md`), platform-wide rather than per-alert:
- `GET /api/v1/analytics/summary` - real SQL `GROUP BY` aggregation (not a full table scan aggregated in JS) across tax status, registration status, land use, dispute case status, workflow status/type, and alert severity/status, plus overall totals (parcels, workflows, open alerts, active disputes)

Frontend: an 8-chart dashboard (`frontend/src/features/analytics/AnalyticsDashboard.tsx`, using `recharts`) plus a "Top At-Risk Parcels" list (a transparent heuristic risk score - tax delinquency, dispute exposure, open alerts, restrictions, `backend/src/predictive-analytics/`) on the Admin Portal, alongside the System Overview/User Management/Recent Activity cards described under Admin Portal / User Management above.

### Spatial Layer Write APIs
`backend/src/spatial/` (`docs/FEATURE_AUDIT.md` §8 item 13) - zoning overlays, restriction zones, and infrastructure features were read-only through Phase 9; real `POST`/`PATCH`/`DELETE` now exist for all three (admin-only), with geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure). `change-detection-events` stays read-only - it's written only through `/change-detection/analyze`, never a direct write endpoint. No frontend UI calls these yet (there's no map-drawing tool to author new zone geometry) - this exists as tested API capability, which is what the backlog item actually asked for.

### Planned (not yet implemented)
Only two backlog items remain, both P2 and both flagged rather than silently built or skipped (`docs/FEATURE_AUDIT.md` §8's closing note has the full reasoning):
- **PostGIS end-to-end** - the `USE_SQLITE=false` path and `init-postgis.sql` exist, but swapping the hand-rolled JS point-in-polygon/distance functions in `geo-utils.ts` for real `ST_*` queries needs an actual running Postgres+PostGIS instance to verify against, which this environment doesn't have running.
- **OAuth-based auth** - would need a real OAuth app registered with an external provider (a client ID/secret only a human can provision); BHOOMISETU.md only asks for it "where required," and JWT alone already covers Phase 10's real ask.

## Development Phases

The implementation follows a phased MVP plan:

1. **GIS Foundation** ✅ done and tested — PostGIS/SQLite setup, parcel table, map visualization
2. **Parcel Core** ✅ done — search (by any identifier), get-by-id, geometry, and the 360 skeleton above are all live
3. **Mock State Schemas** ✅ done — two structurally different state land-record schemas with full CRUD (see below)
4. **Mock Department APIs** ✅ done — 6 independent per-parcel department APIs (see below)
5. **Interoperability** ✅ done — identifier resolver, State A/B adapters, canonical transformer, response aggregator (see below)
6. **Citizen Portal** ✅ done — search, map, tabbed Parcel 360 view, and service requests (see Workflows below)
7. **Officer Portal** ✅ done — real login, assigned-workflow dashboard, per-step review (approve/reject), governance alerts panel (see above)
8. **AI Integration** ✅ done — Groq-backed natural language query, parcel 360 summary, and governance alert explanation, all Zod-validated (see Groq AI Endpoints above)
9. **Change Detection** ✅ done — real pixel-diff imagery comparison, spatial intersection, and governance alert generation, in Node/TypeScript (see Change Detection above)
10. **Security and Audit** ✅ done — authentication, RBAC, and audit logging all done (see Authentication, Authorization (RBAC), and Audit Logging above); broader API security (HTTPS, deployed CORS restriction) remains, but that's a deployment concern (§9), not something buildable without a real deployment target

## Mock Data

`backend/seed.ts` generates exactly 200 mock parcels in four geographically real, grid-clustered demo regions rather than scattering them randomly across India:

| Cluster | State | District | Parcels |
|---|---|---|---|
| Pune | MH | Pune | 100 (primary GIS demo cluster) |
| Chennai | TN | Chennai | 40 |
| Bangalore | KA | Bangalore | 40 |
| New Delhi | DL | New Delhi | 20 |

- Each cluster's parcels are generated from one shared coordinate lattice, not independently: a jittered grid of corner points plus one jittered midpoint per shared edge, both reused by every parcel touching them, so two neighbouring parcels are built from the *literal same coordinates* along their shared boundary — a connected cadastral network, not just nearby polygons. Each parcel is an irregular 8-vertex ring; area is computed from the actual geometry.
- Every parcel carries a `clusterId` (e.g. `MH-PUNE-01`), and explicit `TOUCHING`/`NEARBY` relationships are precomputed at seed time in a `parcel_neighbours` table from known grid row/column position (the 4 orthogonal grid neighbours are `TOUCHING`, the 4 diagonal ones `NEARBY`) rather than derived from geometry at query time.
- Identifier types are state-differentiated: Maharashtra favors Survey Number/ULPIN, Tamil Nadu Survey Number/Subdivision Number, Karnataka Survey Number/Hissa Number, Delhi Plot Number/Property Number — every parcel in every state also gets a Local Parcel ID.
- The Pune cluster additionally seeds: 3 zoning overlays (residential/commercial/agricultural), a flood restriction zone, 4 infrastructure features (road, water line, 2 electricity points), and a simulated change-detection event — each restriction/change-detection polygon's affected-parcel list is computed with a real point-in-polygon test, not hand-picked. These live in `zoning_overlays` / `restriction_zones` / `infrastructure_features` / `change_detection_events` tables, readable via the Spatial Demo Layers endpoints above (read-only; a write API is a later phase).
- Every Pune/MH parcel gets a State A land record and every New Delhi/DL parcel gets a State B land record (see Mock State Land Record Schemas above), with `areaHectares`/`landExtentSqft` derived from that parcel's real geometry area, and its state-schema identifier matching the same parcel's `parcel_identifiers` row so the Land Records department API (below) can actually resolve it.
- Every parcel gets Registration/Planning/Tax/Restriction/Dispute mock records (see Mock Department APIs below); for Pune, Planning's land use matches the zoning overlay the parcel actually falls in and Restriction's flood flag matches the flood zone, rather than being independently random. ~12% of parcels get a real dispute on file.
- Governance alerts (see above) are generated from that same data, not hand-picked: one per parcel actually inside the flood zone, one per parcel actually flagged by the change-detection event, and one per parcel whose seeded tax record actually came out `OVERDUE`.

## License

MIT
