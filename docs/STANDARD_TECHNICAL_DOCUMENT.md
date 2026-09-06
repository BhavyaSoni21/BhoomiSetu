# BhoomiSetu — Standard Technical Document

**System**: BhoomiSetu — a GIS-based, parcel-centric land governance and interoperability platform
**Document date**: 2026-09-05, reflecting the state of the codebase after Phase 9 of `docs/Plan.md`
**Status of this document**: this is an as-built technical reference, not a proposal. Every schema, endpoint, and architectural claim below was verified directly against the source code (`backend/src/**`, `frontend/src/**`) rather than transcribed from the team's earlier design notes (`Tech.md`, `BHOOMISETU.md`). Where the original design notes proposed something that was *not* built, or was built differently, that is stated explicitly rather than silently omitted — see `docs/FEATURE_AUDIT.md` for the full gap analysis this document is scoped to close.

---

## 1. System Architecture

### 1.1 High-level shape

```
                    ┌────────────────────┐
                    │   React Frontend    │   (Vite dev server :5173)
                    │  Citizen / Officer  │
                    │   / Admin Portals   │
                    └──────────┬──────────┘
                               │ REST (axios, JSON + one multipart route)
                               ▼
                    ┌────────────────────┐
                    │   NestJS Backend    │   (:3000, prefix /api/v1)
                    │  20 controllers,    │
                    │  19 TypeORM entities│
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
          ┌───────────┐ ┌───────────┐ ┌──────────────┐
          │  SQLite    │ │ Groq API  │ │ Postgres +   │
          │ (dev, file)│ │ (external,│ │ PostGIS      │
          │            │ │ optional) │ │ (prod path,  │
          │            │ │           │ │ e.g. Supabase)│
          └───────────┘ └───────────┘ └──────────────┘
```

There is **one backend process**, not a microservices mesh. Every "department" (Land Records, Registration, Planning, Tax, Restriction, Dispute), the AI layer, the change-detection pipeline, and the interoperability/aggregation layer are all NestJS modules inside the same application, communicating via in-process service injection — not network calls between separate services. This is a deliberate simplification from the originally-sketched `docker-compose.yml` (which lists `land-records-api`, `registration-api`, `planning-api`, `tax-api`, `restriction-api`, `ai-service` as if they were separate containers); every one of those actually builds from the same `./backend` image today. The only genuinely external network dependency is the Groq API for the three AI endpoints, and it is called *only* from the backend, never from the browser.

### 1.2 Backend module inventory

`backend/src/` contains 17 top-level directories. `auth/`, `users/`, and `audit/` were all empty `@Module({})` stubs before 2026-09-05 and are now real (§6.1, §8 items 9, 10, 11) - none remain.

| Module | Owns these tables | Depends on (feature-module imports) |
|---|---|---|
| `GisModule` | (reads `parcels`) | — |
| `SpatialModule` | `zoning_overlays`, `restriction_zones`, `infrastructure_features`, `change_detection_events` | — |
| `LandRecordsModule` | `state_a_land_records`, `state_b_land_records` | — |
| `DepartmentsModule` | `registration_records`, `planning_records`, `tax_records`, `restriction_records`, `dispute_records` (reads `parcels`, `parcel_identifiers`, state A/B tables) | — |
| `ParcelsModule` | `parcels`, `parcel_identifiers`, `parcel_neighbours` | `InteroperabilityModule`, `WorkflowsModule`, `PredictiveAnalyticsModule` |
| `InteroperabilityModule` | (reads `parcels`, `parcel_identifiers`) | `DepartmentsModule` |
| `WorkflowsModule` | `workflows`, `workflow_steps` (reads `parcels`) | — |
| `GovernanceModule` | `governance_alerts` | — |
| `AiModule` | (reads `parcels` + all department tables) | `InteroperabilityModule`, `GovernanceModule` |
| `ChangeDetectionModule` | (reads `parcels`; writes `change_detection_events`, `governance_alerts`) | — |
| `AnalyticsModule` | (reads `parcels`, tax/registration/planning/dispute/workflow/alert tables) | — |
| `PredictiveAnalyticsModule` | (reads `parcels`, tax/dispute/restriction/alert tables) | — |
| `UsersModule` | `users` | `AuditModule` |
| `AuthModule` | (reads `users`) | `UsersModule`, `AuditModule` |
| `AuditModule` | `audit_logs` | — |

**Dependency-cycle avoidance pattern** (applied consistently, not ad hoc): a module that needs to *read* another module's table registers its own `TypeOrmModule.forFeature([...])` for that entity directly, instead of importing the module that owns it. This is why, for example, `ChangeDetectionModule` re-declares `Parcel`/`ChangeDetectionEvent`/`GovernanceAlert` rather than importing `SpatialModule`/`GovernanceModule`, and why `WorkflowsModule` re-declares `Parcel` rather than importing `ParcelsModule` — which is precisely what lets `ParcelsModule` import `WorkflowsModule` back without creating a cycle. No circular imports exist among feature modules as currently wired.

### 1.3 Frontend architecture

React 18 + Vite, client-side routed (`react-router-dom` v6), no server-side rendering. Structure under `frontend/src/`:

```
frontend/src/
├── features/
│   ├── admin/           UserManagement, RecentActivity (real as of 2026-09-05 - see §8 item 11; previously an empty Phase-1 scaffold directory)
│   ├── ai/            AiParcelSearch, AiExplanationCard (shared across 3 touchpoints)
│   ├── analytics/       AnalyticsDashboard, TopRiskParcels
│   ├── auth/            auth.ts (useAuthUser/useLogin/useLogout, React-Query-backed), RequireAuth
│   ├── change-detection/  ChangeDetectionPanel
│   ├── map/            MapComponent (11 source/layer pairs, one shared component)
│   ├── officer/         WorkflowReviewPanel, GovernanceAlertsPanel, officerAuth (role/label lookups only - session state moved to features/auth)
│   └── parcels/         ParcelSearch, Parcel360View, ServiceRequestForm, RequestNotifications (citizen notification MVP, §8 item 12)
├── pages/                CitizenPortal, OfficerPortal, AdminPortal, LoginPage (real sign-in as of 2026-09-05)
├── services/apiService.ts   one shared axios instance; its JWT interceptor is real now (was dead code before 2026-09-05 - see §6.1)
├── types/                12 files, one per API response shape
└── test/setup.ts
```

`components/`, `features/workflow/`, `hooks/`, and `store/` remain empty directories — Phase-1 scaffolding for `zustand`/shared-hooks/shared-components patterns that were never needed, since state has stayed local to each feature via React Query + `useState`. `features/admin/` was the same kind of empty scaffold until 2026-09-05, when it became the real home for Admin Portal's user-management UI. `zustand` and `react-hook-form` remain installed dependencies with zero usages in the codebase.

**Routes** (`App.tsx`): `/` and `/citizen` → Citizen Portal (no login - anonymous by design, see §6.1); `/officer` and `/admin` → wrapped in `RequireAuth` (real JWT session check + role check, redirects to `/login` otherwise, as of 2026-09-05 - see §6.1); `/officer` → Officer Portal (real governance-alert/workflow-review dashboard); `/admin` → Admin Portal (real governance analytics, top-at-risk-parcels, user management, and an audit-trail feed, all as of 2026-09-05 - see §8 items 3, 8, 11); `/login` → the real sign-in page for Officer + Admin; `/parcels/search`, `/parcels/:id`, `/map` → standalone versions of components also embedded elsewhere.

### 1.4 Data flow example — Parcel 360

Illustrates the layering used throughout: `ParcelsController` (`GET /parcels/:id/360`) → `ResponseAggregatorService.buildParcel360()` → calls `LandRecordsLookupService`, `RegistrationService`, `PlanningService`, `TaxService`, `RestrictionService`, `DisputeService` in parallel (`Promise.all`) → the Land Records result is passed through `adaptLandRecordsResult()` (State A/B adapter) → everything is merged via `buildCanonicalEnvelope()` into the Tech.md-specified canonical shape (`parcel_id`, `identifiers`, `location`, `spatial`, `sources`) plus a `departments` object carrying the real per-department payloads. This same aggregator is reused by `AiController`'s parcel-explanation endpoint.

---

## 2. API Standards

- **Style**: REST over HTTP/JSON, one exception (multipart/form-data for `POST /change-detection/analyze`, which accepts image files).
- **Base path**: every route is prefixed `/api/v1` (`app.setGlobalPrefix('api/v1')` in `main.ts`). The prefix is not currently used for actual version negotiation — there is no `/api/v2`; it exists as a forward-compatible convention.
- **Documentation**: Swagger/OpenAPI is live at `GET /api` (`SwaggerModule.setup('api', app, ...)`), auto-generated from controllers/DTOs. No controller currently carries explicit `@ApiOperation`/`@ApiBody` annotations, so Swagger's rendering is schema-accurate but not narratively documented; the multipart change-detection endpoint in particular renders its file fields as plain text inputs in the Swagger UI rather than file pickers, since `@ApiConsumes`/`@ApiBody({schema: ...})` was never added.
- **Request validation**: a single global `ValidationPipe({ whitelist: true, transform: true })` (`main.ts`) — every DTO is `class-validator`-decorated; unknown body fields are silently stripped (`whitelist: true`), and query/body values are coerced to their declared types (`transform: true`).
- **Response shape**: no custom global exception filter exists. NestJS's built-in exceptions produce a consistent envelope in practice — `{ statusCode, message, error }` — but this is Nest's default behavior, not a project-authored standard, and nothing formalizes it as a contract new endpoints must follow.
- **Status code conventions actually followed**: `200` (read), `201` (create), `204` (delete), `400` (validation failure / malformed input), `401` (missing/invalid/expired token), `403` (valid token, wrong role — `RolesGuard`'s default, §6), `404` (valid ID, no matching row), `502` (an AI response failed Zod validation — see §7), `503` (AI endpoints when `GROQ_API_KEY` is unset). Every path parameter that represents an entity ID is validated with `ParseUUIDPipe`, so a malformed (non-UUID) ID reliably 400s before any handler logic runs.
- **Authentication headers**: checked on every officer/admin-only route as of 2026-09-05 (§6 — `JwtAuthGuard` + `RolesGuard`), not just `/auth/me`. Citizen-facing routes still ignore the `Authorization` header entirely, by design. `frontend/src/services/apiService.ts`'s request interceptor attaches a bearer token from `localStorage` (real now, was dead code before 2026-09-05), and its response interceptor redirects to `/login` on a `401` from anything *other than* `/auth/login` itself — that carve-out was added after a live check caught it hard-redirecting on a failed login attempt too, wiping the page before the "Invalid email or password" message could render.
- **CORS**: unrestricted (`app.enableCors()` with no options) — acceptable for a local prototype, not for any real deployment.

### 2.1 Full endpoint inventory

63 routes across 20 controllers. Grouped by area; full request/response shape for each is in the corresponding controller/DTO under `backend/src/`. **Auth** column reflects §8 items 5/9/10/11/13 (2026-09-05): Public = no guard at all; Staff = `JwtAuthGuard`+`RolesGuard`, any officer role or ADMIN; Admin = same guards, ADMIN only.

| Area | Base path | Verbs available | Auth |
|---|---|---|---|
| Auth | `/auth` | `POST /login` (public), `GET /me` (any authenticated user) | Mixed |
| Users | `/users` | `GET`, `POST`, `PATCH /:id/role`, `DELETE /:id` — real user/role management (§8 item 11); an admin can't change their own role or delete their own account | Admin |
| Audit | `/audit` | `GET` (filterable by `entityType`/`userId`) | Admin |
| Parcels | `/parcels` | `GET` (search), `GET /:id`, `GET /:id/geometry`, `GET /:id/neighbours`, `GET /:id/context`, `GET /:id/workflows`, `GET /:id/360`, `GET /:id/risk-score` (all public); `GET /:id/audit` (§8 item 10) | Mixed |
| GIS (map tiles) | `/gis` | `GET /parcels`, `GET /parcel-at-location`, `GET /parcels/:id/geometry`, `GET /parcels/:id/restrictions` | Public |
| GIS (spatial demo layers) | `/gis` | `GET` for zoning-overlays/restriction-zones/infrastructure/change-detection-events (public); `POST`/`PATCH`/`DELETE` for zoning-overlays, restriction-zones, and infrastructure (§8 item 13 - change-detection-events stays read-only, created only via `/change-detection/analyze`) | Mixed |
| State land record schemas | `/state-a/land-records`, `/state-b/land-records` | Full CRUD (`POST`/`GET`/`GET :id`/`PATCH :id`/`DELETE :id`) on each | Public (mock external-state APIs, never called by the frontend directly - see §6.1) |
| Mock departments | `/land-records`, `/registration`, `/planning`, `/tax`, `/restriction`, `/dispute` | `GET /:parcelId` on each | Public (same reasoning as above) |
| Workflows | `/workflows` | `POST` (public - citizen request); `GET`, `GET /:id`, `PATCH /:id/status`, `PATCH /:workflowId/steps/:stepId` (Staff, plus per-department enforcement on the last two - see §6.1) | Mixed |
| Governance alerts | `/governance-alerts` | `GET`, `GET /:id`, `PATCH /:id/status` | Staff |
| AI (Groq) | `/ai` | `POST /query`, `POST /parcels/:parcelId/explain` (both public); `POST /alerts/:alertId/explain` (Staff) | Mixed |
| Change detection | `/change-detection` | `POST /analyze` (multipart) | Staff |
| Analytics | `/analytics` | `GET /summary` (now includes `totalUsers`/`recentLogins24h` - §8 item 11) | Admin |
| Predictive analytics | `/predictive-analytics` | `GET /top-risk-parcels` | Admin |

Note: `GisController` and `SpatialController` are two separate modules that both mount under `/gis` — they don't collide (disjoint sub-paths) but this means "the GIS module" isn't a single file to look at; it's two.

---

## 3. Interoperability Standards

The interoperability layer (`backend/src/interoperability/`) exists specifically to reconcile the fact that different "state" land-record schemas use different field names, units, and identifier conventions — the actual challenge a real Land Stack has to solve.

- **Canonical Data Model**: `buildCanonicalEnvelope()` (`canonical-transformer.ts`) produces one fixed shape regardless of source state:
  ```json
  {
    "parcel_id": "uuid",
    "identifiers": { "ulpin": "string|null", "survey_number": "string|null", "plot_number": "string|null", "local_identifier": "string|null" },
    "location": { "state": "string", "district": "string", "locality": "string" },
    "spatial": { "area_sq_m": "number", "geometry": {} },
    "sources": [{ "department": "string", "status": "AVAILABLE|NOT_AVAILABLE" }]
  }
  ```
  This is the one place in the codebase that deliberately uses `snake_case` keys — every other API response is `camelCase` (TypeORM/JS convention) — because this specific shape is a fixed external contract that predates the implementation, not an internal detail free to follow house style.
- **Identifier resolution**: `IdentifierResolverService` maps *any* known identifier (canonical UUID, ULPIN, survey number, plot number, local identifier) to the canonical parcel, and the reverse (canonical parcel → the identifier value a specific department would recognize it by). Backward resolution order: canonical ID → ULPIN → `parcel_identifiers` lookup.
- **State adapters**: `land-record-adapters.ts` implements the exact unit/field conversion between the two mock state schemas and the canonical model — State A's `area_hectares` × 10,000 → `area_sq_m`; State B's `land_extent_sqft` ÷ 10.7639 → `area_sq_m`. New states are added by writing one more adapter function, not by changing the canonical model or any consuming code.
- **Response aggregation**: `ResponseAggregatorService` calls every department service in parallel and merges results — the design principle followed throughout is *"standardize interoperability without forcing every source system to become identical"*: the department services still return their own native shapes in the `departments` object; only the top-level envelope is canonicalized.
- **What is *not* implemented**: schema versioning/metadata tagging, a formal API contract/OpenAPI-per-department-schema publishing mechanism, and validation of inbound third-party payloads (moot today since every "department" is this team's own mock, not a real external system).

---

## 4. Data Schemas

The authoritative schema is the TypeORM entity source under `backend/src/**/*.entity.ts` — **19 entities**, listed here exactly as declared (field name, type, notable constraints). This intentionally does not match `Tech.md`'s originally-proposed `snake_case` schema; TypeORM's project convention is `camelCase` field names mapped to the DB, and several tables here (`clusterId` on `Parcel`, the entire `parcel_neighbours` table) didn't exist in the original design at all — added because the spatial/cluster features that consume them didn't exist yet when `Tech.md` was written. `Tech.md`'s `users` and `audit_logs` tables now exist (added 2026-09-05, §8 items 9 and 10); `roles` does not (see "Not yet built" below).

### Core parcel model
- **`Parcel`** (`parcels`) — `id` (uuid PK), `canonicalParcelId`, `clusterId`, `ulpin` (all nullable varchar), `stateCode` (varchar 10), `districtCode` (varchar 20), `localBodyCode` (varchar 20), `geometry` (text, GeoJSON), `areaSqM` (decimal 15,2), `createdAt`/`updatedAt`. Indexed on `[stateCode, districtCode]`, `[canonicalParcelId]`, `[ulpin]`, `[clusterId]`.
- **`ParcelIdentifier`** (`parcel_identifiers`) — `id`, `identifierType`, `identifierValue`, `sourceState`, `sourceDepartment`; `@ManyToOne` to `Parcel` with `onDelete: CASCADE`.
- **`ParcelNeighbour`** (`parcel_neighbours`) — `id`, `parcelId`, `neighbourParcelId`, `relationshipType` (`TOUCHING`|`NEARBY`) — plain string FKs, not a TypeORM relation, populated at seed time from known grid adjacency rather than computed per-request.

### Spatial demo layers (zoning/restriction/infrastructure: read + write as of 2026-09-05, §8 item 13)
- **`ZoningOverlay`** (`zoning_overlays`) — `zoneType` (`RESIDENTIAL`|`COMMERCIAL`|`AGRICULTURAL`), `parcelIds` (`simple-array`).
- **`RestrictionZone`** (`restriction_zones`) — `restrictionType` (`FLOOD`|`ENVIRONMENTAL`|`PROTECTED_AREA`), `affectedParcelIds`.
- **`InfrastructureFeature`** (`infrastructure_features`) — `featureType` (`ROAD`|`WATER_LINE`|`ELECTRICITY`).
- **`ChangeDetectionEvent`** (`change_detection_events`) — `description`, `geometry`, `affectedParcelIds`, `detectedAt`. Stays read-only through `/gis` - written only at seed time (one simulated event) or live by `POST /change-detection/analyze`, never through a direct write endpoint.

### Mock state land-record schemas (Tech.md #12/#13 — deliberately incompatible with each other by design)
- **`StateALandRecord`** (`state_a_land_records`, PK field named `recordId`, not `id`) — `surveyNumber`, `subdivisionNumber`, `ownerName`, `villageCode`, `areaHectares` (decimal 10,4), `recordStatus`.
- **`StateBLandRecord`** (`state_b_land_records`, PK also `recordId`) — `plotId`, `holderName`, `localityId`, `landExtentSqft` (decimal 12,2), `recordCategory`. Neither table has a foreign key to `Parcel` — resolution is by identifier value only, via the interoperability layer (§3).

### Mock department records (all keyed by a plain `parcelId` string column, not a relation — "independent department system" framing)
- **`RegistrationRecord`** — `registrationStatus` (`REGISTERED`|`PENDING`|`NOT_REGISTERED`), `registrationNumber`, `registrationDate`, `lastTransactionType` (`SALE`|`GIFT`|`INHERITANCE`|`PARTITION`), `lastTransactionDate`.
- **`PlanningRecord`** — `landUse` (`RESIDENTIAL`|`COMMERCIAL`|`AGRICULTURAL`|`MIXED_USE`), `zoningClassification`, `masterPlanReference`, `buildingPermissionStatus`.
- **`TaxRecord`** — `assessedValue` (decimal 14,2), `annualTaxAmount`, `taxStatus` (`PAID`|`PENDING`|`OVERDUE`), `outstandingAmount`, `lastPaymentDate`.
- **`RestrictionRecord`** — `hasRestriction` (boolean), `restrictionType` (`ENVIRONMENTAL`|`PROTECTED_AREA`|`FLOOD_PRONE`), `restrictionDetails`, `imposingAuthority`.
- **`DisputeRecord`** — `hasActiveDispute` (boolean), `disputeType` (`OWNERSHIP`|`BOUNDARY`|`INHERITANCE`|`ENCROACHMENT`), `caseStatus` (`FILED`|`UNDER_REVIEW`|`RESOLVED`|`DISMISSED`), `filingDate`, `resolutionDate`, `resolutionSummary`. Added 2026-09-05 to close the SIH problem statement's own required workflow list ("land records, registration, dispute, planning, and fiscal") — see `docs/FEATURE_AUDIT.md`.

### Workflow & governance schemas (Tech.md #24/#34)
- **`Workflow`** (`workflows`) — `parcelId`, `workflowType` (free-form string, not an enum — e.g. `ROR_COPY_REQUEST`, `CORRECTION_REQUEST`), `currentStatus` (default `SUBMITTED`), `createdBy`, `requestDetails`, `lastRemarks`.
- **`WorkflowStep`** (`workflow_steps`) — `stepOrder`, `department` (`LAND_RECORDS`|`REGISTRATION`|`PLANNING`|`DISPUTE`), `assignedRole`, `status` (default `PENDING`), `action`, `remarks`, `completedAt`. `@ManyToOne` to `Workflow`, `onDelete: CASCADE`. The 3-stage `LAND_RECORDS → REGISTRATION → PLANNING` pipeline is the default for every `workflowType` except `DISPUTE_FILING`, which gets a single `DISPUTE`/`DISPUTE_OFFICER` step instead (`PIPELINES_BY_TYPE` in `workflows.service.ts`).
- **`GovernanceAlert`** (`governance_alerts`) — `parcelId`, `alertType` (`RESTRICTION_ZONE_OVERLAP`|`UNAUTHORIZED_CHANGE_DETECTED`|`TAX_OVERDUE`), `severity` (`LOW`|`MEDIUM`|`HIGH`|`CRITICAL`), `source` (`RESTRICTION_MONITOR`|`CHANGE_DETECTION`|`TAX_MONITOR`), `status` (default `OPEN`), `explanation`.

### Auth schema (Tech.md §7.1, added 2026-09-05 — §8 item 9)
- **`User`** (`users`) — `id` (uuid PK), `email` (varchar, unique index), `passwordHash` (varchar, bcrypt), `name` (varchar), `role` (varchar 30 — `ADMIN`|`LAND_RECORD_OFFICER`|`REGISTRATION_OFFICER`|`PLANNING_OFFICER`|`DISPUTE_OFFICER`, not a separate `roles` table/FK, matching this codebase's existing plain-varchar-enum convention), `createdAt`. `createdBy` on `Workflow` remains a free-text string, not a foreign key to `users` — a deliberate, permanent choice rather than a punted TODO: workflow *creation* is the citizen service-request flow, which stays anonymous by design (§6.1), so there is no user identity to reference there even now that RBAC (§8 item 5) exists.

### Audit schema (Tech.md §27, added 2026-09-05 — §8 item 10)
- **`AuditLog`** (`audit_logs`) — `id` (uuid PK), `userId`, `userRole` (varchar 30), `action` (varchar 60 — e.g. `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`, `USER_ROLE_CHANGED`), `entityType` (varchar 40 — `USER`|`WORKFLOW`|`WORKFLOW_STEP`|`GOVERNANCE_ALERT`), `entityId` (nullable), `parcelId` (nullable — a pragmatic addition beyond Tech.md's proposed columns, indexed so `GET /parcels/:id/audit` doesn't need to parse every row's `metadata`), `metadata` (text, JSON-serialized), `createdAt`. Indexed on `[entityType, entityId]` and `[parcelId]`.

### Not yet built
`roles` — a separate table with per-role descriptions, `Tech.md`'s proposal; a plain `varchar` column on `users` already serves every real need this codebase has.

---

## 5. GIS Standards

- **Geometry format**: GeoJSON throughout — every `geometry` column is stored as `text` (a JSON-encoded string) rather than a native geometry type. This is deliberately unchanged even now that real PostGIS is wired up (see below): migrating to a native `geometry` column would mean rewriting every existing `JSON.parse(row.geometry)` consumer across the codebase, which is out of the PostGIS backlog item's actual scope (it asked for the spatial *queries* to become real, not the storage schema).
- **Two spatial code paths, chosen automatically at connection time**: SQLite (the default dev database) has no spatial extension, so it uses a hand-implemented plain-TypeScript path (`backend/src/common/geo-utils.ts`) for point-in-polygon, polygon-to-polygon distance, centroid, and ring intersection. When connected to a real Postgres+PostGIS instance (`USE_SQLITE=false` — live-verified 2026-09-06 against a Supabase-hosted instance, see `docs/FEATURE_AUDIT.md` §8 item 14), the same 4 call sites instead run real parameterized `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid`/`ST_MakeEnvelope`/`ST_GeomFromGeoJSON` queries. A shared `isPostgisAvailable()` helper (checking the actual connected TypeORM driver, not env vars) decides which path runs; the SQLite path is untouched and still covered by all 211 backend e2e tests.
- **Coordinate system**: WGS84 (`EPSG:4326`, plain lng/lat), matching GeoJSON's implicit CRS. Local distance math uses an equirectangular approximation centered on the reference latitude (`metersPerDegree()` in `geo-utils.ts`) — accurate for parcels a few hundred metres apart, not for anything continental in scale.
- **Layering model** (as actually built in `MapComponent.tsx` — 11 MapLibre source/layer pairs on one shared component): base search-result parcels (colored by state) → same-district fill → cluster fill (a selected parcel's whole connected network) → nearby outline → adjacent outline → selected outline → 4 toggleable overlay layers (zoning, restriction, infrastructure as line+point, change-detection). Selected/adjacent/nearby/cluster default visible; district and overlay layers default hidden. This matches BHOOMISETU.md §41's proposed `BASE LAYER → ESSENTIAL GOVERNANCE LAYER → ADDITIONAL LAYERS` structure conceptually, though the actual layer list is more granular than that three-tier description.
- **Parcel topology**: parcels within a seeded cluster are generated from one shared coordinate lattice (a jittered grid of corner points, one jittered midpoint per shared edge, both reused by every parcel touching them) so that adjacent parcels share the literal same boundary coordinates — a genuinely connected cadastral network, not independently-generated polygons that happen to sit near each other.
- **Spatial indexing**: still none, even on the Postgres/PostGIS path — since `geometry` stays a `text` column (see above), every `ST_*` call parses GeoJSON on the fly per row rather than reading a native, indexable `geometry` column, so a GiST spatial index isn't applicable without that storage migration. No application-level spatial index like an R-tree/quadtree exists either — every spatial query scans the full parcel set, acceptable at ~200 seeded parcels, not at scale.
- **Map basemap**: OpenStreetMap raster tiles via MapLibre GL JS, no attribution/licensing issue at prototype scale.

---

## 6. Security Framework

**Current state (updated 2026-09-05): authentication, authorization, and audit logging all exist.** `POST /auth/login`/`GET /auth/me` are real and JWT-backed (§8 item 9); every officer/admin-only route in §2.1 is now also behind a real server-side role check (§8 item 5); every officer/admin decision is recorded to a real audit trail (§8 item 10). Citizen-facing routes (parcel search/360/risk-score, AI query and parcel-explanation, workflow creation) are deliberately still public — that's the actual UX boundary the app has always had, not a gap. §6.2 lists what's left of `Tech.md`'s Phase 10 framework.

### 6.1 What exists today

- Input validation: global `ValidationPipe` + per-DTO `class-validator` decorators (§2) — this *is* real and does prevent malformed requests from reaching business logic.
- AI-output validation: Zod schemas (`query-intent.schema.ts`, `ai-explanation.schema.ts`) validate whatever Groq returns before it's trusted — a response that fails validation is rejected (`502`), never silently passed through. This is the one place `Tech.md`'s "Zod validation" architecture note is actually implemented; it is not used for general request validation (`class-validator` handles that).
- Secrets: `GROQ_API_KEY` is read from environment only, never touches frontend code, matching Tech.md §28's explicit rule. `JWT_SECRET` is now actively read (`backend/src/auth/jwt.constants.ts`) to sign and verify login tokens, falling back to the same placeholder default `docker-compose.yml` already used (`change_this_in_production`) when unset.
- File-upload limits: the one multipart endpoint (`change-detection/analyze`) caps each image at 5MB and rejects non-image MIME types.
- Rate limiting (added 2026-09-05): `@nestjs/throttler`, applied globally via `APP_GUARD` in `AppModule` — 200 requests/minute/IP by default (`X-RateLimit-*` response headers included), with a tighter 30 requests/minute override (`@Throttle`) on `AiController` and `ChangeDetectionController` specifically, since those cost a real Groq API call / real CPU-bound image processing per request.
- **Real authentication (added 2026-09-05, §8 item 9)**: a `users` table (`id`, `email` [unique], `password_hash`, `name`, `role`, `created_at`) seeded with 5 demo accounts (1 admin + 1 per officer role, password `Demo@123`). `POST /auth/login` verifies the password with `bcrypt.compare` and, on success, signs a JWT (`@nestjs/jwt`, 24h expiry) carrying `{sub, email, role}`. `GET /auth/me` (behind `JwtAuthGuard`, a `passport-jwt` strategy) looks the user up **fresh from the database on every call** rather than trusting the token payload alone, so a deleted account stops working immediately rather than only once its token happens to expire. Both endpoints uniformly return `401` for a wrong password *and* an unknown email (no user-enumeration signal). Passwords are never returned in any response body — every handler goes through `AuthService.toPublicUser()`, which strips `password_hash`.
- Role model actually built: `ADMIN`, `LAND_RECORD_OFFICER`, `REGISTRATION_OFFICER`, `PLANNING_OFFICER`, `DISPUTE_OFFICER` (a plain `varchar` column on `users`, not a separate `roles` table/foreign key — matching this codebase's existing convention of plain-varchar "enums" elsewhere, e.g. `TaxRecord.taxStatus`). No `CITIZEN` role exists: the Citizen Portal was never account-based (search and service requests are anonymous) and stays that way — there was no citizen session to migrate. `DISPUTE_OFFICER` is a fix made alongside the authentication work: the dispute workflow pipeline (`workflows.service.ts`, §8 item 2) already assigned steps to it, but no officer role of that name was ever selectable at login, so a filed dispute had no one able to review it.
- **RBAC route guards (added 2026-09-05, §8 item 5)**: a `RolesGuard` (`backend/src/auth/roles.guard.ts`) reads a `@Roles(...)` decorator's metadata via `Reflector` and checks it against `req.user.role` (populated by `JwtAuthGuard`, which always runs first — `@UseGuards(JwtAuthGuard, RolesGuard)`); returning `false` from a `CanActivate` guard is Nest's own default `403`, distinct from `JwtAuthGuard`'s `401` for "not authenticated at all". Applied per-route where a controller mixes public and staff-only endpoints (`WorkflowsController`, `AiController`), or at the controller class level where every route is uniformly staff-only (`GovernanceAlertsController`, `ChangeDetectionController`) or admin-only (`AnalyticsController`, `PredictiveAnalyticsController`). `POST /workflows` (citizen service-request creation) and the citizen-facing AI/parcel routes stay unguarded by design — see the "Auth" column added to the endpoint table in §2.1.
- **Per-department enforcement on workflow step review**: `WorkflowsService.reviewStep()` now takes the acting user's role and compares it against that specific `WorkflowStep.assignedRole` — a `LAND_RECORD_OFFICER` gets a real `403` (`'FORBIDDEN_WRONG_DEPARTMENT'`) trying to decide a `REGISTRATION` step, and `GET /workflows`'s `department` query param is silently overridden to the caller's own department for any non-`ADMIN` role (an officer can't browse another department's queue by editing the query string). `ADMIN` bypasses both restrictions — can decide any step, can query any/no department filter. This is finer-grained than the role-list check `RolesGuard` does, since the correct role is data-dependent (which department a given step belongs to), not statically knowable from the route decorator alone.
- Live-verified end to end: curl across no-token (`401`), wrong-role (`403`), and correct-role (`200`) for `/analytics/summary` and `/governance-alerts`; Playwright driving the real UI as both a `LAND_RECORD_OFFICER` and the previously-broken `DISPUTE_OFFICER` (login → dashboard loads real workflows/alerts → approve a step) with zero console errors and zero failed API requests. 14 new backend e2e tests cover the guard/department-matching logic directly, including the `403` case.
- **Audit logging (added 2026-09-05, §8 item 10)**: a real `audit_logs` table (`id`, `user_id`, `user_role`, `action`, `entity_type`, `entity_id`, `parcel_id`, `metadata`, `created_at` — `parcel_id` is a pragmatic addition beyond Tech.md's proposed columns, letting `GET /parcels/:id/audit` index straight to it rather than parsing every row's `metadata` JSON). `AuditService.log()` is called from `AuthController` (`AUTH_LOGIN`), `WorkflowsController` (`WORKFLOW_STEP_APPROVED`/`REJECTED` with department+remarks, `WORKFLOW_STATUS_CHANGED`), and `GovernanceAlertsController` (`GOVERNANCE_ALERT_STATUS_CHANGED`) — every state-mutating officer/admin action RBAC (§8 item 5) now gates. `GET /audit` (admin, filterable by `entityType`/`userId`) and `GET /parcels/:id/audit` (staff) expose it; live-verified against the real running app.
- **User/role management (added 2026-09-05, §8 item 11)**: `UsersController` (`GET`/`POST /users`, `PATCH /users/:id/role`, `DELETE /users/:id`, all admin-only) is real CRUD over the `users` table introduced by item 9, each mutation itself audit-logged (`USER_CREATED`/`USER_ROLE_CHANGED`/`USER_DELETED`). An admin cannot change their own role or delete their own account (`400`) — a deliberate self-lockout guard, not an oversight. `GET /analytics/summary` was extended with `totalUsers` (a real count) and `recentLogins24h` (a count of `AUTH_LOGIN` audit entries in the last 24h — an honest proxy for activity, not a claim of tracking concurrent sessions, which JWTs structurally can't do without a session store this project doesn't have).

### 6.2 What Tech.md specifies for Phase 10 that's still not built

- A separate `roles` table with per-role descriptions — Tech.md's proposal; not built, since a plain `varchar` role column already serves every real need this codebase has today (see 6.1).
- HTTPS in deployment — moot until any deployment exists (§9).

### 6.3 AI-specific security rules (implemented as designed, not aspirational)

Per Tech.md §32, the AI service must never modify data, approve transactions, or execute arbitrary SQL — and it structurally cannot: `AiService.naturalLanguageQuery()` only ever builds a `TypeORM.find({ where })` clause from a Zod-validated, fixed set of six known filter keys (`state`, `district`, `tax_status`, `has_restriction`, `land_use`, `registration_status`); there is no code path from an AI response to a write operation anywhere in the codebase.

---

## 7. UI/UX Guidelines

BHOOMISETU.md §42 proposes five principles: citizen-first design, GIS-first exploration, progressive information disclosure, clear workflow status, and consistent design/terminology. These were never formalized into a checked design review during any of the 9 build phases; the assessment below is a retroactive check against the actual UI.

| Principle | Followed? | Evidence |
|---|---|---|
| Citizen-first design | Mostly | Search-by-any-identifier, plain-language AI query box, Parcel 360's tabbed layout with a "no data available" fallback per department rather than blank fields |
| GIS-first exploration | Yes | The map is not a secondary widget — `MapComponent` drives selection state itself (clickable parcels feed back into the parent page) and is reused, unmodified, across the Citizen Portal, Parcel 360, and the bare `/map` route |
| Progressive information | Yes | Parcel 360's tab structure (Overview first, department detail behind a click); the map's layer-toggle panel defaults to only the essential layers visible |
| Clear workflow status | Yes | Every workflow step shows a color-coded status badge (`PENDING`/`APPROVED`/`REJECTED`/`IN_PROGRESS`) consistently across the citizen-facing confirmation panel and the officer review panel |
| Consistent design/terminology | Partial | Component-level Tailwind utility classes are repeated rather than extracted into a shared design-token/component library — the same badge/button patterns are hand-copied across `WorkflowReviewPanel`, `GovernanceAlertsPanel`, and `ServiceRequestForm` rather than sharing one component, so visual drift between them is possible over time even though none has occurred yet |

**A responsive/mobile breakpoint pass is done** (2026-09-05, `docs/FEATURE_AUDIT.md` §8 item 7): a hamburger menu now replaces the nav links that previously just vanished below the `md` breakpoint with no mobile alternative (Officer/Admin portals were unreachable by UI on a phone), and the Parcel 360 "Actions" button row wraps instead of overflowing; everything else audited was already responsive via Tailwind's mobile-first grid classes. Live-verified at a 375px viewport with Playwright — no console errors, no horizontal overflow. No accessibility (WCAG/screen-reader) review has been done — that remains a §7 not-mentioned-anywhere gap, not a scored backlog item.

---

## 8. Color Schema

BHOOMISETU.md §43 proposes a specific palette: **Deep Earth Green** (primary — land, governance, stability), **Soil Brown** (secondary — geography, land records), **Saffron/Warm Gold** (accent — alerts, action, important governance indicators), white/light-grey neutrals with the map kept visually dominant.

**This palette was not implemented.** The actual UI uses Tailwind CSS's default color palette directly — `blue`, `green`, `red`, `indigo`, `yellow`, `purple`, `orange`, `gray` classes appear 52 times across 13 components, with no CSS custom properties or Tailwind theme extension tying them back to the proposed schema. Concretely:

- Primary actions/links: `blue-500`/`blue-600` (Tailwind default), not Deep Earth Green
- Governance/officer-role accents: `indigo-600` (AI features, change-detection panel), not Saffron/Gold
- Severity/status badges: ad hoc `green`/`yellow`/`orange`/`red` per severity level, not derived from a single accent color
- Neutral backgrounds: `gray-50`/`white`, which does coincidentally match the "white and light grey" neutral guidance

**If this schema is to be enforced going forward**, the practical path is a `tailwind.config.js` theme extension mapping `primary`/`secondary`/`accent` token names to the proposed hex values, then a find-and-replace pass across the ~13 components currently using raw Tailwind color utilities. This is not a scored backlog item (BHOOMISETU.md is this team's own spec, not a competition ask — see `docs/FEATURE_AUDIT.md` §1's weighting) and remains undone; it's a distinct scope from the responsive/mobile breakpoint pass (§8 item 7, now done), which touched navigation and layout, not color usage.

---

## 9. Deployment and Scalability Considerations

### 9.1 Current state

- **Nothing has ever been deployed, and the Dockerfiles below have not been through a real `docker build` yet** (added 2026-09-05; Docker Desktop wasn't running on the dev machine and wasn't started to verify them this round — see `docs/FEATURE_AUDIT.md` §8 item 6). All application verification throughout every phase has been against `npm run start:dev` / `npm run dev` on a local machine.
- **`backend/Dockerfile`** — multi-stage: installs and builds in a `node:22-slim` stage with `python3`/`make`/`g++` available (a safety net in case `sqlite3`/`sharp`'s native bindings need to compile rather than use a prebuilt binary), then the final stage copies the already-resolved `node_modules` and `dist` across rather than running a second `npm install` - trades image size for not depending on two separate installs behaving identically. Caught one real bug by checking the actual local build output rather than assuming: `nest build` (no `nest-cli.json` override in this repo) preserves the `src/` folder structure under `dist/`, so the compiled entry point is **`dist/src/main.js`, not `dist/main.js`** — the Dockerfile's `CMD` was corrected to match after actually inspecting `backend/dist/`.
- **`frontend/Dockerfile`** — multi-stage: builds the Vite SPA, then serves the static output with `nginx` (`vite dev`/`vite preview` are dev tools, not a production server). Includes an `nginx.conf` with an SPA fallback (`try_files ... /index.html`), since `react-router`'s client-side routing 404s at the server on a hard refresh of e.g. `/parcels/:id` without one.
- **`docker-compose.yml`** — corrected to match the real single-backend architecture (§1.1) rather than the originally-imagined per-department containers, which never existed. This surfaced a second real bug: the previous version set the frontend's `VITE_API_URL` build arg to `http://backend:3000` (Docker's *internal* service hostname) — but Vite bakes that URL into the static JS at build time, and it's the *browser on the host*, not a container, that actually calls it; `backend` would never resolve there. Fixed to point at the port the compose file actually publishes to the host (`http://localhost:3000/api/v1`). `docker compose config` (a daemon-less syntax/merge check) validates the corrected file cleanly.
- Database: SQLite file-based storage in dev (`./data/dev.sqlite`), zero external setup required. The Postgres/PostGIS path is toggled via `USE_SQLITE=false` + `DB_*` env vars (`init-postgis.sql` provided, and the default in `docker-compose.yml`) and, as of 2026-09-06, has been exercised end-to-end against a live Supabase Postgres+PostGIS instance — see `docs/FEATURE_AUDIT.md` §8 item 14. Note Supabase specifically requires its IPv4 connection pooler rather than its (IPv6-only) direct-connection hostname; `backend/.env.example` documents both `DB_SSL` and the pooler-shaped host/username format.
- Environment configuration: `backend/.env.example` documents every variable read by the app (`USE_SQLITE`, `SQLITE_PATH`, `DB_HOST`/`PORT`/`USERNAME`/`PASSWORD`/`NAME`, `PORT`, `JWT_SECRET` [signs login tokens as of 2026-09-05, §6.1], `GROQ_API_KEY`, `GROQ_MODEL`). No secrets are committed — `.env` is gitignored and confirmed clean throughout this project's git history; `docker-compose.yml` reads `JWT_SECRET`/`GROQ_API_KEY` from the host shell's environment (`JWT_SECRET` does have a working non-secret fallback baked into the compose file itself, `change_this_in_production`, so login works out of the box — not safe to deploy with, but not a hard requirement to set locally).
- **Not yet done**: an actual `docker compose up --build` run to prove the images build and the three containers can actually talk to each other - the two bugs above were caught by static inspection, not by running the containers, so a live run may still surface something neither pass of review did.

### 9.2 Scalability considerations (as designed, not yet exercised at scale)

Per BHOOMISETU.md §34, the intent is architectural readiness rather than premature production-scale complexity — consistent with what was actually built:

- **Modular services**: the module boundaries in §1.2 are real and would translate reasonably directly into separate deployable services if that became necessary (each already avoids importing another module's repository directly in most cases).
- **API-based integration**: every department is already integration-tested as if it were external (no shared in-process shortcuts between department services and the aggregator beyond dependency injection).
- **Configurable state adapters**: adding a third state's land-record schema requires one new adapter function (§3), not a change to the canonical model or any consuming code — verified by construction (State A and State B already coexist this way).
- **Spatial indexing / GIS caching**: not implemented (§5) — the clearest concrete scale ceiling in the current build. Every spatial query is an in-memory scan; this is fine at ~200 seeded parcels and would need real indexing (PostGIS + spatial index, or an application-level R-tree) before growing further.
- **Background analytics / distributed deployment**: not implemented — there is no background job runner or queue anywhere in the codebase; every computation (including the change-detection image diff) runs synchronously within the HTTP request that triggered it.

### 9.3 What a real deployment would require, in order

1. ~~Write `Dockerfile`s for `backend/` and `frontend/`; correct `docker-compose.yml`~~ — done 2026-09-05 (§9.1), pending a live `docker compose up --build` to confirm the images actually build and run.
2. ~~Stand up Postgres + PostGIS and actually run the `USE_SQLITE=false` path end-to-end~~ — done 2026-09-06 against a live Supabase instance, including rewriting the 4 spatial call sites to real `ST_*` queries (`geo-utils.ts`'s hand-rolled functions remain as the SQLite-only fallback) — see `docs/FEATURE_AUDIT.md` §8 item 14.
3. ~~Build audit logging~~ — done 2026-09-05 (§6.1, §8 item 10), alongside authentication and RBAC route guards. Security-wise, what's left before exposing this publicly is item 4 below.
4. Add HTTPS termination and CORS restriction (`app.enableCors()` currently allows any origin).
