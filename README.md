<p align="center">
  <img src="docs/Logo.png" alt="BhoomiSetu" width="320" />
</p>

# BhoomiSetu - GIS-based Land Governance Platform

BhoomiSetu is a GIS-based, parcel-centric land governance and interoperability platform designed to connect fragmented land-related datasets through a unified digital framework.

## Project Structure

```
SIH_2026_BhoomiSetu/
├── backend/                 # NestJS backend application
├── frontend/                # React frontend application
├── docs/                    # see Documentation below for what's in here
├── docker-compose.yml       # Docker Compose configuration (see Docker note below)
├── BHOOMISETU.md            # Project vision and overview
├── Tech.md                  # Technical architecture and specifications
└── README.md                # This file
```

## Technology Stack

### Backend
- **Runtime**: Node.js 22+
- **Framework**: NestJS (TypeScript)
- **Database**: SQLite for development, PostgreSQL + PostGIS for production (live-verified against a hosted Supabase instance - see Database below)
- **ORM**: TypeORM
- **Auth**: `@nestjs/jwt` + `passport-jwt` (JWT issuance/verification), `bcryptjs` (password hashing)
- **File uploads**: `@nestjs/platform-express` (Multer) - imagery for Change Detection, document photos/scans for Document Verification
- **OCR**: `tesseract.js` - local, in-process text extraction for Document Verification (no external API, no API key)
- **Image processing**: `sharp` - decode/resize for Change Detection's pixel-diff pipeline
- **Validation**: `class-validator` (HTTP request DTOs), `zod` (validating Groq's AI output before it's trusted - see Groq AI Endpoints below)
- **AI**: Groq, via the OpenAI-compatible `openai` SDK (backend-only, never called from the frontend)
- **API Documentation**: Swagger/OpenAPI (served at `/api`)
- **Testing**: Jest + Supertest (e2e)

### Frontend
- **Framework**: React (TypeScript)
- **Build Tool**: Vite
- **Server State**: TanStack Query
- **GIS Map**: MapLibre GL JS
- **Styling**: Tailwind CSS - a Bauhaus-inspired design system (`docs/design.md`): an earth-tone palette derived from the BhoomiSetu logo, exposed as semantic CSS-variable-backed tokens (`primary`/`secondary`/`accent`/`ink`/`surface`) so light/dark mode is a variable swap, not per-component `dark:` classes. A theme toggle persists the choice in `localStorage`
- **Icons**: `lucide-react`
- **Localization**: `i18next`/`react-i18next` - English/Hindi, persisted language choice, covering the nav, landing hero, parcel search, Citizen Portal panels, and the map's layer labels/popup
- **HTTP Client**: Axios
- **Charts**: `recharts` (Admin Portal's analytics dashboard)
- **Testing**: Vitest + React Testing Library

> `zustand`, `react-hook-form`, and `zod` are installed as dependencies but aren't wired into any frontend component yet.

### Database
- **Dev**: SQLite (file-based, zero setup) - what `npm run start:dev`/`npm test` use out of the box
- **Production**: PostgreSQL 16+ with PostGIS 3+ - live-verified end-to-end against a hosted [Supabase](https://supabase.com) Postgres+PostGIS instance (`docs/FEATURE_AUDIT.md` §8 item 14). Supabase's *direct* connection host is IPv6-only and won't resolve from an IPv4-only environment - use its connection *pooler* host instead (see `backend/.env.example`)
- **Spatial queries**: real `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid` when connected to Postgres; the same operations (bbox filtering, point-in-polygon, polygon distance, spatial intersection) fall back to hand-rolled JS equivalents (`backend/src/common/geo-utils.ts`) on SQLite, since SQLite has no spatial extension. Which path runs is decided automatically from the actual connected TypeORM driver, not an env flag (`backend/src/common/postgis.ts`)
- **Spatial data**: GeoJSON, stored as `text` in both modes (a native PostGIS `geometry` column was deliberately not adopted - every consumer already does `JSON.parse(row.geometry)`, and migrating the storage type would mean rewriting all of them for no behavioral gain)

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
   npm run seed            # populate ./data/dev.sqlite with 200 mock parcels + demo accounts
   npm run start:dev       # start on http://localhost:3000
   ```
   The first request that runs OCR (Document Verification) downloads Tesseract's English language model (~5MB) into `backend/` and caches it there for subsequent runs - this is gitignored and regenerates automatically, not something to commit.

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

5. **Sign in** (optional for browsing - parcel search, the map, and document verification need no account; filing a service request and My Parcels do)
   - Officer/Admin: `admin@bhoomisetu.gov.in` / `Demo@123` (the other 4 officer accounts are listed on the sign-in page itself)
   - Citizen: `citizen1@example.com` through `citizen20@example.com`, password `Demo@123` for all - each is linked to a random 0-5 parcels (see Citizen Sign-In / My Parcels below)

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

To run against PostgreSQL + PostGIS instead of SQLite, set `USE_SQLITE=false` and the `DB_*` variables in `backend/.env` (see `backend/.env.example` for both a local/docker-compose shape and a Supabase-pooler shape). No manual schema setup is needed beyond having the `postgis` extension available in your target database (`docker-compose.yml`'s `postgis/postgis` image, and Supabase, both already ship with it) - TypeORM's `synchronize: true` creates every table from the entity definitions automatically on backend startup. This path has been live-verified end-to-end (`docs/FEATURE_AUDIT.md` §8 item 14) - real `ST_*` spatial queries, not a placeholder.

`docker-compose.yml` runs the real three-service architecture (frontend behind nginx, the single backend, PostGIS) - `docker compose up --build` builds and runs all three, live-verified end-to-end on 2026-09-06 (`docs/FEATURE_AUDIT.md` §8 item 6): the backend starts, connects to PostGIS, and serves the API; `docker compose exec backend npm run seed` populates the same 200-parcel demo dataset as every other environment. The compose file reads `GROQ_API_KEY`/`JWT_SECRET` from your shell environment. Set `GROQ_API_KEY` if you want AI working (it has no usable default - unset, those endpoints just 503). `JWT_SECRET` **must** be set in your shell before running `docker compose up` - the compose file sets `NODE_ENV=production` for the backend, and the backend refuses to start under `NODE_ENV=production` without a real `JWT_SECRET` (see `backend/.env.example` for details); `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build` is a quick way to generate one.

## API Endpoints

Implemented and covered by the backend test suite. Every endpoint is rate-limited (`@nestjs/throttler`, 200 requests/minute/IP by default, `X-RateLimit-*` response headers included) - see Groq AI Endpoints / Change Detection / Document Verification below for tighter overrides on the costlier endpoints.

### GIS Endpoints
- `GET /api/v1/gis/parcels` - Get parcels with optional filtering (`bbox`, `zoom`, `state`, `district`, `limit`, `offset`). The bbox filter runs a real `ST_Intersects` query against Postgres/PostGIS; on SQLite (no spatial extension) it's skipped with a console warning
- `GET /api/v1/gis/parcel-at-location` - Find the parcel containing a given `lat`/`lng` via a real `ST_Contains` query against Postgres/PostGIS; returns `null` on SQLite (same reason as above)
- `GET /api/v1/gis/parcels/:id/geometry` - Get parcel geometry as a GeoJSON Feature
- `GET /api/v1/gis/parcels/:id/restrictions` - Get restrictions for a parcel (placeholder, returns `[]`)

### Parcel Endpoints
- `GET /api/v1/parcels` - Search parcels by identifiers (ulpin, survey_number, plot_number, local_identifier, state, district)
- `GET /api/v1/parcels/mine` - Parcels linked to the signed-in citizen's account (citizen-only, JWT required) - see Citizen Sign-In / My Parcels below. Registered before `:id` in the controller so `mine` is never mistaken for a UUID
- `GET /api/v1/parcels/:id` - Get parcel by ID
- `GET /api/v1/parcels/:id/geometry` - Get parcel geometry as a GeoJSON Feature (404 if not found)
- `GET /api/v1/parcels/:id/neighbours` - Adjacent (`TOUCHING`) and nearby (`NEARBY`) parcels, each as a GeoJSON Feature with relationship + distance. Prefers precomputed relationships (see `parcel_neighbours` below); falls back to a real geometric distance query for parcels with none - `ST_Distance`/`ST_DWithin` on Postgres, the same hand-rolled JS calculation as before on SQLite. `?distance=` (metres, default 200) only applies to that fallback
- `GET /api/v1/parcels/:id/context` - Full spatial context: `selectedParcel` + `cluster` + `clusterParcels` (every parcel sharing the selected parcel's `clusterId` - the whole connected network, not just its neighbours) + `adjacentParcels`/`nearbyParcels`
- `GET /api/v1/parcels/:id/360` - Aggregated Parcel 360: the Tech.md #15 canonical envelope (`parcel_id`/`identifiers`/`location`/`spatial`/`sources`) plus a `departments` object with the real data from all 5 department APIs below (`null` for any department with nothing linked to this parcel) - see Interoperability below
- `GET /api/v1/parcels/:id/workflows` - Service requests submitted for this parcel, newest first (404 if the parcel doesn't exist) - see Workflows below

### Spatial Demo Layers (Pune cluster only)
Read-only, filterable by `?state=&district=`; populated by `backend/seed.ts`:
- `GET /api/v1/gis/zoning-overlays`
- `GET /api/v1/gis/restriction-zones`
- `GET /api/v1/gis/infrastructure`
- `GET /api/v1/gis/change-detection-events`

Real `POST`/`PATCH`/`DELETE` also exist for zoning overlays, restriction zones, and infrastructure features (admin-only, `backend/src/spatial/`), with geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure). No frontend UI calls these yet (no map-drawing tool exists to author new zone geometry) - tested API capability. `change-detection-events` stays read-only, written only through `/change-detection/analyze`.

### Mock State Land Record Schemas
Two deliberately different schemas (Tech.md #12/#13), full CRUD, demonstrating the interoperability challenge - no parcel foreign key on either by design; resolved to a canonical parcel by identifier via the Interoperability layer below:
- `POST|GET /api/v1/state-a/land-records` (list supports `?survey_number=&village_code=`), `GET|PATCH|DELETE /api/v1/state-a/land-records/:id` - rural/village schema (surveyNumber, subdivisionNumber, ownerName, villageCode, areaHectares)
- `POST|GET /api/v1/state-b/land-records` (list supports `?plot_id=&locality_id=`), `GET|PATCH|DELETE /api/v1/state-b/land-records/:id` - urban plot schema (plotId, holderName, localityId, landExtentSqft, recordCategory)

### Mock Department APIs
Six independent department mocks (five from Tech.md #16, plus Dispute), each `GET .../:parcelId`, none aware of each other or of the canonical model - that aggregation is the Interoperability layer below, via `GET /api/v1/parcels/:id/360`, not these:
- `GET /api/v1/land-records/:parcelId` - resolves the parcel to its Phase 3 state schema record (MH via SURVEY_NUMBER, DL via PLOT_NUMBER); 404 for states with no schema configured (TN/KA) or no matching identifier
- `GET /api/v1/registration/:parcelId` - registration status, registration number/date, last transaction
- `GET /api/v1/planning/:parcelId` - land use, zoning classification, master plan reference, building permission status
- `GET /api/v1/tax/:parcelId` - assessed value, annual tax, tax status, outstanding amount
- `GET /api/v1/restriction/:parcelId` - environmental/protected-area/flood-prone restriction flag (a per-parcel business record - distinct from the GIS `restriction-zones` polygon layer above)
- `GET /api/v1/dispute/:parcelId` - active-dispute flag, dispute type (ownership/boundary/inheritance/encroachment), case status, filing/resolution dates - seeded on ~12% of parcels, the rest return a real "no dispute" record (not a 404)

### Interoperability
`backend/src/interoperability/` (Tech.md #14/#15/#22) ties the mock state schemas and department APIs together into one canonical view, surfaced entirely through `GET /api/v1/parcels/:id/360`:
- **Identifier resolver** - any identifier (canonicalParcelId, ulpin, survey_number, plot_number, local_identifier) → canonical parcel UUID, and the reverse (parcel → the identifier a given department would recognise it by)
- **State A/B adapters** - map each state schema's own field names/units to canonical fields exactly per Tech.md #14 (area_hectares × 10000, land_extent_sqft ÷ 10.7639)
- **Canonical transformer** - builds the Tech.md #15 envelope (`parcel_id`, `identifiers`, `location`, `spatial`, `sources` - deliberately snake_case, matching that spec's JSON verbatim)
- **Response aggregator** - calls all 6 department APIs in parallel, adapts Land Records through whichever state adapter applies, and returns the canonical envelope plus a `departments` object with each department's real data (`null` where nothing is linked for that parcel)

### Workflows (Citizen Service Requests + Officer Review)
`backend/src/workflows/` (Tech.md #23/#24/#25) - a citizen request (e.g. "send me a copy of the RoR", a correction request) creates a `Workflow` and auto-generates a 3-step simulated review pipeline (`LAND_RECORDS → REGISTRATION → PLANNING`, all starting `PENDING`). A `DISPUTE_FILING` request gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead:
- `POST /api/v1/workflows` - create a request (`parcelId`, `workflowType`, optional `createdBy`/`requestDetails`); 400 if the parcel doesn't exist. **Citizen-only** (JWT required, `CITIZEN` role) - `createdBy` defaults to the filing citizen's name when not given
- `GET /api/v1/workflows` - list workflows, optionally filtered to `?department=&stepStatus=` - powers the Officer Portal dashboard. Officer/admin-only
- `GET /api/v1/workflows/:id` - a workflow with its steps. Officer/admin-only
- `PATCH /api/v1/workflows/:id/status` - directly override `currentStatus` (+ optional `remarks`). Officer/admin-only
- `PATCH /api/v1/workflows/:workflowId/steps/:stepId` - the actual officer review action: `{action: 'APPROVE'|'REJECT', remarks?}` decides one step (400 if already decided), then recomputes the workflow's overall `currentStatus`. Officer/admin-only, with per-department enforcement (see Authorization (RBAC) below)

The citizen portal's Parcel 360 view ("Request Documents" / "Report Issue" buttons) submits directly to this API and shows the created workflow's reference ID and live step statuses. A "Your Requests" panel on the same view keeps showing plain-language live status for every request on that parcel.

### Document Verification
`backend/src/document-verification/` - a citizen uploads a photo/scan of a land record document (e.g. an RoR copy or sale deed); it's OCR'd locally (`tesseract.js`, no external API key) and cross-checked against a specified parcel's actual records:
- `POST /api/v1/document-verification/verify` - multipart: a `document` image (5MB cap) + `parcelId`. Public, citizen-facing, rate-limited to 20 requests/minute/IP (OCR is real CPU work per request)
- Checks every identifier on file for that parcel (ULPIN/Survey Number/Plot Number/Local Identifier, whichever exist), owner name, and area - owner name/area are resolved via the same interoperability layer Parcel 360 uses, so a match means "matches the real record", not a separately-invented comparison. Matching is tolerant of real OCR noise: identifiers use a whitespace-insensitive substring match, names require a majority of expected words to appear, and area accepts any number within 5% (checked against both the sqm-converted value and the state's native unit)
- Returns `{parcelId, canonicalParcelId, extractedText, ocrConfidence, fieldChecks: [{field, expectedValue, status}], overallVerdict}` where `overallVerdict` is `VERIFIED` / `PARTIAL_MATCH` / `MISMATCH` / `INSUFFICIENT_DATA` (the last for a blank/unreadable image, reported honestly rather than a misleading blanket mismatch); a field with no expected value for that parcel's state (e.g. owner name for a state with no land-record schema in this mock) is `NOT_AVAILABLE` and excluded from the verdict

Frontend: a "Verify a Document" panel on the Citizen Portal (`frontend/src/features/document-verification/`), reusing whichever parcel is already selected via Parcel Search rather than a second search form.

### Governance Alerts
`backend/src/governance/` (Tech.md #34) - the officer-facing output of the AI/change-detection pipeline. Seeded from spatial/tax data `seed.ts` already computes (flood restriction-zone overlap, the simulated change-detection event, overdue tax), plus real ones created by Change Detection below:
- `GET /api/v1/governance-alerts` - list, optionally filtered by `?status=&severity=`, newest first
- `GET /api/v1/governance-alerts/:id` - a single alert
- `PATCH /api/v1/governance-alerts/:id/status` - officer marks it `REVIEWED` or `DISMISSED`

Frontend: each alert in the Officer Portal has a "View Details" button opening a popout with the full record (severity, status, parcel, source, raised timestamp, full explanation) plus an "Explain with AI" button and its resulting summary - both moved out of the cramped inline row and into the popout (`GovernanceAlertDetailModal.tsx`).

### Authentication
`backend/src/auth/` + `backend/src/users/` - real accounts, one `users` table shared by officers/admin and (optionally) citizens:
- `users` table: email, bcrypt password hash, name, role (`ADMIN`, one of 4 officer roles, or `CITIZEN`). Seeded by `seed.ts` with 5 officer/admin demo accounts and 20 citizen demo accounts, all sharing password `Demo@123`
- `POST /api/v1/auth/login` - `{email, password}` → a JWT (24h expiry, `@nestjs/jwt`) plus the public user shape; wrong credentials or an unknown email both 401 uniformly (no user enumeration)
- `GET /api/v1/auth/me` - behind a `passport-jwt` guard; looks the user up fresh on every call, so a deleted account stops working immediately
- Frontend: one sign-in page (`frontend/src/pages/LoginPage.tsx`) for all three account kinds, redirecting to `/admin`, `/officer`, or `/citizen` by role; `RequireAuth` gates `/officer`/`/admin`. Signing in is never required for the Citizen Portal's search or document verification - filing a service request (see Workflows above) and the My Parcels panel below both require a citizen account
- A `/register` page exists as a UI placeholder - the form is real but submission is disabled ("registration opens soon"), since no `POST /api/v1/auth/register` endpoint exists yet. Sign in with a demo citizen account instead

### Citizen Sign-In / My Parcels
Optional citizen accounts (`CITIZEN` role, reusing the JWT auth above) linked to 0-5 parcels each - seeded with a weighted distribution (`[[0,2],[1,5],[2,5],[3,3],[4,2],[5,1]]`) so 1-2 parcels is most common and both 0 and 5 are the least likely:
- `CitizenParcel` join table (`citizen_parcels`) links a citizen to their parcels - deliberately separate from a land record's own recorded owner name, which is a different concept
- `GET /api/v1/parcels/mine` (see Parcel Endpoints above) returns them
- Frontend: a "My Parcels" panel at the top of the Citizen Portal (`frontend/src/features/citizen/MyParcels.tsx`) - a sign-in prompt when signed out, the linked-parcel list + a sign-out link when signed in as a citizen
- Citizen accounts are excluded from the Admin Portal's staff-only `GET /api/v1/users` list and its `totalUsers` analytics metric - both existed before citizens did and were never meant to include them

### Authorization (RBAC)
`backend/src/auth/roles.guard.ts` + `roles.decorator.ts` - authentication alone only proves *who* is calling; this stops a signed-in user from calling an endpoint their role shouldn't reach:
- `RolesGuard` reads a `@Roles(...)` decorator via `Reflector` and checks it against the JWT-derived `req.user.role`; a mismatch is a `403`, distinct from `JwtAuthGuard`'s `401` for no/invalid token
- Officer/admin-only: workflow review and listing, governance alerts, change-detection analysis, the AI alert-explanation endpoint, both analytics endpoints, and staff user management. Citizen-only: `GET /parcels/mine`, `POST /workflows` (filing a service request). Citizen-facing routes that stay fully public: parcel search/360/risk-score, AI query, document verification
- Finer-grained on `PATCH /workflows/:workflowId/steps/:stepId`: checks the acting officer's role against that specific step's `assignedRole` - a `LAND_RECORD_OFFICER` gets a real `403` trying to decide a `REGISTRATION` step. `ADMIN` bypasses department restrictions

### Audit Logging
`backend/src/audit/` (Tech.md §27) - a real trail of who did what:
- A real `audit_logs` table records `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED`, `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, and `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`
- `GET /api/v1/audit` (admin-only, filterable by `?entityType=&userId=`) and `GET /api/v1/parcels/:id/audit` (staff-only) read it back
- Frontend: a "Recent Activity" feed on the Admin Portal

### Admin Portal / User Management
`frontend/src/features/admin/` + `backend/src/users/users.controller.ts` (Tech.md §38):
- `GET /api/v1/users` (staff only - excludes citizen accounts), `POST /api/v1/users` (create an Officer/Admin account), `PATCH /api/v1/users/:id/role`, `DELETE /api/v1/users/:id` - all admin-only, all audit-logged. An admin cannot change their own role or delete their own account
- `GET /api/v1/analytics/summary` includes `totalUsers` (staff accounts only) and `recentLogins24h`
- Frontend: a "User Management" card, a "Recent Activity" card, and real System Overview counts

### Officer Portal
`frontend/src/pages/OfficerPortal.tsx` + `frontend/src/features/officer/` - gated by real login. Once signed in: a dashboard of real counts (pending/decided workflows, open alerts), assigned workflows with a full review panel (approve/reject + remarks), and the governance alerts list with its detail popout.

### Groq AI Endpoints
`backend/src/ai/` (Tech.md #28-#32) - Groq is called only from the backend (`GroqService`, the official `openai` SDK pointed at Groq's OpenAI-compatible API); every response is Zod-validated before it reaches application logic, and a response that fails validation is a 502, never silently trusted. Without a `GROQ_API_KEY` configured, all endpoints return 503. Rate-limited tighter than the rest of the API (30 requests/minute/IP):
- `POST /api/v1/ai/query` - `{query: string}` → **one Groq call answers both a data question and a "how do I use this site" question**. For a data question, Groq extracts a structured filter (`state`/`district`/`tax_status`/`has_restriction`/`land_use`/`registration_status`) and the backend runs the real DB query against it (the LLM never touches SQL); for a navigation/help question, Groq answers directly using a system prompt grounded in the site's real features, so it never invents capabilities that don't exist. Returns `{intent: 'DATA_QUERY'|'HELP', reply, filters?, totalMatches?, results?}`
- `POST /api/v1/ai/parcels/:parcelId/explain` - a plain-language summary of that parcel's full 360 view, structured as `{summary, risk_level, findings[], recommended_action}`; 404 for an unknown parcel
- `POST /api/v1/ai/alerts/:alertId/explain` - the same structured shape explaining one governance alert (officer/admin-only); 404 for an unknown alert

Frontend: a floating "Ask AI" chat widget (`frontend/src/features/ai/AskAiWidget.tsx`) - a button that can be **dragged anywhere on screen**, opening a chat panel (also draggable, via its header) that persists its conversation while navigating between citizen-facing pages, since it's mounted once at the app-shell level rather than per-page. The user's own message renders immediately on submit, before the network round trip resolves. An "Explain with AI" button also appears on Parcel 360 and inside each governance alert's detail popout, both sharing one `AiExplanationCard` renderer with the widget.

### Change Detection
`backend/src/change-detection/` (Tech.md #33) - built in Node/TypeScript rather than a separate Python/OpenCV service:
- `POST /api/v1/change-detection/analyze` - multipart fields `before`/`after` (images, 5MB cap each) plus `minLng`/`minLat`/`maxLng`/`maxLat` (the real geographic bounds the two images cover) and an optional `description`. Rate-limited to 30 requests/minute/IP
- `sharp` decodes/resizes both images to a fixed grid; a hand-rolled pixel comparison (`image-diff.ts`) finds the bounding box of pixels that actually changed and maps it back to a real geographic region
- Every seeded parcel is tested against that region - a real `ST_Contains`/`ST_Centroid` query on Postgres, a JS point-in-polygon test against each parcel's centroid on SQLite - genuine spatial intersection, not hand-picked
- A real `ChangeDetectionEvent` row and one `GovernanceAlert` per affected parcel are created, immediately visible in the Officer Portal and explainable via the AI endpoints above

Frontend: an "Analyze Imagery" panel in the Officer Portal with file pickers, a bounds form (one-click "Use Pune cluster bounds" fill), and a result view linking affected parcels into Parcel 360.

### Governance Analytics
`backend/src/analytics/` - platform-wide rather than per-alert:
- `GET /api/v1/analytics/summary` - real SQL `GROUP BY` aggregation across tax status, registration status, land use, dispute case status, workflow status/type, and alert severity/status, plus overall totals

Frontend: an 8-chart dashboard (`recharts`) plus a "Top At-Risk Parcels" list (a transparent heuristic risk score) on the Admin Portal.

### Planned (not yet implemented)
- **OAuth-based auth** - would need a real OAuth app registered with an external provider (a client ID/secret only a human can provision); BHOOMISETU.md only asks for it "where required," and JWT alone already covers the real ask.

## Development Phases

The implementation follows a phased MVP plan (full detail, including every live-verification pass, in `docs/Plan.md`):

1. **GIS Foundation** ✅ - PostGIS/SQLite setup, parcel table, map visualization
2. **Parcel Core** ✅ - search (by any identifier), get-by-id, geometry, neighbours/context, Parcel 360 skeleton
3. **Mock State Schemas** ✅ - two structurally different state land-record schemas with full CRUD
4. **Mock Department APIs** ✅ - 6 independent per-parcel department APIs
5. **Interoperability** ✅ - identifier resolver, State A/B adapters, canonical transformer, response aggregator
6. **Citizen Portal** ✅ - search, map, tabbed Parcel 360 view, and service requests
7. **Officer Portal** ✅ - real login, assigned-workflow dashboard, per-step review, governance alerts panel (+ detail popout)
8. **AI Integration** ✅ - Groq-backed natural-language data queries *and* navigation help in one call, parcel/alert explanation, all Zod-validated, surfaced via a draggable floating "Ask AI" widget
9. **Change Detection** ✅ - real pixel-diff imagery comparison, spatial intersection, and governance alert generation
10. **Security and Audit** ✅ - authentication (officer/admin/citizen), RBAC, and audit logging
11. **Document Verification** ✅ - OCR a citizen-uploaded document, cross-check it against a parcel's real records
12. **Citizen Sign-In** ✅ - optional citizen accounts linked to their parcels, a "My Parcels" dashboard

Also completed outside the phase numbering: **PostGIS run end-to-end** against a live Supabase instance (real `ST_*` queries, not the SQLite fallback), and a from-scratch **irregular parcel geometry generator** replacing the original uniform grid (see Mock Data below).

## Mock Data

`backend/seed.ts` generates exactly 200 mock parcels in four geographically real demo regions rather than scattering them randomly across India:

| Cluster | State | District | Parcels |
|---|---|---|---|
| Pune | MH | Pune | 100 (primary GIS demo cluster) |
| Chennai | TN | Chennai | 40 |
| Bangalore | KA | Bangalore | 40 |
| New Delhi | DL | New Delhi | 20 |

- **Irregular, topology-aware subdivision** (`backend/src/common/parcel-generation/`), not a uniform grid: each cluster gets its own irregular convex envelope (a jittered-ellipse point cloud reduced to its convex hull, oriented along a per-cluster "dominant road angle" so no two clusters look alike), recursively split into that cluster's parcel count via randomly-angled cuts. Most splits share an exact boundary (so adjacent parcels are built from the literal same coordinates); some leave a small real gap instead. Leaves range from triangles to heptagons, with genuinely varied sizes - the greedy "always split the largest piece" strategy alone produces that variance, with a compactness guard against paper-thin sliver shapes.
- Every parcel carries a `clusterId` (e.g. `MH-PUNE-01`), and explicit `TOUCHING`/`NEARBY` relationships are precomputed at seed time in a `parcel_neighbours` table from real geometric distance between every pair of parcels in a cluster (an exact shared edge measures 0 → `TOUCHING`; an intentional small gap measures a few metres → `NEARBY`) - the same convention the live PostGIS `ST_Distance`/`ST_DWithin` queries use.
- Identifier types are state-differentiated: Maharashtra favors Survey Number/ULPIN, Tamil Nadu Survey Number/Subdivision Number, Karnataka Survey Number/Hissa Number, Delhi Plot Number/Property Number - every parcel in every state also gets a Local Parcel ID.
- The Pune cluster additionally seeds: 3 zoning overlays (residential/commercial/agricultural, latitude-banded across Pune's actual generated extent), a flood restriction zone, 4 infrastructure features (road, water line, 2 electricity points), and a simulated change-detection event - each zone is anchored to a real generated parcel's position and sized until it captures a plausible parcel count, then resolved with a real point-in-polygon test - not hand-picked coordinates.
- Every Pune/MH parcel gets a State A land record and every New Delhi/DL parcel gets a State B land record, with `areaHectares`/`landExtentSqft` derived from that parcel's real geometry area, and its state-schema identifier matching the same parcel's `parcel_identifiers` row.
- Every parcel gets Registration/Planning/Tax/Restriction/Dispute mock records; for Pune, Planning's land use matches the zoning overlay the parcel actually falls in and Restriction's flood flag matches the flood zone. ~12% of parcels get a real dispute on file.
- Governance alerts are generated from that same data: one per parcel actually inside the flood zone, one per parcel actually flagged by the change-detection event, and one per parcel whose seeded tax record actually came out `OVERDUE`.
- **Accounts**: 5 officer/admin demo accounts (1 per role) and 20 citizen demo accounts, all password `Demo@123`. Each citizen is linked to a random 0-5 of the 200 parcels via a weighted pick (peaked at 1-2, both 0 and 5 rarest), walking a shuffled parcel list so no parcel is ever linked to two citizens.

## Documentation

**What's actually built:**
- [`docs/FEATURES.md`](docs/FEATURES.md) - feature-by-feature index of everything currently built, with backend/frontend locations.
- [`docs/design.md`](docs/design.md) - the Bauhaus visual design system: color tokens, typography, dark mode.
- [`docs/flow.md`](docs/flow.md) - login/registration/role-dashboard IA and feature distribution across Citizen/Officer/Admin (partially superseded, see below).
- [`docs/STANDARD_TECHNICAL_DOCUMENT.md`](docs/STANDARD_TECHNICAL_DOCUMENT.md) - the SIH-required Standard Technical Document: API, interoperability, data-schema, architecture, GIS, security, UI/UX, color, and deployment standards, verified against the real codebase.
- [`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md) - cross-reference of what's required (the official SIH problem statement), what the team's own spec additionally proposed, and what's actually built, with a scored backlog.
- [`docs/Plan.md`](docs/Plan.md) - the phase-by-phase build log, with a dated verification note after every phase.

**Planning only, not yet built:**
- [`docs/FRONTEND_UPGRADE_SPEC.md`](docs/FRONTEND_UPGRADE_SPEC.md) - the master spec for the next frontend pass: mobile/email OTP auth, a real Home/Citizen-Portal split, historical parcel-imagery comparison, ownership history, admin-configurable governance rules.
- [`docs/AUTH_VERIFICATION_UPGRADE.md`](docs/AUTH_VERIFICATION_UPGRADE.md) - backend-schema-level detail for the mobile/email OTP verification piece above.
- [`docs/CITIZEN_FEATURES_UPGRADE_PLAN.md`](docs/CITIZEN_FEATURES_UPGRADE_PLAN.md) - citizen-dashboard upgrades (Land Claim, document persistence, officer routing) plus the three PS-compliance gaps `FEATURE_AUDIT.md` found (encumbrance/mortgage records, valuation references, a Chandigarh pilot cluster).

**Project origin:**
- [`BHOOMISETU.md`](BHOOMISETU.md) - project vision and overview.
- [`Tech.md`](Tech.md) - the team's original technical architecture and specification.

## License

MIT
