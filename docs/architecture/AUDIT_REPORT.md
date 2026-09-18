# BhoomiSetu Earth Engine GIS Pipeline - Audit Report

**Date**: 2026-09-18  
**Project**: SIH 2026 BhoomiSetu  
**Scope**: Earth Engine terrain/infrastructure pipeline optimization

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BhoomiSetu                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐        ┌──────────┐       ┌─────────┐
   │ PostGIS │        │  Celery  │       │Frontend │
   └────┬────┘        └────┬─────┘       └────┬────┘
        │                  │                  │
        │    ┌─────────────┴─────────────┐    │
        │    ▼                           ▼    │
        │ Earth Engine                    │    │
        │ (ee.Image/FeatureCollection)    │    │
        │                  │              │    │
        └──────────────────┼──────────────┘    │
                           ▼                    ▼
                    ParcelTerrainProfile    Map Rendering
                           │                    │
                           ▼                    ▼
                      API Response         GeoJSON Layers
```

### Data Flow
1. **Ingestion** (Celery `ingest_district_terrain`):
   - Fetches bounds from parcels table
   - Calls `earth_engine_terrain.fetch_terrain_bundle()`
   - Stores raw geometries in `road_networks`, `building_footprints`, `land_cover`, `elevation_tiles`
   - Triggers `compute_parcel_profiles`

2. **Profile Computation** (Celery `compute_parcel_profiles`):
   - Loops through each parcel in district
   - Runs 5+ PostGIS spatial queries per parcel
   - Upserts `ParcelTerrainProfile`

3. **Frontend Rendering**:
   - `/gis/parcels` - viewport-bbox filtered parcels (GeoJSON)
   - `/gis/zoning-overlays`, `/gis/restriction-zones`, etc. - district-level GeoJSON
   - `/tiles/{z}/{x}/{y}.pbf` - MVT for parcels only
   - MapLibre GL renders all as GeoJSON sources

---

## Current Bottlenecks

### Earth Engine Bottlenecks

| Issue | Location | Impact |
|-------|----------|--------|
| **`.getInfo()` on entire FeatureCollections** | `fetch_road_network:134`, `fetch_building_footprints:175`, `fetch_land_cover:217` | Downloads ALL geometries to Python memory; OOM risk for large districts |
| **`reduceToVectors` for land cover** | `fetch_land_cover:208-215` | Polygonizes entire raster region; extremely compute-intensive (high EECU) |
| **No fallback for MS Buildings** | `fetch_building_footprints:167` | Crashes entire pipeline if dataset inaccessible |
| **No batching for roads/buildings** | `fetch_terrain_bundle:287-292` | Sequential calls, no parallelization |
| **No EECU instrumentation** | All EE calls | Cannot measure actual compute usage |
| **Hardcoded dataset IDs** | `earth_engine_terrain.py:115-119, 167` | No configurable fallback mechanism |

### PostGIS Bottlenecks

| Issue | Location | Impact |
|-------|----------|--------|
| **Missing GIST indexes on terrain tables** | Migration `a1b2c3d4e5f6` uses `spatial_index=True` but no explicit index creation | Slow spatial queries on roads, buildings, land_cover, elevation_tiles |
| **N+1 queries in `compute_parcel_profiles`** | `terrain_tasks.py:290-390` | 5 queries × 3,840 parcels = ~19,200 queries per district |
| **No composite indexes** | All terrain tables | Missing `(state_code, district)` composite indexes for district-scoped queries |
| **Per-parcel commits** | `terrain_tasks.py:391-393` | Commits every 50 parcels but still slow |
| **Raw geometry in parcel profiles** | Not in model but `/parcels/{id}/context` returns full geometries | Large API payloads |

### Frontend Rendering Bottlenecks

| Issue | Location | Impact |
|-------|----------|--------|
| **All layers use GeoJSON sources** | `MapComponent.tsx:170-182, 326-399` | Full geometries sent to browser; slow for 60+ clusters |
| **No vector tiles for terrain layers** | Only parcels have MVT (`map_tiles.py`) | Roads, buildings, landcover sent as full GeoJSON |
| **Multiple separate API calls** | `UnifiedMapWrapper.tsx:187-221` | 4+ parallel requests per map load |
| **No geometry simplification** | All GeoJSON responses | High precision geometries waste bandwidth |
| **Parcel context returns full geometries** | `parcels.py:307-312` | `/parcels/{id}/context` returns heavy payloads |

---

## EECU Risks

| Operation | Current Estimate | Risk |
|-----------|------------------|------|
| `reduceToVectors` (land cover) | ~5-10 EECU/district | HIGH - polygonizes 10m raster over entire district |
| `.getInfo()` on roads | ~0.5-2 EECU/district | MEDIUM - downloads all road segments |
| `.getInfo()` on buildings | ~1-3 EECU/district | MEDIUM - downloads all building footprints |
| Elevation reduceRegion | ~0.1-0.5 EECU/district | LOW - server-side aggregation |
| **Total per district** | **~6.6-15.5 EECU** | **60 districts = 400-930 EECU** |

**Budget**: 150 EECU/month  
**Current trajectory**: **3-6x OVER budget**

---

## Recommended Changes

### Priority 1: Critical (Must Fix)

1. **Replace `.getInfo()` with server-side aggregation**
   - Roads/Buildings: Use `reduceToVectors` with tile-based export OR export to Cloud Storage + batch import
   - Land Cover: Use `reduceRegion` with histogram reducer instead of `reduceToVectors`

2. **Add dataset fallback mechanism**
   - Configurable fallback chain per dataset
   - Record actual source in database

3. **Add GIST indexes on terrain tables**
   - Create explicit migration for spatial indexes
   - Add composite indexes on `(state_code, district)`

4. **Batch parcel profile computation**
   - Single query with lateral joins or CTEs
   - Process in batches of 500-1000

### Priority 2: High (Performance)

5. **Implement MVT endpoints for all terrain layers**
   - `/tiles/roads/{z}/{x}/{y}.pbf`
   - `/tiles/buildings/{z}/{x}/{y}.pbf`
   - `/tiles/landcover/{z}/{x}/{y}.pbf`

6. **Add Redis caching**
   - Cache `ParcelTerrainProfile` by parcel_id
   - Cache district terrain bundles
   - Cache MVT tiles

7. **EECU instrumentation**
   - Track operation, dataset, duration, estimated EECU
   - Store in `ProcessingJob` or new table

### Priority 3: Medium (Robustness)

8. **Per-dataset status in Celery tasks**
   - Track roads/buildings/landcover/elevation separately
   - Allow partial success

9. **Idempotent ingestion**
   - Use `ON CONFLICT DO UPDATE` with content hash
   - Safe re-run capability

10. **Source tracking in profiles**
    - Record actual dataset used (including fallbacks)

---

## Files to Modify

### Core Services
- `app/services/earth_engine_terrain.py` - Major refactor
- `app/tasks/terrain_tasks.py` - Batch processing, per-dataset status
- `app/routers/map_tiles.py` - Add MVT endpoints for terrain layers
- `app/routers/admin_terrain.py` - EECU reporting

### Database
- New migration: GIST indexes + composite indexes on terrain tables
- Migration: Add `status_per_dataset` column to `ProcessingJob`

### Frontend
- `MapComponent.tsx` - Switch to MVT sources
- `UnifiedMapWrapper.tsx` - Use vector tiles

### New Files
- `app/services/ee_fallback.py` - Fallback mechanism
- `app/services/eecu_tracker.py` - EECU instrumentation
- `app/services/terrain_cache.py` - Redis caching