# BhoomiSetu — Data Reference

**Purpose:** the concrete data side of the [Master PPT Data doc](./SIH_2026_BhoomiSetu_Master_PPT_Data.md) — what data actually exists in the prototype, what the canonical model is, and what is still to be supplied. Use this to fill the master doc's `DATA REQUIRED` slots with verified numbers instead of inventing them.

**Claim labels** (same policy as the master doc):
- `PROTOTYPE` — exists and runs in the current codebase.
- `TEAM DESIGN` — our proposed model/target, not (yet) fully built.
- `DATA REQUIRED` — a real number/dataset the PPT needs; must be measured, not guessed.

> All counts below are verified against source (2026-09-23). **Runtime-computed totals are flagged `~` / "runtime"** — the configured target is stated, but the actual seeded number depends on `gap_probability` and weighted picks, so measure a real seed run before quoting an exact parcel count in the PPT.

---

## 1. Canonical data model (three layers)

From master doc §4. The prototype centres every layer on the **parcel** keyed by **ULPIN** (identity) + **canonicalParcelId** (internal).

| Layer | Contents | Status |
|---|---|---|
| **Base Spatial** | parcel geometry, roads, buildings, land cover, elevation, clusters | `PROTOTYPE` |
| **Essential Governance** | ownership/RoR, tax status, zoning, restrictions, encumbrances, disputes | `PROTOTYPE` (partial) / `TEAM DESIGN` |
| **Additional / Derived** | risk score, master-plan mismatch, unauthorized-construction, change-detection | `TEAM DESIGN` (Layers 5–6 built server-side) |

---

## 2. Entities & tables

`PROTOTYPE` — **58 SQLAlchemy models** (`backend-py/app/models/*.py`), all mapped to one `Base`. **Every geometry column is PostGIS `Geometry`, SRID 4326 (WGS84).**

**Parcel core + history (13 tables)** — `models/parcel.py`
- `parcels` — the hub. `POLYGON/4326` geometry + precomputed layer columns: `tax_status`, `legal_status_severity`, `value_band`, `risk_score`, `masterplan_mismatch`, `unauthorized_construction_suspected`; plus `cluster_id`, `ulpin`, `current_state (JSON)`.
- `parcel_identifiers`, `parcel_neighbours` (`relationship_type` = TOUCHING\|NEARBY), `citizen_parcels`, `parcel_documents`, `ownership_history_records`, `crop_records`.
- Per-domain history: `tax_history_records`, `dispute_history_records`, `encumbrance_history_records`, `restriction_history_records`, `registration_history_records`, and `parcel_historical_states` (per-year attribute snapshot, no geometry).

**Spatial overlays (5)** — `models/spatial.py`: `zoning_overlays`, `restriction_zones`, `infrastructure_features`, `admin_map_notes` (admin-only), `change_detection_events`. Overlay tables carry `parcel_ids ARRAY` links.

**Terrain / Earth-Engine (5)** — `models/terrain.py`, all GIST-indexed: `road_networks` (**LINESTRING/4326**, `road_type` + `osm_tags JSON`, **no width column**), `building_footprints`, `land_cover`, `elevation_tiles`, `parcel_terrain_profiles`.

**Governance / workflow / cases**: workflow (3) `workflow_pipeline_configs`, `workflows`, `workflow_steps`; cases (11) incl. `cases`, `case_applications`, `department_tasks`, `ai_analyses`, `routing_decisions`, `sla_configs`, `appointments`, `case_timeline_events`, `feedback`, `case_parcel_geometry_versions` (POLYGON/4326); governance (2) `governance_alerts`, `governance_rules`.

**Department records (9 + 2)** — `models/department_record.py`: `registration_records`, `planning_records`, `tax_records`, `restriction_records`, `dispute_records`, `encumbrance_records`, `survey_records`, `encumbrance_certificates`, `survey_documents`; interop (`models/land_records.py`): `state_a_land_records`, `state_b_land_records`.

**Users / admin / misc**: `users`, `departments` (capability-matrix JSON), `audit_logs`, `notifications`, `pending_registrations`, `processing_jobs`, `profile_fields`, `verification_evidence`.

---

## 3. Seeded datasets (volumes)

What `seed.py` + the cluster generator actually produce. These are the numbers the PPT's "prototype scope / dataset" claims should cite.

`PROTOTYPE` — source: `app/common/parcel_generation/cluster_generator.py`, `scripts/seed.py`.

**Clusters: 58 total**
- 5 hand-tuned (`CLUSTER_CONFIGS`): MH-PUNE-01 (150), TN-CHENNAI-01 (80), KA-BANGALORE-01 (80), DL-NEWDELHI-01 (50), CH-CHANDIGARH-01 (50).
- 53 auto: 25 state capitals → 25 city (150 each) + 25 village (70 each) + 3 extra villages (MH/TN/KA).

**Parcels: ~6,120 configured target** (410 hand-tuned + 3,750 auto-city + 1,960 auto-village). `DATA REQUIRED` for an exact figure — actual seeded count is **runtime-computed**: `gap_probability` 0.08–0.16 drops parcels during recursive envelope split. Measure post-seed (`SELECT count(*) FROM parcels`) before quoting.
- Plot-size bands (sq m): small 55–93, medium 111–139, large 223–372; mix 45% / 35% / 20%.

**Coverage: 30 distinct state/UT codes** (25 capitals + MH/TN/KA/DL/CH), ~2 districts each (one city + one "Rural" village district).

**Historical depth: 5 years per parcel** — 2022–2026 (`CURRENT_YEAR = 2026`).

**Users: 11 staff** — 1 ADMIN + 8 officer roles + 2 VERIFIER (shared demo password `Demo@123`). **`CITIZEN_COUNT = 20`**, each linked to 0–5 parcels by weighted pick (total citizen-linked parcels runtime-computed).

**Departments: 8 seeded** — LAND_RECORDS, REGISTRATION, PLANNING, TAX, RESTRICTION, DISPUTE, ENCUMBRANCE, SURVEY.

**Demo case (citizen1 story):** `seed_citizen1_demo()` seeds one deterministic end-to-end case — `CASE-2026-9001`, intent `CORRECTION_REQUEST`, `ACTIVE`/`HIGH` — over 3 parcels where `PARCEL-PUN-0002` carries the built-in conflicts (owner name mismatch, area 920→985, `OVERDUE` ₹48,500 tax, active `BOUNDARY` dispute). Department tasks are seeded across their lifecycle states, and a matching case-linked `audit_logs` trail (`CASE_CREATED` → `CASE_ROUTED` → per-department `TASK_STATUS_CHANGED`) is written so `GET /cases/:id/audit` returns real history on a cold seed. All values are synthetic (no real identity/Aadhaar/deed).

---

## 4. Roles

`PROTOTYPE` — authoritative: `backend-py/app/auth/roles.py` (frontend mirror `features/officer/officerAuth.ts`).

**11 role values.**
- **8 officers** (`OFFICER_ROLES`): `LAND_RECORD_OFFICER`, `REGISTRATION_OFFICER`, `PLANNING_OFFICER`, `DISPUTE_OFFICER`, `TAX_OFFICER`, `RESTRICTION_OFFICER`, `ENCUMBRANCE_OFFICER`, `SURVEY_OFFICER` — each mapped to a department via `ROLE_DEPARTMENT`.
- `ADMIN` (`ALL_STAFF_ROLES` = officers + admin).
- `CITIZEN`.
- `VERIFIER` — deliberately outside staff roles (separation of duties).

---

## 5. API surface (router groups)

`PROTOTYPE` — mounted in `app/main.py`; **26 router groups**, all under `/api/v1` except `/health`.

| Prefix | Purpose |
|---|---|
| `/gis` | GeoJSON overlays + parcels (`gis.py` + `spatial.py`) |
| `/tiles` | MVT vector tiles |
| `/parcels` | parcel CRUD/query |
| `/change-detection` · `/historical-imagery` | change events · imagery compare |
| `/cases` · `/workflows` | case mgmt · workflow pipelines |
| `/state-a/land-records` · `/state-b/land-records` | State Adapter interop |
| `/` (departments.py) | dept ops (`/tax/overdue`, `/encumbrance/certificates`, …) |
| `/notifications` · `/governance-alerts` · `/audit` | feeds + audit log |
| `/ai` · `/predictive-analytics` · `/multilingual` | AI · predictions · i18n |
| `/users` · `/auth` · `/profile-fields` · `/jobs` · `/analytics` | identity, sessions, config, jobs, analytics |
| `/admin/departments` · `/admin/workflow-pipelines` · `/admin/governance-rules` · `/admin/terrain` | admin config |

---

## 6. Map layers (data sources)

`PROTOTYPE` — **`LayerKey` = 20 values** (`frontend/src/features/map/MapComponent.tsx`), backed four different ways:

| Group | Layers | Backend source |
|---|---|---|
| Parcel relationships | `selected`, `adjacent`, `nearby`, `cluster`, `sameDistrict` | `/gis/parcels` GeoJSON + `parcel_neighbours` |
| Parcel-attribute colouring | `taxStatus`, `legalStatus`, `circleRate`, `riskScore`, `mismatch`, `unauthorized` | precomputed columns on `parcels` (feature props) |
| GIS overlays | `zoning`, `restriction`, `infrastructure`, `changeDetection`, `adminNotes` | `/gis/*` GeoJSON endpoints (`adminNotes` admin-only) |
| MVT tiles | `roads`, `buildings`, `landcover`, `elevation` | `/api/v1/tiles/*.pbf` from terrain tables |

---

## 7. Tech / data stack (present vs aspirational)

Verified against `frontend/package.json` and `backend-py/requirements.txt`. **The PPT (§19) lists PyTorch, scikit-learn, GeoServer, Rasterio as stack — they are NOT code dependencies. Correct the slide or relabel them `TEAM DESIGN`.**

**Frontend — all PRESENT:** React 18.2, TypeScript 5.0, Vite 4.4, Tailwind 3.3, Zustand 4.4, MapLibre GL 4.0, Recharts 2.8 (+ react-query 4.32, axios, react-hook-form, zod, mapbox-gl-draw).

**Backend:**
| PPT claim | Reality |
|---|---|
| FastAPI 0.115 / Pydantic 2.10 / SQLAlchemy 2.0 / Celery 5.4 | PRESENT |
| PostgreSQL / PostGIS / Redis | PRESENT as code bindings (`psycopg2-binary`, `geoalchemy2` 0.16, `redis` 5.2); servers are infra |
| GeoPandas | PRESENT 1.0.1 (+ shapely 2.0.6, osmium 4.3.1) |
| GDAL | not pinned — pulled transitively via geopandas/shapely |
| GeoServer | **ABSENT** (infra, not a pip dep) |
| Rasterio | **ABSENT** |
| OpenCV | PRESENT (`opencv-python-headless` 4.10) |
| PyTorch | **ABSENT** |
| scikit-learn | **ABSENT** |

**Actually present AI/geo not in PPT §19:** `openai` 1.57, `google-generativeai` 0.8.3, `earthengine-api` 1.4.3, `pytesseract` (OCR), `reportlab`/`PyMuPDF`/`pypdf` (PDF).

---

## 8. Still `DATA REQUIRED` for the PPT

Carried from master doc §0/§1 — not derivable from code:
- Theme, Team ID, Team Name (submission metadata).
- Any `VERIFIED METRIC` (latency, tile-serve time, model accuracy) — must be measured on a real run, not estimated.
