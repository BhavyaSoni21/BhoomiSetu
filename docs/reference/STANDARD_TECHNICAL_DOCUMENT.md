# BhoomiSetu — Standard Technical Document

**Problem Statement:** SIH26014 — Comprehensive Land Stack for Digital Land Governance
**Platform:** BhoomiSetu — GIS-based Land Governance Platform
**Document Type:** Standard Technical Document (API standards, interoperability, data schemas, system architecture, GIS standards, security framework, UI/UX guidelines, colour schema, deployment & scalability)
**Version:** 1.0
**Date:** 25 September 2026
**Status:** Prototype — reconciled against the as-built `backend-py/` (Python) codebase and `frontend/` (React) codebase.

---

## Document Control

| Item | Detail |
|---|---|
| Owner | Team BhoomiSetu |
| Applies to | `main` branch (live) |
| Backend | FastAPI + SQLAlchemy 2.0 + PostGIS (`backend-py/`) |
| Frontend | React 18 + Vite + TypeScript + MapLibre GL (`frontend/`) |
| Authority for tokens/versions | Repository source (`requirements.txt`, `package.json`, `index.css`) |
| Related docs | `docs/architecture/SYSTEM_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `KNOWN_RISKS.md`, `SECURITY.md`, `DEPLOYMENT.md` |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the technical standards, architecture, and engineering
conventions of the BhoomiSetu platform, the team's response to problem
statement **SIH26014 (Land Stack)**. It is the Standard Technical Document
required by the problem statement and consolidates nine mandated areas: API
standards, interoperability standards, data schemas, system architecture, GIS
standards, security framework, UI/UX guidelines, colour schema, and deployment
& scalability considerations.

### 1.2 Scope
BhoomiSetu is a unified digital land-governance stack that maps citizen land
issues onto a canonical parcel model, routes them through department-specific
workflows, and exposes a GIS-first interface across citizen, officer, verifier,
and administrator roles. The platform is built for the two pilot states of the
problem statement (Chandigarh and Tamil Nadu, launched 31 Dec 2025) and is
generalised across 58 cadastral clusters spanning every state capital plus one
representative village per state.

### 1.3 Intended Audience
Evaluators, integrating government departments, security reviewers, and the
engineering team maintaining the platform.

---

## 2. System Architecture

### 2.1 Architectural Style
BhoomiSetu is a **stateless client–server web application** with a single
consolidated backend process. What appear as per-department "services" are
in-process modules within one FastAPI application, not separate microservices —
a deliberate choice that keeps the fan-out across departments a local
`asyncio`/function call rather than a network hop, while preserving clean module
boundaries for a future split.

### 2.2 Technology Stack

**Backend (`backend-py/`)** — versions pinned in `backend-py/requirements.txt`:

| Concern | Technology | Version |
|---|---|---|
| Web framework | FastAPI | 0.115.6 |
| ASGI server | Uvicorn (`[standard]`) | 0.34.0 |
| ORM | SQLAlchemy | 2.0.36 |
| Spatial ORM | GeoAlchemy2 | 0.16.0 |
| DB driver | psycopg2-binary | 2.9.10 |
| Migrations | Alembic | 1.14.0 (~48 migration files) |
| Validation | Pydantic + pydantic-settings | 2.10.4 / 2.7.0 |
| Auth | python-jose[cryptography], bcrypt | 3.4.0 / 4.2.1 |
| Rate limiting | slowapi | 0.1.9 |
| Geospatial | Shapely, GeoPandas, osmium | 2.0.6 / 1.0.1 / 4.3.1 |
| Remote sensing | earthengine-api | 1.4.3 |
| AI | openai (→ Groq), google-generativeai | 1.57.0 / 0.8.3 |
| Documents | reportlab, pypdf, PyMuPDF, qrcode, pytesseract, opencv | — |
| Async jobs | Celery, Redis, kombu | 5.4.0 / 5.2.0 / 5.4.0 |
| Backend-as-a-service | supabase | 2.11.0 |
| Runtime | Python | 3.12 (`python:3.12-slim`) |

**Database:** PostgreSQL 15 with PostGIS 3.3+ (`postgis/postgis:15-3.3` locally;
Supabase-hosted PostGIS in production).

**Frontend (`frontend/`)** — versions from `frontend/package.json`:

| Concern | Technology | Version |
|---|---|---|
| UI library | React + React-DOM | 18.2 |
| Build tool | Vite | 4.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS + PostCSS + autoprefixer | 3.3 / 8.4 / 10.4 |
| Icons | lucide-react | 0.469 |
| Forms & validation | react-hook-form + zod | 7.45 / 3.20 |
| Client state | zustand | 4.4 |
| Server state | @tanstack/react-query (+persist) | 4.32 |
| Charts | recharts | 2.8 |
| Routing | react-router-dom | 6.14 |
| HTTP | axios | 1.20 |
| Maps | maplibre-gl + @mapbox/mapbox-gl-draw | 4.x / 1.5 |
| PWA/offline | vite-plugin-pwa, dexie, idb-keyval | 0.20 / 4.4 / 6.3 |
| Onboarding | driver.js | 1.8 |
| Testing | vitest, @testing-library/react, msw | 1.6 / 14.3 / 2.15 |

### 2.3 Layering
The backend follows a strict three-tier separation:

```
HTTP request
  → Router (app/routers/*.py)         — transport, auth dependency, validation
    → Service (app/services/*.py)     — business logic, orchestration
      → Model (app/models/*.py)       — SQLAlchemy ORM + PostGIS geometry
        → PostgreSQL / PostGIS
```

A representative flow is the Parcel 360 view: `GET /api/v1/parcels/{id}/360`
fans out across the seven department services, merges them through a response
aggregator, applies the State-A/State-B adapter, and returns a fixed canonical
envelope.

### 2.4 Request Lifecycle
Middleware executes in this order (`backend-py/app/main.py`):

1. `RequestIdMiddleware` — assigns a correlation `requestId`.
2. `LastActivityMiddleware` — records `last_activity_at` for idle-timeout support.
3. `SecurityHeadersMiddleware` — HSTS and edge security headers in production.
4. Global exception handlers — uniform error envelope.
5. `SlowAPIMiddleware` — per-IP rate limiting.
6. `CORSMiddleware` — cross-origin policy.

**Production boot guards:** the application refuses to start if `JWT_SECRET` is
unset or a placeholder, if `DB_USERNAME/DB_PASSWORD/DB_NAME` are missing, or if
`CORS_ORIGIN` is unset — failing safe rather than launching mis-configured.

### 2.5 Migration Heritage
The platform was originally built as a NestJS + TypeORM backend (29 entities)
and has been fully ported to the current Python stack (`backend-py/`). The
legacy TypeScript backend is retained only as a live end-to-end contract test
suite (see §11 CI). Schema is managed exclusively through Alembic migrations —
there is no `create_all`/`synchronize` auto-DDL in production.

### 2.6 Deployment Topology (Summary)
Production runs as **Render (backend web service + Celery worker + Redis) +
Vercel (SPA)** with an external managed PostGIS database (Supabase pooler).
Local development uses a five-service Docker Compose stack. Full detail in §11.

---

## 3. API Standards

### 3.1 Style & Conventions
- **Protocol:** REST over HTTP/JSON. `multipart/form-data` is used only for
  file-upload routes (change-detection images, document identification,
  workflow evidence).
- **Versioned prefix:** every business route is mounted under **`/api/v1`**.
  `health` and `multilingual` are intentionally mounted outside the prefix.
- **Documentation:** OpenAPI 3 / Swagger UI is auto-generated at `/api/docs`
  with the schema at `/api/openapi.json`. Interactive docs are disabled in
  production.

### 3.2 Serialization Contract
All response schemas inherit `CamelModel` (`backend-py/app/schemas/base.py`), a
Pydantic base configured with `alias_generator=to_camel`,
`populate_by_name=True`, and `from_attributes=True`. The Python domain is
`snake_case`; the wire contract is **`camelCase`**, matching the TypeScript
frontend. The interoperability canonical envelope is the single deliberate
`snake_case` exception (see §4).

### 3.3 Authentication & Authorization
- **Scheme:** JWT Bearer — `Authorization: Bearer <token>`, HS256 via
  python-jose.
- **Revocation:** tokens embed a `tokenVersion`; role-guarded routes use the
  `require_roles(*roles)` dependency. Details in §7.

### 3.4 Error Handling
A consistent error envelope `{statusCode, message, error, requestId}` is emitted
by centrally-registered exception handlers. `RateLimitExceeded` is explicitly
mapped to the HTTP exception handler. Standard status codes: `200/201/204`
success; `400` validation; `401` unauthenticated; `403` forbidden; `404` not
found; `429` rate-limited / account lockout; `502` AI response schema-validation
failure; `503` AI/OCR endpoint invoked without a configured provider key.

### 3.5 Rate Limiting
`slowapi` enforces a global default of **200 requests/minute per IP**, with
tighter per-route ceilings: 30/min on AI, change-detection, and
historical-imagery routes; 20/min on login and document identification. A
per-account login lockout (`login_guard`) supplements the per-IP limit.

### 3.6 Pagination & Filtering
List endpoints accept `limit`/`offset` (or `skip`/`limit`) and domain filters
(e.g. parcels by ULPIN, survey number, plot number, state, district). Workflow
list queries use `selectinload` to avoid N+1 fan-out.

### 3.7 API Surface (Router Groups)
The backend registers **30 routers**. Grouped by domain:

**Identity & administration**
| Router | Purpose |
|---|---|
| `auth` | Login, registration (pending → OTP verify), Google OAuth, profile, `/me` |
| `users` | User CRUD, role change, delete (admin) |
| `admin` | Admin portal user/department metadata |
| `admin_governance_rules` | CRUD of configurable governance rules (`condition_config`) |
| `admin_pipeline_config` | Workflow pipeline step definitions |
| `admin_terrain` | Terrain-layer configuration |
| `profile_fields` | Configurable profile-field definitions |
| `audit` | Audit-log read (admin) + per-parcel audit (staff) |

**Land & parcel core**
| Router | Purpose |
|---|---|
| `parcels` | Search, 360, geometry, neighbours, context, ownership history, documents, risk score, identify-from-document |
| `land_records` | Mock State A + State B land-record CRUD |
| `departments` | Mock department record lookups by parcel |
| `public` | Public/unauthenticated informational lookups |

**GIS & spatial**
| Router | Purpose |
|---|---|
| `gis` | Parcel geometry, parcel-at-location, restrictions, overlay reads |
| `spatial` | Spatial-layer authoring CRUD (zoning/restriction/infrastructure/admin-notes) |
| `map_tiles` | MVT/PBF vector tiles `/{z}/{x}/{y}.pbf` via PostGIS `ST_AsMVT` |
| `change_detection` | Before/after image diff → change events + alerts |
| `historical_imagery` | Cluster year-over-year comparison, Earth Engine imagery |

**Workflow, cases & governance**
| Router | Purpose |
|---|---|
| `cases` | Case management (case entity + workflow layer) |
| `workflows` | Service-request filing, officer review, escalate/reopen, verifier assignment + field evidence |
| `governance` | Governance alerts list/detail + status state machine |
| `notification_feed` | In-app notifications list + mark-read |

**Intelligence & operations**
| Router | Purpose |
|---|---|
| `ai` | Groq/Gemini query, parcel-explain, alert-explain (staff) |
| `analytics` | Governance analytics + officer monitoring |
| `predictive_analytics` | Risk score + top-risk parcels |
| `multilingual` | Bhashini-backed UI text + translate/transliterate/TTS/ASR |
| `jobs` | Background job create/status (Celery dispatch) |
| `sync` | Offline sync operations (idempotent) |
| `health` | Liveness check (outside `/api/v1`) |

---

## 4. Interoperability Standards

BhoomiSetu is designed to sit on top of heterogeneous state land records and to
exchange data through open, standard formats at every boundary.

### 4.1 Data-Interchange Formats
| Boundary | Format / Standard |
|---|---|
| Geometry (API) | **GeoJSON** (RFC 7946), `[lng, lat]` order, WGS84 |
| Map tiles | **Mapbox Vector Tiles (MVT/PBF)**, extent 4096 |
| REST payloads | JSON (camelCase); canonical envelope (snake_case) |
| File upload | `multipart/form-data` |
| Documents | PDF (reportlab / pypdf / PyMuPDF) |
| Satellite imagery | PNG (true-colour visualisations) |
| Offline sync | JSON operations with idempotency keys |

### 4.2 Canonical Envelope
Because each state exposes land records differently, department reads are
normalised through a State-A/State-B adapter into a **fixed canonical envelope**
so that downstream consumers (and the frontend) see one stable shape regardless
of the source system. This is the platform's core interoperability contract.

### 4.3 External Systems & Standards
| System | Role | Standard / Protocol |
|---|---|---|
| **Bhashini / ULCA (Dhruva)** | Multilingual translate, transliterate, TTS, ASR | ULCA APIs over HTTPS; 11 Indian languages |
| **OpenStreetMap** | Basemap tiles + data ingestion | OSM raster tiles; `osmium` for PBF/OSM parsing |
| **Google Earth Engine** | Terrain layers + true-colour/NDVI imagery | EE Python API, service-account auth; AOI as GeoJSON |
| **Supabase** | Managed PostGIS + object storage | Postgres wire protocol; S3-style storage |
| **Groq (via OpenAI SDK)** | Primary LLM for parcel/alert explanation | OpenAI-compatible REST |
| **Google Gemini** | Automatic LLM fallback | google-generativeai |
| **OpenRouter** | Historical-imagery narrative | OpenAI-compatible REST |
| **Zoho Mail SMTP / TextBee** | Email & SMS OTP | SMTP / REST |
| **Google OAuth 2.0** | Federated login | OAuth 2.0 + CSRF state |

### 4.4 Remote-Sensing Datasets (Earth Engine)
Interoperates with standard public geospatial datasets: OSM roads
(`projects/sat-io/open-datasets/OSM/roads`), Microsoft Global Building
Footprints, ESA WorldCover v200 land cover (classes 10–95), Copernicus DEM
GLO-30 (30 m) elevation with `ee.Terrain.slope`, and Sentinel-2 NDVI for
change detection.

### 4.5 Asynchronous Integration
Heavy, third-party-dependent work (Earth Engine ingestion, OCR, ETL,
change-detection, terrain profiling) is decoupled from the request path onto a
Celery job queue over Redis, tracked in a `processing_jobs` table with
idempotency keys. Offline mutations from the PWA are replayed through the `sync`
router with a processed-operation guard to guarantee exactly-once application.

---

## 5. Data Schemas

### 5.1 Conventions
- **Primary keys:** UUID (`gen_random_uuid()` server default).
- **Timestamps:** `TIMESTAMP WITH TIME ZONE DEFAULT now()` for
  `created_at`/`updated_at`/`started_at`/`completed_at`; `updated_at` uses
  `onupdate`.
- **Structured data:** JSON/JSONB columns (job payload/result, governance
  `condition_config`, audit metadata, AI analysis, routing decisions).
- **Geometry:** PostGIS `Geometry(..., srid=4326)` via GeoAlchemy2 on every
  spatial table.
- **Arrays:** native Postgres `ARRAY(String)` for parcel-id lists on spatial
  layers (e.g. `affected_parcel_ids`).
- **Cross-entity references:** department records key on a plain `parcel_id`
  string (no FK) — deliberately mirroring how independent state systems
  reference parcels; intra-domain relations use FKs with `ondelete="CASCADE"`.
- **Schema evolution:** Alembic only (~48 migrations; initial
  `ff7c6e8d9c1f_initial_schema.py`).

### 5.2 Entity Groups

**Parcels & land**
`parcels` (POLYGON SRID 4326, `ulpin`, `canonical_parcel_id`, `cluster_id`,
`state_code`, `district_code`, `area_sq_m`), `parcel_identifiers`,
`parcel_neighbours` (explicit precomputed `TOUCHING`/`NEARBY` edges),
`ownership_history_records`, `crop_records`, `parcel_documents` (OCR-extracted
text), `parcel_historical_states`, `citizen_parcels` (unique one-parcel-one-
citizen invariant).

**Department records (7 + State A/B)**
`registration`, `planning`, `tax`, `restriction`, `dispute`, `encumbrance`,
`survey` records, plus `state_a_land_records` and `state_b_land_records` — all
keyed by `parcel_id` string.

**Cases & workflow**
`cases`, `department_tasks`, `case_applications`, `ai_analyses`,
`routing_decisions`, `sla_configs`, `appointments`, `case_timeline_events`,
`feedback`, `proposed_field_changes`, `case_parcel_geometry_versions`,
`workflows`, `workflow_steps`, `verification_evidence` (geotagged field
photos), `pending_registration`, `processing_jobs`, `processed_sync_operations`.

**Spatial layers**
`zoning_overlays` (POLYGON), `restriction_zones` (POLYGON),
`infrastructure_features` (generic GEOMETRY), `change_detection_events`
(POLYGON), `admin_map_notes` (generic GEOMETRY, admin-only).

**Terrain**
`road_networks` (LINESTRING), `building_footprints` (POLYGON), `land_cover`
(POLYGON), `elevation_tiles` (POLYGON), `parcel_terrain_profiles`.

**Users, governance & audit**
`users` (role ∈ {ADMIN, 8 `*_OFFICER` roles, CITIZEN, VERIFIER};
`token_version`), `governance_rules` + `governance_alerts` (state machine
OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED / DISMISSED), `audit_logs`,
`notifications`.

### 5.3 Case Detail Contract
The `CaseDetailOut` schema is the assembled case view returned to portals:
`case`, `tasks[]`, `timeline[]`, `feedback[]`, `aiAnalysis`, `routingDecision`.

---

## 6. GIS Standards

### 6.1 Coordinate Reference System
- **Storage & interchange:** SRID **4326 (WGS84, EPSG:4326)** throughout, in
  `[lng, lat]` GeoJSON order. Every geometry column is declared
  `Geometry(..., srid=4326)`.
- **Tile rendering:** geometry is reprojected to **EPSG:3857 (Web Mercator)**
  at query time via `ST_Transform(geometry, 3857)`.

### 6.2 Spatial Data Platform
- **True PostGIS geometry** via GeoAlchemy2 columns — not GeoJSON-as-text.
- **Python ↔ DB conversion:** Shapely `shape()` + GeoAlchemy2
  `from_shape(..., srid=4326)`; output via a shared `geometry_to_geojson()`
  helper returning GeoJSON Feature/FeatureCollection.
- **Input validation:** GeoJSON geometries are checked against a per-layer
  allow-list (`assert_geometry_type`) — e.g. zoning/restriction require
  `Polygon`; infrastructure accepts `Point`/`LineString`; admin notes accept
  `Point`/`LineString`/`Polygon`.

### 6.3 Geometry Types
| Entity | Geometry type |
|---|---|
| Parcel, ZoningOverlay, RestrictionZone, ChangeDetectionEvent | `POLYGON` |
| InfrastructureFeature, AdminMapNote | generic `GEOMETRY` (Point/Line/Polygon) |
| RoadNetwork | `LINESTRING` |
| BuildingFootprint, LandCover, ElevationTile | `POLYGON` |

### 6.4 Spatial Indexing
PostGIS **GIST** indexes are created (migration
`15753b4d91a3_add_gist_spatial_indexes.py`) on the geometry columns of
`parcels`, `restriction_zones`, `zoning_overlays`, `infrastructure_features`,
`change_detection_events`, and `admin_map_notes`. `land_cover` additionally
carries a composite `(state_code, district, year)` index and per-column
btree indexes. Standing rule: **a GIST index on every new geometry column** and
a composite `(state_code, district)` index on every new attribute table.

### 6.5 Map Rendering & Tiles
- **Renderer:** MapLibre GL JS (open-source), with Mapbox GL Draw for geometry
  authoring. All layers render as GeoJSON sources or vector tiles.
- **Vector tiles:** `map_tiles` serves MVT/PBF at `/tiles/{z}/{x}/{y}.pbf`
  (parcels) plus `/tiles/roads|buildings|landcover|elevation`, built with
  `ST_AsMVT` + `ST_AsMVTGeom(ST_Transform(geometry,3857),
  ST_TileEnvelope(z,x,y), 4096, 64, true)`, media type
  `application/vnd.mapbox-vector-tile`.
- **Precomputed tile attributes** on parcels: `tax_status`,
  `legal_status_severity`, `value_band`, `risk_score`, `masterplan_mismatch`,
  `unauthorized_construction_suspected` — enabling styling without per-request
  computation. Design rule: **precompute, never compute-on-read** for the
  viewport, with versioned tile URLs suited to CDN fronting.

### 6.6 Spatial Layer Categories
Zoning overlays (RESIDENTIAL | COMMERCIAL | AGRICULTURAL), restriction zones
(FLOOD | ENVIRONMENTAL | PROTECTED_AREA), infrastructure features (ROAD |
WATER_LINE | ELECTRICITY), change-detection events, and admin map notes. Reads
of the first four are public; **all writes are ADMIN-only**, and admin notes are
ADMIN-only for both read and write.

### 6.7 Spatial Operations
- **Overlap rejection:** `ST_Intersects`.
- **Edge snapping:** `ST_DWithin` / `ST_Snap` / `ST_Overlaps` with tolerance
  `0.0005°` (~55 m).
- **Affected-parcel computation:** `ST_Within(ST_Centroid(parcel.geometry),
  region)`.
- **Bounding-box filter:** `ST_Intersects(geometry, ST_MakeEnvelope(..., 4326))`.
- **Live cluster bounds:** computed from real PostGIS extent
  (`ST_XMin/YMin/XMax/YMax`), not reconstructed from config.

### 6.8 Parcel Generation & Adjacency
Parcels are generated as connected cadastral clusters (`cluster_id`, e.g.
`MH-PUNE-01`) through a subdivision pipeline: cluster → envelope →
recursive balanced split → corner-nibble variety → validation. A minimum
parcel-width floor (5 m) and compactness bar are enforced; a piece that cannot
be split without creating a sliver is left whole rather than forced, so tight
village clusters yield slightly fewer but always-valid parcels. Adjacency is
precomputed at seed time into `parcel_neighbours` (`TOUCHING`/`NEARBY`), stored
bidirectionally rather than derived per request.

### 6.9 Change Detection & Terrain Pipeline
- **Change detection** (officer/admin only): (a) upload before/after images
  (`image/*`, ≤ 5 MB each), or (b) fetch Sentinel-2 NDVI from Earth Engine for
  given bounds/dates. Pipeline: image diff → changed-pixel ratio → change-region
  polygon → spatial intersection → affected parcels → governance alerts. Bounds
  are validated (`lng ∈ [-180,180]`, `lat ∈ [-90,90]`, `afterDate ≥ beforeDate`).
- **Terrain ingestion:** Earth Engine service-account auth pulls the datasets in
  §4.4 into terrain tables per cluster, then materialises
  `parcel_terrain_profiles`. Terrain constraints (steep slope, water body,
  protected area, flood zone) can filter parcel placement. The Earth Engine free
  tier (150 EECU/month) is a documented capacity constraint under active
  optimisation.

---

## 7. Security Framework

### 7.1 Authentication
- **Primary:** JWT Bearer tokens, **HS256** via python-jose. Payload:
  `{sub: userId, email, role, tokenVersion}`.
- **Session model:** tokens intentionally omit an `exp` claim — a deliberate
  product requirement that sessions remain valid until explicit logout.
  Revocation is achieved by a **`token_version`** counter: `get_current_user`
  re-fetches the user every request and rejects any token whose embedded
  `tokenVersion` no longer matches `User.token_version`. Logout increments the
  counter, invalidating all outstanding tokens server-side.
- **Optional idle timeout:** `idle_timeout_minutes` (default 0 = disabled) via
  `last_activity_at`.
- **Federated & OTP:** Google OAuth 2.0 with CSRF state validation; email
  (Zoho SMTP) and SMS (TextBee) OTP flows. OTP codes are stored **bcrypt-hashed**
  with expiry (10-minute email expiry, 5-attempt cap).

### 7.2 Password Storage
Passwords are hashed with the **bcrypt** library directly
(`bcrypt.hashpw`/`gensalt`/`checkpw`) — not passlib — and stored in
`User.password_hash`.

### 7.3 Authorization (RBAC)
Roles are enforced server-side by `require_roles(*roles)` (403 on mismatch, 401
if unauthenticated) and are finer-grained than a simple four-role model:

| Role class | Roles |
|---|---|
| Officers (8) | `LAND_RECORD_OFFICER`, `REGISTRATION_OFFICER`, `PLANNING_OFFICER`, `DISPUTE_OFFICER`, `TAX_OFFICER`, `RESTRICTION_OFFICER`, `ENCUMBRANCE_OFFICER`, `SURVEY_OFFICER` |
| Staff | `ALL_STAFF_ROLES = OFFICER_ROLES + [ADMIN]` |
| Citizen | `CITIZEN_ROLE` (self-registration, 0–5 parcels) |
| Verifier | `VERIFIER_ROLE` — **deliberately excluded** from staff roles |

Each officer role maps to a department via `ROLE_DEPARTMENT`. The verifier's
exclusion structurally enforces **separation of duties**: the verifier collects
field evidence, the officer makes the decision. Spatial writes and admin notes
require `ADMIN`; change-detection and historical-imagery comparison require any
staff role.

### 7.4 Rate Limiting & Brute-Force Protection
- Per-IP: `slowapi`, 200/min default, 20/min on login.
- Per-account: `login_guard` lockout returning 429 on repeated failures.
- Auto-disabled under test (`RATE_LIMIT_ENABLED=false`).

### 7.5 Input Validation
All request bodies are Pydantic v2 models (`CamelModel`). Numeric bounds
(`Field(ge=, le=)`), string `max_length`, image content-type and size checks
(≤ 5 MB), and geometry-type allow-lists are enforced at the edge. Dynamic
profile fields are validated against their configured definitions.

### 7.6 Audit Logging
`AuditLog` records privileged and state-changing operations: `user_id`,
`user_role`, `action`, `entity_type`/`entity_id`, `parcel_id`, case-linked
`case_id`/`task_id`/`decision_id`, `previous_value`/`new_value` (JSON),
`reason`, `metadata`, `created_at`. Logging is performed **after** the mutation
succeeds so a logging failure never rolls back the underlying action. Auth
events (login, register, logout, OTP verify, Google login, onboarding) are
audited.

### 7.7 Transport & Headers
HTTPS/HSTS with edge security headers (`X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) applied by
`SecurityHeadersMiddleware` in production.

### 7.8 Secrets & Configuration
Configuration is loaded via pydantic-settings `BaseSettings` from environment /
`.env`. All secrets are environment-sourced and blank in the repo (`sync:false`
on Render): `JWT_SECRET` (production boot refuses the placeholder), DB
credentials with `DB_SSL` → `sslmode=require`, AI keys, Bhashini/ULCA keys, OTP
provider keys, and the Google Earth Engine service-account key (as raw JSON
string for file-less platforms). The GEE key is never committed.

### 7.9 Data Privacy & File Handling
PostGIS is the single source of authority; the browser holds only cache,
workspace, and an offline-mutation queue — never passwords or secrets. Owner-only
department fields are gated per request. PII (`government_id_number`,
`home_latitude/longitude`) is optional and captured only with consent. Uploads
are constrained by content-type and size; documents are stored with OCR-derived
text and a private storage bucket (local-disk fallback).

### 7.10 Documented Posture & Known Tradeoffs
`SECURITY.md` records the measures above and identifies this as an SIH 2026
prototype with some hardening deferred (strict CSP, multi-instance-safe lockout
storage). Two deliberate, documented tradeoffs a reviewer should note: JWTs omit
`exp` (mitigated by revocable `token_version`), and `CORS_ORIGIN` defaults
wide-open when unset (blocked in production by the boot guard). The full audit
lives in `docs/architecture/KNOWN_RISKS.md`.

---

## 8. UI/UX Guidelines

### 8.1 Frontend Architecture
A React 18 + TypeScript SPA built with Vite, organised by **feature folders**
(`src/features/{auth,map,admin,officer,analytics,...}`), **role pages**
(`src/pages/{citizen,officer,admin}`), and shared `components/`. Server state is
managed by React Query (v4) with offline cache persistence to IndexedDB; client
state by Zustand; forms by react-hook-form + zod; icons by lucide-react; charts
by recharts; routing by react-router-dom v6 with `React.lazy` + `Suspense`
route-level code splitting.

### 8.2 Role-Based Portals
Three primary portals — **Citizen**, **Officer**, **Admin** — plus verifier
field flows, each gated by the RBAC model in §7.3. UI affordances follow the
identity mapping in the design system: **Circle + green = Citizen, Square +
terracotta = Officer, Triangle + gold = Admin**.

### 8.3 Multilingual (i18n)
- **11 languages:** English, Hindi, Bengali, Gujarati, Kannada, Malayalam,
  Marathi, Odia, Punjabi, Tamil, Telugu.
- **Delivery:** bundled `en.json`/`hi.json` plus an embedded fallback dictionary
  for instant/offline rendering; runtime strings fetched from
  `GET /multilingual/ui-text/{lang}` (3.5 s timeout) and served by Bhashini/ULCA
  server-side, falling back to embedded strings on failure.
- **Persistence:** `localStorage` key `bhoomisetu_lang` (default `en`), synced to
  the user profile (`preferredLanguage`) when logged in.
- **Interpolation:** `t(key, options)` supports `{{var}}` substitution.

### 8.4 Accessibility
Design tokens target **GIGW 3.0** (India Government web-accessibility
guidelines) with ~WCAG 2.1 **AA** contrast. Data-heavy tables scroll
horizontally on mobile rather than collapsing columns; a visible amber focus
ring is standard.

### 8.5 Responsive Design
Breakpoints: mobile `< 640px`, tablet `640–1024px`, desktop `> 1024px`.

### 8.6 Offline / PWA
`vite-plugin-pwa` service worker plus a Dexie/idb-keyval IndexedDB layer provide
offline resilience: cached reads, a persisted React Query cache, and an
offline-mutation queue replayed idempotently through the `sync` API when
connectivity returns.

### 8.7 Onboarding & Voice
Guided product tours use driver.js; voice capture (for AI-assisted application
intake) uses recordrtc feeding the Bhashini ASR path.

### 8.8 Interaction Principle
The design system enforces a single, disciplined interaction convention: **green
communicates structure and identity; amber is the only interactive/highlight
colour.** This keeps calls-to-action unambiguous across a dense,
government-grade interface.

---

## 9. Colour Schema

The runtime authority for colour is `frontend/src/index.css` (`:root` tokens),
mapped to Tailwind classes in `tailwind.config.js` (`darkMode: 'class'`, tokens
CSS-variable-backed so dark mode is a variable swap). `docs/architecture/
DESIGN_SYSTEM.md` documents the fuller design language. Where sources differ,
**`index.css` is authoritative.**

### 9.1 Light Mode Tokens (`:root`)
| Token | Hex | Role |
|---|---|---|
| `--page-bg` | `#F7F6EE` | Warm parchment page background |
| `--surface-1` / `--surface-2` | `#FFFFFF` / `#F5F4EC` | Cards / raised surfaces |
| `--nav-bg` / `--nav-text` | `#0F3D2E` / `#FFFFFF` | Navigation |
| `--brand-900/700/600/300` | `#0F3D2E` / `#166534` / `#15803D` / `#86EFAC` | Brand green (structure/identity) |
| `--action-700/600/500` | `#B45309` / `#D97706` / `#F59E0B` | Interactive amber (sole highlight) |
| `--action-text-on` | `#16241A` | Text on amber |
| `--earth-700/500/300` | `#92400E` / `#B45309` / `#D6A46F` | Land/soil accents |
| `--text-heading/primary/secondary/muted` | `#0F3D2E` / `#34413A` / `#53635A` / `#718078` | Text ramp |
| `--border` | `#DDE5DF` | Borders |
| `--success/warning/error/info` | `#16A34A` / `#D97706` / `#DC2626` / `#0F766E` | Semantic |
| `--focus` | `#F59E0B` | Focus ring |

### 9.2 Dark Mode Tokens (`.dark`)
| Token | Hex |
|---|---|
| `--page-bg` | `#071A14` |
| `--surface-1` / `--surface-2` | `#0D261D` / `#123126` |
| `--nav-bg` / `--nav-text` | `#06150F` / `#F0FDF4` |
| `--brand-900/700/600/300` | `#06150F` / `#153D2C` / `#34D399` / `#BBF7D0` |
| `--action-700/600/500` | `#F59E0B` / `#FBBF24` / `#FCD34D` |
| `--earth-700/500/300` | `#E5A869` / `#F0B375` / `#F6D0A1` |
| `--text-heading/primary/secondary/muted` | `#FFFFFF` / `#E2EBE5` / `#BCE3D0` / `#9EBAAD` |
| `--border` | `#1E4436` |
| `--success/warning/error/info` | `#4ADE80` / `#FBBF24` / `#F87171` / `#2DD4BF` |

### 9.3 GIS Map Palette (five-state parcel styling, light)
| State | Fill | Border |
|---|---|---|
| Verified land | `#22C55E` (28%) | `#15803D` |
| Selected parcel | `#166534` (45%) | `#0F3D2E` |
| Pending verification | `#F59E0B` (28%) | `#B45309` |
| Disputed | `#DC2626` (22%) | `#991B1B` |
| High risk | `#F97316` (24%) | `#C2410C` |
| Project boundary | `#78350F` (85%; dark `#D6A46F`) | — |
| Field-survey track | `#0F766E` (dark `#2DD4BF`) | — |

### 9.4 Chart Palette (6-series)
- **Light:** `#15803D`, `#22C55E`, `#A7C957`, `#D6A46F`, `#0F766E`, `#64748B`
- **Dark:** `#34D399`, `#86EFAC`, `#A7F3D0`, `#D6A46F`, `#2DD4BF`, `#94A3B8`

### 9.5 Typography & Shape
Fonts: UI/display `Roboto` (per `index.css`); the Tailwind config additionally
declares Inter/Montserrat/Noto Sans and JetBrains Mono for headings and
monospace. Radius scale `4–16px`; custom hard-offset shadows (`hard-sm/md/lg`);
`fade-up`/`shimmer` animations. Bhashini widget tokens are namespaced
(`--bhashini-accent #208A43`, `--bhashini-accent-3 #f57c00`).

---

## 10. Deployment & Scalability Considerations

### 10.1 Production Topology
Production is a hybrid deployment:

| Component | Host | Type |
|---|---|---|
| `bhoomisetu-api` | Render | Docker web service, `/health` health check, `ENVIRONMENT=production` |
| `bhoomisetu-worker` | Render | Celery worker (queues `celery,earth_engine,ocr,etl,change_detection,terrain`) |
| `bhoomisetu-redis` | Render | Key-value store, internal-only (`ipAllowList: []`) |
| Frontend SPA | Vercel | Static build |
| PostGIS database | Supabase (pooler) / managed Postgres | External, `DB_SSL=true` |

The backend is **stateless** (JWT in the client, no server session store), so
the API web service scales horizontally behind Render's load balancer.

### 10.2 Local Development Topology (`docker-compose.yml`)
Five services: `frontend` (nginx SPA, `5173:80`), `backend-py` (`8000:8000`,
`/health`), `redis` (`redis:7-alpine`, append-only), `migrate` (one-shot
`alembic upgrade head`), `worker` (Celery, all six queues), and `postgis`
(`postgis/postgis:15-3.3`, **no published host port** — reachable only on the
internal network).

### 10.3 Container Runtime (`backend-py/Dockerfile`)
- Base `python:3.12-slim`.
- System dependencies installed before pip (GDAL ordering): `gdal-bin`,
  `libgdal-dev`, `g++`, Cairo/expat/zlib/bz2, `tesseract-ocr`.
- Runs as **non-root** `appuser` (uid 10001), writable only under `/tmp`.
- Entrypoint: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`
  (single-process uvicorn; Render supplies `$PORT`).

### 10.4 Configuration Management
All secrets are environment variables, blank in the repo and injected per
environment: `DB_*`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`,
`GROQ/GEMINI/OPENROUTER_API_KEY`, `GEE_SERVICE_ACCOUNT_EMAIL` +
`GEE_SERVICE_ACCOUNT_KEY_JSON`, `SUPABASE_*`, `TEXTBEE_*`, `MAIL_*`,
`GOOGLE_OAUTH_*`, `ULCA_*`, and an auto-wired `REDIS_URL`. `RATE_LIMIT_ENABLED`
toggles limiting. Production boot guards (see §2.4) fail fast on missing or
placeholder secrets.

### 10.5 Continuous Integration (`.github/workflows/backend-py-ci.yml`)
Two jobs, both against a real `postgis/postgis:15-3.3` service container:
1. **`test`** — build the backend image → `alembic upgrade head` →
   `pytest -q` (~560 tests).
2. **`live-e2e`** — build, migrate, run the backend detached, wait on
   `/health`, then execute the retained legacy NestJS Jest live-spec suite over
   real HTTP against the running Python backend (contract regression guard;
   `RATE_LIMIT_ENABLED=false`, Node 20).

Triggered on pushes/PRs touching `backend-py/**`; `cancel-in-progress`
concurrency. Frontend and deploy are handled by Vercel/Render auto-deploy (no
build job in this workflow).

### 10.6 Scalability Design
- **Spatial performance:** GIST indexes on all geometry columns; composite
  `(state_code, district[, year])` btree indexes on attribute tables; MVT
  vector tiles with precomputed styling attributes to keep viewport rendering
  off the compute path; versioned tile URLs suited to CDN fronting.
- **Read-path efficiency:** paginated list endpoints; `selectinload` to
  eliminate workflow N+1 queries; canonical-envelope aggregation done in one
  fan-out.
- **Write/heavy-work offloading:** Celery + Redis move OCR, Earth Engine
  ingestion, ETL, change-detection, and terrain profiling off the request path
  onto an independently-scalable worker service. If Redis is unavailable the API
  stays up; only deferred `.delay()` work is affected.
- **Database:** external managed PostGIS behind a connection pooler with
  enforced SSL; horizontal API scaling enabled by statelessness.
- **Client resilience:** React Query cache persisted to IndexedDB + PWA service
  worker for offline continuity.

### 10.7 Known Constraints & Risks (per `KNOWN_RISKS.md`, overall Low-to-Moderate)
- **Critical:** `maplibre-gl@4.7.1` carries advisory GHSA-jrc7-96c5-q579 (a
  sanitizer-bypass XSS); remediation is a semver-major upgrade — tracked.
- **High:** staff `GET /cases` is not yet department-scoped.
- **Medium:** `LastActivityMiddleware` idle-timeout is a silent no-op; CORS
  `"*"` + credentials fallback (safe in production only via the boot guard); no
  Content-Security-Policy header yet.
- **Low:** JWTs carry no `exp` (mitigated by `token_version`); token stored in
  `localStorage`.
- **Not yet implemented:** physical table partitioning by cluster/state — state
  scoping is currently index/query-level, not partitions. Earth Engine usage is
  on a trajectory over the 150 EECU/month free tier and is being optimised.

---

## 11. Standards Compliance Summary

| Mandated area | Standard adopted |
|---|---|
| API | REST/JSON, OpenAPI 3, `/api/v1` versioning, camelCase (`CamelModel`), JWT Bearer |
| Interoperability | GeoJSON (RFC 7946), MVT, canonical envelope, Bhashini/ULCA, OAuth 2.0, OSM, Earth Engine |
| Data schemas | UUID PKs, TZ-aware timestamps, Alembic migrations, JSON columns, PostGIS geometry |
| Architecture | Layered FastAPI monolith, stateless, Alembic-managed schema |
| GIS | WGS84 / EPSG:4326 storage, EPSG:3857 tiles, PostGIS + GIST, MapLibre GL, MVT |
| Security | JWT + bcrypt, server-side RBAC, slowapi + login lockout, audit log, HSTS/security headers |
| UI/UX | GIGW 3.0 / WCAG AA, responsive breakpoints, 11-language i18n, PWA offline |
| Colour | CSS-variable token system, light/dark, single-highlight (amber) discipline |
| Deployment & scalability | Render + Vercel + managed PostGIS, Celery/Redis offload, GIST indexing, CI on real PostGIS |

---

## Appendix A — Source of Authority

| Fact class | Authoritative source |
|---|---|
| Backend versions | `backend-py/requirements.txt` |
| Frontend versions | `frontend/package.json` |
| Colour tokens | `frontend/src/index.css`, `frontend/tailwind.config.js` |
| Deployment | `render.yaml`, `docker-compose.yml`, `backend-py/Dockerfile`, `DEPLOYMENT.md` |
| CI | `.github/workflows/backend-py-ci.yml` |
| Security | `SECURITY.md`, `docs/architecture/KNOWN_RISKS.md` |
| Architecture | `docs/architecture/SYSTEM_ARCHITECTURE.md`, `FEATURE_TECH_MAP.md` |
| Data model | `backend-py/app/models/`, `DATABASE_IMPLEMENTATION_GUIDE.md` |
| Design system | `docs/architecture/DESIGN_SYSTEM.md` |

*End of document.*
