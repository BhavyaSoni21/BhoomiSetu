# BhoomiSetu Performance Audit

## Scope and constraints

This audit covers the React/Vite frontend, FastAPI/SQLAlchemy backend, PostGIS/GIS paths, async processing, container build, and CI/deployment configuration in `D:\Projects\SIH_2026_BhoomiSetu`.

The audit was read-only. Existing staged, modified, unmerged, and untracked files were preserved. No source file was changed as part of evidence collection.

## Current architecture

- **Frontend:** React 18.3.1, Vite 4.5.14, TanStack React Query 4, Zustand, Axios, MapLibre GL, and route-level lazy imports. `frontend/src/App.tsx` lazy-loads portal and public pages; `frontend/src/main.tsx` owns the shared `QueryClient`.
- **Map path:** `frontend/src/features/map/UnifiedMapWrapper.tsx` coordinates district/context queries and `frontend/src/features/map/MapComponent.tsx` renders MapLibre layers. Map requests use viewport bounds and explicit limits where implemented.
- **Backend:** FastAPI with synchronous SQLAlchemy sessions, GeoAlchemy2/PostGIS, Alembic, Celery, and Redis dependencies. `backend-py/app/database.py` creates the engine and request session.
- **GIS:** Parcel, zoning, restriction, infrastructure, terrain, and MVT routes use PostGIS functions. Existing migrations create named GiST indexes for core geometry columns.
- **Async:** Celery tasks exist for Earth Engine, OCR, ETL, change detection, and terrain. The original Compose topology did not declare Redis, a worker, beat, or a migration job.

## Baselines collected

### Frontend build

Command:

```powershell
npm run build
```

Result: successful Vite production build, 2,684 modules transformed. Vite warned that minified chunks exceed 500 kB.

Measured large files in the pre-existing `frontend/dist` included:

- `hero-team.jpg`: 2,429,967 bytes
- `bhashini-dev-team.png`: 1,976,846 bytes
- `chatbot-lady-icon.png`: 968,351 bytes
- `hero-bg.png`: 959,585 bytes
- `logo-full.png`: 767,910 bytes
- `assets/index-cb31f850.js`: 598,341 bytes
- `assets/AdminPortal-123c1b38.js`: 554,576 bytes
- `assets/maplibre-gl-4a1636ec.js`: 802,890 bytes

### Frontend dependency and type checks

- `npm ls --depth=0` reports `UNMET DEPENDENCY msw@^2.15.0` even though it is declared in `frontend/package.json`.
- `npx tsc --noEmit` fails because `msw` is missing and because the installed `@testing-library/react` does not export `Hook`/`renderHook` as expected by the current test setup.
- `npm audit` previously reported a critical MapLibre-related advisory; dependency upgrade should be validated separately from the performance changes.

### Runtime blockers

- Docker daemon is unavailable: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct or the daemon is running`.
- Local PostgreSQL/PostGIS is unavailable, so no live `EXPLAIN (ANALYZE, BUFFERS)` measurements were possible.
- Backend `pytest --collect-only -q` timed out after 120 seconds.
- Global `python -m pip check` reports Pydantic, python-dotenv, uvicorn, OpenAI, Starlette, and other version conflicts. The project backend virtual environment should be used for validation.

## Confirmed findings

### Critical — async processing is not deployable as configured

`docker-compose.yml:10-82` declares only PostGIS, backend, and frontend. It has no Redis, Celery worker, or beat service. `backend-py/app/config.py:68-69` and `backend-py/app/core/celery_app.py:9-12` default to `redis://localhost:6379/0`, while the backend container starts only Uvicorn at `backend-py/Dockerfile:17-20`.

Impact: `.delay()` calls cannot reach a broker, and no process consumes queued tasks.

### High — Celery task discovery and routing are incorrect

`backend-py/app/core/celery_app.py:9-18` creates Celery without `include`, `imports`, or autodiscovery. Task registration depends on importing `backend-py/app/tasks/__init__.py:3-10`. Routes such as `app.tasks.earth_engine.*` at `backend-py/app/core/celery_app.py:21-26` do not match modules named `earth_engine_tasks`, `ocr_tasks`, `etl_tasks`, and `change_detection_tasks`.

Impact: a worker may start with no registered tasks, and tasks are sent to the default queue instead of their intended queues.

### High — fresh Compose databases are not migrated

`backend-py/docker/init-bhoomisetu_py-db.sql:1-14` only enables PostGIS. Compose starts Uvicorn directly and has no `alembic upgrade head` job or `Base.metadata.create_all()` fallback.

Impact: a fresh `postgis_data` volume has no application schema until migrations are run manually.

### High — sensitive and test files enter the backend image context

`backend-py/.dockerignore:1-6` excludes only caches, virtual environments, and `.env`; `backend-py/Dockerfile:17` copies the remaining context. Credential files, `test_local.db`, `test_audio.wav`, `test_recording.wav`, uploads, and generated data can enter image layers or a production bind mount.

### High — OSM ingestion dependency is undeclared

`backend-py/scripts/extract_osm_roads.py:18-19` imports `osmium`, but `backend-py/requirements.txt:1-36` does not declare `pyosmium`/`osmium`.

### High — Parcel 360 performs sequential department fan-out

`backend-py/app/services/response_aggregator_service.py:20-37` performs one land-record lookup and seven department lookups sequentially for `GET /api/v1/parcels/{id}/360` (`backend-py/app/routers/parcels.py:323-335`).

Impact: latency and connection occupancy grow with each backing table. A safe optimization is to batch where the storage model permits it or run independent read-only lookups with isolated sessions and a bounded executor.

### High — zone writes scan every parcel

`backend-py/app/services/spatial_service.py:56-62` and `backend-py/app/routers/spatial.py:112-120,124-135,156-169,173-193` use `ST_Within(ST_Centroid(geometry), geom)` without a bounding-box prefilter.

Impact: zone create/update operations can scan all parcels. Add `geometry && ST_Envelope(geom)` before the centroid predicate so the existing GiST index is used.

### High — restriction-zone alerts use a per-parcel N+1 pattern

`backend-py/app/services/spatial_service.py:72-87` calls `evaluate_rules_and_create_alerts()` once per newly affected parcel. The rule query is therefore repeated for every parcel.

Impact: write latency and database round trips scale with affected parcel count. Fetch active rules once and bulk-create alerts.

### High — document identification loads complete tables into Python

`backend-py/app/services/parcels_service.py:161-172` loads every parcel with a ULPIN and every identifier, including an unnecessary `joinedload(ParcelIdentifier.parcel)`, then filters in Python for `POST /api/v1/parcels/identify-from-document` (`backend-py/app/routers/parcels.py:248-264`).

Impact: memory and CPU scale with the complete tables. Select only identifier columns, reduce candidate IDs in SQL where possible, and load only candidate parcels.

### Medium — GIS collection reads are unbounded

`backend-py/app/routers/gis.py:39-68` and `backend-py/app/routers/spatial.py:67-102` expose parcel, zoning, restriction, infrastructure, and change-detection collections without useful default caps. The parcel endpoint accepts `limit`, but it defaults to `None`; spatial endpoints use `.all()` directly.

Impact: large districts produce large responses, high serialization cost, and high memory use.

### Medium — MVT feature encoding has no cap

`backend-py/app/routers/map_tiles.py:24-47,84-107,141-165,205-229,262-286` builds set-based MVT queries without a feature limit.

Impact: dense tiles can process and encode arbitrarily many features. Add a bounded inner `LIMIT` per tile.

### Medium — neighbour/context fallback scans district or cluster rows

`backend-py/app/services/parcels_service.py:301-326,357-366` loads every parcel in the same state/district or cluster when precomputed neighbours are absent, then calculates distances in Python.

Impact: fallback requests scale with district size. Use a PostGIS `ST_DWithin` candidate query before exact distance calculation.

### Medium — “My parcels” is unbounded

`backend-py/app/services/parcels_service.py:61-76` loads all citizen links and all linked parcels/identifiers for `/api/v1/parcels/mine` and `/api/v1/parcels/citizen/{citizen_id}/parcels`.

Impact: response size and query cost scale with a citizen’s parcel count. Add explicit limit/offset parameters.

### Medium — search query combines joined rows and distinct count

`backend-py/app/services/parcels_service.py:201-255` combines `joinedload(Parcel.identifiers)`, `identifiers.any(...)`, and `distinct().count()`.

Impact: joined rows can inflate count work and make pagination less predictable. Count distinct parcel IDs separately, then eager-load identifiers only for the page.

### Medium — request session commits read-only work

`backend-py/app/database.py:17-32` commits every successful request. Read-only routes still open and commit transactions.

Impact: unnecessary transaction work and connection occupancy. Commit only when the session has pending changes, while preserving explicit route behavior.

### Medium — last-activity middleware repeats user lookups

`backend-py/app/middleware.py:37-52` calls `get_current_user(token)` and then opens another session to query the same user before updating `last_activity_at`.

Impact: authenticated requests perform avoidable duplicate reads and writes. A single token-validation/user update path would reduce round trips.

### Frontend findings

- `frontend/src/App.tsx:27` statically imports `AskAiWidget` even though it is conditionally rendered at `frontend/src/App.tsx:424-429`; this pulls widget dependencies into the initial application chunk.
- `frontend/src/main.tsx:11` creates `QueryClient` without stale-time, cache-GC, or retry defaults.
- `frontend/src/features/parcels/ParcelSearch.tsx:65-76` runs a new query on every keystroke with no debounce or request cancellation.
- `frontend/src/features/map/MapComponent.tsx` constructs MapLibre maps but does not import the explicit worker URL helper; the helper documents that this is required under Vite for reliable GeoJSON worker operation.
- Large public images are rendered without consistent lazy-loading/decoding attributes on below-fold sections.

## Recommended optimization order

1. Restore deployable async topology: Redis, worker, task discovery/routing, migration job, and readiness checks.
2. Add spatial bbox prefiltering, bulk alert creation, bounded collection/MVT queries, and PostGIS neighbour candidates.
3. Reduce backend session/transaction overhead and document-identification memory use.
4. Lazy-load `AskAiWidget`, debounce/cancel parcel search requests, configure QueryClient defaults, and set the MapLibre worker URL.
5. Harden Docker ignore rules and add frontend HTTP compression/cache headers.
6. Re-run production build, frontend tests/typecheck, backend collection/tests, and database-backed `EXPLAIN` measurements once Docker/PostgreSQL are available.

## Validation plan

### Frontend

```powershell
npm run build
npx tsc --noEmit
npm test -- --run
```

Measure initial JS/CSS and image transfer sizes before and after the changes. Confirm that portal pages still lazy-load and that the AI widget works after on-demand import.

### Backend

```powershell
# Use the project virtual environment.
.\backend-py\.venv\Scripts\python -m pytest --collect-only -q
.\backend-py\.venv\Scripts\python -m pytest
```

When PostGIS is available:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id
FROM parcels
WHERE geometry && ST_Envelope(ST_GeomFromGeoJSON(:zone_geojson))
  AND ST_Within(ST_Centroid(geometry), ST_GeomFromGeoJSON(:zone_geojson));

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, geometry
FROM parcels
WHERE ST_DWithin(
  ST_Transform(geometry, 3857),
  ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857),
  :distance_m
);
```

### Deployment

```powershell
docker compose config --services
docker compose config --format json
docker compose run --rm backend-migrate alembic upgrade head
docker compose exec backend-worker celery -A app.core.celery_app:celery_app inspect ping
```

## Expected outcome

The first implementation pass should reduce initial frontend JavaScript, avoid redundant parcel search requests, make map worker behavior reliable, remove avoidable backend read commits, bound large GIS responses, use existing spatial indexes for zone writes, reduce alert rule round trips, and make Celery jobs actually runnable in Compose.
