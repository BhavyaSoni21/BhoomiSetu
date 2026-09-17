**BhoomiSetu**

**Data Architecture, GIS Performance & Scalability Implementation Guide**

*Team Engineering Document • SIH Prototype → Production Roadmap*

Purpose: give the development team a single practical reference for storing, retrieving, validating, serving, caching and rendering parcel/GIS data efficiently while keeping the architecture simple enough for the SIH prototype.

# **1\. Engineering Goals**

* One parcel should have one unified, parcel-centric view across relevant departments.  
* The map must not load all parcels at once. Data delivery must depend on the current viewport and zoom.  
* Separate lightweight map data from detailed Parcel 360° information.  
* Keep PostgreSQL \+ PostGIS as the primary parcel source of truth unless measurements justify another datastore.  
* Move expensive GIS, AI, Earth Engine and bulk-ingestion work to background jobs.  
* Validate geometry and preserve source/provenance information during ingestion.  
* Design for horizontal scaling, but prove scalability with measurable load tests rather than claims.

# **2\. Recommended Architecture**

React / Map UI  
        |  
        v  
Cloudflare/CDN \+ WAF \+ Rate Limiting  
        |  
        v  
API Gateway / Backend  
   |          |            |  
   v          v            v  
Map API   Parcel API   Citizen API  
   |          |            |  
   v          v            v  
PostGIS   PostgreSQL    PostgreSQL  
   |  
Redis / Tile Cache

Background workers:  
  Earth Engine | ETL/Ingestion | AI/Heavy GIS  
        |  
        v  
Derived datasets / results

## **Core rule**

Do not make the database process more data than necessary. Do not send the frontend more data than necessary. Do not make the browser render more geometry than necessary. Do not recompute results that can be reused.

# **3\. Database Strategy**

## **Primary recommendation**

* PostgreSQL \+ PostGIS: authoritative application and spatial data store.  
* Redis: optional cache for measured hot paths; do not add it just for architecture diagrams.  
* Object storage: documents, large source files and generated artifacts where required.  
* MongoDB: only introduce it if a measured workload has a genuine document-oriented need. Do not split parcel data across PostgreSQL and MongoDB merely to appear scalable.

## **Spatial index**

CREATE INDEX parcels\_geom\_gist  
ON parcels  
USING GIST (geom);

Verify important spatial queries with EXPLAIN ANALYZE. Spatial predicates should be executed in PostGIS rather than pulling large datasets into application memory.

## **Suggested parcel fields**

* parcel\_id — internal stable identifier  
* ulpin / survey\_no / plot\_no / local identifiers — source identifiers where applicable  
* geom — canonical parcel geometry  
* source\_dataset / source\_record\_id — provenance  
* source\_crs / canonical\_srid — coordinate reference information  
* validation\_status / validation\_errors — geometry QA  
* data\_version / updated\_at — synchronization/version information  
* state\_id / department\_id — production isolation and authorization scope

# **4\. GIS Data Retrieval & Map Performance**

## **Current anti-pattern to avoid**

DB → fetch thousands of parcels → GeoJSON → React → render everything

## **Target flow**

PostGIS  
  ↓  
viewport / tile query  
  ↓  
MVT / PBF vector tile  
  ↓  
CDN / tile cache  
  ↓  
map renderer  
  ↓  
click parcel  
  ↓  
GET /parcel/{id}  
  ↓  
Parcel 360°

## **Vector tiles**

Use Mapbox Vector Tiles (MVT/PBF) or an equivalent vector-tile approach. The browser should receive only features relevant to the visible tile and zoom level. Keep tile attributes minimal (for example parcel\_id, survey number and a small status field).

## **PostGIS MVT pattern**

WITH bounds AS (  
  SELECT ST\_TileEnvelope(:z, :x, :y) AS geom  
)  
SELECT ST\_AsMVT(mvt, 'parcels')  
FROM (  
  SELECT  
    parcel\_id,  
    survey\_no,  
    ST\_AsMVTGeom(  
      geom,  
      bounds.geom,  
      4096,  
      64,  
      true  
    ) AS geom  
  FROM parcels, bounds  
  WHERE geom && bounds.geom  
) AS mvt;

## **Zoom-dependent Level of Detail**

* Low zoom: district/village/cluster summaries; do not draw detailed parcel polygons.  
* Medium zoom: parcel outlines with simplified geometry.  
* High zoom: detailed cadastral geometry.  
* Very high zoom: full detail only when it is actually useful.

## **Separate APIs**

GET /tiles/{z}/{x}/{y}.pbf  
GET /parcel/{parcel\_id}  
GET /parcel/{parcel\_id}/registration  
GET /parcel/{parcel\_id}/tax  
GET /parcel/{parcel\_id}/planning  
GET /parcel/{parcel\_id}/restrictions

The map API is optimized for high-volume lightweight reads. Parcel 360° endpoints are protected and return detailed information only after a parcel is selected.

# **5\. Geometry Ingestion, CRS & Validation**

Government/source dataset  
        ↓  
Identify source CRS  
        ↓  
Parse geometry  
        ↓  
Basic validation  
        ↓  
Topology/geometry checks  
        ↓  
Repair OR quarantine  
        ↓  
Transform to canonical CRS  
        ↓  
PostGIS \+ spatial index  
        ↓  
Vector tiles

## **Minimum prototype checks**

* Geometry is not NULL.  
* Expected geometry type is enforced.  
* ST\_IsValid(geom) is checked.  
* Coordinate and area sanity checks are performed.  
* Source CRS is known before transformation.  
* Transformation succeeds.  
* Failed records are quarantined instead of silently inserted.

## **Provenance to retain**

* source\_file / source\_dataset  
* source\_record\_id  
* source\_crs  
* canonical\_srid  
* validation\_status  
* validation\_errors  
* repair\_method  
* validated\_at  
* geometry/data version

## **Important repair rule**

ST\_MakeValid can be useful, but repair output depends on the deployed PostGIS/GEOS versions and selected method. Treat repair as a transformation: revalidate the result and record what was done. Do not assume every invalid cadastral geometry can be safely repaired automatically.

SELECT PostGIS\_Version();  
SELECT postgis\_full\_version();

# **6\. Caching**

## **Recommended cache layers**

* Static frontend assets: browser \+ CDN.  
* Public vector tiles: CDN/tile cache; version tile URLs so data updates are controllable.  
* Frequently requested public summaries: short-lived Redis only if profiling shows value.  
* Private Parcel 360° data: authorization-aware caching only when justified.  
* Large documents/artifacts: object storage \+ controlled CDN delivery where appropriate.

## **Tile versioning**

/tiles/v42/{z}/{x}/{y}.pbf  
→ dataset update  
/tiles/v43/{z}/{x}/{y}.pbf

Versioned tile URLs reduce difficult cache invalidation problems. Urgent corrections can use targeted invalidation if required.

# **7\. Authentication, Authorization & Data Boundaries**

* Public map layers and protected Parcel 360° information must be treated as different security classes.  
* Authorization must be enforced server-side; hiding fields in React is not security.  
* Every protected request should carry authenticated identity and be checked against role/data scope.  
* Never put private responses into a shared public CDN cache.  
* Keep department/state scope explicit in production authorization rules.

Public:  
GET /tiles/z/x/y.pbf

Protected:  
GET /parcel/123  
Authorization: Bearer \<token\>

# **8\. Parcel Updates, Re-ingestion & Versioning**

Department correction  
        ↓  
New source record/version  
        ↓  
Ingestion \+ validation  
        ↓  
Compare with current state  
        ↓  
Create version/audit event  
        ↓  
Invalidate affected cache/tile  
        ↓  
Expose current state

BhoomiSetu should act as an interoperability and presentation layer unless the deployment explicitly makes it authoritative. Corrections to authoritative land records should originate from the responsible department through the defined update workflow.

## **Production version model**

parcel\_version  
\- version\_id  
\- parcel\_id  
\- valid\_from  
\- valid\_to  
\- recorded\_at  
\- source  
\- geometry  
\- attributes  
\- change\_reason  
\- created\_by

Keep legal/valid time conceptually separate from system-recorded time where the source process requires it.

## **Audit trail**

* who  
* what changed  
* when  
* parcel  
* old value  
* new value  
* source  
* reason  
* request/transaction ID

# **9\. Background Processing**

Do not run expensive Earth Engine, AI, bulk-import or heavy spatial processing synchronously in ordinary user requests.

User request  
   ↓  
Create job\_id  
   ↓  
Queue  
   ↓  
Worker  
   ↓  
Earth Engine / ETL / AI  
   ↓  
Store result  
   ↓  
GET /jobs/{job\_id}

* Jobs must have stable IDs and explicit states such as queued/running/succeeded/failed.  
* Retries must be idempotent so a retry does not duplicate data or external work.  
* Precompute reusable geospatial indicators such as NDVI, land-use classification, water proximity or change indicators where useful.  
* Parcel 360° should read prepared results instead of triggering expensive analysis on every click.

# **10\. Frontend / Map Optimization**

* Do not render thousands of DOM markers for parcels.  
* Prefer WebGL/vector-tile rendering.  
* Avoid repeatedly replacing an entire map source when only a small state change occurred.  
* Keep the number of active layers/sources under control.  
* Simplify geometry at lower zoom levels.  
* Load detailed parcel information only after selection.  
* Debounce/throttle map movement-driven requests where an API call is still needed.  
* Lazy-load non-map application modules where possible.

# **11\. Performance Testing**

Do not claim scalability without measurements. Build a repeatable benchmark.

## **Test dataset sizes**

* 10,000 parcels  
* 100,000 parcels  
* 1,000,000 parcels  
* 10,000,000+ parcels where infrastructure permits

## **Measure**

* p50 / p95 / p99 API latency  
* requests per second  
* PostGIS query latency  
* database CPU and memory  
* API CPU and memory  
* tile size and network payload  
* browser memory  
* map render time / frame behavior  
* error rate  
* cache hit rate  
* concurrent users

## **Developer workflow**

1\. Capture baseline.  
2\. Find the slow query/render path.  
3\. EXPLAIN ANALYZE the database query.  
4\. Add/fix spatial indexes.  
5\. Reduce selected columns/data.  
6\. Switch large map payloads to vector tiles.  
7\. Add LOD/simplification.  
8\. Add caching only where useful.  
9\. Re-run the same benchmark.  
10\. Record before/after metrics.

A strong engineering statement is: “We identified the GIS rendering bottleneck, measured it, optimized spatial querying and data delivery, and benchmarked the system under increasing parcel loads.”

# **12\. Production Architecture — Later Stage**

* Read replicas for read-heavy workloads.  
* WAL, independent backups and point-in-time recovery (PITR).  
* Restore testing and defined RPO/RTO.  
* State/tenant isolation using separate schemas/databases or strict tenant controls such as Row-Level Security.  
* Partitioning only after workload/data shape justifies it.  
* Queue infrastructure for reliable background jobs.  
* Observability: logs, metrics, tracing and alerting.  
* Multi-region or deeper distributed architecture only when actual scale and availability requirements justify it.

A read replica is not a backup.

# **13\. Governance & Legal Boundary**

Use deployment-specific legal and departmental rules rather than hard-coding assumptions into the architecture. Safe product wording: “Designed to support applicable government data-governance, access, retention and RTI requirements; final policies are determined by the concerned department and applicable law at the time of deployment.”

# **14\. SIH Implementation Priority**

| Priority | Implement now | Production / later |
| :---- | :---- | :---- |
| P0 | PostGIS spatial index; viewport/tile queries; vector tiles; map/Parcel 360° separation | — |
| P0 | Geometry validation \+ CRS metadata \+ quarantine | Advanced topology validation |
| P0 | Basic auth \+ RBAC \+ protected Parcel 360° endpoints | Complex multi-state authorization |
| P1 | LOD/simplification; basic tile caching/versioning | Large distributed tile infrastructure |
| P1 | Basic audit/provenance; batch update/re-ingestion | Full temporal/version reconciliation |
| P1 | Background jobs for heavy processing | Large queue/worker fleet |
| P1 | Benchmark 10k → 1M+ representative data | 10M+ / national-scale benchmark |
| P2 | Redis only for proven hot paths | Advanced cache topology |

# **15\. Developer Checklist**

* Can the map load without fetching the whole parcel table?  
* Does every important spatial query use the spatial index?  
* Are only viewport-relevant features returned?  
* Are map tiles smaller than equivalent all-parcel GeoJSON payloads?  
* Are geometry and CRS validated at ingestion?  
* Are invalid records quarantined and traceable?  
* Is Parcel 360° data fetched separately and authorized server-side?  
* Are expensive Earth Engine/AI tasks asynchronous?  
* Are retries idempotent?  
* Can a department correction be ingested without manual database editing?  
* Can affected tiles/cache entries be invalidated or versioned?  
* Can we show before/after performance numbers?  
* Are backups independent from the primary database?  
* Can the team explain where authoritative data comes from and what BhoomiSetu changes?

# **16\. Definition of Done for the Current Prototype**

* Map no longer loads all parcels as one large GeoJSON payload.  
* PostGIS has a working spatial index and representative queries have been checked with EXPLAIN ANALYZE.  
* Vector tiles or equivalent viewport-based delivery are working.  
* Parcel selection opens a separate protected Parcel 360° request.  
* Geometry ingestion records CRS and validation status.  
* Invalid geometry is quarantined or explicitly reviewed.  
* At least one background job pattern exists for expensive processing.  
* A repeatable benchmark report records baseline vs optimized performance.  
* The team has a documented path from the SIH prototype to production architecture.

# **17\. Key Engineering Principle**

**Store authoritative data once → query only what is needed → transmit only what is needed → render only what is visible → cache what does not change frequently → process heavy work asynchronously.**