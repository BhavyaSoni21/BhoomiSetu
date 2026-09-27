# 02 — Architecture

## Layered view

```
                 CLIENT (React 18 SPA — Vite, PWA)
        Citizen / Officer / Verifier / Admin portals
                          │  HTTPS, JWT Bearer
                          ▼
              FastAPI backend  (/api/v1/*)
   RequestId → LastActivity → SecurityHeaders middleware
                          │
   ┌──────────┬───────────┼────────────┬──────────────┐
   ▼          ▼           ▼            ▼              ▼
 Parcel/    Case /      Spatial /    AI /          Multilingual
 Dept       Workflow    GIS (MVT)    OCR /         (Bhashini)
 records    engine                   change-detect
   │          │           │            │              │
   └──────────┴───────────┴────────────┴──────────────┘
                          ▼
        PostgreSQL + PostGIS (SRID 4326, GIST)  ·  Redis + Celery
                          ▼
        Canonical parcel model  ←  State A / State B adapters
```

## Central principle

**Existing systems remain independent; BhoomiSetu connects them.** Rather than one giant database owning everything, each department dataset is modelled as its own table/record type, and a canonical parcel record links them. The interoperability demo proves this with **two deliberately different state schemas** (`state_a_land_records` uses `survey_number`/`area_hectares`; `state_b_land_records` uses `plot_id`/`land_extent_sqft`) mapped into one canonical shape by adapters.

> Note: The vision docs (`BHOOMISETU.md`/`Tech.md`) describe department systems as separate microservices on their own ports. In the shipped prototype these are **tables + router endpoints inside the one FastAPI app**, gated behind an env flag (see below), not separate services.

## The canonical parcel

`parcels` is the hub. Everything else references a parcel by id. Identity is multi-keyed so the system never depends solely on ULPIN availability:
- `canonical_parcel_id` — internal stable id
- `ulpin` — national identifier (optional)
- `parcel_identifiers` — many rows per parcel (`identifier_type` → `identifier_value`, with `source_state`/`source_department`)

Precomputed governance columns live on `parcels` directly: `risk_score`, `legal_status_severity`, `value_band`, `tax_status`, `masterplan_mismatch`, `unauthorized_construction_suspected`, plus a `current_state` JSON snapshot.

Spatial layers group into three PS categories (Base → Essential → Additional) — see [05-DATABASE-SCHEMA.md](05-DATABASE-SCHEMA.md).

## Case / workflow engine

The live engine is **case-centric** (not the old NestJS `Workflow`-centric model, though `workflows`/`workflow_steps` tables still exist for pipeline configuration).

- **Case lifecycle:** `CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED`.
- One `Case` fans out to many `DepartmentTask`s (one per department that must act).
- A `DepartmentTask` carries status, assigned officer/verifier, stage, resolution mode/decision/remarks, and SLA thresholds.
- **`case_timeline_events`** records every state transition (actor, role, previous→new state) — the audit spine of a case.
- **`proposed_field_changes`** and **`case_parcel_geometry_versions`** hold officer-proposed edits to records/geometry, kept versioned and pending until decided (honest, no silent writes).
- **`verification_evidence`** holds field-verifier photos with GPS + hash + capture time.
- **`routing_decisions`** / `ai_analyses` / `case_applications` capture AI intake, routing, and the citizen's drafted/confirmed application.

## Interoperability flow

```
API call → identifier resolution → state adapter → schema validation
        → canonical transformation → response aggregation → Parcel 360°
```

Mock department lookups (`land_records.py`, per-parcel dept endpoints in `departments.py`) are **env-flag gated** via `require_mock_dept_apis_enabled` / `EXPOSE_MOCK_DEPT_APIS` — they return **404 in production** so mock adapters aren't exposed live. They are demonstration endpoints, not auth-gated business endpoints.

## Reliability — degrade, don't crash

Every external dependency has a defined fallback:
- Groq → 503 + deterministic routing
- Earth Engine → 503
- Bhashini → raw i18n key / cached fallback strings
- OpenRouter → plain facts
- Celery/Redis absent → no-op shim (`.delay()` calls fail, rest of API unaffected)
- SMS/Email → in-app notification
- Offline → IndexedDB queue → idempotent `POST /api/v1/sync`

Not yet built: automated DB failover, multi-region replication, SLA sweeper.
