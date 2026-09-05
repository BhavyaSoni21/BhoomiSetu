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

`docker-compose.yml` sketches a full multi-service deployment (frontend, backend, PostGIS, per-department API instances, AI service), but no `Dockerfile` exists yet for `backend/` or `frontend/`, so `docker-compose up` will not build successfully today — this is planned for a later phase.

## API Endpoints

Implemented and covered by the backend test suite:

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
Five independent department mocks (Tech.md #16), each `GET .../:parcelId`, none aware of each other or of the canonical model - that aggregation is the Interoperability layer below, via `GET /api/v1/parcels/:id/360`, not these:
- `GET /api/v1/land-records/:parcelId` - resolves the parcel to its Phase 3 state schema record (MH via SURVEY_NUMBER, DL via PLOT_NUMBER); 404 for states with no schema configured (TN/KA) or no matching identifier
- `GET /api/v1/registration/:parcelId` - registration status, registration number/date, last transaction
- `GET /api/v1/planning/:parcelId` - land use, zoning classification, master plan reference, building permission status
- `GET /api/v1/tax/:parcelId` - assessed value, annual tax, tax status, outstanding amount
- `GET /api/v1/restriction/:parcelId` - environmental/protected-area/flood-prone restriction flag (a per-parcel business record - distinct from the GIS `restriction-zones` polygon layer above)

### Interoperability
`backend/src/interoperability/` (Tech.md #14/#15/#22) ties the mock state schemas and department APIs together into one canonical view, surfaced entirely through `GET /api/v1/parcels/:id/360` (no separate `/integrations/...` namespace - Plan.md's Phase 5 checklist only asked to expand `/360`):
- **Identifier resolver** - any identifier (canonicalParcelId, ulpin, survey_number, plot_number, local_identifier) → canonical parcel UUID, and the reverse (parcel → the identifier a given department would recognise it by)
- **State A/B adapters** - map each state schema's own field names/units to canonical fields exactly per Tech.md #14 (area_hectares × 10000, land_extent_sqft ÷ 10.7639)
- **Canonical transformer** - builds the Tech.md #15 envelope (`parcel_id`, `identifiers`, `location`, `spatial`, `sources` - deliberately snake_case, matching that spec's JSON verbatim)
- **Response aggregator** - calls all 5 department APIs in parallel, adapts Land Records through whichever state adapter applies, and returns the canonical envelope plus a `departments` object with each department's real data (`null` where nothing is linked for that parcel)

### Workflows (Citizen Service Requests + Officer Review)
`backend/src/workflows/` (Tech.md #23/#24/#25) - a citizen request (e.g. "send me a copy of the RoR", a correction request) creates a `Workflow` and auto-generates a 3-step simulated review pipeline (`LAND_RECORDS → REGISTRATION → PLANNING`, all starting `PENDING`):
- `POST /api/v1/workflows` - create a request (`parcelId`, `workflowType`, optional `createdBy`/`requestDetails`); 400 if the parcel doesn't exist
- `GET /api/v1/workflows` - list workflows, optionally filtered to `?department=&stepStatus=` (e.g. "workflows where my department's step is still PENDING") - powers the Officer Portal dashboard below
- `GET /api/v1/workflows/:id` - a workflow with its steps
- `PATCH /api/v1/workflows/:id/status` - directly override `currentStatus` (+ optional `remarks`)
- `PATCH /api/v1/workflows/:workflowId/steps/:stepId` - **the actual officer review action** (Phase 7): `{action: 'APPROVE'|'REJECT', remarks?}` decides one step (400 if it's already been decided), then recomputes the workflow's overall `currentStatus` - any `REJECTED` step rejects the whole workflow, all `APPROVED` steps approves it, otherwise `IN_PROGRESS`

The citizen portal's Parcel 360 view ("Request Documents" / "Report Issue" buttons) submits directly to this API and shows the created workflow's reference ID and live step statuses.

### Governance Alerts
`backend/src/governance/` (Tech.md #34) - the officer-facing output of the AI/change-detection pipeline that Phase 8/9 will build. Seeded now from spatial/tax data `seed.ts` already computes (flood restriction-zone overlap, the simulated change-detection event, overdue tax) rather than hand-picked, so the Officer Portal has real alerts to act on before that pipeline exists:
- `GET /api/v1/governance-alerts` - list, optionally filtered by `?status=&severity=`, newest first
- `GET /api/v1/governance-alerts/:id` - a single alert
- `PATCH /api/v1/governance-alerts/:id/status` - officer marks it `REVIEWED` or `DISMISSED`

### Officer Portal
`frontend/src/pages/OfficerPortal.tsx` + `frontend/src/features/officer/` - officer login is a **simulated role session** (name + department, kept in `localStorage`, no password/JWT), matching BHOOMISETU.md's framing of workflow stages as "controlled by a different simulated officer role"; real authentication (JWT, bcrypt, a `users` table, RBAC middleware) is Plan.md's Phase 10, not this one. Once "signed in":
- **Dashboard** - real counts (not placeholders): pending workflows assigned to the officer's department, steps that department decided today, total decided all-time, and open governance alerts
- **Assigned Workflows** - every workflow with a `PENDING` step in the officer's own department; selecting one loads its full review panel
- **Workflow Review** - every step's status/remarks/decision time, plus an Approve/Reject + remarks form for the officer's own step (only while it's still `PENDING`)
- **Governance Alerts** - every `OPEN` alert with severity/type/explanation, with Mark Reviewed / Dismiss actions

### Groq AI Endpoints
`backend/src/ai/` (Tech.md #28-#32) - Groq is called only from the backend (`GroqService`, the official `openai` SDK pointed at Groq's OpenAI-compatible API); every response is Zod-validated before it reaches application logic, and a response that fails validation is a 502, never silently trusted. Without a `GROQ_API_KEY` configured, all three return 503 rather than crashing:
- `POST /api/v1/ai/query` - `{query: string}` → Groq converts it to a structured filter (`state`/`district`/`tax_status`/`has_restriction`/`land_use`/`registration_status`, all optional) → the backend runs the actual DB query against those fields (the LLM never touches SQL). Returns `{filters, totalMatches, results}`
- `POST /api/v1/ai/parcels/:parcelId/explain` - a plain-language summary of that parcel's full 360 view (identifiers, location, all 5 departments), structured as `{summary, risk_level, findings[], recommended_action}`; 404 for an unknown parcel
- `POST /api/v1/ai/alerts/:alertId/explain` - the same structured shape explaining one governance alert; 404 for an unknown alert

Frontend touchpoints (`frontend/src/features/ai/`), all sharing one `AiExplanationCard` renderer: an "Ask AI" natural-language search box on the Citizen Portal, an "Explain with AI" button on Parcel 360, and an "Explain" button on each governance alert in the Officer Portal. Each shows a specific message if the server has no `GROQ_API_KEY` configured rather than a generic error.

### Planned (not yet implemented)
Change detection and audit logging are scaffolded as empty NestJS modules but have no controllers or routes yet, and real officer authentication (JWT/bcrypt/RBAC middleware, a `users` table) is still Phase 10 - Phase 7's simulated officer login above stands in for it. See the phase breakdown below.

## Development Phases

The implementation follows a phased MVP plan:

1. **GIS Foundation** ✅ done and tested — PostGIS/SQLite setup, parcel table, map visualization
2. **Parcel Core** ✅ done — search (by any identifier), get-by-id, geometry, and the 360 skeleton above are all live
3. **Mock State Schemas** ✅ done — two structurally different state land-record schemas with full CRUD (see below)
4. **Mock Department APIs** ✅ done — 5 independent per-parcel department APIs (see below)
5. **Interoperability** ✅ done — identifier resolver, State A/B adapters, canonical transformer, response aggregator (see below)
6. **Citizen Portal** ✅ done — search, map, tabbed Parcel 360 view, and service requests (see Workflows below)
7. **Officer Portal** ✅ done — simulated officer login, real assigned-workflow dashboard, per-step review (approve/reject), governance alerts panel (see above)
8. **AI Integration** ✅ done — Groq-backed natural language query, parcel 360 summary, and governance alert explanation, all Zod-validated (see Groq AI Endpoints above)
9. **Change Detection** — imagery comparison and alert generation
10. **Security and Audit** — authentication, RBAC, audit logging, API security

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
- Every parcel gets Registration/Planning/Tax/Restriction mock records (see Mock Department APIs below); for Pune, Planning's land use matches the zoning overlay the parcel actually falls in and Restriction's flood flag matches the flood zone, rather than being independently random.
- Governance alerts (see above) are generated from that same data, not hand-picked: one per parcel actually inside the flood zone, one per parcel actually flagged by the change-detection event, and one per parcel whose seeded tax record actually came out `OVERDUE`.

## License

MIT
