# BhoomiSetu — SIH 2026 PPT (Slide Content)

PPT-ready markdown for PS **SIH26014 "Land Stack"**. One `##` block per slide = one slide. Content is distilled from `SIH_2026_BhoomiSetu_Master_PPT_Data.md` and grounded in verified numbers from `SIH_2026_BhoomiSetu_Data_Reference.md`.

`⟨DATA REQUIRED⟩` = fill before submission (not derivable from code).

---

## Slide 1 — Problem Statement & Team

**PS ID:** SIH26014 · **Title:** Land Stack · **Solution:** BhoomiSetu
**Theme:** ⟨DATA REQUIRED⟩ · **Category:** Software · **Team ID / Name:** ⟨DATA REQUIRED⟩
**Institute:** Shah & Anchor Kutchhi Engineering College, Mumbai

**The problem:** land records are fragmented across departments (records, registration, tax, planning, survey), stored in incompatible formats per state, and disconnected from the map. A citizen or officer cannot see one parcel's full legal, spatial and tax picture in one place — so mutations are slow, disputes fester, and fraud/encroachment goes unseen.

---

## Slide 2 — Proposed Solution

**BhoomiSetu: a parcel-centric Land Stack.** Every record hangs off one parcel, keyed by **ULPIN** (national identity) + internal canonical ID.

- **Parcel 360°** — one view unifying ownership/RoR, tax, zoning, restrictions, encumbrances, disputes, and geometry with 5 years of history (2022–2026).
- **State Adapter** — pluggable interop layer maps any state's schema into one canonical model (State-A / State-B adapters implemented).
- **Layered map** — 20 map layers over the parcel: relationships, tax/legal/value/risk attributes, zoning/restriction/infrastructure overlays, and OSM roads/buildings/land-cover/elevation as vector tiles.
- **Workflow + AI** — department-routed mutation/dispute workflows, plus AI for change-detection, risk scoring, master-plan-mismatch and unauthorized-construction flags.

**Novelty:** parcel as the single join key across all departments + a state-agnostic adapter, so the same stack works nationwide without rewriting per state.

---

## Slide 3 — Technical Approach

**Frontend:** React 18 · TypeScript · Vite · Tailwind · Zustand · React Query · **MapLibre GL** · Recharts.

**Backend:** FastAPI · Pydantic 2 · SQLAlchemy 2 · Celery · **PostgreSQL + PostGIS** (all geometry SRID 4326) · Redis.

**Geo / AI (actually in stack):** GeoPandas + Shapely + osmium · MVT vector tiles · Google Earth Engine API · OpenCV · Tesseract OCR · OpenAI / Gemini LLM APIs · reportlab/PyMuPDF for docs.
> Note: PyTorch, scikit-learn, GeoServer, Rasterio are **not** used — do not list them.

**Data model:** 58 tables, parcel-centric, three layers — Base Spatial / Essential Governance / Derived-AI.

**Architecture:** SPA → FastAPI (`/api/v1`, 26 router groups) → PostGIS; heavy geo/AI jobs on Celery workers; map reads served as GeoJSON overlays + `/tiles/*.pbf` MVT.

---

## Slide 4 — Feasibility & Viability

**Built and running (prototype):**
- 58 seeded clusters across 30 states/UTs, ~6,120 target parcels ⟨exact count: measure post-seed⟩.
- 11 roles (8 dept officers + ADMIN + CITIZEN + VERIFIER), 8 departments, department-scoped RBAC + separation-of-duties verifier.
- Full Parcel 360°, layered map, workflow engine, State Adapter interop, historical-imagery year switch.

**Risks → mitigation:**
- *State schema variance* → State Adapter isolates per-state mapping.
- *Map performance at national zoom* → MVT tiles + precomputed parcel-attribute columns + CDN caching.
- *Data quality / accuracy* → AI flags are advisory (buffered-road blocks and detections are demo-grade, not survey-accurate); human officer verification in the loop.

---

## Slide 5 — Impact & Benefits

- **Citizens:** one-click Parcel 360° — full history, status and map without visiting offices; faster mutations, fewer disputes.
- **Government:** cross-department single source of truth; audit log on every change; AI surfaces encroachment, unauthorized construction and master-plan mismatches for proactive action.
- **Scale:** state-agnostic stack → onboard a new state by writing one adapter, not a new system.
- **Metrics:** ⟨DATA REQUIRED — measure on a real run: tile-serve latency, API p95, model accuracy⟩.

---

## Slide 6 — References

- ULPIN / DILRMP (Digital India Land Records Modernization Programme) — MoRD.
- OpenStreetMap (roads/buildings), Google Earth Engine (imagery/terrain).
- ⟨DATA REQUIRED — add specific govt scheme docs, standards, and any datasets cited⟩.
