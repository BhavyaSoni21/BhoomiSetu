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
- **Styling**: Tailwind CSS - a Bauhaus-inspired design system (`docs/architecture/DESIGN_SYSTEM.md`): an earth-tone palette derived from the BhoomiSetu logo, exposed as semantic CSS-variable-backed tokens (`primary`/`secondary`/`accent`/`ink`/`surface`) so light/dark mode is a variable swap, not per-component `dark:` classes. A theme toggle persists the choice in `localStorage`
- **Icons**: `lucide-react`
- **Localization**: `i18next`/`react-i18next` - English/Hindi, persisted language choice, covering the nav, landing hero, parcel search, Citizen Portal panels, and the map's layer labels/popup
- **HTTP Client**: Axios
- **Charts**: `recharts` (Admin Portal's analytics dashboard)
- **Testing**: Vitest + React Testing Library

> `zustand`, `react-hook-form`, and `zod` are installed as dependencies but aren't wired into any frontend component yet.

### Database
- **Dev**: SQLite (file-based, zero setup) - what `npm run start:dev`/`npm test` use out of the box
- **Production**: PostgreSQL 16+ with PostGIS 3+ - live-verified end-to-end against a hosted [Supabase](https://supabase.com) Postgres+PostGIS instance (`docs/archive/FEATURE_AUDIT.md` §8 item 14). Supabase's *direct* connection host is IPv6-only and won't resolve from an IPv4-only environment - use its connection *pooler* host instead (see `backend/.env.example`)
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
   npm run seed            # populate ./data/dev.sqlite with 220 mock parcels + demo accounts
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

5. **Sign in** - the public site (`/`, `/about`, `/features`) needs no account, but every actual tool (parcel search, the map, document verification, My Parcels, filing a service request) lives behind sign-in in the Citizen Portal now (docs/archive/FRONTEND_UPGRADE_SPEC.md §1/§4 - "no guest search, anywhere in the flow")
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

To run against PostgreSQL + PostGIS instead of SQLite, set `USE_SQLITE=false` and the `DB_*` variables in `backend/.env` (see `backend/.env.example` for both a local/docker-compose shape and a Supabase-pooler shape). No manual schema setup is needed beyond having the `postgis` extension available in your target database (`docker-compose.yml`'s `postgis/postgis` image, and Supabase, both already ship with it) - TypeORM's `synchronize: true` creates every table from the entity definitions automatically on backend startup. This path has been live-verified end-to-end (`docs/archive/FEATURE_AUDIT.md` §8 item 14) - real `ST_*` spatial queries, not a placeholder.

`docker-compose.yml` runs the real three-service architecture (frontend behind nginx, the single backend, PostGIS) - `docker compose up --build` builds and runs all three, live-verified end-to-end on 2026-09-06 (`docs/archive/FEATURE_AUDIT.md` §8 item 6): the backend starts, connects to PostGIS, and serves the API; `docker compose exec backend npm run seed` populates the same 200-parcel demo dataset as every other environment. The compose file reads `GROQ_API_KEY`/`JWT_SECRET` from your shell environment. Set `GROQ_API_KEY` if you want AI working (it has no usable default - unset, those endpoints just 503). `JWT_SECRET` **must** be set in your shell before running `docker compose up` - the compose file sets `NODE_ENV=production` for the backend, and the backend refuses to start under `NODE_ENV=production` without a real `JWT_SECRET` (see `backend/.env.example` for details); `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build` is a quick way to generate one.

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
- `GET /api/v1/gis/admin-notes` (added 2026-09-10, **admin-only including this read** - a 4th layer for free-form annotations, never fetched by the shared citizen/officer map)

Real `POST`/`PATCH`/`DELETE` also exist for zoning overlays, restriction zones, infrastructure features, and admin notes (admin-only, `backend/src/spatial/`), with geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure, all three for admin notes). **As of 2026-09-10 these are real, not just tested API capability**: a full authoring UI exists (Admin Portal → Map Layer Authoring), including a MapLibre-based drawing tool (`@mapbox/mapbox-gl-draw`, scoped only to that page) so an admin draws a shape instead of hand-typing GeoJSON. Creating/editing a restriction zone or zoning overlay now computes its `affectedParcelIds`/`parcelIds` for real (server-side centroid-in-ring against every seeded parcel, overriding whatever the client sends) instead of trusting an admin-typed value, and creating a restriction zone that newly affects a parcel creates a real Governance Alert for it (see below). Two zones of the same layer type can no longer overlap (a real polygon-vs-polygon test, `common/geo-utils.ts`'s `ringsOverlap`, rejects the create/edit with 400). A fifth admin view, "Combined View," renders all four layers together on one map. `change-detection-events` stays read-only, written only through `/change-detection/analyze`.

### Mock State Land Record Schemas
Two deliberately different schemas (Tech.md #12/#13), full CRUD, demonstrating the interoperability challenge - no parcel foreign key on either by design; resolved to a canonical parcel by identifier via the Interoperability layer below:
- `POST|GET /api/v1/state-a/land-records` (list supports `?survey_number=&village_code=`), `GET|PATCH|DELETE /api/v1/state-a/land-records/:id` - rural/village schema (surveyNumber, subdivisionNumber, ownerName, villageCode, areaHectares)
- `POST|GET /api/v1/state-b/land-records` (list supports `?plot_id=&locality_id=`), `GET|PATCH|DELETE /api/v1/state-b/land-records/:id` - urban plot schema (plotId, holderName, localityId, landExtentSqft, recordCategory)

### Mock Department APIs
Seven independent department mocks (five from Tech.md #16, plus Dispute and Encumbrance), each `GET .../:parcelId`, none aware of each other or of the canonical model - that aggregation is the Interoperability layer below, via `GET /api/v1/parcels/:id/360`, not these:
- `GET /api/v1/land-records/:parcelId` - resolves the parcel to its Phase 3 state schema record (MH via SURVEY_NUMBER, DL via PLOT_NUMBER); 404 for states with no schema configured (TN/KA/CH) or no matching identifier
- `GET /api/v1/registration/:parcelId` - registration status, registration number/date, last transaction
- `GET /api/v1/planning/:parcelId` - land use, zoning classification, master plan reference, building permission status
- `GET /api/v1/tax/:parcelId` - assessed value, annual tax, tax status, outstanding amount, plus an independent `marketValueReference`/`valuationDate`/`valuationSource` valuation reference (added 2026-09-09, per `docs/archive/FEATURE_AUDIT.md` §8 item 18 - a circle-rate/comparable-sale figure, deliberately separate from the tax authority's own assessed value)
- `GET /api/v1/restriction/:parcelId` - environmental/protected-area/flood-prone restriction flag (a per-parcel business record - distinct from the GIS `restriction-zones` polygon layer above)
- `GET /api/v1/dispute/:parcelId` - active-dispute flag, dispute type (ownership/boundary/inheritance/encroachment), case status, filing/resolution dates - seeded on ~12% of parcels, the rest return a real "no dispute" record (not a 404)
- `GET /api/v1/encumbrance/:parcelId` - active mortgage/lien/charge flag, lender name, instrument reference, registered/discharge dates (added 2026-09-09, per `docs/archive/FEATURE_AUDIT.md` §8 item 17) - seeded on ~17% of parcels, the rest return a real "no encumbrance" record (not a 404)

### Ownership History
`backend/src/parcels/ownership-history-record.entity.ts` (added 2026-09-09) - a parcel's chain of past owners, not just the current one; sits behind the current-owner fields the State A/B schemas above already expose, not a replacement for them:
- `GET /api/v1/parcels/:id/ownership-history` - rows ordered oldest-first (`ownerName`, `transactionType` ORIGINAL/SALE/GIFT/INHERITANCE/PARTITION, `transactionDate`, `documentReference`), seeded on a representative ~50% of parcels. **Citizen-restricted**: staff always see it; a citizen only sees it for a parcel actually linked to their own account (`citizen_parcels`), 403 otherwise - previous-owner names are personal information about people other than the viewing citizen
- Frontend: a new "Ownership History" tab on Parcel 360, fetched only when that tab is opened

### Interoperability
`backend/src/interoperability/` (Tech.md #14/#15/#22) ties the mock state schemas and department APIs together into one canonical view, surfaced entirely through `GET /api/v1/parcels/:id/360`:
- **Identifier resolver** - any identifier (canonicalParcelId, ulpin, survey_number, plot_number, local_identifier) → canonical parcel UUID, and the reverse (parcel → the identifier a given department would recognise it by)
- **State A/B adapters** - map each state schema's own field names/units to canonical fields exactly per Tech.md #14 (area_hectares × 10000, land_extent_sqft ÷ 10.7639)
- **Canonical transformer** - builds the Tech.md #15 envelope (`parcel_id`, `identifiers`, `location`, `spatial`, `sources` - deliberately snake_case, matching that spec's JSON verbatim)
- **Response aggregator** - calls all 7 department APIs in parallel, adapts Land Records through whichever state adapter applies, and returns the canonical envelope plus a `departments` object with each department's real data (`null` where nothing is linked for that parcel)

### Workflows (Citizen Service Requests + Officer Review)
`backend/src/workflows/` (Tech.md #23/#24/#25) - a citizen request (e.g. "send me a copy of the RoR", a correction request) creates a `Workflow` and auto-generates a 3-step simulated review pipeline (`LAND_RECORDS → REGISTRATION → PLANNING`, all starting `PENDING`). A `DISPUTE_FILING` request gets its own single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline instead:
- `POST /api/v1/workflows` - create a request (`parcelId`, `workflowType`, optional `createdBy`/`requestDetails`); 400 if the parcel doesn't exist. **Citizen-only** (JWT required, `CITIZEN` role) - `createdBy` defaults to the filing citizen's name when not given
- `GET /api/v1/workflows` - list workflows, optionally filtered to `?department=&stepStatus=` - powers the Officer Portal dashboard. Officer/admin-only
- `GET /api/v1/workflows/:id` - a workflow with its steps. Officer/admin-only
- `PATCH /api/v1/workflows/:id/status` - directly override `currentStatus` (+ optional `remarks`). Officer/admin-only
- `PATCH /api/v1/workflows/:workflowId/steps/:stepId` - the actual officer review action: `{action: 'APPROVE'|'REJECT', remarks}` decides one step (400 if already decided; **`remarks` is mandatory as of 2026-09-09**, not optional), then recomputes the workflow's overall `currentStatus`. Officer/admin-only, with per-department enforcement (see Authorization (RBAC) below)
- `POST /api/v1/workflows/:workflowId/steps/:stepId/escalate` - added 2026-09-10, **admin-only** (not officer): `{message}`, notifies the step's assigned officer role to prioritize it without touching `status`/`action` at all. Backs the Admin Portal's "Alert Officer" action (see Admin Portal below) - an admin is not expected to decide a step by default
- `POST /api/v1/workflows/:workflowId/steps/:stepId/reopen` - added 2026-09-10, **admin-only**: `{message}`, the inverse of escalate - resets an already-decided step (`APPROVED`/`REJECTED`) back to `PENDING` (clearing `action`/`remarks`/`completedAt`) and recomputes the workflow's overall `currentStatus`, then notifies the step's assigned officer role with the admin's reason (400 if the step is still `PENDING` - nothing to reopen). Backs the Admin Portal's "Send Back for Re-Review" action (see Admin Portal below) - lets an admin force a genuine re-decision on a case that needs a second look, not just an alert on one still pending

The citizen portal's Parcel 360 view ("Request Documents" / "Report Issue" / "File a Dispute" / "Verify Documents" buttons) submits directly to this API and shows the created workflow's reference ID and live step statuses. The Citizen Portal's Requests page (`GET /workflows/mine`) is where a citizen sees every request across every parcel in one place - the older per-parcel "Your Requests" panel on Parcel 360 was removed 2026-09-10.

### Document Verification
`backend/src/document-verification/` - a citizen uploads a photo/scan of a land record document (e.g. an RoR copy or sale deed); it's OCR'd locally (`tesseract.js`, no external API key) and cross-checked against a specified parcel's actual records:
- `POST /api/v1/document-verification/verify` - multipart: a `document` image (5MB cap) + `parcelId`. Public, citizen-facing, rate-limited to 20 requests/minute/IP (OCR is real CPU work per request)
- Checks every identifier on file for that parcel (ULPIN/Survey Number/Plot Number/Local Identifier, whichever exist), owner name, and area - owner name/area are resolved via the same interoperability layer Parcel 360 uses, so a match means "matches the real record", not a separately-invented comparison. Matching is tolerant of real OCR noise: identifiers use a whitespace-insensitive substring match, names require a majority of expected words to appear, and area accepts any number within 5% (checked against both the sqm-converted value and the state's native unit)
- Returns `{parcelId, canonicalParcelId, extractedText, ocrConfidence, fieldChecks: [{field, expectedValue, status}], overallVerdict}` where `overallVerdict` is `VERIFIED` / `PARTIAL_MATCH` / `MISMATCH` / `INSUFFICIENT_DATA` (the last for a blank/unreadable image, reported honestly rather than a misleading blanket mismatch); a field with no expected value for that parcel's state (e.g. owner name for a state with no land-record schema in this mock) is `NOT_AVAILABLE` and excluded from the verdict

Frontend: a "Verify Documents" page in the Citizen Portal (`frontend/src/pages/citizen/VerifyDocumentsPage.tsx`, wrapping `frontend/src/features/document-verification/`), with an optional dropdown of the signed-in citizen's own parcels to tie the check to one of them.

### Governance Alerts
`backend/src/governance/` (Tech.md #34) - the officer-facing output of the change-detection/spatial/historical-comparison pipelines. **No alert is ever hand-seeded** (as of 2026-09-10) - every alert comes from something that actually happened: a real admin-authored restriction zone (see Spatial Demo Layers above), a real Change Detection analysis (below), or a real historical-year comparison (below).
- `GET /api/v1/governance-alerts` - list, filtered by `?severity=` and/or `?status=` (an exact value, or the pseudo-status `ACTIVE` meaning "not RESOLVED/DISMISSED"), newest first
- `GET /api/v1/governance-alerts/:id` - a single alert
- `PATCH /api/v1/governance-alerts/:id/status` - advance an alert through a real 4-stage progression: **OPEN (Detected) → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED**, with **DISMISSED** reachable as an early exit from any of the first three. `reason` is mandatory on every transition; an out-of-order PATCH (e.g. OPEN straight to RESOLVED) is rejected with 400 naming the alert's real next stage(s). The relevant department's officer(s) are notified only on final closure (RESOLVED/DISMISSED)

Frontend: each alert in the Officer Portal has a "View Details" button opening a popout with the full record, a 4-step progress stepper (current stage highlighted; Dismissed shown as a distinct note), plus an "Explain with AI" button and its resulting summary - both moved out of the cramped inline row and into the popout (`GovernanceAlertDetailModal.tsx`). Only the action button(s) actually reachable from the alert's current stage are shown. The list itself is paginated client-side (5/page, added 2026-09-09) rather than rendering every open alert as one unbounded scroll.

### Authentication
`backend/src/auth/` + `backend/src/users/` + `backend/src/notifications/` - real accounts, one `users` table shared by officers/admin and citizens, plus citizen self-registration and mobile/email OTP verification (`docs/archive/FRONTEND_UPGRADE_SPEC.md` §3, added 2026-09-08):
- `users` table: `email`/`mobileNumber` (both nullable+unique - a citizen needs at least one, staff always have email), `emailVerified`/`mobileVerified` booleans, `pendingEmail`/`pendingMobileNumber` (a change-in-progress, staged until its own OTP is verified), bcrypt password hash, name, role. Seeded by `seed.ts` with 5 officer/admin demo accounts and 20 citizen demo accounts, all sharing password `Demo@123`, all `emailVerified: true`
- `POST /api/v1/auth/login` - `{email|mobileNumber, password}` → a JWT (no expiry, per the user's explicit "the session should not log out until the user presses logout" - Logout is the only thing that ends a session) plus the public user shape; wrong credentials, an unknown identifier, and a malformed one are all rejected uniformly (401/400, no user enumeration)
- `POST /api/v1/auth/register` - citizen-only, a method-selector (`method: 'EMAIL'|'MOBILE'` + the matching field) rather than both fields at once; creates the account and returns a session immediately (verification isn't a login gate - see below), and fires off that method's OTP
- `POST /api/v1/auth/verify-otp` / `resend-otp` - citizen-only, `{method, code}`; mobile OTP is delivered via **TextBee** (`textbee.dev`, uses an Android phone as the SMS gateway - send-only, so `SmsService` generates/bcrypt-hashes the code itself and `AuthService` persists+checks it, same as email); email OTP is generated/bcrypt-hashed/checked locally, 10-minute expiry, 5-attempt lockout
- `POST /api/v1/auth/profile/contact` - citizen-only add-or-change: an empty slot is set directly, an already-verified one is staged into `pendingEmail`/`pendingMobileNumber` and only takes over once its own OTP succeeds, so a bad new value can never lock a citizen out of their old one
- `GET /api/v1/auth/me` - behind a `passport-jwt` guard; looks the user up fresh on every call, so a deleted account stops working immediately
- `SmsService` (TextBee, `TEXTBEE_API_KEY`/`TEXTBEE_DEVICE_ID`/`TEXTBEE_SIM_SUBSCRIPTION_ID`) and `EmailService` (SMTP via `nodemailer`, `MAIL_HOST`/`PORT`/`SECURE`/`USER`/`PASSWORD`/`FROM` - defaults to Zoho Mail's relay but works with any SMTP-capable provider) both follow `GroqService`'s "unset config → 503 at call time" pattern; a failed send never fails the surrounding registration/add-change request itself, since the account/contact value is already saved either way
- Frontend: one sign-in page (`frontend/src/pages/LoginPage.tsx`) and one register page (`RegisterPage.tsx`) for all three account kinds - both get a method-selector toggle, no main navbar, just a lightweight logo strip; `OtpEntryForm.tsx` (6-digit entry, expiry countdown, rate-limited resend) is shared by registration's post-signup step and Profile's add/change-contact flow (`pages/citizen/ProfilePage.tsx`). `RequireAuth` gates `/officer/*`, `/admin`, and `/citizen/*` alike

### Citizen Sign-In / My Parcels
Optional citizen accounts (`CITIZEN` role, reusing the JWT auth above) linked to 0-5 parcels each - seeded with a weighted distribution (`[[0,2],[1,5],[2,5],[3,3],[4,2],[5,1]]`) so 1-2 parcels is most common and both 0 and 5 are the least likely:
- `CitizenParcel` join table (`citizen_parcels`) links a citizen to their parcels - deliberately separate from a land record's own recorded owner name, which is a different concept
- `GET /api/v1/parcels/mine` (see Parcel Endpoints above) returns them
- Frontend: a "My Parcels" page in the Citizen Portal (`frontend/src/pages/citizen/MyParcelsPage.tsx`, wrapping `frontend/src/features/citizen/MyParcels.tsx`) - the linked-parcel list + a sign-out link and a link into Profile
- Citizen accounts are excluded from the Admin Portal's staff-only `GET /api/v1/users` list and its `totalUsers` analytics metric - both existed before citizens did and were never meant to include them

### Authorization (RBAC)
`backend/src/auth/roles.guard.ts` + `roles.decorator.ts` - authentication alone only proves *who* is calling; this stops a signed-in user from calling an endpoint their role shouldn't reach:
- `RolesGuard` reads a `@Roles(...)` decorator via `Reflector` and checks it against the JWT-derived `req.user.role`; a mismatch is a `403`, distinct from `JwtAuthGuard`'s `401` for no/invalid token
- Officer/admin-only: workflow review and listing, governance alerts, change-detection analysis, the AI alert-explanation endpoint, both analytics endpoints, and staff user management. Citizen-only: `GET /parcels/mine`, `POST /workflows` (filing a service request). Citizen-facing routes that stay fully public: parcel search/360/risk-score, AI query, document verification
- Finer-grained on `PATCH /workflows/:workflowId/steps/:stepId`: checks the acting officer's role against that specific step's `assignedRole` - a `LAND_RECORD_OFFICER` gets a real `403` trying to decide a `REGISTRATION` step. `ADMIN` bypasses department restrictions

### Audit Logging
`backend/src/audit/` (Tech.md §27) - a real trail of who did what:
- A real `audit_logs` table records `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED`, `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`, and `DEPARTMENT_CREATED`/`UPDATED`/`DELETED`
- `GET /api/v1/audit` (admin-only, filterable by `?entityType=&userId=`) and `GET /api/v1/parcels/:id/audit` (staff-only) read it back
- Frontend: a filterable "Recent Activity" feed on the Admin Portal's System Monitoring page

### Admin Portal
`frontend/src/pages/AdminPortal.tsx` (its own `/admin/*` `<Routes>`, same pattern as the Officer/Citizen Portals) + `frontend/src/features/admin/`:
- **Dashboard** - `backend/src/users/users.controller.ts` (Tech.md §38): `GET /api/v1/users` (staff only - excludes citizen accounts), `POST /api/v1/users` (create an Officer/Admin account), `PATCH /api/v1/users/:id/role`, `DELETE /api/v1/users/:id` - all admin-only, all audit-logged. An admin cannot change their own role or delete their own account. Also hosts the Governance Analytics and Top At-Risk Parcels sections below.
- **Departments** - `backend/src/admin/departments-admin.controller.ts`: `GET/POST/PATCH/DELETE /api/v1/admin/departments`, admin-only CRUD (audit-logged) over a `departments` table (name/description/contact info) - display metadata for the department codes already hardcoded elsewhere (`ROLE_DEPARTMENT`, the mock department modules), which keep working unchanged
- **System Monitoring** - real System Overview counts (`GET /api/v1/analytics/summary`'s `totalUsers`/`recentLogins24h`) plus the Recent Activity feed above, both moved off the Dashboard onto their own page 2026-09-09
- **Workflow Oversight** (added 2026-09-10) - every department's workflows, opened in a monitor-first review mode: "Alert Officer" (`POST /api/v1/workflows/:workflowId/steps/:stepId/escalate`, admin-only - notifies the assigned officer without deciding anything) is the primary action; "Decide Myself" is an explicit opt-in that reveals the real Approve/Reject form. Already-decided steps get their own row with "Send Back for Re-Review" (`POST .../reopen`, admin-only) - resets the step to `PENDING` and notifies the responsible officer with a required reason, so a questionable decision gets a mandatory second look instead of standing unquestioned
- **Map Layer Authoring** (added 2026-09-10) - the real UI for the Spatial Demo Layers write APIs above, including the Admin Notes layer, the drawing tool, and the Combined View
- **Officer Monitoring** (added 2026-09-10) - `GET /api/v1/analytics/officer-monitoring`: one row per officer - pending workload in their role's queue (a real SQL `GROUP BY` over `WorkflowStep`), approved/rejected counts and average time-to-decide (from `AuditLog`, the only place an individual officer, not just a role, is attributable to a decision), and last activity - including officers with zero activity

### Officer Portal
`frontend/src/pages/OfficerPortal.tsx` + `frontend/src/pages/officer/` + `frontend/src/features/officer/` - gated by real login, multi-page (`/officer/*`: Dashboard, Assigned Requests, Governance Alerts, Historical Imagery, Map, Notifications, Profile). Dashboard is real counts (pending/decided workflows, open alerts); Assigned Requests is the workflow list grouped by parcel with stored documents (absorbed the old standalone Documents page 2026-09-10) and a full review panel (approve/reject + mandatory remarks); Governance Alerts is the 4-stage alerts list with its detail popout; Profile (added 2026-09-10) has the same editable depth as the Citizen Portal's Profile.

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

Frontend: `ChangeDetectionPanel.tsx` (file pickers, a bounds form with a one-click "Use Pune cluster bounds" fill, and a result view linking affected parcels into Parcel 360) is not currently mounted anywhere in the app - it was previously an always-visible "Analyze Imagery" panel on the Officer Portal, removed from that portal's navigation 2026-09-09 per docs/archive/FRONTEND_UPGRADE_SPEC.md §8 (the feature's name overpromised real satellite-imagery analysis). Its on-demand replacement is Historical Imagery Comparison, below. The backend endpoint and `image-diff.ts` are untouched and still fully covered by `backend/test/change-detection.e2e-spec.ts`.

### Historical Imagery Comparison
`backend/src/historical-imagery/` (docs/archive/FRONTEND_UPGRADE_SPEC.md §8) - the on-demand, staff-only replacement for Change Detection's always-on upload panel: instead of requiring a fresh upload every time, it compares two years of a cluster's own synthetic snapshot archive. Redesigned 2026-09-08 to drop pixel-diffing for a real per-parcel data comparison, after the pixel-diff version's aggregate-percentage output and single-paragraph AI description tested poorly ("looks like fetched from the dataset").
- `GET /api/v1/historical-imagery/clusters` - which clusters have snapshots and for which years
- `GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/image` - serves the stored PNG for that cluster/year
- `POST /api/v1/historical-imagery/clusters/:clusterId/compare` - `{fromYear, toYear}`, rate-limited to 30 requests/minute. **As of 2026-09-10, only accepts exactly `CURRENT_YEAR-1 → CURRENT_YEAR`** (any other pair, even two purely historical years, gets 400) - since this is the only place a historical comparison creates alerts, and alerts should reflect the most recent year-over-year difference only, not any pair an officer happens to pick. The GET endpoints below are unaffected - browsing any individual year's data stays unrestricted. `common/parcel-generation/parcel-category.ts` computes a real `ParcelCategory` (`NONE`/`RESTRICTED`/`DISPUTE_OWNERSHIP`/`DISPUTE_BOUNDARY`/`DISPUTE_INHERITANCE`/`DISPUTE_ENCROACHMENT`) per parcel per year from real data - that year's `ParcelHistoricalState.restrictionStatus`, plus (current year only, since `DisputeRecord` has no per-year history) the parcel's real active dispute type - and a parcel is "affected" simply if its category differs between the two years compared. No pixel math, no bounding box, no spatial intersection - the category is the localization. A newly-appearing or worsened category creates a `GovernanceAlert` (`DISPUTE_DETECTED`/`RESTRICTION_DETECTED`, severity `CRITICAL`/`HIGH`/`MEDIUM` by category and whether the parcel also has an active restriction); an improved category (e.g. a cleared dispute) is still reported but never re-alerted
- All three endpoints are staff-only. `NarrativeService` (renamed from `VisionService`) calls OpenRouter (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, text-only) to turn each affected parcel's real facts into one grounded sentence - e.g. "This parcel now has an active boundary dispute" - instead of one generic paragraph for the whole comparison. It never decides which parcels get flagged, only how the explanation reads, and a failed/unconfigured call falls back to the same real facts, plainly phrased. The two snapshot images are deliberately not sent to this call any more - a live test measured them adding 50-80s of latency for zero information gain once detection stopped depending on the images at all; the call is also capped to the 20 most severe affected parcels to bound worst-case latency
- `ClusterHistoricalSnapshot` rows (one rendered PNG per cluster per year, 2022-2026, identical bounding box every year so no image-registration step is ever needed) are generated at seed time - SVG polygons rasterized via `sharp`, each parcel colored by its real `ParcelCategory` for that year (the same function the compare endpoint uses)

- `GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/parcels` (added 2026-09-08) - real parcel geometry + a real `ParcelCategory` per parcel for one year, so the frontend can render a cluster's actual boundaries on the live map instead of only the flat snapshot PNG

Frontend: `features/officer/HistoricalImageryPanel.tsx`, mounted at `/officer/historical-imagery` - pick a cluster, then a single year dropdown drives the real interactive map (`features/map/MapComponent.tsx`, extended with `parcelColors`/`parcelLabels` props) showing that year's actual parcel boundaries colored by category. The comparison itself (`features/officer/HistoricalYearCompare.tsx`, extracted 2026-09-10) has no year picker any more - it always compares the two most recent years (matching the backend restriction above) and shows one row per affected parcel: its category-change badge, its real narrative sentence, and an "Alert raised" tag where one was created. As of 2026-09-10, Parcel 360's "Compare Years & Generate Alerts" action runs this inline on the same page instead of navigating to `/officer/historical-imagery`.

### Governance Analytics
`backend/src/analytics/` - platform-wide rather than per-alert:
- `GET /api/v1/analytics/summary` - real SQL `GROUP BY` aggregation across tax status, registration status, land use, dispute case status, workflow status/type, and alert severity/status, plus overall totals

Frontend: an 8-chart dashboard (`recharts`) plus a "Top At-Risk Parcels" list (a transparent heuristic risk score) on the Admin Portal.

### Planned (not yet implemented)
- **OAuth-based auth** - would need a real OAuth app registered with an external provider (a client ID/secret only a human can provision); BHOOMISETU.md only asks for it "where required," and JWT alone already covers the real ask.

## Development Phases

The implementation follows a phased MVP plan (full detail, including every live-verification pass, in `docs/archive/Plan.md`):

1. **GIS Foundation** ✅ - PostGIS/SQLite setup, parcel table, map visualization
2. **Parcel Core** ✅ - search (by any identifier), get-by-id, geometry, neighbours/context, Parcel 360 skeleton
3. **Mock State Schemas** ✅ - two structurally different state land-record schemas with full CRUD
4. **Mock Department APIs** ✅ - 6 independent per-parcel department APIs
5. **Interoperability** ✅ - identifier resolver, State A/B adapters, canonical transformer, response aggregator
6. **Citizen Portal** ✅ - multi-page, gated by citizen sign-in (docs/archive/FRONTEND_UPGRADE_SPEC.md §4): search, map, tabbed Parcel 360 view, and service requests restricted to the citizen's own parcels
7. **Officer Portal** ✅ - multi-page (docs/archive/FRONTEND_UPGRADE_SPEC.md §5): real login, assigned-workflow review, governance alerts panel (+ detail popout)
8. **AI Integration** ✅ - Groq-backed natural-language data queries *and* navigation help in one call, parcel/alert explanation, all Zod-validated, surfaced via a draggable floating "Ask AI" widget
9. **Change Detection** ✅ - real pixel-diff imagery comparison, spatial intersection, and governance alert generation
10. **Security and Audit** ✅ - authentication (officer/admin/citizen), RBAC, and audit logging
11. **Document Verification** ✅ - OCR a citizen-uploaded document, cross-check it against a parcel's real records
12. **Citizen Sign-In** ✅ - optional citizen accounts linked to their parcels, a "My Parcels" dashboard

Also completed outside the phase numbering: **PostGIS run end-to-end** against a live Supabase instance (real `ST_*` queries, not the SQLite fallback), a from-scratch **irregular parcel geometry generator** replacing the original uniform grid (see Mock Data below), full **citizen registration + email/mobile OTP verification** (see Authentication above), and **Historical Imagery Comparison** (see above) - Change Detection's on-demand, AI-assisted successor.

A later, dedicated **Admin/Officer Portal follow-up round** (2026-09-10, full detail in `docs/archive/ADMIN_PANEL_ISSUES.md`) turned three of that portal's remaining placeholder cards into real features - Workflow Oversight, Map Layer Authoring (with a drawing tool, an admin-only Admin Notes layer, and real spatial-overlap computation), and Officer Monitoring - plus a real 4-stage Governance Alert verification flow, mandatory review remarks, full Officer/Admin English/Hindi coverage, a richer Officer Profile, and role-aware notification deep-linking. See the Governance Alerts, Spatial Demo Layers, Admin Portal, and Officer Portal sections above for the as-built detail.

## Mock Data

`backend/seed.ts` generates exactly 220 mock parcels in five geographically real demo regions rather than scattering them randomly across India:

| Cluster | State | District | Parcels |
|---|---|---|---|
| Pune | MH | Pune | 100 (primary GIS demo cluster) |
| Chennai | TN | Chennai | 40 |
| Bangalore | KA | Bangalore | 40 |
| New Delhi | DL | New Delhi | 20 |
| Chandigarh | CH | Chandigarh | 20 (added 2026-09-09 - Chandigarh and Tamil Nadu are the two actual pilot locations named in the official "Land Stack" problem statement) |

- **Irregular, topology-aware subdivision** (`backend/src/common/parcel-generation/`), not a uniform grid: each cluster gets its own irregular convex envelope (a jittered-ellipse point cloud reduced to its convex hull, oriented along a per-cluster "dominant road angle" so no two clusters look alike), recursively split into that cluster's parcel count via randomly-angled cuts. Most splits share an exact boundary (so adjacent parcels are built from the literal same coordinates); some leave a small real gap instead. Leaves range from triangles to heptagons, with genuinely varied sizes - the greedy "always split the largest piece" strategy alone produces that variance, with a compactness guard against paper-thin sliver shapes.
- Every parcel carries a `clusterId` (e.g. `MH-PUNE-01`), and explicit `TOUCHING`/`NEARBY` relationships are precomputed at seed time in a `parcel_neighbours` table from real geometric distance between every pair of parcels in a cluster (an exact shared edge measures 0 → `TOUCHING`; an intentional small gap measures a few metres → `NEARBY`) - the same convention the live PostGIS `ST_Distance`/`ST_DWithin` queries use.
- Identifier types are state-differentiated: Maharashtra favors Survey Number/ULPIN, Tamil Nadu Survey Number/Subdivision Number, Karnataka Survey Number/Hissa Number, Delhi Plot Number/Property Number - every parcel in every state also gets a Local Parcel ID.
- The Pune cluster additionally seeds: 3 zoning overlays (residential/commercial/agricultural, latitude-banded across Pune's actual generated extent), a flood restriction zone, 4 infrastructure features (road, water line, 2 electricity points), and a simulated change-detection event - each zone is anchored to a real generated parcel's position and sized until it captures a plausible parcel count, then resolved with a real point-in-polygon test - not hand-picked coordinates.
- Every Pune/MH parcel gets a State A land record and every New Delhi/DL parcel gets a State B land record, with `areaHectares`/`landExtentSqft` derived from that parcel's real geometry area, and its state-schema identifier matching the same parcel's `parcel_identifiers` row.
- Every parcel gets Registration/Planning/Tax/Restriction/Dispute/Encumbrance mock records; for Pune, Planning's land use matches the zoning overlay the parcel actually falls in and Restriction's flood flag matches the flood zone. ~12% of parcels get a real dispute on file, ~17% get a real mortgage/lien/charge, and a representative ~50% get a 1-3-entry ownership history chain (the final entry matching the State A/B owner name where one exists).
- **No `GovernanceAlert` rows are seeded** (removed 2026-09-10) - the flood zone, simulated change-detection event, and tax records above are still seeded normally for their own features, but a governance alert is only ever created by something that actually happens at runtime (see Governance Alerts below), never fabricated at seed time.
- **Accounts**: 5 officer/admin demo accounts (1 per role) and 20 citizen demo accounts, all password `Demo@123`. Each citizen is linked to a random 0-5 of the 220 parcels via a weighted pick (peaked at 1-2, both 0 and 5 rarest), walking a shuffled parcel list so no parcel is ever linked to two citizens.

## Documentation

`docs/` is split into two directories (reorganized 2026-09-11): current-state reference vs. historical record. Each has its own index README with a one-line description of every document in it - start there rather than this list, which only covers the highlights.

**[`docs/architecture/`](docs/architecture/README.md) - what's actually built, right now:**
- [`docs/architecture/FEATURES.md`](docs/architecture/FEATURES.md) - feature-by-feature index of everything currently built, with backend/frontend locations.
- [`docs/architecture/FEATURE_TECH_MAP.md`](docs/architecture/FEATURE_TECH_MAP.md) - the same feature numbering, as a library/endpoint/file lookup table.
- [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md) - the SIH-required Standard Technical Document: API, interoperability, data-schema, architecture, GIS, security, UI/UX, color, and deployment standards, verified against the real codebase.
- [`docs/architecture/DESIGN_SYSTEM.md`](docs/architecture/DESIGN_SYSTEM.md) - the portal Bauhaus visual system (color tokens, typography, dark mode) plus the public landing page's own separate literal-hex color system.
- [`docs/architecture/KNOWN_RISKS.md`](docs/architecture/KNOWN_RISKS.md) - the most recent full-stack security/performance/reliability audit.
- [`docs/architecture/BACKLOG.md`](docs/architecture/BACKLOG.md) - everything genuinely still open (Admin session/timeout, OAuth login, admin-editable Workflow Configuration/Governance Rules, and a handful of smaller deferred items), each sourced back to where it was originally scoped.

**[`docs/archive/`](docs/archive/README.md) - historical planning documents and completed punch lists**, kept for their reasoning and dated history, not as a description of the system today: `ADMIN_PANEL_ISSUES.md`, `AUTH_VERIFICATION_UPGRADE.md`, `CITIZEN_FEATURES_UPGRADE_PLAN.md`, `FRONTEND_UPGRADE_SPEC.md`, `FEATURE_AUDIT.md`, `Plan.md`, `flow.md`.

**Project origin (repo root, not moved):**
- [`BHOOMISETU.md`](BHOOMISETU.md) - project vision and overview.
- [`Tech.md`](Tech.md) - the team's original technical architecture and specification.

## License

MIT
