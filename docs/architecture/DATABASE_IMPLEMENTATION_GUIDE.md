# BhoomiSetu Database Implementation Guide

*Team Engineering Document • SIH Prototype → Production*

---

## 1. Current Database State

### 1.1 Stack
- **Primary**: PostgreSQL 15+ with PostGIS 3.4+ (Supabase)
- **ORM**: SQLAlchemy 2.0 + GeoAlchemy2
- **Migrations**: Alembic
- **Connection**: Async SQLAlchemy with `asyncpg`

### 1.2 Core Spatial Tables (from `ff7c6e8d9c1f_initial_schema.py`)

| Table | Geometry Column | SRID | Current Indexes |
|-------|-----------------|------|-----------------|
| `parcels` | `geometry` (POLYGON) | 4326 | `cluster_id`, `ulpin` (btree) |
| `restriction_zones` | `geometry` (POLYGON) | 4326 | `district`, `state_code` (btree) |
| `zoning_overlays` | `geometry` (POLYGON) | 4326 | `district`, `state_code` (btree) |
| `infrastructure_features` | `geometry` (GEOMETRY) | 4326 | `district`, `state_code` (btree) |
| `change_detection_events` | `geometry` (POLYGON) | 4326 | `district`, `state_code` (btree) |

**Critical gap**: No GIST spatial index on any geometry column.

### 1.3 Non-Spatial Core Tables
- `users` — authentication, roles, district assignment, `token_version` for session revocation
- `workflows` + `workflow_steps` — configurable pipelines via `workflow_pipeline_configs`
- `governance_rules` + `governance_alerts` — configurable rules with `condition_config` JSON
- `parcel_identifiers` — ULPIN, survey number, plot number, khata mappings
- `citizen_parcels` — citizen↔parcel links with verification status
- `notifications` — SMS/email delivery via TextBee + Zoho SMTP

---

## 2. P0 Implementation Checklist (SIH Demo)

### 2.1 GIST Spatial Index — **HIGHEST PRIORITY**

```sql
-- Migration: add_parcels_gist_index
CREATE INDEX parcels_geom_gist ON parcels USING GIST (geometry);

-- Also add for zone tables used in spatial queries
CREATE INDEX restriction_zones_geom_gist ON restriction_zones USING GIST (geometry);
CREATE INDEX zoning_overlays_geom_gist ON zoning_overlays USING GIST (geometry);
CREATE INDEX infrastructure_features_geom_gist ON infrastructure_features USING GIST (geometry);
CREATE INDEX change_detection_events_geom_gist ON change_detection_events USING GIST (geometry);
```

**Verification**:
```sql
EXPLAIN ANALYZE
SELECT * FROM parcels
WHERE geometry && ST_MakeEnvelope(72.8, 18.9, 72.9, 19.0, 4326);
-- Must show "Index Scan using parcels_geom_gist"
```

### 2.2 MVT Vector Tile Endpoint

**New router**: `backend-py/app/routers/map_tiles.py`

```python
from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.database import get_db

router = APIRouter(prefix="/tiles", tags=["map-tiles"])

@router.get("/{z}/{x}/{y}.pbf")
def get_vector_tile(z: int, x: int, y: int, db: Session = Depends(get_db)):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for parcels in the given tile.
    Minimal attributes: parcel_id, canonical_parcel_id, state_code, district_code.
    """
    # Validate tile coordinates
    max_tile = 2 ** z
    if not (0 <= x < max_tile and 0 <= y < max_tile):
        raise HTTPException(400, "Invalid tile coordinates")

    # PostGIS MVT query (from architecture guide Section 105-122)
    sql = text("""
        WITH bounds AS (
            SELECT ST_TileEnvelope(:z, :x, :y) AS geom
        )
        SELECT ST_AsMVT(mvt, 'parcels', 4096, 'geom')
        FROM (
            SELECT
                id AS parcel_id,
                canonical_parcel_id,
                state_code,
                district_code,
                ST_AsMVTGeom(
                    geometry,
                    bounds.geom,
                    4096,   -- tile extent
                    64,     -- buffer
                    true    -- clip geometry
                ) AS geom
            FROM parcels, bounds
            WHERE geometry && bounds.geom
        ) AS mvt
    """)

    result = db.execute(sql, {"z": z, "x": x, "y": y}).scalar()

    if result is None:
        # Return empty tile (valid PBF)
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")
```

**Frontend usage** (MapLibre/Mapbox GL):
```javascript
map.addSource('parcels', {
  type: 'vector',
  tiles: ['/api/v1/tiles/{z}/{x}/{y}.pbf'],
  minzoom: 0,
  maxzoom: 18
});
map.addLayer({
  id: 'parcels-fill',
  type: 'fill',
  source: 'parcels',
  'source-layer': 'parcels',
  paint: {
    'fill-color': ['match', ['get', 'state_code'], 'MH', '#1f77b4', 'KA', '#ff7f0e', '#7f7f7f'],
    'fill-opacity': 0.6
  }
});
```

### 2.3 Background Job Pattern (Minimal Celery + Redis)

**Dependencies**: `celery`, `redis`, `kombu`

**Config** (`backend-py/app/core/celery_app.py`):
```python
from celery import Celery
from app.config import settings

celery_app = Celery(
    "bhoomisetu",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

# Task routes
celery_app.conf.task_routes = {
    "app.tasks.earth_engine.*": {"queue": "earth_engine"},
    "app.tasks.ocr.*": {"queue": "ocr"},
    "app.tasks.etl.*": {"queue": "etl"},
}
```

**Job schema** (add to Alembic migration):
```sql
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,  -- 'earth_engine', 'ocr', 'etl', 'change_detection'
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued, running, succeeded, failed
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(100) UNIQUE  -- for idempotent retries
);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_idempotency ON processing_jobs(idempotency_key);
```

**Example task** (`backend-py/app/tasks/earth_engine_tasks.py`):
```python
from app.core.celery_app import celery_app
from app.services.earth_engine_service import run_change_detection
from app.database import SessionLocal
from uuid import UUID

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_change_detection(self, job_id: str, aoi_geojson: dict, start_date: str, end_date: str):
    db = SessionLocal()
    try:
        # Update job status
        job = db.query(ProcessingJob).get(UUID(job_id))
        job.status = "running"
        job.started_at = func.now()
        db.commit()

        # Do the heavy work
        result = run_change_detection(aoi_geojson, start_date, end_date)

        # Store result
        job.status = "succeeded"
        job.result = result
        job.completed_at = func.now()
        db.commit()

    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()
```

**API endpoints** (`backend-py/app/routers/jobs.py`):
```python
@router.post("/jobs", response_model=JobResponse)
def create_job(job_type: str, payload: dict, db: Session = Depends(get_db)):
    # Check idempotency
    existing = db.query(ProcessingJob).filter_by(idempotency_key=payload.get("idempotency_key")).first()
    if existing:
        return existing

    job = ProcessingJob(job_type=job_type, payload=payload, idempotency_key=payload.get("idempotency_key"))
    db.add(job)
    db.commit()

    # Dispatch to Celery
    if job_type == "change_detection":
        process_change_detection.delay(str(job.id), **payload)
    # ... other types

    return job

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job
```

---

## 3. Current Anti-Patterns to Fix

| Current Code | Problem | Fix |
|--------------|---------|-----|
| `search_parcels()` returns full `Parcel` objects with geometry | Loads all columns + geometry for list views | Use MVT for map; separate `/parcels` list endpoint without geometry |
| `/parcels/{id}/geometry` returns full GeoJSON Feature | OK for single parcel, but used for bulk | Keep for Parcel 360°; use MVT for map rendering |
| `get_neighbours()` / `get_context()` fetch all candidates in Python | No spatial index usage; O(n) in app | Use `ST_DWithin` with GIST index; return minimal attributes |
| `identify_from_document()` loads all parcels with ULPIN | Full table scan | Add GIST index on centroid; use `ST_DWithin` with text search |

---

## 4. Scaling Path (Post-SIH)

### 4.1 P1 (After Demo)
- **LOD/Simplification**: `ST_Simplify(geometry, tolerance)` per zoom level in MVT query
- **Tile Versioning**: `/tiles/v{version}/{z}/{x}/{y}.pbf` — increment version on data update
- **Tile Caching**: Cloudflare/CDN in front of `/tiles` endpoint
- **Background Jobs**: Full Celery deployment with flower monitoring
- **Benchmark**: 10k → 100k → 1M parcels with p50/p95 latency metrics

### 4.2 P2 (Production)
- **Read Replicas**: Route `/tiles` and `/parcels` list to read replicas
- **Partitioning**: `parcels` by `state_code` or `district_code` when >10M rows
- **RLS**: Row-Level Security for multi-state/tenant isolation
- **Redis**: Only for proven hot paths (session cache, rate limiting)

### 4.3 What NOT To Do
- ❌ Split parcels across PostgreSQL + MongoDB
- ❌ Add Redis before profiling proves need
- ❌ Pre-partition before data shape justifies it
- ❌ Multi-region before availability requirements exist

---

## 5. Migration Commands

```bash
# Generate GIST index migration
cd backend-py
alembic revision --autogenerate -m "add_gist_spatial_indexes"

# Apply
alembic upgrade head

# Verify indexes
psql $DATABASE_URL -c "\d parcels"
# Should show: "parcels_geom_gist" gist (geometry)
```

---

## 6. Definition of Done (SIH Prototype)

- [ ] GIST index on `parcels.geometry` + zone tables created and verified with `EXPLAIN ANALYZE`
- [ ] `/tiles/{z}/{x}/{y}.pbf` endpoint returns valid MVT for parcels
- [ ] Frontend map loads parcels via vector tiles (not GeoJSON)
- [ ] Background job table + Celery worker running; at least one task type (change detection or OCR) works end-to-end
- [ ] Benchmark script runs 10k/100k parcel loads and reports tile query latency
- [ ] No full-parcel GeoJSON payloads sent to frontend for map rendering

---

## 7. Key Principle

> **Store authoritative data once → query only what is needed → transmit only what is needed → render only what is visible → cache what does not change frequently → process heavy work asynchronously.**

*From Architecture Guide Section 17*