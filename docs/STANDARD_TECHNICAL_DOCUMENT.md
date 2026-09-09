# BhoomiSetu — Standard Technical Document

**System**: BhoomiSetu — a GIS-based, parcel-centric land governance and interoperability platform, built for SIH 2026's Land Stack problem statement.
**Document date**: 2026-09-10.
**Scope**: this document covers exactly the nine areas the problem statement asks a Standard Technical Document to contain — API standards, interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX guidelines, color schemas, and deployment/scalability considerations. It is an as-built reference: every claim below was checked directly against the source (`backend/src/**`, `frontend/src/**`) on the document date, not transcribed from earlier design notes. For a feature-by-feature narrative see `docs/FEATURES.md`; for a per-feature library/endpoint/file lookup table see `docs/FEATURE_TECH_MAP.md`; for the original team vision documents see `Tech.md`/`BHOOMISETU.md`.

---

## 1. System Architecture

### 1.1 High-level shape

```
                    ┌────────────────────┐
                    │   React Frontend    │   (Vite dev server :5173)
                    │  Citizen / Officer  │
                    │   / Admin Portals   │
                    └──────────┬──────────┘
                               │ REST (axios, JSON + multipart for
                               │ image/document upload routes)
                               ▼
                    ┌────────────────────┐
                    │   NestJS Backend    │   (:3000, prefix /api/v1)
                    │  23 controllers,    │
                    │  28 TypeORM entities│
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┬───────────────┐
              ▼                ▼                ▼               ▼
       ┌───────────┐    ┌───────────┐    ┌─────────────┐  ┌───────────┐
       │  SQLite    │    │ Groq API  │    │ Postgres +  │  │ Fast2SMS /│
       │ (dev, file)│    │(AI query/ │    │ PostGIS     │  │ SMTP      │
       │            │    │explain/   │    │(prod path,  │  │(OTP/email │
       │            │    │routing)   │    │e.g. Supabase)│  │delivery)  │
       └───────────┘    └───────────┘    └─────────────┘  └───────────┘
                               +
                        OpenRouter (Historical
                        Imagery narrative LLM)
```

There is **one backend process**, not a microservices mesh. Every "department" (Land Records, Registration, Planning, Tax, Restriction, Dispute, Encumbrance), the AI layer, change detection, historical imagery, and the interoperability/aggregation layer are all NestJS modules inside the same application, communicating via in-process dependency injection — not network calls between separate services. This is a deliberate simplification over a literal per-department microservice split: at this data volume and team size, module boundaries inside one process give the same separation of concerns without the operational cost of a service mesh, while §9.2 covers what would need to change to actually split it. The only external network dependencies are: the Groq API (AI query/explain/routing), OpenRouter (historical-imagery narrative generation), Fast2SMS (mobile OTP), and SMTP (email OTP/verification) — all called only from the backend, never from the browser.

### 1.2 Backend module inventory

`backend/src/` has 20 top-level module directories (plus `common/` for shared utilities and `adapters/` for interoperability adapters, which aren't feature modules of their own).

| Module | Owns these tables | Notable dependencies |
|---|---|---|
| `GisModule` | (reads `parcels`) | — |
| `SpatialModule` | `zoning_overlays`, `restriction_zones`, `infrastructure_features`, `change_detection_events`, `admin_map_notes` | writes `governance_alerts` on restriction-zone overlap |
| `LandRecordsModule` | `state_a_land_records`, `state_b_land_records` | — |
| `DepartmentsModule` | `registration_records`, `planning_records`, `tax_records`, `restriction_records`, `dispute_records`, `encumbrance_records` | — |
| `ParcelsModule` | `parcels`, `parcel_identifiers`, `parcel_neighbours`, `ownership_history_records`, `parcel_documents`, `citizen_parcels`, `parcel_historical_states` | `InteroperabilityModule`, `WorkflowsModule`, `PredictiveAnalyticsModule` |
| `InteroperabilityModule` | (reads `parcels`, department tables) | `DepartmentsModule` |
| `WorkflowsModule` | `workflows`, `workflow_steps` | `ai/groq.module.ts` (request routing), writes `notifications` |
| `GovernanceModule` | `governance_alerts` | writes `notifications` |
| `AiModule` | (reads `parcels` + department tables) | `InteroperabilityModule`, `GovernanceModule` |
| `ChangeDetectionModule` | writes `change_detection_events`, `governance_alerts` | `sharp` (image decode) |
| `HistoricalImageryModule` | `cluster_historical_snapshots` | writes `governance_alerts`; OpenRouter (narrative) |
| `AnalyticsModule` | (reads `parcels`, department/workflow/alert/audit tables, `workflow_steps`) | — |
| `PredictiveAnalyticsModule` | (reads `parcels`, tax/dispute/restriction/alert tables) | — |
| `AdminModule` | `departments` (display/admin metadata, distinct from role constants) | — |
| `UsersModule` | `users` | `AuditModule` |
| `AuthModule` | (reads/writes `users`) | `UsersModule`, `AuditModule`, `notifications/` (OTP) |
| `AuditModule` | `audit_logs` | — |
| `NotificationFeedModule` | `notifications` (in-app feed — distinct from `notifications/`, OTP delivery infra) | — |

**Dependency-cycle avoidance pattern** (applied consistently): a module that needs to *read* another module's table registers its own `TypeOrmModule.forFeature([...])` for that entity directly, instead of importing the module that owns it. This is why `ChangeDetectionModule` re-declares `Parcel`/`GovernanceAlert` rather than importing `SpatialModule`/`GovernanceModule`, and why `WorkflowsModule` re-declares `Parcel` rather than importing `ParcelsModule` — which is what lets `ParcelsModule` import `WorkflowsModule` back without creating a cycle. No circular imports exist among feature modules as currently wired.

### 1.3 Frontend architecture

React 18 + Vite, client-side routed (`react-router-dom` v6), no server-side rendering.

```
frontend/src/
├── features/         one directory per feature area — admin/, ai/, analytics/,
│                     auth/, change-detection/, citizen/, document-verification*,
│                     map/, notifications/, officer/, parcels/
├── pages/            HomePage, CitizenPortal (+ pages/citizen/*), OfficerPortal
│                     (+ pages/officer/*), AdminPortal (+ pages/admin/*),
│                     LoginPage, RegisterPage, AboutPage, FeaturesPage
├── services/apiService.ts   one shared axios instance; JWT bearer-token
│                            interceptor + 401 redirect-to-login interceptor
├── types/            one file per API response shape
├── i18n/             i18next config + en.json/hi.json locale files
└── test/setup.ts
```

*`features/document-verification/` no longer exists as a standalone UI — see `docs/FEATURE_TECH_MAP.md` feature 9's note; OCR verification is now folded into the request-filing flow.

**Routes** (`App.tsx`): `/` → `HomePage` for a guest, or a redirect to the signed-in user's own portal; `/citizen/*`, `/officer/*`, `/admin/*` → each wrapped in `RequireAuth` (real JWT session check + role check, redirects to `/login` otherwise) and each a self-contained multi-page portal with its own relative `<Routes>`; `/login`, `/register` → sign-in/registration; `/about`, `/features` → public informational pages, no login; `/parcels/:id` → Parcel 360, a public unguarded route shared by citizen/officer/admin. As of the account-centric redesign, **signing in is required for the entire Citizen Portal** (search, map, document verification, My Parcels) — there is no anonymous/guest path anywhere in the citizen flow; only `/`, `/about`, `/features` need no account.

### 1.4 Data flow example — Parcel 360

Illustrates the layering used throughout: `ParcelsController` (`GET /parcels/:id/360`) → `ResponseAggregatorService.buildParcel360()` → calls the Land Records, Registration, Planning, Tax, Restriction, Dispute, and Encumbrance services in parallel (`Promise.all`) → the Land Records result passes through a State A/B adapter → everything merges via `buildCanonicalEnvelope()` into a fixed shape (`parcel_id`, `identifiers`, `location`, `spatial`, `sources`) plus a `departments` object carrying the real per-department payloads. This same aggregator is reused by `AiController`'s parcel-explanation endpoint.

---

## 2. API Standards

- **Style**: REST over HTTP/JSON. Multipart/form-data is used for the three file-upload routes: `POST /change-detection/analyze`, `POST /parcels/identify-from-document`, and evidence upload on `POST /workflows`.
- **Base path**: every route is prefixed `/api/v1` (`app.setGlobalPrefix('api/v1')`). The prefix exists as a forward-compatible convention — there is no `/api/v2` yet.
- **Documentation**: Swagger/OpenAPI is live at `GET /api` (`SwaggerModule.setup('api', app, ...)`), auto-generated from controllers/DTOs.
- **Request validation**: a single global `ValidationPipe({ whitelist: true, transform: true })` — every DTO is `class-validator`-decorated; unknown body fields are silently stripped, and query/body values are coerced to their declared types. Every path parameter that represents an entity ID is validated with `ParseUUIDPipe`, so a malformed (non-UUID) ID reliably 400s before handler logic runs.
- **Response shape**: NestJS's built-in exceptions produce a consistent `{ statusCode, message, error }` envelope by default; there is no custom global exception filter formalizing this further.
- **Status codes actually used**: `200` (read), `201` (create), `204` (delete), `400` (validation failure, malformed input, invalid state transition — e.g. an out-of-order governance-alert status PATCH), `401` (missing/invalid/expired token), `403` (valid token, wrong role, or role right but wrong department on a workflow step), `404` (valid ID, no matching row), `502` (an AI response failed Zod schema validation), `503` (an AI/OCR-narrative endpoint called with no API key configured).
- **Authentication**: JWT bearer token (`Authorization: Bearer <token>`), checked via `JwtAuthGuard` + `RolesGuard` on every officer/admin/citizen-account-only route. Public routes (informational pages, some read-only lookups) ignore the header entirely, by design. `apiService.ts`'s request interceptor attaches the token from `localStorage`; its response interceptor redirects to `/login` on a `401` from anything *other than* `/auth/login` itself, so a failed login attempt shows its own error message instead of hard-redirecting.
- **Rate limiting**: `@nestjs/throttler`, global `APP_GUARD` — 200 req/min/IP default; 30 req/min/IP on `ai/`, `change-detection/`, and `historical-imagery/`; 20 req/min/IP on `parcels/identify-from-document`. `X-RateLimit-*` response headers included; `trust proxy` set so per-IP limiting reads the real client IP behind one reverse proxy.
- **CORS**: configurable via `CORS_ORIGIN` (comma-separated allowlist); wide-open (`origin: true`) only when unset, matching local-dev/Docker-internal-traffic behavior with no separate dev flag needed.

### 2.1 Endpoint inventory by area

All paths relative to `/api/v1`. **Auth** column: Public = no guard; Citizen = `JwtAuthGuard`+`RolesGuard`, citizen role only; Staff = any officer role or ADMIN; Admin = ADMIN only; Mixed = varies by route within that controller.

| Area | Base path | Representative routes | Auth |
|---|---|---|---|
| Auth | `/auth` | `POST /login`, `POST /register`, `POST /verify-otp`, `POST /resend-otp`, `POST /profile/contact`, `POST /profile/details`, `GET /me` | Mixed |
| Users | `/users` | `GET`, `POST`, `PATCH /:id/role`, `DELETE /:id` | Admin |
| Audit | `/audit` | `GET` (filterable) | Admin |
| Parcels | `/parcels` | `GET` (search), `GET /:id`, `/:id/geometry`, `/:id/neighbours`, `/:id/context`, `/:id/workflows`, `/:id/360`, `/:id/history`, `/:id/risk-score`, `/:id/documents`, `POST /identify-from-document`, `GET /mine` | Mixed |
| Parcels (restricted) | `/parcels` | `GET /:id/ownership-history`, `/:id/documents/:docId/file` (staff, or citizen owning the parcel), `/:id/audit` (staff only) | Mixed |
| GIS | `/gis` | `GET /parcels`, `/parcel-at-location`, `/parcels/:id/geometry`, `/parcels/:id/restrictions` | Public |
| Spatial layers | `/spatial` | `GET/POST/PATCH/DELETE` on `zoning-overlays`, `restriction-zones`, `infrastructure` (public read, admin write); `admin-notes` (admin-only including reads) | Mixed |
| State land record schemas | `/state-a/land-records`, `/state-b/land-records` | Full CRUD on each | Public (mock external-state APIs) |
| Mock departments | `/land-records`, `/registration`, `/planning`, `/tax`, `/restriction`, `/dispute`, `/encumbrance` | `GET /:parcelId` on each | Public |
| Workflows | `/workflows` | `POST` (citizen), `GET`, `GET /mine` (citizen), `GET /:id`, `GET /:id/evidence`, `PATCH /:id/status`, `PATCH /:workflowId/steps/:stepId`, `POST /:workflowId/steps/:stepId/escalate` (admin) | Mixed |
| Governance alerts | `/governance-alerts` | `GET`, `GET /:id`, `PATCH /:id/status` | Staff |
| AI (Groq) | `/ai` | `POST /query`, `POST /parcels/:parcelId/explain`, `POST /alerts/:alertId/explain` (staff) | Mixed |
| Change detection | `/change-detection` | `POST /analyze` (multipart) | Staff |
| Historical imagery | `/historical-imagery` | `GET /clusters`, `GET /clusters/:id/years/:year/parcels`, `GET /clusters/:id/years/:year/image`, `POST /clusters/:id/compare` | Staff |
| Notifications | `/notifications` | `GET`, `PATCH /:id/read` | Any authenticated |
| Analytics | `/analytics` | `GET /summary`, `GET /officer-monitoring` | Admin |
| Predictive analytics | `/predictive-analytics` | `GET /top-risk-parcels` | Admin |
| Admin departments | `/admin/departments` | Full CRUD | Admin |

23 controllers total. `GisController` and `SpatialController` are two separate modules that both mount sub-paths — they don't collide, but "the GIS module" is two files, not one.

---

## 3. Interoperability Standards

The interoperability layer (`backend/src/interoperability/`) exists specifically to reconcile the fact that different "state" land-record schemas use different field names, units, and identifier conventions — the actual challenge a real Land Stack has to solve.

- **Canonical data model**: `buildCanonicalEnvelope()` (`canonical-transformer.ts`) produces one fixed shape regardless of source state:
  ```json
  {
    "parcel_id": "uuid",
    "identifiers": { "ulpin": "string|null", "survey_number": "string|null", "plot_number": "string|null", "local_identifier": "string|null" },
    "location": { "state": "string", "district": "string", "locality": "string" },
    "spatial": { "area_sq_m": "number", "geometry": {} },
    "sources": [{ "department": "string", "status": "AVAILABLE|NOT_AVAILABLE" }]
  }
  ```
  This is the one place in the codebase that deliberately uses `snake_case` keys — every other API response is `camelCase` — because this shape is a fixed external contract, not an internal detail free to follow house style.
- **Identifier resolution**: `IdentifierResolverService` maps any known identifier (canonical UUID, ULPIN, survey number, plot number, local identifier) to the canonical parcel, and the reverse.
- **State adapters**: `land-record-adapters.ts` implements the exact unit/field conversion between the two mock state schemas and the canonical model — State A's `area_hectares` × 10,000 → `area_sq_m`; State B's `land_extent_sqft` ÷ 10.7639 → `area_sq_m`. A third state is added by writing one more adapter function, not by changing the canonical model or any consuming code.
- **Response aggregation**: `ResponseAggregatorService` calls every department service in parallel and merges results — department services keep returning their own native shapes inside the `departments` object; only the top-level envelope is canonicalized. This is the "standardize interoperability without forcing every source system to become identical" principle carried through.
- **Cross-department correlation without a shared key**: every department table is keyed by a plain `parcelId` string (not a foreign-key relation) — deliberately, to mirror how independent real government systems would only share an identifier convention, not a shared database.
- **What is not implemented**: schema versioning/metadata tagging on the canonical envelope, a formal API-contract-per-department-schema publishing mechanism, and validation of inbound third-party payloads (moot today since every "department" is this project's own mock, not a real external system) — a real deployment integrating actual state systems would need both before onboarding a live data source.

---

## 4. Data Schemas

The authoritative schema is the TypeORM entity source under `backend/src/**/*.entity.ts` — **28 entities**. Field names are `camelCase` (TypeORM/JS convention, mapped by TypeORM to the DB columns), and IDs are UUID primary keys unless noted.

### Core parcel model
- **`Parcel`** (`parcels`) — `id` (uuid PK), `canonicalParcelId`, `clusterId`, `ulpin`, `stateCode`, `districtCode`, `localBodyCode`, `geometry` (text, GeoJSON), `areaSqM` (decimal 15,2), `createdAt`/`updatedAt`. Indexed on `[stateCode, districtCode]`, `[canonicalParcelId]`, `[ulpin]`, `[clusterId]`.
- **`ParcelIdentifier`** (`parcel_identifiers`) — `identifierType`, `identifierValue`, `sourceState`, `sourceDepartment`; `@ManyToOne` to `Parcel`, `onDelete: CASCADE`.
- **`ParcelNeighbour`** (`parcel_neighbours`) — `parcelId`, `neighbourParcelId`, `relationshipType` (`TOUCHING`|`NEARBY`) — plain string FKs, precomputed at seed time.
- **`OwnershipHistoryRecord`** (`ownership_history_records`) — `parcelId`, `ownerName`, `transactionType` (`ORIGINAL`|`SALE`|`GIFT`|`INHERITANCE`|`PARTITION`), `transactionDate`, `documentReference`.
- **`ParcelDocument`** (`parcel_documents`) — `parcelId`, stored document metadata + binary/file reference, `extractedText` (OCR cache).
- **`ParcelHistoricalState`** (`parcel_historical_states`) — `parcelId`, `year`, `restrictionStatus` — one row per parcel per year, backing feature 26 (Historical Imagery Comparison).
- **`CitizenParcel`** (`citizen_parcels`) — join table linking a `CITIZEN` user to 0-5 parcels.

### Spatial demo layers
- **`ZoningOverlay`** (`zoning_overlays`) — `zoneType` (`RESIDENTIAL`|`COMMERCIAL`|`AGRICULTURAL`), `parcelIds` (server-computed, `simple-array`).
- **`RestrictionZone`** (`restriction_zones`) — `restrictionType` (`FLOOD`|`ENVIRONMENTAL`|`PROTECTED_AREA`), `affectedParcelIds` (server-computed).
- **`InfrastructureFeature`** (`infrastructure_features`) — `featureType` (`ROAD`|`WATER_LINE`|`ELECTRICITY`).
- **`AdminMapNote`** (`admin_map_notes`) — an admin-only 4th layer, never fetched by the citizen/officer map; every endpoint including reads is ADMIN-gated.
- **`ChangeDetectionEvent`** (`change_detection_events`) — `description`, `geometry`, `affectedParcelIds`, `detectedAt`. Read-only via `/gis`; written only by seed or `POST /change-detection/analyze`.

### Mock state land-record schemas (deliberately incompatible with each other by design)
- **`StateALandRecord`** (`state_a_land_records`, PK `recordId`) — `surveyNumber`, `subdivisionNumber`, `ownerName`, `villageCode`, `areaHectares` (decimal 10,4), `recordStatus`.
- **`StateBLandRecord`** (`state_b_land_records`, PK `recordId`) — `plotId`, `holderName`, `localityId`, `landExtentSqft` (decimal 12,2), `recordCategory`. Neither has a FK to `Parcel` — resolution is by identifier value only (§3).

### Mock department records (all keyed by a plain `parcelId` string column, not a relation)
- **`RegistrationRecord`** — `registrationStatus` (`REGISTERED`|`PENDING`|`NOT_REGISTERED`), `registrationNumber`, `registrationDate`, `lastTransactionType`, `lastTransactionDate`.
- **`PlanningRecord`** — `landUse` (`RESIDENTIAL`|`COMMERCIAL`|`AGRICULTURAL`|`MIXED_USE`), `zoningClassification`, `masterPlanReference`, `buildingPermissionStatus`.
- **`TaxRecord`** — `assessedValue` (decimal 14,2), `annualTaxAmount`, `taxStatus` (`PAID`|`PENDING`|`OVERDUE`), `outstandingAmount`, `lastPaymentDate`, `marketValueReference`/`valuationDate`/`valuationSource` (independent valuation reference).
- **`RestrictionRecord`** — `hasRestriction` (boolean), `restrictionType` (`ENVIRONMENTAL`|`PROTECTED_AREA`|`FLOOD_PRONE`), `restrictionDetails`, `imposingAuthority`.
- **`DisputeRecord`** — `hasActiveDispute` (boolean), `disputeType` (`OWNERSHIP`|`BOUNDARY`|`INHERITANCE`|`ENCROACHMENT`), `caseStatus` (`FILED`|`UNDER_REVIEW`|`RESOLVED`|`DISMISSED`), `filingDate`, `resolutionDate`, `resolutionSummary`.
- **`EncumbranceRecord`** — active mortgage/lien/charge flag, `lender`, `instrumentReference`.

### Workflow & governance schemas
- **`Workflow`** (`workflows`) — `parcelId`, `workflowType` (free-form string — e.g. `ROR_COPY_REQUEST`, `CORRECTION_REQUEST`, `DISPUTE_FILING`, `LAND_CLAIM_REQUEST`, `DOCUMENT_VERIFICATION_REQUEST`), `currentStatus` (default `SUBMITTED`), `createdBy` (display name, not a FK — workflow creation stays tied to the filing citizen's account via a separate association check, not a stored user reference), `requestDetails`, `lastRemarks`, `routingNotes` (AI request-routing rationale).
- **`WorkflowStep`** (`workflow_steps`) — `stepOrder`, `department`, `assignedRole` (a *role*, not a specific user — shared by every officer holding it), `status` (default `PENDING`), `action`, `remarks` (mandatory on decision), `completedAt`. `@ManyToOne` to `Workflow`, `onDelete: CASCADE`. Default pipeline: `LAND_RECORDS → REGISTRATION → PLANNING`; `DISPUTE_FILING` gets a single `DISPUTE`/`DISPUTE_OFFICER` step instead.
- **`GovernanceAlert`** (`governance_alerts`) — `parcelId`, `alertType` (`RESTRICTION_ZONE_OVERLAP`|`UNAUTHORIZED_CHANGE_DETECTED`|`RESTRICTION_DETECTED`|`DISPUTE_DETECTED`), `severity` (`LOW`|`MEDIUM`|`HIGH`|`CRITICAL`), `source`, `status` — a real 4-stage linear progression: `OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED`, with `DISMISSED` reachable as an early exit from any of the first three (enforced server-side, see §6), `reason` (mandatory on every transition), `explanation`. No alert is ever hand-seeded — every row is created by something that actually happened at runtime (a real spatial overlap, a real change-detection analysis, or a real year-over-year historical comparison).

### Auth, audit & notification schemas
- **`User`** (`users`) — `id`, `email`/`mobileNumber` (both nullable+unique), `emailVerified`/`mobileVerified`, `pendingEmail`/`pendingMobileNumber` (staged, unconfirmed change), `passwordHash` (bcrypt), `name`, `role` (varchar — `ADMIN` | one of 7 `*_OFFICER` roles | `CITIZEN`, a plain column, not a separate `roles` table/FK).
- **`AuditLog`** (`audit_logs`) — `userId`, `userRole`, `action` (e.g. `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED`, `WORKFLOW_STATUS_CHANGED`, `GOVERNANCE_ALERT_STATUS_CHANGED`, `USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`, `DEPARTMENT_CREATED`/`UPDATED`/`DELETED`), `entityType`, `entityId`, `parcelId` (indexed, lets `GET /parcels/:id/audit` skip parsing every row's metadata), `metadata` (text, JSON-serialized — correlated in application code, not SQL, since it isn't portably query-able as JSON across SQLite/Postgres), `createdAt`. Indexed on `[entityType, entityId]` and `[parcelId]`.
- **`Notification`** (`notifications`, `notification-feed/`) — `userId`, `type`, `title`, `message`, `parcelId`/`workflowId`/`alertId` (nullable, deep-link targets), `read` (boolean).
- **`Department`** (`departments`, `admin/`) — display/admin metadata (name, description, contact info) — distinct from the hardcoded department *codes* used elsewhere in routing logic.
- **`ClusterHistoricalSnapshot`** (`cluster_historical_snapshots`) — one rendered PNG per cluster per year (2022-2026), generated at seed time.

### Not built
A separate `roles` table with per-role descriptions — a plain `varchar` column on `users` already serves every real need this codebase has.

---

## 5. GIS Standards

- **Geometry format**: GeoJSON throughout — every `geometry` column is stored as `text` (a JSON-encoded string) rather than a native geometry type, even on the Postgres/PostGIS path — every consumer just `JSON.parse()`s it.
- **Two spatial code paths, chosen automatically at connection time** (`common/postgis.ts`, checking the actual connected TypeORM driver, not an env flag): SQLite (default dev database, no spatial extension) uses a hand-implemented plain-TypeScript path (`common/geo-utils.ts`) for point-in-polygon, polygon-to-polygon distance, centroid, ring intersection, and (added for feature 21) true polygon-vs-polygon overlap (`ringsOverlap`). Against real Postgres+PostGIS (live-verified against a hosted Supabase instance), the same call sites instead run real parameterized `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid`/`ST_MakeEnvelope`/`ST_GeomFromGeoJSON` queries.
- **Coordinate system**: WGS84 (`EPSG:4326`, plain lng/lat), matching GeoJSON's implicit CRS. Local distance math uses an equirectangular approximation centered on the reference latitude — accurate for parcels a few hundred metres apart, not continental in scale.
- **Layering model** (`MapComponent.tsx`, one shared component reused across every portal): base search-result parcels (colored by state) → same-district fill → cluster fill (a selected parcel's connected network) → nearby outline → adjacent outline → selected outline → 4 toggleable overlay layers (zoning, restriction, infrastructure as line+point, change-detection) → historical-imagery mode adds per-parcel category coloring. Selected/adjacent/nearby/cluster default visible; district and overlay layers default hidden.
- **Parcel topology**: parcels within a seeded cluster are generated from one shared coordinate lattice (a jittered grid of corner points, one jittered midpoint per shared edge, reused by every parcel touching them) so adjacent parcels share the literal same boundary coordinates — a genuinely connected cadastral network, not independently-generated polygons that happen to sit near each other.
- **Spatial overlap validation**: `SpatialService` computes real affected-parcel sets server-side (centroid-in-ring against every seeded parcel) rather than trusting admin-typed `parcelIds`, and rejects two same-layer-type zones that overlap (`ringsOverlap`, a 400 naming the conflicting zone) — the codebase's first true polygon-vs-polygon test, everything before it was point-in-polygon.
- **Spatial indexing**: none, even on the Postgres/PostGIS path — since `geometry` stays a `text` column, every `ST_*` call parses GeoJSON per row rather than reading a native, indexable geometry column, so a GiST index isn't applicable without a storage migration. No application-level spatial index (R-tree/quadtree) exists either — acceptable at ~220 seeded parcels, a real scale ceiling beyond that (see §9.2).
- **Map basemap**: OpenStreetMap raster tiles via MapLibre GL JS.

---

## 6. Security Framework

### 6.1 Authentication & session

- JWT-based (`@nestjs/jwt` + `passport-jwt`), 24h expiry, signed with `JWT_SECRET`. `POST /auth/login` accepts `{email|mobileNumber, password}`, returns uniform `401` for wrong credentials/unknown identifier/malformed input (no user-enumeration signal). Passwords are bcrypt-hashed (`bcryptjs`); every response passes through a `toPublicUser()` transform that strips `passwordHash`.
- `GET /auth/me` looks the user up **fresh from the database on every call** rather than trusting the token payload alone, so a deleted account stops working immediately.
- Citizen self-registration + OTP: mobile OTP is delegated entirely to Fast2SMS's Smart OTP API (generate/store/verify all happen on Fast2SMS's side — this backend never stores an OTP code); email OTP is generated/bcrypt-hashed/checked locally (10-minute expiry, 5-attempt lockout), delivered via SMTP/`nodemailer`. Both notification services follow a consistent "unset config → 503 at call time" pattern — a failed send never fails the surrounding request, since the account/contact value is already saved regardless.
- `main.ts` **refuses to start** under `NODE_ENV=production` if `JWT_SECRET` is unset or still the public placeholder default — a real deployment can't accidentally ship the well-known dev secret.

### 6.2 Authorization (RBAC)

- `RolesGuard` (`auth/roles.guard.ts`) reads a `@Roles(...)` decorator's metadata via `Reflector` and checks it against the JWT-derived role — returning `false` from a `CanActivate` guard is Nest's own default `403`, distinct from `JwtAuthGuard`'s `401` for "not authenticated at all."
- Role model: `ADMIN`, 7 department officer roles (`LAND_RECORD_OFFICER`, `REGISTRATION_OFFICER`, `PLANNING_OFFICER`, `DISPUTE_OFFICER`, `TAX_OFFICER`, `RESTRICTION_OFFICER`, `ENCUMBRANCE_OFFICER`), and `CITIZEN` — a plain `varchar` column on `users`, not a separate `roles` table/FK.
- **Data-dependent authorization beyond a static role list**: `WorkflowsService.reviewStep()` compares the acting officer's role against that specific `WorkflowStep.assignedRole` — a `LAND_RECORD_OFFICER` gets a real `403` trying to decide a `REGISTRATION` step; `ADMIN` bypasses. Similarly, `GET /parcels/:id/ownership-history` and the document-file route check a citizen's actual `citizen_parcels` association before allowing access, not just their role.
- Citizen-facing content stays intentionally public where the data isn't personal (parcel search, Parcel 360, risk score); it's gated by role+ownership specifically where the data is personal (ownership history, stored documents) or requires an account context (raising a request, My Parcels).

### 6.3 Input & AI-output validation

- Global `ValidationPipe` + per-DTO `class-validator` decorators (§2) prevent malformed requests from reaching business logic.
- AI-output validation: every Groq/OpenRouter response is Zod-schema-validated before use — a response that fails validation is rejected (`502`), never silently trusted. `AiService.naturalLanguageQuery()` only ever builds a `TypeORM.find({ where })` clause from a fixed, closed set of known filter keys extracted by the LLM — there is no code path from an AI response to raw SQL or a write operation anywhere in the codebase; request routing similarly only ever selects from a closed set of real department codes, falling back to a deterministic default pipeline on any AI failure.
- **Governance alert state machine**: `GovernanceAlertsService.updateStatus`'s `VALID_TRANSITIONS` map rejects any out-of-order status PATCH server-side with `400` — enforced in the API, not just disabled in the UI.

### 6.4 Audit logging

A real `audit_logs` table records every state-mutating officer/admin action: logins, workflow step approve/reject, workflow status changes, governance-alert status changes, user create/role-change/delete, department create/update/delete. `GET /audit` (admin, filterable) and `GET /parcels/:id/audit` (staff) expose it; `features/admin/RecentActivity.tsx` surfaces it in the Admin Portal.

### 6.5 Other hardening

- File-upload limits: every multipart endpoint (change detection, document-identify, workflow evidence) caps images at 5MB and rejects non-image MIME types.
- Rate limiting: see §2.
- Secrets: `GROQ_API_KEY`, `JWT_SECRET`, SMTP/Fast2SMS credentials are read from environment only, never touch frontend code. No secrets are committed (`.env` is gitignored).
- Self-lockout prevention: an admin cannot change their own role or delete their own account.
- **What's still open**: a separate `roles` table with per-role descriptions (not needed at current scale); WCAG/screen-reader accessibility review (not done); HTTPS is a deployment-environment concern, not application code (§9).

---

## 7. UI/UX Guidelines

Design principles actually followed, checked against the real UI:

| Principle | Status | Evidence |
|---|---|---|
| Citizen-first design | Followed | Search-by-any-identifier, plain-language AI query box, Parcel 360's tabbed layout with an explicit "no data available" fallback per department rather than blank fields |
| GIS-first exploration | Followed | The map is not a secondary widget — `MapComponent` drives selection state itself and is reused unmodified across the Citizen Portal, Officer Portal, Parcel 360, and Historical Imagery |
| Progressive information disclosure | Followed | Parcel 360's tab structure (overview first, department detail behind a click); the map's layer-toggle panel defaults to only essential layers visible |
| Clear workflow/process status | Followed | Every workflow step shows a color-coded status badge consistently across citizen and officer views; governance alerts show an explicit 4-step progress stepper (Detected → Acknowledged → Field Verified → Resolved) with the current stage highlighted |
| Consistent design/terminology | Followed, with a shared component layer | Status-badge/stage-config/action-button logic for governance alerts is centralized in one shared module (`GovernanceAlertReasonPrompt.tsx`'s exports) consumed by both the list panel and detail modal, specifically to prevent visual/behavioral drift between them |
| Multilingual | Followed | Full English/Hindi coverage across all three portals (`i18next`/`react-i18next`, ~180+ translation keys for the Officer/Admin surface alone), language choice persisted in `localStorage`, live-switchable with no page reload |
| Responsive/mobile | Followed | A hamburger menu replaces nav links below the `md` breakpoint; layouts wrap rather than overflow; live-verified at a 375px viewport with no horizontal overflow |
| Accessibility (WCAG/screen-reader) | Not done | No formal accessibility review has been performed — a real gap, not a scored item that was intentionally skipped |

**Dark mode**: theme-aware throughout (`darkMode: 'class'` in `tailwind.config.js`), CSS-custom-property-backed semantic color tokens (§8) so components repaint for dark mode without needing a `dark:` variant on every element.

---

## 8. Color Schema

A deliberate earth-tone palette — Deep Earth Green (primary, land/governance/stability), Soil Brown (secondary, geography/land records), Saffron/Warm Gold (accent, alerts/action/governance indicators) — **is implemented**, via CSS custom properties (`index.css`) mapped into Tailwind theme tokens (`tailwind.config.js`), not raw Tailwind default-palette utility classes. Both a light and dark variant are defined for every semantic token, so the same component code repaints correctly in either mode with no per-component `dark:` overrides needed.

| Semantic token | Light mode | Dark mode | Source hue |
|---|---|---|---|
| `background` | `#f5f6f2` (paper) | `#0a1a13` (dark) | bhoomi-paper / bhoomi-dark |
| `surface` | `#ffffff` (white cards) | `#142f24` (card) | — / bhoomi-card |
| `ink` (text/borders) | `#0a1a13` | `#f5f6f2` | bhoomi-dark / bhoomi-paper |
| `primary` | `#1b4332` (forest) | `#52b788` (mint) | bhoomi-forest / bhoomi-mint |
| `primary-strong` | `#2d6a4f` (leaf) | `#40916c` (sprout) | bhoomi-leaf / bhoomi-sprout |
| `secondary` | `#935116` (clay) | `#c68b59` (sand) | bhoomi-clay / bhoomi-sand |
| `secondary-strong` | `#7c3f1d` (soil) | `#935116` (clay) | bhoomi-soil / bhoomi-clay |
| `accent` | `#e8963c` (gold) | `#e8963c` (gold, unchanged — already punchy) | bhoomi-gold |
| `muted` | `#e7e2d3` (warm parchment) | `#234e3b` (border) | — / bhoomi-border |

The full literal earth-tone scale (`bhoomi.dark/spruce/forest/card/border/leaf/sprout/mint/soil/clay/sand/gold/paper`) is also available directly in `tailwind.config.js` for one-off decorative accents (corner shapes, role badges) where a specific hue is wanted regardless of theme. Severity/status badges (governance-alert severity, workflow status) use additional ad hoc `green`/`yellow`/`orange`/`red` shades layered on top of this base palette, not derived from the single accent color — a deliberate exception, since a red/green semantic (danger/success) shouldn't be forced through an earth-tone lens. Typography: **Outfit** (display/body face) with **Noto Sans** as the same-stack fallback for Devanagari glyphs (so Hindi text in the same sentence as English resolves correctly with no locale branching in code), **IBM Plex Mono** for monospace. Shadows are hard, unblurred offsets (`hard-sm`/`hard-md`/`hard-lg`, 3-8px solid offset) colored by a `--shadow-color` token that itself flips between near-black and cream so shadows stay visible against a near-black dark-mode background.

---

## 9. Deployment and Scalability Considerations

### 9.1 Current state

- **`docker compose up --build` is live-verified** from a completely fresh Postgres volume: all 3 images build, all 3 containers start, `docker compose exec backend npm run seed` populates real demo data, and the API/frontend both serve correctly through their published ports.
- **`backend/Dockerfile`** — multi-stage: installs and builds in a `node:22-slim` stage with `python3`/`make`/`g++` available (a safety net in case `sqlite3`/`sharp`'s native bindings need to compile), then the final stage copies the already-resolved `node_modules` and `dist` across rather than running a second `npm install`. The compiled entry point is `dist/src/main.js` (Nest preserves the `src/` folder structure under `dist/` with no `nest-cli.json` override in this repo).
- **`frontend/Dockerfile`** — multi-stage: builds the Vite SPA, then serves the static output with `nginx`, with an SPA fallback (`try_files ... /index.html`) so client-side routes like `/parcels/:id` don't 404 on a hard refresh.
- **`docker-compose.yml`** — 3 services: `frontend` (nginx, published `5173:80`), `backend` (published `3000:3000`, `NODE_ENV=production`, reads `JWT_SECRET`/`GROQ_API_KEY`/`CORS_ORIGIN` from the host shell), `postgis` (image `postgis/postgis:15-3.3`, **no published port** — reached only over the internal Docker network by service name, so a default-credentialed database is never exposed to the internet). `VITE_API_URL` is baked in at build time as a host-reachable URL (`http://localhost:3000/api/v1`), not the internal Docker service hostname — the *browser*, not a container, is what actually calls it.
- **Database**: SQLite file-based storage in dev (`./data/dev.sqlite`), zero external setup required. The Postgres/PostGIS path (`USE_SQLITE=false` + `DB_*` env vars) has been exercised end-to-end against both a live Supabase Postgres+PostGIS instance and `docker-compose.yml`'s local PostGIS container. `synchronize: true` builds the entire schema from the TypeORM entities on backend startup — no hand-written SQL migration/setup script is needed on either path, the target database only needs the `postgis` extension available (both Supabase and the `postgis/postgis` image ship with it enabled).
- **Environment configuration**: `backend/.env.example` documents every variable the app reads (`USE_SQLITE`, `SQLITE_PATH`, `DB_HOST`/`PORT`/`USERNAME`/`PASSWORD`/`NAME`, `DB_SSL`, `PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`, `GROQ_API_KEY`, `GROQ_MODEL`, plus Fast2SMS/SMTP credentials for OTP delivery). No secrets are committed.

### 9.2 Scalability considerations (as designed, not yet exercised at production scale)

- **Modular services**: the module boundaries in §1.2 would translate reasonably directly into separate deployable services if that became necessary — most already avoid importing another module's repository directly, using the re-declare-the-entity pattern instead (§1.2).
- **API-based integration**: every department is already integration-tested as if it were external — no shared in-process shortcuts between department services and the aggregator beyond dependency injection, so swapping a mock department for a real external API later is a service-implementation change, not an architecture change.
- **Configurable state adapters**: adding a third state's land-record schema requires one new adapter function (§3), not a change to the canonical model or any consuming code — verified by construction (State A and State B already coexist this way).
- **Spatial indexing / GIS caching**: not implemented (§5) — the clearest concrete scale ceiling in the current build. Every spatial query is an in-memory or full-table scan; fine at ~220 seeded parcels, would need real indexing (a native PostGIS `geometry` column + GiST index, or an application-level R-tree) before growing meaningfully past that.
- **Background jobs / async processing**: not implemented — there is no background job runner or queue anywhere in the codebase; every computation (change-detection image diff, historical-imagery narrative generation, OCR) runs synchronously within the HTTP request that triggered it. A production deployment handling real upload volume would want these moved to a queue (e.g. BullMQ) rather than blocking a request thread.
- **Horizontal scaling**: the backend is stateless (JWT auth, no server-side session store) so running multiple backend instances behind a load balancer is architecturally straightforward; the one shared-state dependency is the database itself.

### 9.3 What a real public deployment would still need, in order

1. Spatial indexing (above) if parcel volume grows past prototype scale.
2. A background job queue for OCR/image-diff/narrative-generation endpoints, to keep request latency bounded under real load.
3. HTTPS termination (a hosting/reverse-proxy concern, not application code) and setting `CORS_ORIGIN` to the real deployed frontend origin(s).
4. Real OAuth-based authentication as an additional/alternative login method — the one item still open against the team's own original spec (`docs/FEATURE_AUDIT.md`); it needs a real OAuth app registered with an external provider, which only the deploying party can provision.
