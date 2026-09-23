# BhoomiSetu — Master Project Document

> **One Parcel. Every Record. One Trusted Workflow.**
>
> An integrated, parcel-centric, GIS-based Digital Public Infrastructure for land governance.
> Built for **Smart India Hackathon 2026 · Problem Statement SIH26014 — "Land Stack"** (Department of Land Resources).

---

## Claim Labels (read this first)

Every non-trivial statement in this document carries an implicit or explicit label so reviewers can tell fact from plan from measurement:

| Label | Meaning |
|---|---|
| **PS-FACT** | Quoted or paraphrased directly from the official problem statement. |
| **PROTOTYPE** | Exists and runs in the current codebase (`backend-py/` FastAPI + `frontend/` React). |
| **TEAM DESIGN** | Our proposed model or target — designed, not (yet) fully built. |
| **VERIFIED METRIC** | A number measured on a real run. Unmeasured slots are marked **DATA REQUIRED**. |
| **REFERENCE** | An external standard or source, cited in §34. |

No statistic in this document is invented. Where a figure depends on a runtime process (e.g. exact seeded parcel count after probabilistic gap-dropping), it is flagged **DATA REQUIRED — measure before quoting**.

---

## Table of Contents

1. Executive Overview
2. The Complete Problem Statement (PS-to-Module Mapping)
3. Department-Wise Problem Analysis
4. Problem-to-Solution Mapping
5. Solution Overview
6. End-to-End Pipeline
7. Departmental Workflow Architecture
8. Parcel-Centric Architecture
9. GIS Architecture
10. System Architecture Diagram
11. Data Architecture & ER Model
12. Technology Stack
13. Uniqueness & Innovation
14. AI Pipeline (Decision-Support, Human-in-Loop)
15. Document Processing Pipeline
16. Feasibility Analysis
17. Tricky Technical Challenges
18. Scalability
19. Cost Analysis
20. Security Architecture
21. Reliability & Fault Tolerance
22. Performance Optimization
23. Implementation Strategy (10 Phases)
24. Testing Strategy
25. Impact & Benefits
26. Before vs After
27. Future Scope
28. Key Performance Indicators
29. Risk Analysis
30. Governance & Auditability
31. Reference Architecture Diagrams
32. Master End-to-End Workflow
33. References
34. Final Summary

---

## 1. Executive Overview

**BhoomiSetu** ("Bhoomi" = land, "Setu" = bridge) is a functional prototype of an integrated GIS-based Land Stack: a single interoperable platform that binds every land-related dataset — cadastral geometry, Record of Rights, registration, planning/zoning, taxation, restrictions, encumbrances, disputes, and survey — to **one shared parcel record**, and drives every citizen and departmental interaction through **one auditable workflow engine**.

The problem the PS names is fragmentation: *"land governance involves multiple institutions maintaining information in fragmented, disconnected systems"* **(PS-FACT)**. Most digital-land efforts respond by building yet another department system. BhoomiSetu instead treats the **parcel** as the integration primitive — every record, every workflow, every map layer hangs off a parcel keyed by **ULPIN** (the PS-suggested national identifier) plus an internal `canonicalParcelId`. This is the entire thesis:

> **One Parcel. Every Record. One Trusted Workflow.**

**What exists today (PROTOTYPE):** a running React + FastAPI application with real PostGIS spatial queries over **~6,120 seeded parcels across 58 clusters in 30 States/UTs**, 32 implemented features, 8 departmental officer roles, an AI assistant + AI request-routing (Groq), OCR document verification, satellite change-detection via Google Earth Engine, an 11-language Bhashini UI, a unified case-management engine, and RBAC + JWT + audit logging throughout.

**What is designed but not fully built (TEAM DESIGN):** the full multi-department resolution engine with SLA sweeping, the complete geometry-versioning survey workflow, and the ML-based (rather than heuristic) predictive layer. These are labelled honestly throughout, because the PS asks for a *scalable prototype*, and a prototype that claims to be production is less defensible to evaluators than one that draws the line clearly.

**Why it wins the evaluation:** the PS explicitly requires a *"Standard Technical Document"* covering API standards, interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX guidelines, color schemas, and deployment/scalability **(PS-FACT)**. This document is that deliverable, and every technical claim in it is traceable to running code or a labelled design.

**The one-sentence pitch:** *Each officer sees only their department's slice of work, but every action writes back to one shared parcel record — so a mutation approval auto-updates tax liability, a restriction flag blocks encumbrance registration elsewhere, a dispute pauses pending registration on the same survey number, and a survey correction propagates area changes to RoR, Tax, and Planning. That cross-department consistency is the actual problem statement — not any single dashboard.*

---
## 2. The Complete Problem Statement (PS-to-Module Mapping)

**Problem Statement:** SIH26014 — *Land Stack: an integrated GIS-based digital platform bringing all land-related datasets, workflows, and services into a single interoperable framework* **(PS-FACT)**.

**Context (PS-FACT):** The Department of Land Resources launched Land Stack pilots in **Chandigarh and Tamil Nadu on 31 December 2025**, with a proposed expansion to one city and one village in every State/UT, then nationwide. The central difficulty is that **land is a State subject** — record formats, database structures, units of measurement, field sets, language, terminology, and workflows vary across states. The challenge is a *scalable prototype capable of integrating diverse datasets into a common interoperable State-level framework*.

### PS requirement → BhoomiSetu module

| PS requirement (paraphrased, PS-FACT) | BhoomiSetu module | Status |
|---|---|---|
| Georeferenced cadastral maps, parcel boundaries, ULPIN base layer | PostGIS parcel geometry (SRID 4326) + `ulpin`/`canonicalParcelId` identity | PROTOTYPE |
| Essential layers: RoR, registration, master plan, building permission, encumbrance/mortgage, land use & zoning | Department record tables + spatial zoning overlays, all parcel-linked | PROTOTYPE (partial) |
| Additional layers: utility infrastructure, taxation, valuation, infra networks, environmental/restriction zones | Infrastructure/restriction spatial overlays + tax records + value-band column | PROTOTYPE |
| Each parcel uniquely identifiable, linked to multiple governance layers | Parcel 360° aggregated view | PROTOTYPE |
| Parcel-level GIS visualization + data exploration | MapLibre client + `/gis` GeoJSON + MVT vector tiles | PROTOTYPE |
| Interoperability via open APIs, standardized metadata | Canonical model + State Adapters (`state_a`/`state_b_land_records`) | PROTOTYPE (2 adapters) / TEAM DESIGN (N adapters) |
| Secure auth, RBAC, audit trails | JWT + `require_roles()` RBAC + `audit_logs` | PROTOTYPE |
| Citizen features: parcel search, ownership verification, status tracking, service requests | Citizen portal + case tracking + "Get Assistance" AI intake | PROTOTYPE |
| AI/ML, satellite change detection, predictive analytics, workflow automation, decision-support dashboards | Groq AI assistant/routing, Earth Engine change detection, risk-score heuristic, case engine, analytics dashboard | PROTOTYPE (heuristic) / TEAM DESIGN (trained ML) |
| Modular, scalable, configurable, replicable national framework | Configurable workflow pipelines, per-state adapters, cluster-per-state seeding | PROTOTYPE + TEAM DESIGN |
| Standard Technical Document | This document | PROTOTYPE |

**The core insight:** the PS's three-layer taxonomy (Base → Essential → Additional) is not just a data classification — it is the dependency order. You cannot link RoR to a parcel until the parcel has geometry and an identity; you cannot compute a valuation or risk score until the essential governance layer exists. BhoomiSetu's architecture is built in exactly this order (§8, §11).

---
## 3. Department-Wise Problem Analysis

The PS names the fragmented institutions explicitly. BhoomiSetu models each as a first-class officer role mapped to a real-world equivalent and a specific PS pain point. This 8-way split (7 named in the PS + Dispute as operational glue + Survey for spatial integrity) is a deliberate answer to *"multiple institutions maintaining information in fragmented, disconnected systems"* **(PS-FACT)** — we model each fragment honestly rather than pretending it is one department.

| Officer role (PROTOTYPE) | Real-world equivalent | PS pain point addressed | Fragmentation today |
|---|---|---|---|
| **Land Record Officer** | Talathi / Tehsildar (RoR, 7/12, mutation) | "Record of Rights... managed independently" | RoR lives in revenue dept, disconnected from registration |
| **Registration Officer** | Sub-Registrar (IGR) | "Registration records" | Sale deed registered but mutation not reflected — the classic gap |
| **Planning Officer** | Town Planning / Master Plan authority | "Master Plan, Building Permission, land use" | Zoning maps not linked to individual parcels |
| **Tax Officer** | Revenue / Municipal tax dept | "Property taxation records" | Tax assessed on stale area/classification |
| **Restriction Officer** | Collector's office (ceiling, forest, gairan) | "Restrictions" | Restricted land silently transferable via another dept |
| **Encumbrance Officer** | Sub-Registrar's encumbrance wing | "Mortgage records / other databases" | Disputed/restricted land mortgaged through a blind spot |
| **Dispute Officer** | Tehsildar's Revenue Court | (operational glue) | Complaints chase paperwork across all of the above |
| **Survey Officer** | District Survey Office | "Cadastral maps... managed independently" | Ad-hoc geometry edits with no audit or propagation |

### The fragmentation each department suffers, and the fix

- **Registration ↔ Land Records:** registration and mutation are legally separate steps handled by different offices. Today a registered sale deed may never reach the RoR. **Fix (TEAM DESIGN):** Registration Officer's confirmation sends a linking signal to the Land Record Officer's queue — an explicit modelled handoff, plus automatic duplicate-registration flagging on the same survey number.
- **Tax ↔ Land Records:** tax rates differ for agricultural vs non-agricultural land; a mutation that changes classification should re-trigger assessment. **Fix (TEAM DESIGN):** tax reassessment auto-triggered on approved mutation with changed area/classification — one verified change propagates.
- **Restriction ↔ everything:** a ceiling-act or forest flag must *block* transactions, not merely display. **Fix (TEAM DESIGN):** restriction flags enforced at the data layer — an active restriction warns/blocks registration and encumbrance actions in other officers' queues.
- **Encumbrance ↔ Dispute ↔ Restriction:** because these live on one parcel record, the Encumbrance Officer automatically sees a parcel under dispute or restriction being used for a new loan — preventing the exact fraud fragmented systems allow.
- **Survey ↔ RoR/Tax/Planning:** geometry corrections are first-class, auditable workflows owned by the Survey Officer; an approved polygon change propagates area deltas to RoR, Tax, and Planning with no manual re-entry.

**The unifying line (for the demo):** *every officer sees only their slice, but every action writes back to one shared parcel — that cross-department consistency is the problem statement itself.*

---
## 4. Problem-to-Solution Mapping

Every gap the PS describes maps to a concrete BhoomiSetu mechanism. This table is the spine of the whole project.

| Gap (PS-FACT) | Consequence today | BhoomiSetu mechanism | Status |
|---|---|---|---|
| Fragmented, disconnected systems | Records inconsistent across departments | Single canonical parcel record; every table foreign-keys to `canonicalParcelId` | PROTOTYPE |
| Limited interoperability | Duplication of effort, manual reconciliation | Canonical envelope + State Adapters (snake_case, unit normalization) | PROTOTYPE (2) / TEAM DESIGN (N) |
| Delays obtaining ownership info | Citizen waits weeks, visits multiple offices | Parcel 360° — one query returns ownership + all linked records | PROTOTYPE |
| Lack of transparency in transactions | Citizen cannot see status | Case timeline + status tracking + audit log | PROTOTYPE |
| Inconvenience to citizens | Physical office visits, forms | "Get Assistance" AI intake → auto-routed case | PROTOTYPE |
| Diverse state formats/units | No common view possible | Adapter converts (State A hectares×10 000; State B sqft÷10.7639) into canonical m² | PROTOTYPE |
| No spatial framework | Records are text, not map-linked | PostGIS geometry per parcel; every layer spatially queryable | PROTOTYPE |
| No change detection | Illegal construction/encroachment unseen | Earth Engine Sentinel-2 NDVI change detection → governance alerts | PROTOTYPE |
| No decision support | Officers act on incomplete evidence | Evidence chain pre-assembled per case; AI explanations; risk score | PROTOTYPE |
| Land is a State subject (diversity) | One-size system impossible | Configurable workflow pipelines + per-state adapters + config-driven departments | PROTOTYPE + TEAM DESIGN |

**The design principle behind every row:** BhoomiSetu does **not** replace department systems (politically and technically infeasible — land is a State subject). It sits above them as an interoperability + workflow layer, ingesting through adapters and writing back through the same. This is why "canonical model + adapters" appears everywhere: it is the only architecture that respects state autonomy while delivering a unified view.

---
## 5. Solution Overview

BhoomiSetu is a three-tier web platform with a spatial database core.

```
┌───────────────────────────────────────────────────────────────────┐
│  CITIZEN            OFFICER (×8 depts)        VERIFIER        ADMIN  │
│  ─ parcel search    ─ department queue        ─ field visits  ─ config│
│  ─ My Parcels       ─ approve/reject          ─ geo-tagged     ─ users│
│  ─ Get Assistance   ─ evidence review           evidence       ─ layers│
│  ─ status tracking  ─ decisions               (no decisions)   ─ rules│
└───────────────────────────────────────────────────────────────────┘
                              │  React 18 + MapLibre GL + Bhashini i18n
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                    FastAPI  (backend-py, /api/v1)                    │
│  27 routers · JWT+RBAC · slowapi rate limit · audit · Celery tasks   │
│  ┌─────────────┬──────────────┬───────────────┬──────────────────┐  │
│  │ Case/Workflow│ AI (Groq)    │ GIS + Tiles   │ Interop Adapters │  │
│  │ engine       │ OCR / Earth  │ (PostGIS)     │ (State A/B)      │  │
│  │              │ Engine       │               │                  │  │
│  └─────────────┴──────────────┴───────────────┴──────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                              │  SQLAlchemy 2.0 + GeoAlchemy2
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│              PostgreSQL + PostGIS (SRID 4326, GIST indexes)          │
│  58 tables · parcel hub · department records · spatial overlays ·    │
│  terrain tiles · cases · governance alerts · audit · users           │
└───────────────────────────────────────────────────────────────────┘
```

**The five pillars:**

1. **Parcel-centric core (PROTOTYPE)** — one hub table (`parcels`) with geometry + precomputed governance columns; everything else references it.
2. **Interoperability layer (PROTOTYPE, 2 adapters)** — canonical envelope + State Adapters normalize diverse state schemas without replacing them.
3. **Workflow / case engine (PROTOTYPE)** — one citizen request becomes one case fanning out to multiple department tasks, each auditable.
4. **GIS + spatial intelligence (PROTOTYPE)** — real PostGIS queries, MVT tiles, satellite change detection, spatial-overlap computation.
5. **AI as decision-support (PROTOTYPE)** — Groq-backed intake/routing/explanation, always human-in-loop, never authoritative (§14).

**What a judge sees in the demo:** open a parcel → Parcel 360° shows ownership, tax, registration, disputes, restrictions, and risk in one view; file a "Get Assistance" request in Hindi → AI classifies and routes it to the right department; the officer reviews a pre-assembled evidence chain and decides; the decision writes back to the shared record and propagates.

---
## 6. End-to-End Pipeline

The canonical citizen journey, from request to resolution, showing where each subsystem engages.

```
 CITIZEN                    AI / SYSTEM                 OFFICER(S)              DATA
 ───────                    ───────────                 ──────────              ────
 1. "My tax bill is                                                            
    wrong on plot X"  ──▶  2. AI understands intent                            
    (Hindi, voice/text)       (Groq: classify →                               
                              structured request)                              
                                    │                                          
                              3. AI routing picks                              
                                 department(s) = TAX                           
                                 (+ rationale, stored)                         
                                    │                                          
                              4. Case created                                  
                                 (1 active case per     ──▶ 5. TAX task lands  
                                 citizen+parcel guard)      in officer queue   
                                                              │                
                                                        6. Officer opens       
                                                           pre-assembled       
                                                           evidence chain:     
                                                           parcel 360 + OCR    
                                                           match% + history    
                                                              │                
                              7. (optional) Verifier    ◀── assign field visit 
                                 uploads geo-tagged                            
                                 photo evidence                                
                                    │                                          
                                                        8. Officer decides     
                                                           (mandatory reason)  
                                                              │                
                                                        9. Transactional       ──▶ 10. Parcel record
                                                           write-back,             updated + history
                                                           preserving history       preserved +
                                                              │                     audit entry
                              11. Cross-dept propagation ◀────┘                     
                                  (tax reassess, etc.)                              
                                    │                                               
 12. Citizen sees status  ◀── notification (bilingual                              
     + resolution              SMS/Email + in-app)                                 
```

**Stage labels:**
- Stages 1–4: PROTOTYPE (Get Assistance intake, AI understand/route, case creation with `ACTIVE_CASE_EXISTS` guard).
- Stages 5–6, 8–10: PROTOTYPE (officer queue, decision with mandatory reason, transactional write-back, audit).
- Stage 7: PROTOTYPE (verifier assignment + geo-tagged field evidence).
- Stage 11 (automatic cross-department propagation): **TEAM DESIGN** — the propagation rules are specified in the workflow spec; the shared-record substrate that makes them a small change already exists.
- Stage 12: PROTOTYPE (in-app feed; bilingual SMS/Email via Bhashini + TextBee/SMTP).

**The invariant that makes this trustworthy:** *one parcel can have only one active request of a given type at a time* (enforced: `ACTIVE_CASE_EXISTS` → HTTP 409), **but multiple distinct disputes may coexist on the same parcel** — because a boundary dispute and an inheritance dispute are genuinely separate matters. This rule is preserved everywhere in the engine.

---
## 7. Departmental Workflow Architecture

This section is deliberately **not generic**. Each department has its own queue, its own evidence needs, its own decision semantics, and its own cross-department propagation. All share one substrate (the case engine) but differ in behaviour.

### Shared substrate (PROTOTYPE)
- **Case engine** (`app/services/case_service.py`, `app/models/case.py`): lifecycle `CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED`, enforced by `CASE_STATUS_TRANSITIONS`.
- **One case → many `DepartmentTask`s**: a request touching Tax and Restriction creates two tasks; each department decides independently.
- **Every decision requires a mandatory reason** (surfaced to the citizen and stored on the timeline + audit log).
- **Resolution modes**: DIGITAL / FIELD_VERIFICATION / OFFLINE_APPOINTMENT / HYBRID / MANUAL_REVIEW (TEAM DESIGN for the full set; DIGITAL + FIELD_VERIFICATION are PROTOTYPE).

### Per-department behaviour

**Land Record Officer** — queue: mutation & name/area correction requests. Sees OCR-extracted fields side-by-side with citizen-typed fields + match %. On approve: RoR update → new parcel version + audit; citizen parcel flips `Pending Verification → Registered`. *Unique value:* verification collapses from a full file/site check to a confirm-or-flag decision.

**Registration Officer** — queue: registration-linked requests. Verifies deed reference (number/date/parties) against uploaded proof; confirmation signals Land Records for mutation. *Unique value:* **automatic duplicate-registration flagging** on a survey number that already has an active registered owner — before the file is even opened (TEAM DESIGN).

**Planning Officer** — queue: building permission, land-use change, zoning queries. System overlays the parcel on the zoning layer and highlights (in red) if the requested use violates the zone, before manual review. *Unique value:* geometry-linked automatic zoning-conflict check (PROTOTYPE — spatial overlap computation exists; the officer-facing conflict badge is the last-mile wiring).

**Dispute Officer** — queue: complaints classified as "Dispute Filing". Evidence chain (complaint + OCR-verified doc + verifier geo-photos + prior claim history on the survey number) is pre-assembled. Can escalate to Collector-level (mirrors SDO→Collector→Commissioner). *Unique value:* the officer never chases paperwork across departments.

**Tax Officer** — queue: tax dispute / reassessment. Checks area & classification (agri vs non-agri) against RoR. *Unique value:* reassessment **auto-triggered** on an approved mutation with changed area/classification (TEAM DESIGN).

**Restriction Officer** — queue: add/remove/verify a restriction flag. Cross-checks the source order (forest notification, ceiling-act order). *Unique value:* flags **enforced at the data layer** — an active restriction blocks/warns on registration & encumbrance elsewhere (TEAM DESIGN).

**Encumbrance Officer** — queue: EC requests, new mortgage entries. Verifies the parcel is not over-leveraged / under active dispute or restriction before approving. *Unique value:* sees a disputed/restricted parcel being used for a new loan — the exact fraud fragmented systems allow.

**Survey Officer** — queue: measurement requests, mutation-linked area corrections, court-ordered demarcation, geometry-correction flags. Side-by-side current vs measured geometry with area delta; measurement evidence chain attached. On confirmed discrepancy: approves corrected polygon → new parcel version + audit → propagates area to RoR/Tax/Planning. *Unique value:* **GIS geometry corrections are first-class, auditable workflows** owned by one role, not ad-hoc edits by anyone (TEAM DESIGN; `case_parcel_geometry_versions` model exists).

### Configurable pipelines (PROTOTYPE)
`workflow_pipeline_configs` + the admin "Workflow Oversight" page let an admin define, per request type, which departments form the pipeline and in what order — the mechanism that makes the platform *configurable for different administrative contexts* **(PS-FACT requirement)**.

---
## 8. Parcel-Centric Architecture

The single most important design decision: **the parcel is the integration primitive.** Every dataset, workflow, map layer, and AI explanation resolves to a parcel. This is what turns "many disconnected systems" into "one trusted record."

### Identity (PROTOTYPE)
- **`ulpin`** — the PS-suggested Unique Land Parcel Identification Number, the national/external identity.
- **`canonicalParcelId`** — internal stable key that every other table foreign-keys to. External systems may use different keys; the `IdentifierResolverService` maps them to the canonical id (the interoperability seam).

### The hub table `parcels` (PROTOTYPE)
`POLYGON/4326` geometry + **precomputed governance columns** materialized for fast map rendering:
`tax_status`, `legal_status_severity`, `value_band`, `risk_score`, `masterplan_mismatch`, `unauthorized_construction_suspected`, plus `cluster_id`, `ulpin`, `current_state` (JSON).

These columns are *denormalized on purpose* — a vector tile renderer coloring 6,000 parcels by risk cannot run 6,000 join-and-aggregate queries per pan/zoom. Celery tasks recompute them (§14, §22).

### Parcel 360° (PROTOTYPE)
One endpoint aggregates everything hanging off a parcel:

```
                          ┌──────────────┐
                          │   PARCEL     │  ulpin + canonicalParcelId
                          │  (geometry)  │  + precomputed columns
                          └──────┬───────┘
        ┌──────────┬────────┬────┼────┬─────────┬──────────┬─────────┐
        ▼          ▼        ▼    ▼    ▼         ▼          ▼         ▼
   Ownership  Registration Tax  Dispute Restriction Encumbrance Survey  Crop
   /RoR       records     records records  records   records   records records
        │          │        │    │    │         │          │         │
        └──────────┴────────┴────┴────┴─────────┴──────────┴─────────┘
                          each with per-domain HISTORY tables
                          (tax_history, dispute_history, …,
                           parcel_historical_states per year)
                                     +
        neighbours (TOUCHING|NEARBY) · documents · citizen links · cases
```

### Why this beats a federated-query approach
A federated design (query each department live and merge at read time) fails the PS's latency and consistency goals: any department being down breaks the view, and there is no single place to enforce cross-department rules (a restriction blocking an encumbrance). By **materializing the canonical parcel record** and syncing through adapters, BhoomiSetu gets a consistent, always-available, rule-enforceable view — while adapters keep the source-of-truth in each department's system where the PS's "land is a State subject" constraint requires it.

### History is never destroyed (PROTOTYPE)
Every domain has a history table (`tax_history_records`, `dispute_history_records`, `ownership_history_records`, …) plus `parcel_historical_states` (per-year attribute snapshot) and `case_parcel_geometry_versions` (versioned geometry). A mutation *appends*; it never overwrites — which is what makes the audit trail and the historical-imagery comparison (§15) possible.

---
## 9. GIS Architecture

**PROTOTYPE — real PostGIS, no fallback.** Earlier project documentation described a GeoJSON-text-with-SQLite-fallback path; the current `backend-py` backend stores native PostGIS `Geometry(SRID 4326)` and runs real spatial SQL with **no SQLite fallback** (`app/models/parcel.py`, `app/routers/gis.py` header state this explicitly). Treat any older doc claiming a SQLite path as stale.

### Storage & standards
- **CRS:** SRID **4326** (WGS84) throughout — the PS calls for geospatial standards; WGS84/GeoJSON is the interoperable baseline. **(REFERENCE: OGC GeoJSON RFC 7946.)**
- **Geometry types:** parcels `POLYGON`, roads `LINESTRING`, infrastructure `POINT`/`LINESTRING`, all SRID 4326.
- **Spatial indexing:** GIST indexes on all geometry columns, added by Alembic migration (`15753b4d91a3_add_gist_spatial_indexes.py`, `1b5a3b6280c2_...`) — not by the model definition (the parcel column sets `spatial_index=False`; the index is a migration concern). This matters at scale: without GIST, a viewport query is a full table scan.

### Query patterns (PROTOTYPE)
| Operation | PostGIS function | Endpoint |
|---|---|---|
| Viewport / bbox load | `ST_Intersects(geom, ST_MakeEnvelope(...,4326))` | `GET /gis/parcels` |
| Cluster hierarchy bounds | `ST_XMin/YMin/XMax/YMax` | `GET /gis/clusters-hierarchical` |
| Point-in-parcel | `ST_Contains` / `ST_Centroid` | change detection, spatial overlap |
| Neighbours | `parcel_neighbours` (TOUCHING\|NEARBY) precomputed | `/parcels/.../context` |

### Vector tiles (PROTOTYPE)
`app/routers/map_tiles.py` serves Mapbox Vector Tiles at `/api/v1/tiles/{z}/{x}/{y}.pbf` (+ roads/buildings/landcover/elevation) using `ST_AsMVT` / `ST_AsMVTGeom` / `ST_TileEnvelope`, extent 4096, buffer 64, transformed to EPSG:3857 for web-mercator tiling. **(REFERENCE: Mapbox Vector Tile spec.)** This is the correct architecture for rendering thousands of parcels smoothly — the database emits binary tiles the client renders directly, instead of shipping raw GeoJSON.

### Map layers (PROTOTYPE — 20 `LayerKey` values, 4 source types)
| Group | Layers | Source |
|---|---|---|
| Parcel relationships | selected, adjacent, nearby, cluster, sameDistrict | `/gis/parcels` + `parcel_neighbours` |
| Attribute colouring | taxStatus, legalStatus, circleRate, riskScore, mismatch, unauthorized | precomputed columns on `parcels` |
| GIS overlays | zoning, restriction, infrastructure, changeDetection, adminNotes | `/gis/*` GeoJSON (adminNotes admin-only) |
| MVT tiles | roads, buildings, landcover, elevation | `/tiles/*.pbf` from terrain tables |

### Real-world geometry (PROTOTYPE)
Seeded parcels are not toy squares: subdivision is topology-aware and **snapped to real OSM roads** (313,927 highways extracted from 6 Geofabrik India-zone PBF files) within a 30m radius, sized to standard Indian residential plots (Guntha/Cent/Ground regional units). This makes the demo map look like a real cadastre, not a grid.

---
## 10. System Architecture Diagram

A multi-layer view of the running system (PROTOTYPE unless labelled).

```
╔═══════════════════════════════════════════════════════════════════════════╗
║ PRESENTATION LAYER  — React 18.2 · TS 5.0 · Vite 4.4 · Tailwind 3.3         ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┐                  ║
║  │ Citizen     │ Officer     │ Verifier    │ Admin        │  MapLibre GL 4.0 ║
║  │ Portal      │ Portal (×8) │ Portal      │ Portal       │  Recharts 2.8    ║
║  └─────────────┴─────────────┴─────────────┴─────────────┘  Zustand · rquery║
║  Bhashini i18n (11 langs, live switch) · JWT in client · role-gated routes   ║
╚════════════════════════════════════│════════════════════════════════════════╝
                                      │ HTTPS · /api/v1 · JSON + .pbf tiles
╔════════════════════════════════════▼════════════════════════════════════════╗
║ APPLICATION LAYER  — FastAPI (backend-py) · 27 routers · slowapi rate limit   ║
║                                                                               ║
║  ┌── EDGE ──────────────────────────────────────────────────────────────┐   ║
║  │ CORS allowlist · JWT verify (HS256) · require_roles() RBAC · audit log │   ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
║  ┌── DOMAIN SERVICES (~40 modules) ──────────────────────────────────────┐   ║
║  │ Case/Workflow  │ Parcels/GIS │ AI (Groq)   │ Interop     │ Governance  │   ║
║  │ engine         │ /Spatial    │ OCR/Gemini* │ (canonical  │ alerts +    │   ║
║  │                │ /Tiles      │ EarthEngine │  + adapters)│ rules       │   ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
║  ┌── ASYNC (Celery 5.4 + Redis) ─────────────────────────────────────────┐   ║
║  │ recompute risk/legal/value/masterplan columns · EE imagery · OCR · ETL │   ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
╚════════════════════════════════════│════════════════════════════════════════╝
                                      │ SQLAlchemy 2.0 · GeoAlchemy2 0.16 · Alembic
╔════════════════════════════════════▼════════════════════════════════════════╗
║ DATA LAYER  — PostgreSQL + PostGIS (SRID 4326, GIST) · Redis (cache/broker)   ║
║  58 tables: parcel hub + history · dept records · spatial overlays · terrain  ║
║  tiles · cases · governance · audit · users · interop (state_a/state_b)       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
   EXTERNAL: Groq (LLM) · Google Earth Engine (Sentinel-2) · Bhashini (i18n/TTS/ASR)
             OpenRouter (narratives) · TextBee (SMS) · SMTP (email)
   * Gemini configured but not wired into AI endpoints — flag as configured-but-unused
```

**Layer responsibilities:**
- **Presentation:** stateless React SPA; all authority server-side. Map rendering client-side from vector tiles + GeoJSON.
- **Application:** FastAPI enforces auth/RBAC/rate-limit at the edge, runs domain logic in services, offloads expensive recompute to Celery. The LLM never runs SQL — it emits a structured filter the backend executes (§14).
- **Data:** PostGIS is the single source of truth for the canonical record; Redis is cache + Celery broker; department source systems (in production) sit behind adapters.

**Deployment (PROTOTYPE):** `docker compose up --build` → 3 services (nginx-fronted frontend, FastAPI backend, PostGIS). Production hard-checks refuse to boot without a real `JWT_SECRET`/DB creds; Swagger disabled in production.

---
## 11. Data Architecture & ER Model

**PROTOTYPE — 58 SQLAlchemy models** (`backend-py/app/models/*.py`), all mapped to one `Base`. Every geometry column is PostGIS `Geometry`, SRID 4326.

### The three PS layers, realized as tables

The PS's Base → Essential → Additional taxonomy is the actual table organization:

```
LAYER 1 — BASE SPATIAL (foundation, must exist first)
  parcels (hub: geometry + identity + precomputed cols)
  parcel_identifiers · parcel_neighbours · road_networks · building_footprints
  land_cover · elevation_tiles · parcel_terrain_profiles

LAYER 2 — ESSENTIAL GOVERNANCE (linked to each parcel)
  ownership_history_records (RoR)   registration_records
  planning_records (master plan)    tax_records
  restriction_records               encumbrance_records / encumbrance_certificates
  dispute_records                   survey_records / survey_documents
  zoning_overlays · restriction_zones

LAYER 3 — ADDITIONAL / DERIVED (use-case & analytics)
  infrastructure_features · change_detection_events · governance_alerts
  risk_score / value_band / masterplan_mismatch (precomputed columns)
  crop_records · admin_map_notes

INTEROP (cross-cutting)
  state_a_land_records · state_b_land_records  (adapter source shapes)
```

### Core ER (case-centric slice)

```
 CITIZEN ──< CITIZEN_PARCELS >── PARCEL ──1:1── (precomputed governance cols)
    │                              │
    │                              ├──< OWNERSHIP_HISTORY / TAX / DISPUTE / … RECORDS
    │                              ├──< PARCEL_HISTORICAL_STATES (per year)
    │                              └──< CASE_PARCEL_GEOMETRY_VERSIONS
    │
    └──< CASE >──< DEPARTMENT_TASK >── (assigned role/department)
           │  │
           │  ├──< AI_ANALYSIS          (understand/route output, stored)
           │  ├──< ROUTING_DECISION     (per-department routing + rationale)
           │  ├──< APPOINTMENT
           │  ├──< CASE_TIMELINE_EVENT  (every material state change)
           │  ├──< VERIFICATION_EVIDENCE (geo-tagged field photos)
           │  └──< FEEDBACK             (citizen, post-resolution)
           │
           └── governed by CASE_STATUS_TRANSITIONS + SLA_CONFIG

 GOVERNANCE_ALERT ── created by → change detection / historical compare / masterplan task
 AUDIT_LOG ── every mutation, actor-attributed
```

### Table families (58 total, PROTOTYPE)
- **Parcel core + history (13):** hub, identifiers, neighbours, citizen links, documents, ownership history, crop records, and per-domain history (tax/dispute/encumbrance/restriction/registration) + per-year snapshots.
- **Spatial overlays (5):** zoning, restriction zones, infrastructure, admin notes (admin-only), change-detection events — each carrying a `parcel_ids ARRAY` link.
- **Terrain / Earth Engine (5, GIST-indexed):** road networks, building footprints, land cover, elevation tiles, parcel terrain profiles.
- **Workflow (3) + Cases (11) + Governance (2):** pipeline configs, workflows, steps; case engine models; governance alerts + rules.
- **Department records (9 + 2 interop):** per-department record tables + certificates/documents + State A/B land records.
- **Users / admin / misc:** users, departments (capability-matrix JSON), audit logs, notifications, pending registrations, processing jobs, profile fields, verification evidence.

### Interoperability — the canonical envelope (PROTOTYPE, 2 adapters)
The PS's hardest requirement is that *land is a State subject* with diverse formats/units. BhoomiSetu answers with a **canonical envelope** (snake_case, normalized units) and per-state **adapters**:
- State A stores area in hectares → adapter ×10 000 → canonical m².
- State B stores area in sqft → adapter ÷10.7639 → canonical m².
- `IdentifierResolverService` maps each state's parcel key to `canonicalParcelId`.

Two adapters are built as a proof of the pattern; adding State C is a new adapter class, not a schema change — which is exactly the *replicable national framework* the PS asks for **(scaling to N adapters = TEAM DESIGN)**.

---
## 12. Technology Stack

Verified against `frontend/package.json` and `backend-py/requirements.txt`. **Honesty note:** some older slides listed PyTorch, scikit-learn, GeoServer, and Rasterio as stack — **these are NOT code dependencies** and are labelled TEAM DESIGN below, not PROTOTYPE. Overstating the stack is the fastest way to lose credibility with a technical reviewer.

### Frontend (all PROTOTYPE)
| Tech | Version | Why selected |
|---|---|---|
| React | 18.2 | Component model + ecosystem; concurrent rendering for map-heavy UI |
| TypeScript | 5.0 | Type safety across a large multi-portal app |
| Vite | 4.4 | Fast dev server + optimized builds |
| Tailwind | 3.3 | Consistent design tokens (earth-tone schema, §20/UI) without CSS sprawl |
| **MapLibre GL** | 4.0 | Open-source vector-tile renderer (no Mapbox lock-in); renders `.pbf` tiles natively |
| Zustand | 4.4 | Minimal global state, no Redux boilerplate |
| Recharts | 2.8 | Analytics dashboard charts |
| react-query | 4.32 | Server-state caching, retries, background refetch |
| mapbox-gl-draw | — | Admin geometry drawing tool (scoped to layer authoring) |

### Backend
| Tech | Status | Version | Why selected |
|---|---|---|---|
| FastAPI | PROTOTYPE | 0.115 | Async, Pydantic-native, auto-OpenAPI (the PS wants open API standards) |
| Pydantic | PROTOTYPE | 2.10 | Request/response validation; CamelModel base for JSON |
| SQLAlchemy | PROTOTYPE | 2.0 | Mature ORM; explicit transactions for history-preserving writes |
| GeoAlchemy2 | PROTOTYPE | 0.16 | PostGIS geometry types in the ORM |
| Alembic | PROTOTYPE | — | Versioned migrations (incl. GIST index creation) |
| Celery | PROTOTYPE | 5.4 | Async recompute of precomputed columns + EE imagery |
| PostgreSQL/PostGIS | PROTOTYPE | — | Real spatial SQL; the only defensible choice for a cadastre |
| Redis | PROTOTYPE | 5.2 | Cache + Celery broker |
| GeoPandas / Shapely | PROTOTYPE | 1.0.1 / 2.0.6 | Geometry ops in seeding/analysis |
| osmium | PROTOTYPE | 4.3.1 | Parse Geofabrik OSM PBF for road snapping |
| OpenCV (headless) | PROTOTYPE | 4.10 | Document tamper heuristic |
| pytesseract | PROTOTYPE | — | OCR field extraction |
| reportlab / PyMuPDF / pypdf | PROTOTYPE | — | Official document PDF generation |
| **openai SDK → Groq** | PROTOTYPE | 1.57 | LLM intake/routing/explanation (OpenAI-compatible) |
| earthengine-api | PROTOTYPE | 1.4.3 | Sentinel-2 satellite change detection |
| google-generativeai (Gemini) | PROTOTYPE (configured, **not wired**) | 0.8.3 | Present in config but not in the AI request path — do not claim it powers the assistant |
| slowapi | PROTOTYPE | — | Per-IP rate limiting |
| jose (JWT) + bcrypt | PROTOTYPE | — | Auth + password hashing |
| PyTorch / scikit-learn | **TEAM DESIGN** | — | For a *trained* predictive model; today the risk score is a transparent heuristic |
| GeoServer / Rasterio | **TEAM DESIGN** | — | Not dependencies; PostGIS + Earth Engine cover current needs |

### External services (PROTOTYPE)
Groq (LLM), Google Earth Engine (Sentinel-2, Community tier), Bhashini (translation/transliteration/TTS/ASR), OpenRouter (historical-comparison narratives only), TextBee (SMS), SMTP (email), Google OAuth + OTP (auth).

**Stack rationale in one line:** every choice is open-source or government infrastructure (Bhashini, Earth Engine), avoiding vendor lock-in — which matters for a *national framework* that states must be able to self-host.

---
## 13. Uniqueness & Innovation

Grouped into three honesty tiers so reviewers can weigh them fairly.

### Tier A — Common (table stakes; we do them, but so would any strong entry)
- GIS parcel visualization, parcel search, role-based dashboards, citizen service requests, audit logging, RBAC. All PROTOTYPE — necessary, not differentiating.

### Tier B — PS-required, done well (the PS explicitly asks; our execution is strong)
1. **Canonical model + State Adapters (PROTOTYPE)** — real unit/format normalization (hectares↔m²↔sqft), the direct answer to "land is a State subject." Adding a state = one adapter class.
2. **Real PostGIS + MVT vector tiles (PROTOTYPE)** — not GeoJSON-over-HTTP; database-emitted binary tiles, GIST-indexed, web-mercator. Renders thousands of parcels smoothly.
3. **Satellite change detection via Earth Engine (PROTOTYPE)** — real Sentinel-2 NDVI, live-verified: a run over the Pune cluster returned 75 affected parcels → 75 governance alerts.
4. **11-language Bhashini UI (PROTOTYPE)** — full live language switch (10 Indian languages + English) with TTS/ASR voice I/O and search transliteration — using *Government of India* multilingual infrastructure, not a commercial translator.
5. **Configurable workflow pipelines (PROTOTYPE)** — admin defines per-request-type department pipelines; the "configurable for different administrative contexts" requirement, realized.

### Tier C — Beyond the PS (our genuine differentiators)
1. **Cross-department consistency as the product (PROTOTYPE substrate + TEAM DESIGN rules)** — one shared parcel record means a restriction flag can *block* an encumbrance elsewhere, a dispute can *pause* a registration, a survey correction *propagates* area to RoR/Tax/Planning. Fragmented systems structurally cannot do this. This is the thesis, not a feature.
2. **AI as interface, never authority (PROTOTYPE)** — the LLM classifies intent and drafts structured requests but **never runs SQL and never turns an allegation into a fact**; every response is schema-validated (a validation failure is a 502, never silently trusted). Human-in-loop by construction (§14).
3. **Separation of duties via role topology (PROTOTYPE)** — the Verifier role is *structurally* excluded from staff roles, so a verifier account *cannot* call approve endpoints — enforced by the role split itself, not by extra guard code. Elegant and auditable.
4. **Pre-assembled evidence chains (PROTOTYPE/TEAM DESIGN)** — before an officer opens a dispute, the complaint + OCR-verified document + verifier geo-photos + prior claim history are already assembled in one view.
5. **Transparent, explainable risk score (PROTOTYPE)** — a hand-weighted heuristic (tax 0.4 / dispute 0.3 / alerts 0.2 / restriction 0.1) with a plain-language rationale per factor — chosen deliberately over a black-box model because **no labelled outcome data exists to train or validate one**. Honesty as a design principle.
6. **History-preserving, geometry-versioned writes (PROTOTYPE)** — mutations append; geometry is versioned (`case_parcel_geometry_versions`). Nothing is destroyed, so the audit trail and year-over-year comparison are always possible.

**The differentiator sentence:** *Anyone can build eight dashboards. BhoomiSetu's innovation is that the eight dashboards write to one record with cross-department rules — which is the fragmentation problem solved, not merely displayed.*

---
## 14. AI Pipeline (Decision-Support, Human-in-Loop)

**Governing principle (PROTOTYPE):** AI is the *interface*, never the *authority*. It lowers the barrier to filing a request and pre-digests evidence, but a human officer makes every decision, and the model is never trusted blindly.

### Provider & safety rails (PROTOTYPE)
- **Primary LLM: Groq** (`app/services/groq_service.py`) via the OpenAI-compatible SDK, default model `openai/gpt-oss-20b`.
- **Every AI response is validated against a Pydantic schema.** A validation failure raises `AiResponseValidationError` → HTTP 502. The system never acts on unvalidated model output.
- **The LLM never runs SQL.** For data queries it emits a *structured filter* (state / district / tax_status / has_restriction / land_use / registration_status); the backend executes the real query. This eliminates prompt-injection-to-SQL and hallucinated data.
- Without an API key, endpoints degrade to 503 (never a crash). Rate-limited 30 req/min/IP.
- **Gemini** is configured (`gemini_service.py`, `config.py`) but **not wired** into the AI endpoints — we do not claim it powers anything.
- **OpenRouter** is used *only* by `narrative_service.py` for historical-comparison sentences.
- **No RAG / vector store.** "Grounding" is done by injecting real DB rows (parcel 360, feature list) into the prompt — retrieval from the source of truth, not embedding search. Honest labelling: this is *grounded prompting*, not RAG.

### AI functions (PROTOTYPE)
```
 CITIZEN QUERY ──▶ POST /ai/query
                    ├─ data question → LLM extracts structured filter → backend SQL → results
                    └─ "how do I use this" → answered from a features-grounded system prompt

 PARCEL/ALERT   ──▶ POST /ai/parcels/{id}/explain  (owner-aware, public)
 EXPLANATION        POST /ai/alerts/{id}/explain    (staff-only)
                    → {summary, risk_level, findings[], recommended_action}

 CASE INTAKE    ──▶ POST /ai/understand         (classify free-text intent)
 (Phase 2)          POST /ai/application-draft   (draft a structured application)
                    POST /ai/route               (pick department(s) + rationale)
```

### AI-based request routing (PROTOTYPE)
`request_routing_service.py`: Groq classifies a citizen's free-text request against the 8 real department codes, returning `{departments, reason}`, validated against a closed set (`DEPARTMENT_ROLE`). **On any failure (unconfigured/error/malformed/empty), it falls back to a deterministic `pipeline_for()`** — so routing is never a single point of failure. The AI's rationale is stored on the case and surfaced in the officer's notification. Live-verified: a tax-bill complaint routed to `TAX` alone (not the generic default), carrying the model's actual rationale.

### Human-in-loop guarantee (PROTOTYPE)
```
 AI classifies / drafts / explains   →   officer reviews evidence   →   officer decides
        (suggestion)                        (pre-assembled)              (mandatory reason,
                                                                          audit-logged)
 AI NEVER: writes to the record · approves a case · turns an allegation into a fact
```

**Why heuristic over trained ML for risk (PROTOTYPE):** the predictive score is a transparent weighted sum with per-factor rationale, chosen because there is no labelled ground-truth dataset of "bad" parcels to train or validate a model — a fabricated accuracy number would be dishonest. A trained model is TEAM DESIGN, contingent on real outcome data.

---
## 15. Document Processing Pipeline

Two distinct pipelines: **document verification (OCR)** for citizen-submitted proofs, and **official document generation (PDF)** for issuing records.

### Document verification / OCR (PROTOTYPE)
```
 Citizen uploads proof (image)
      │
      ▼
 pytesseract OCR ──▶ extract structured fields (name, survey no, area, …)
      │
      ▼
 OpenCV authenticity heuristic ──▶ tamper signal (not a legal verdict)
      │
      ▼
 Field matching ──▶ OCR-extracted fields  vs  citizen-typed fields  → match %
      │
      ▼
 Officer sees SIDE-BY-SIDE view + match % ──▶ confirm-or-flag decision
```
Endpoint: `POST /parcels/identify-from-document` (rate-limited 20/min). **Value:** collapses manual re-typing/cross-checking into a quick confirm-or-flag. **Honest limit:** the OpenCV check is a *heuristic tamper signal*, not forensic authentication — labelled as such.

### Satellite / historical change detection (PROTOTYPE)
Two feeds into the same "which parcels changed" logic:
- **Upload mode:** two images + real geographic bounds → Pillow decode → pixel-diff bounding box → `ST_Contains` test every parcel → `ChangeDetectionEvent` + one `GovernanceAlert` per affected parcel.
- **Satellite mode:** real Google Earth Engine Sentinel-2 NDVI for a bounds/date pair (degrades to clean 503 if EE unconfigured). Live-verified: Pune cluster → 75 parcels, 75 alerts.
- **Historical comparison:** compares two years of a cluster's *real per-parcel state* (`ParcelCategory` from `parcel_historical_states`), not pixels — a parcel is "affected" when its category differs. Restricted to `CURRENT_YEAR-1 → CURRENT_YEAR` for alert creation. Per-parcel narratives via OpenRouter, capped to the 20 most severe, with a plain-facts fallback.

### Official document PDF (PROTOTYPE core; integration gaps flagged)
Village Form 7 (RoR) + Form 12 (Register of Crops) style PDF, generated fresh from real rows (`land_record_pdf_service.py` + `official_document_generator.py`, reportlab + qrcode). English/Hindi, emblem, QR, ownership table, crop register.

**Honest status — core renderer complete, end-to-end has critical gaps (from the code review):**
- Applicant profile fields (name/email/mobile/address/gov-ID) exist on `User` but are **not passed into the PDF** — the strip uses the latest approved workflow creator, which may not match the requester.
- Single-page canvas can **overflow** with long ownership/crop history — no multi-page handling yet.
- Endpoint forces `attachment` download; no inline View flow / viewer modal.
- Tests verify the `%PDF-` signature only, not that real values render.

These are documented required fixes (add `ProfileInfo`, multi-page layout, inline disposition, `pypdf` value-assertion tests) — labelled TEAM DESIGN so the prototype's boundary is clear.

---
## 16. Feasibility Analysis

### Technical feasibility — PROVEN (PROTOTYPE)
The riskiest claims are already running: real PostGIS spatial SQL over 6,120 parcels, live Earth Engine imagery, live Groq routing, 11-language Bhashini UI, a full case engine with lifecycle enforcement. Nothing here is a paper design — the demo runs end-to-end against a hosted Supabase Postgres+PostGIS instance.

### Economic feasibility — HIGH
Every external dependency is free-tier or government infrastructure: Bhashini (GoI), Earth Engine (Community tier), Groq (free tier for the prototype). The stack is open-source and self-hostable, so a state incurs no license cost — critical for a national rollout (§19).

### Operational feasibility — HIGH, by design
The platform does **not** require states to replace their systems (which would be politically and operationally infeasible). It ingests through adapters and coexists. A state onboards by writing one adapter, not by migrating a database.

### Legal / institutional feasibility — MODERATE, acknowledged
- Land is a State subject → each state must opt in and expose data. The adapter model minimizes friction, but data-sharing MoUs are a real dependency (outside our control).
- Legal weight of a digitally-issued RoR/EC requires statutory backing — the prototype generates the document; its legal status is a policy question, not a technical one.

### Feasibility summary
| Dimension | Verdict | Basis |
|---|---|---|
| Technical | Proven | Running prototype, live external integrations |
| Economic | High | Free/GoI infra, open-source, self-hostable |
| Operational | High | Coexists via adapters; no rip-and-replace |
| Legal/institutional | Moderate | Requires state opt-in + statutory backing (policy, not tech) |

---

## 17. Tricky Technical Challenges

These are the genuinely hard problems — stated honestly, not strawmen.

**1. Rendering thousands of parcels without melting the browser.**
Shipping 6,120 (→ millions at scale) GeoJSON polygons per pan is infeasible. **Solved (PROTOTYPE):** database-side MVT vector tiles (`ST_AsMVT`), GIST-indexed, so the DB emits only the tiles in view; attribute colouring reads *precomputed* columns, not live aggregates.

**2. Cross-department consistency without distributed-transaction hell.**
A restriction blocking an encumbrance in another officer's queue is a cross-aggregate invariant. **Approach:** single canonical record + transactional write-back preserving history; rules evaluated against the shared record (TEAM DESIGN for the full rule set). Avoids 2-phase commit by keeping the canonical state in one database.

**3. Diverse state schemas / units / languages (the PS's core hard problem).**
**Solved (PROTOTYPE, 2 states):** canonical envelope + adapters normalizing units (hectares×10 000, sqft÷10.7639) and identifiers (`IdentifierResolverService`). Scaling to N states is additive (new adapter class), not a schema migration.

**4. Making AI safe in a legal-records context.**
An LLM that hallucinates ownership is a lawsuit. **Solved (PROTOTYPE):** schema-validated responses (502 on failure), LLM emits filters not SQL, deterministic routing fallback, human-in-loop decisions, and an explicit rule that AI never turns an allegation into a fact.

**5. Keeping precomputed columns fresh without blocking requests.**
Risk/legal/value/masterplan columns are denormalized for tile speed but must stay current. **Solved (PROTOTYPE):** Celery tasks recompute them asynchronously; a graceful no-op shim runs them synchronously-skipped when Celery is absent (dev).

**6. Geometry correction without corrupting the cadastre.**
Ad-hoc map edits are how cadastres rot. **Approach (PROTOTYPE model + TEAM DESIGN workflow):** geometry versioning (`case_parcel_geometry_versions`), Survey-Officer-owned, with area-delta review and propagation to RoR/Tax/Planning.

**7. Satellite quota & latency.**
Earth Engine calls are slow and quota-limited. **Solved (PROTOTYPE):** satellite requests use a longer (90s) client timeout, imagery is on-demand not auto-fetched, and true-color photos are reused across features to conserve quota.

---
## 18. Scalability

Scalability is analysed at four levels; the PS's endgame is nationwide coverage.

### Level 1 — Data (parcels)
- **Today (PROTOTYPE):** ~6,120 parcels, 58 clusters, 30 States/UTs, GIST-indexed.
- **Scaling lever:** GIST spatial indexes + MVT tiling mean query cost scales with *viewport*, not total parcel count — the same architecture serves 6K or 60M parcels; only hardware grows.
- **Partitioning (TEAM DESIGN):** partition `parcels` by state/cluster; tiles are already tile-local.

### Level 2 — Compute (requests)
- Stateless FastAPI workers behind a load balancer scale horizontally.
- Expensive work (imagery, OCR, column recompute) is already off the request path in Celery — scale workers independently of API.
- Rate limiting (slowapi, per-IP) protects shared external quotas.

### Level 3 — Geography (states / adapters)
- Each new state = one adapter class + a data-sharing feed. No core schema change.
- Configurable workflow pipelines + config-driven departments absorb per-state workflow variation without code forks — the *"configurable for different administrative contexts"* requirement **(PS-FACT)**.

### Level 4 — Organisation (departments / roles)
- Departments carry a capability-matrix JSON; roles map to departments via `ROLE_DEPARTMENT`. Adding a department/role is configuration, not a rewrite.

### Scaling path
```
 Pilot (prototype)        →  State rollout          →  National
 6K parcels, 1 DB            millions/state,            federated per-state
 single Postgres+PostGIS     partitioned Postgres,      deployments + central
 + Celery + Redis            autoscaled API/workers,    canonical registry,
                             CDN for tiles              N adapters
 [PROTOTYPE]                 [TEAM DESIGN]              [TEAM DESIGN]
```

**The key scalability property:** because rendering and colouring read tiles + precomputed columns (not live joins), and interoperability is additive (adapters), the marginal cost of the next state or the next million parcels is *infrastructure*, not *re-architecture*.

---

## 19. Cost Analysis

**Honest framing:** the prototype runs at near-zero marginal cost on free/government tiers; production cost is dominated by managed Postgres + compute, both of which a state can self-host.

| Component | Prototype | Production (indicative, per state) |
|---|---|---|
| Database | Free Supabase Postgres+PostGIS | Managed/self-hosted Postgres+PostGIS (DATA REQUIRED — size by parcel count) |
| API/compute | Single container | Autoscaled container group (DATA REQUIRED) |
| Async workers | Local Celery + Redis | Worker pool + managed Redis (DATA REQUIRED) |
| LLM (Groq) | Free tier | Usage-based; capped by rate limits + fallback (DATA REQUIRED) |
| Satellite (Earth Engine) | Community tier (free) | Community/commercial tier by volume |
| Multilingual (Bhashini) | GoI infrastructure (free) | GoI infrastructure |
| Tile serving | From API | CDN-fronted (bandwidth cost, DATA REQUIRED) |
| SMS/Email | TextBee/SMTP dev | Per-message (DATA REQUIRED) |

**Cost-control design choices already made (PROTOTYPE):** on-demand (not auto) satellite fetches, imagery reuse across features, precomputed columns (avoid repeated heavy aggregation), rate limiting on all costly endpoints, and a deterministic routing fallback so an LLM outage costs nothing.

**We do not quote a rupee figure** — a fabricated TCO would violate the no-invented-statistics rule. Any production number is **DATA REQUIRED**, sized against a real deployment's parcel count and traffic.

---
## 20. Security Architecture

The PS explicitly requires *secure authentication, role-based access controls, and audit trails* **(PS-FACT)**. All three are PROTOTYPE.

### Authentication (PROTOTYPE)
- **JWT (HS256, `jose`)**, secret from `config.jwt_secret`. Token embeds `sub/email/role/tokenVersion`.
- **No `exp` claim by design** — sessions persist until explicit logout bumps `token_version`; an optional idle timeout (`idle_timeout_minutes`, default 0) is available. *Design note:* this is a deliberate demo choice; a production deployment should enable idle timeout / short-lived tokens (TEAM DESIGN hardening).
- User is looked up fresh every request; a stale `token_version` or deleted user → 401.
- **Password hashing: bcrypt** directly (`app/auth/passwords.py`).
- Registration supports OTP + Google OAuth.

### Authorization — RBAC (PROTOTYPE)
- `require_roles(*roles)` dependency → 403 on role mismatch, 401 if unauthenticated.
- **11 roles:** 8 officers (`LAND_RECORD, REGISTRATION, PLANNING, DISPUTE, TAX, RESTRICTION, ENCUMBRANCE, SURVEY`) + `ADMIN` + `CITIZEN` + `VERIFIER`.
- **Separation of duties enforced by topology:** `VERIFIER_ROLE` is *excluded* from `OFFICER_ROLES`/`ALL_STAFF_ROLES`, so a verifier structurally cannot reach approve endpoints — no extra guard code needed.
- Data-scoping: citizens see only parcels linked to their account; ownership history is citizen-restricted; admin-notes layer is ADMIN-gated even on reads.

### Audit trail (PROTOTYPE)
`audit_logs` records every material mutation, actor-attributed. It is also the *only* place an individual officer (not just a role) is tied to a decision — the basis for officer performance monitoring.

### Transport & deployment hardening (PROTOTYPE)
- CORS restricted to an explicit allowlist via `CORS_ORIGIN`.
- Production hard-checks: refuses to boot under `ENVIRONMENT=production` with an unset/placeholder `JWT_SECRET` or missing DB creds; Swagger disabled in production; PostGIS port not published to host.
- Rate limiting (slowapi): 200/min default, 30/min on AI/change-detection/historical-imagery, 20/min on OCR.

### Trust boundaries
```
 Untrusted: citizen input, uploaded docs, LLM output, external adapter data
      │  (validated / schema-checked / OCR-flagged / never executed as SQL)
      ▼
 Trusted: canonical Postgres record  ──guarded by──  JWT + RBAC + audit
```

**Security honesty note:** the no-token-expiry choice and the heuristic (not forensic) document check are labelled as demo-appropriate with named production-hardening upgrades — we do not present the prototype's posture as production-grade.

---
## 21. Reliability & Fault Tolerance

Every external dependency has a defined failure mode — none is a single point of catastrophic failure.

| Dependency | Failure mode | Behaviour (PROTOTYPE) |
|---|---|---|
| Groq (LLM) | unconfigured / error / malformed / empty | AI endpoints → 503; **request routing falls back to deterministic `pipeline_for()`** — the case still routes correctly |
| Earth Engine | not configured / project not registered | change-detection-satellite → clean **503**, not a raw 500 |
| Bhashini | translation fails | `t(key)` falls back to the raw key; UI never crashes; external notification degrades to English |
| OpenRouter (narratives) | fails / uncapped / unconfigured | falls back to the same real facts, plainly phrased |
| Celery/Redis | not installed | graceful no-op `shared_task` shim; fire-and-forget recompute skipped, request unaffected |
| Postgres | — | single source of truth; standard managed-Postgres HA/backups in production (TEAM DESIGN) |
| SMS/Email | citizen has no verified contact | in-app notification still delivered; external delivery skipped |

**Design pattern throughout:** *degrade, don't crash.* Every AI/imagery/i18n path has a defined fallback that keeps the core governance workflow working. This is why the demo is robust: even with no API keys set, the case engine, GIS, RBAC, and audit all function.

**Data integrity (PROTOTYPE):** mutations are transactional and history-preserving; geometry is versioned. A failed write rolls back; a successful one appends rather than overwrites.

**Not yet built (TEAM DESIGN):** automated DB failover, multi-region replication, and an SLA-breach sweeper (SLA configs are *stored and queried* but not actively swept by a Celery task today — flagged honestly).

---

## 22. Performance Optimization

| Technique | Where | Effect |
|---|---|---|
| **MVT vector tiles** | `/tiles/*.pbf` via `ST_AsMVT` | DB emits only in-view geometry; client renders binary tiles — scales with viewport, not parcel count |
| **GIST spatial indexes** | all geometry columns (Alembic) | viewport `ST_Intersects` is index-assisted, not a full scan |
| **Precomputed governance columns** | `parcels` (risk/legal/value/masterplan/…) | colour thousands of parcels without per-parcel joins/aggregates |
| **Async recompute** | Celery tasks | heavy recompute off the request path |
| **react-query caching** | frontend | server-state cached, deduped, background-refreshed |
| **Cached UI-text files** | `/multilingual/ui-text/{lang}` | pre-translated `ui_strings_<lang>.json` (~694 keys) served static, not live Bhashini calls |
| **On-demand satellite** | change detection / historical | imagery fetched only when asked; reused across features |
| **Neighbour precomputation** | `parcel_neighbours` | TOUCHING/NEARBY stored, not computed per request |
| **Longer client timeout for EE** | satellite mode (90s vs 10s) | tolerates two sequential live EE fetches without false failures |

**Performance metrics are DATA REQUIRED.** We deliberately quote **no** tile-serve time, query latency, or throughput number here — those must be measured on a real run before appearing in the PPT. Fabricating them would violate the project's evidence rule. The *architecture* is optimized for the right cost model (viewport-bound, precomputed, async); the *numbers* are a measurement task.

---
## 23. Implementation Strategy (10 Phases)

The order reflects the PS's own dependency logic (Base → Essential → Additional) and how the prototype was actually built.

| Phase | Deliverable | Status |
|---|---|---|
| **1. Spatial foundation** | PostGIS parcels (SRID 4326), ULPIN/canonical identity, GIST indexes, real Indian geometry (OSM road-snapped) | ✅ PROTOTYPE |
| **2. Base map & tiles** | MapLibre client, `/gis` GeoJSON, MVT vector tiles, 20 map layers | ✅ PROTOTYPE |
| **3. Essential governance records** | RoR/registration/tax/restriction/dispute/encumbrance/survey tables + history, Parcel 360° | ✅ PROTOTYPE |
| **4. Interoperability** | canonical envelope + State A/B adapters, identifier resolver | ✅ PROTOTYPE (2 states) |
| **5. Identity & access** | JWT auth (OTP/OAuth), 11-role RBAC, audit logging | ✅ PROTOTYPE |
| **6. Citizen & officer portals** | multi-page portals, service requests, officer review + mandatory-reason decisions | ✅ PROTOTYPE |
| **7. Workflow / case engine** | case lifecycle, one-case→many-tasks, verifier field evidence, configurable pipelines | ✅ PROTOTYPE (engine) / 🔶 TEAM DESIGN (full multi-dept resolution + SLA sweep) |
| **8. AI decision-support** | Groq intake/routing/explanation (schema-validated, human-in-loop), OCR verification | ✅ PROTOTYPE |
| **9. Spatial intelligence** | Earth Engine change detection, historical comparison, risk-score heuristic, governance alerts | ✅ PROTOTYPE |
| **10. Multilingual + hardening** | 11-language Bhashini UI + TTS/ASR, Docker deploy, production guards | ✅ PROTOTYPE |

**Remaining / next (TEAM DESIGN):**
- Full automatic cross-department propagation rules (tax reassess, restriction-blocks-encumbrance, dispute-pauses-registration).
- SLA-breach sweeper (configs stored today, not swept).
- Official-PDF integration gaps (profile block, multi-page, inline view — §15).
- Trained ML predictive model (contingent on labelled data).
- N-state adapter expansion.

**Strategy principle:** each phase produced a *demoable* increment, and no phase depended on a not-yet-built later phase — the reason the prototype is coherent rather than a pile of stubs.

---

## 24. Testing Strategy

### Approach
- **Backend:** endpoint + service tests, notably the workflow/case suites that exercise the **deterministic routing fallback for real** (no `GROQ_API_KEY` in the test environment — so the fallback path is genuinely tested, not mocked away).
- **Frontend:** component/render tests (vitest). Known caveat: some string/label failures trace to `FALLBACK_STRINGS` i18n drift and tests predating a UI redesign — `en.json` is treated as source of truth, tests as spec-to-update.
- **Spatial:** live-verified end-to-end against hosted Supabase Postgres+PostGIS (bbox, `ST_Intersects`, change-detection intersection).
- **External integrations:** live-verified — Earth Engine (Pune cluster → 75 parcels/75 alerts), Groq routing (tax complaint → TAX + rationale).

### Test matrix

| Layer | What | Method | Status |
|---|---|---|---|
| Spatial SQL | bbox, contains, MVT | live Postgres+PostGIS | ✅ verified |
| Auth/RBAC | role gates, token version, self-lockout | unit/endpoint | ✅ |
| Case engine | lifecycle transitions, `ACTIVE_CASE_EXISTS` guard | unit | ✅ |
| AI routing | fallback on no key, closed-set validation | unit (fallback exercised) | ✅ |
| Change detection | image + satellite → alerts | live EE run | ✅ verified |
| Verifier | assign, field-evidence, role separation | endpoint suite | ✅ |
| Official PDF | `%PDF-` signature only | unit | 🔶 gap: no value assertions (TEAM DESIGN: add `pypdf` extraction, 403 test, 25-row overflow test) |
| Frontend i18n | label coverage | vitest | 🔶 drift being reconciled against `en.json` |
| Load / latency | throughput, tile-serve time | — | ❌ **DATA REQUIRED** — not yet measured |

**Honest gaps:** performance/load testing is not done (numbers are DATA REQUIRED); official-PDF value-level tests are a named TEAM DESIGN item. We list these rather than claim full coverage.

---
## 25. Impact & Benefits

Story-driven, from the three people the PS's fragmentation actually hurts.

**Asha, a farmer in rural Maharashtra, sells part of her field.** Today: the sale is registered at the Sub-Registrar, but the mutation never reaches the Talathi's RoR; months later she is still taxed on the full area, and a bank rejects a loan because the record is inconsistent. **With BhoomiSetu:** the Registration Officer's confirmation signals Land Records; the approved mutation auto-triggers tax reassessment; her Parcel 360° shows one consistent record; she tracks status in Marathi on her phone. *(intake, routing, case engine, Parcel 360° = PROTOTYPE; auto-propagation = TEAM DESIGN.)*

**Ravi, a Sub-Registrar, faces a new sale deed on a survey number.** Today: he cannot easily see the parcel is under an active boundary dispute and a forest-land restriction — fragmented systems hide it — and a fraudulent transfer slips through. **With BhoomiSetu:** the shared record surfaces the dispute and restriction before he opens the file; the restriction flag blocks the registration until resolved. *(shared record + evidence surfacing = PROTOTYPE; hard block = TEAM DESIGN.)*

**A district administrator wants to find at-risk parcels.** Today: impossible without manually cross-referencing tax, dispute, and alert registers across offices. **With BhoomiSetu:** the analytics dashboard and Top At-Risk list rank parcels by a transparent, explainable risk score, and satellite change detection flags likely illegal construction for review. *(both PROTOTYPE.)*

### Systemic benefits mapped to PS goals

| PS goal (PS-FACT) | BhoomiSetu benefit |
|---|---|
| Reduce duplication & inconsistency | one canonical record; write-back propagation |
| Faster ownership info | Parcel 360° in one query vs multi-office visits |
| Transparency in transactions | case timeline + status tracking + audit |
| Citizen convenience | multilingual AI intake, phone-first, voice I/O |
| Informed decisions | explainable risk score, analytics, change detection |
| Data-driven governance | dashboards over a unified spatial record |

---

## 26. Before vs After

| Dimension | Before (fragmented, PS-FACT) | After (BhoomiSetu) | Status |
|---|---|---|---|
| Record location | 8+ department silos | 1 canonical parcel record | PROTOTYPE |
| Getting ownership info | visit multiple offices, days–weeks | Parcel 360°, one query | PROTOTYPE |
| Cross-dept consistency | manual reconciliation, often never | write-back + propagation rules | PROTOTYPE substrate / TEAM DESIGN rules |
| Filing a request | paper forms, correct office, correct language | AI intake, auto-routed, 11 languages, voice | PROTOTYPE |
| Officer evidence | chase paperwork across depts | pre-assembled evidence chain | PROTOTYPE / TEAM DESIGN |
| Fraud (mortgage on disputed land) | possible via blind spots | flagged on shared record | PROTOTYPE (surfaced) / TEAM DESIGN (blocked) |
| Illegal construction | unnoticed until complaint | satellite change detection → alerts | PROTOTYPE |
| Geometry edits | ad-hoc, unaudited | versioned, Survey-Officer-owned | PROTOTYPE model / TEAM DESIGN workflow |
| Map performance | raw GeoJSON, slow | MVT tiles, GIST, precomputed cols | PROTOTYPE |
| State diversity | one-size systems fail | canonical + per-state adapters | PROTOTYPE (2) / TEAM DESIGN (N) |
| Transparency to citizen | opaque | status tracking + audit trail | PROTOTYPE |
| Language | English/Hindi forms | 11 languages + TTS/ASR | PROTOTYPE |

---
## 27. Future Scope

Ordered by dependency and value. All TEAM DESIGN unless noted.

1. **Complete cross-department propagation engine** — turn the specified rules (tax reassess on mutation, restriction-blocks-encumbrance, dispute-pauses-registration, survey→RoR/Tax/Planning) into enforced invariants on the shared record. *Highest-value next step; substrate already exists.*
2. **SLA enforcement sweeper** — a Celery task that sweeps `sla_configs` and raises breach alerts (configs are stored/queried today, not swept).
3. **N-state adapter expansion** — onboard additional states, each a new adapter class; this is the direct path to the PS's nationwide goal.
4. **Trained ML predictive layer** — replace the heuristic risk score with a validated model, *once labelled outcome data exists* (PyTorch/scikit-learn become real dependencies here).
5. **Official-document completion** — profile block, multi-page layout, inline viewer, value-level tests (§15).
6. **Mobile-native app** — the PS values mobile accessibility; the API + vector tiles already support a native client.
7. **DPI integrations** — DigiLocker for document issuance, Aadhaar-based e-KYC (policy-gated), UPI for fee payment.
8. **Advanced geospatial** — drone/high-res imagery ingestion, automated boundary extraction, encroachment ML.
9. **Blockchain-anchored audit (evaluate, don't assume)** — a tamper-evident audit anchor is *worth evaluating* for legal-record integrity, but only if it beats a well-run append-only audit log + backups; not adopted for its own sake.
10. **Production HA** — multi-region replication, automated failover, CDN-fronted tiles.

---

## 28. Key Performance Indicators

KPIs are split into **product** (measurable now) and **outcome** (require a real deployment). Outcome targets are **DATA REQUIRED** — we set the metric, not a fabricated value.

### Product KPIs (measurable on the prototype)
| KPI | Definition | Value |
|---|---|---|
| Parcel coverage | seeded parcels across States/UTs | ~6,120 across 30 (exact count DATA REQUIRED — runtime gap-drop) |
| Departments modelled | officer roles → departments | 8 |
| Languages | full live-switch coverage | 11 |
| Features implemented | from the feature index | 32 |
| Data model breadth | SQLAlchemy tables | 58 |
| API surface | router groups | 27 |
| Change-detection accuracy (functional) | parcels correctly flagged in a known-change region | verified functional (Pune: 75/75); precision/recall = DATA REQUIRED |

### Outcome KPIs (DATA REQUIRED — measure on pilot)
- Median time to obtain ownership info (before vs after).
- % of mutations reflected in tax within N days.
- Fraudulent-transfer attempts flagged / blocked.
- Citizen request resolution time by department.
- Tile-serve latency, query latency, throughput.
- Officer decision throughput and SLA adherence.

**We do not publish invented percentages.** Every outcome KPI is a measurement plan, not a claim.

---
## 29. Risk Analysis

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | States decline to share data (land is a State subject) | High | High | Adapter model = coexist, not replace; low onboarding cost; opt-in per state |
| R2 | LLM hallucination in a legal context | Medium | High | Schema-validated (502 on fail), LLM emits filters not SQL, deterministic fallback, human-in-loop, "never turns allegation into fact" |
| R3 | Digitally-issued RoR/EC lacks legal weight | Medium | High | Prototype generates the doc; statutory backing is a policy dependency, flagged not hidden |
| R4 | External quota/outage (Groq, Earth Engine, Bhashini) | Medium | Medium | Every path degrades gracefully (§21); fallbacks keep core workflow alive |
| R5 | Spatial performance at national scale | Medium | High | Viewport-bound MVT tiles + GIST + precomputed cols; partition by state (TEAM DESIGN) |
| R6 | Geometry corruption from bad edits | Low | High | Versioned geometry, Survey-Officer-owned workflow, area-delta review |
| R7 | Overclaiming prototype maturity to judges | Medium | Medium | Claim labels throughout; TEAM DESIGN vs PROTOTYPE explicit; no invented metrics |
| R8 | Security posture (no token expiry, heuristic doc check) | Medium | Medium | Labelled as demo choices with named production hardening (idle timeout, forensic verification) |
| R9 | i18n/test drift | Low | Low | `en.json` as source of truth; tests reconciled as spec |
| R10 | Official-PDF integration gaps | Low | Medium | Documented required fixes; core renderer works |

**Top risk (R1) is institutional, not technical** — and it is the one the architecture is specifically shaped to minimize (coexist via adapters). That alignment between the hardest risk and the core design choice is the project's strongest defensive point.

---

## 30. Governance & Auditability

The PS names *audit trails* as a requirement **(PS-FACT)**; BhoomiSetu treats auditability as a first-class property, not an add-on.

- **Every mutation is audit-logged** (`audit_logs`), actor-attributed. It is the sole place an *individual* officer (not just a role) is tied to a decision — enabling officer performance monitoring.
- **Every officer decision carries a mandatory reason**, stored on the case timeline and shown to the citizen — no silent approvals/rejections.
- **Case timeline events** record every material state change (`CREATED→ACTIVE→RESOLUTION→FEEDBACK→CLOSED`), giving a complete, replayable case history.
- **Governance alerts** are *never seeded* — an alert only ever exists because something actually happened at runtime (change detection, historical comparison, masterplan mismatch). No fabricated governance state.
- **Governance alert lifecycle** (4-stage, reason mandatory at every transition): `OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED` (+ `DISMISSED`), with the concerned department's officers notified on closure.
- **Governance rules engine** (`governance_rules`, admin-configurable) + masterplan/legal/value/risk recompute tasks generate alerts deterministically and dedup against open ones.
- **History is preserved, not overwritten** — per-domain history tables + per-year snapshots + versioned geometry mean any past state is reconstructable, which is what makes an audit *meaningful*.

**Governance principle:** a land record is only as trustworthy as its audit trail. BhoomiSetu makes every write attributable, every decision justified, every alert real, and every past state recoverable.

---
## 31. Reference Architecture Diagrams

Fourteen focused diagrams, each isolating one concern.

### D1 — Three-layer data model (PS taxonomy)
```
 ADDITIONAL / USE-CASE  │ infra · tax · valuation · restriction zones · risk · change events
 ───────────────────────┼──────────────────────────────────────────────────────────────
 ESSENTIAL GOVERNANCE   │ RoR · registration · master plan · permits · encumbrance · zoning
 ───────────────────────┼──────────────────────────────────────────────────────────────
 BASE SPATIAL           │ cadastral geometry · parcel boundaries · ULPIN · roads/terrain
                        └── everything above keys to the parcel below
```

### D2 — Parcel as integration primitive
```
        ownership ─┐  ┌─ tax        registration ─┐  ┌─ dispute
                   ▼  ▼                           ▼  ▼
                 ┌─────────────── PARCEL ───────────────┐
                 │ ulpin · canonicalParcelId · geometry │
                 └──────────────────────────────────────┘
                   ▲  ▲                           ▲  ▲
     restriction ─┘  └─ encumbrance     survey ──┘  └─ crop / neighbours / cases
```

### D3 — Request → resolution flow
```
 citizen → AI understand → AI route → case(+dept tasks) → officer review
   → (verifier evidence?) → decision(reason) → write-back(+history) → propagate → notify
```

### D4 — Interoperability (canonical + adapters)
```
 State A DB (hectares) ─┐
                        ├─▶ ADAPTER (×10000 / resolve id) ─┐
 State B DB (sqft) ─────┤   ADAPTER (÷10.7639 / resolve id)├─▶ CANONICAL ENVELOPE ─▶ parcels
 State C … ─────────────┘   (new adapter class, no schema change)          (snake_case, m²)
```

### D5 — GIS rendering path
```
 Postgres+PostGIS ─ ST_AsMVT ─▶ /tiles/{z}/{x}/{y}.pbf ─▶ MapLibre GL ─▶ browser
        │ GIST index                                            ▲
        └─ /gis/*.geojson (overlays) ───────────────────────────┘
        └─ precomputed columns ─▶ attribute colouring (risk/tax/legal/…)
```

### D6 — AI safety pipeline
```
 user text ─▶ Groq ─▶ structured output ─▶ Pydantic validate ─┬─ ok ─▶ backend runs filter/SQL
                                                              └─ fail ─▶ 502 (never trusted)
 routing: Groq ─▶ {departments} ─▶ closed-set check ─┬─ ok ─▶ route
                                                     └─ fail ─▶ deterministic pipeline_for()
```

### D7 — Case lifecycle state machine
```
 CREATED ─▶ ACTIVE ─▶ RESOLUTION ─▶ FEEDBACK ─▶ CLOSED
   (guard: one active case per citizen+parcel → 409 ACTIVE_CASE_EXISTS;
    multiple distinct disputes on one parcel allowed)
```

### D8 — Governance alert lifecycle
```
 OPEN ─▶ ACKNOWLEDGED ─▶ FIELD_VERIFIED ─▶ RESOLVED        (reason mandatory each step)
   └────────────▶ DISMISSED                                (never seeded; runtime-only)
```
### D9 — RBAC / role topology
```
 ALL_STAFF_ROLES = OFFICER_ROLES(8) + ADMIN
   OFFICER_ROLES: LAND_RECORD REGISTRATION PLANNING DISPUTE TAX RESTRICTION ENCUMBRANCE SURVEY
 CITIZEN  (own parcels only)
 VERIFIER (OUTSIDE staff roles → structurally cannot approve — separation of duties)
```

### D10 — Change detection pipeline
```
 upload imgs ─┐                          ┌─ ST_Contains(parcel, region) ─▶ affected parcels
              ├─▶ diff → changed region ─┤
 EE Sentinel-2┘   (bbox / NDVI)          └─▶ ChangeDetectionEvent + 1 GovernanceAlert / parcel
```

### D11 — Document verification
```
 uploaded proof ─▶ pytesseract OCR ─▶ fields ─▶ match% vs citizen-typed ─▶ officer confirm/flag
                └▶ OpenCV tamper heuristic (signal, not forensic verdict) ─┘
```

### D12 — Async recompute (Celery)
```
 trigger/schedule ─▶ Celery(Redis) ─▶ recompute risk/legal/value/masterplan cols on parcels
                                    ─▶ EE imagery · OCR · ETL · terrain
   (Celery absent → graceful no-op shim; request path unaffected)
```

### D13 — Deployment topology
```
 docker compose up --build
   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
   │ frontend    │──▶│ FastAPI      │──▶│ PostgreSQL+PostGIS│
   │ (nginx)     │   │ backend-py   │   │ (5432 not host-   │
   └─────────────┘   │ + Celery     │   │  published)       │
                     └──────┬───────┘   └──────────────────┘
                            └─▶ Redis (cache + broker)
   prod guards: JWT_SECRET required · Swagger off · CORS allowlist
```

### D14 — National scaling model
```
 PILOT ───────────▶ STATE ROLLOUT ──────────▶ NATIONAL
 1 DB, 6K parcels    partitioned Postgres,      per-state deployments +
 single API+worker   autoscaled API/workers,    central canonical registry,
                     CDN tiles, millions/state  N adapters, DPI integrations
 [PROTOTYPE]         [TEAM DESIGN]              [TEAM DESIGN]
```

---

## 32. Master End-to-End Workflow

A single worked example tying every subsystem together — the demo narrative.

**Scenario:** Asha files a boundary-correction request on her Pune parcel, in Marathi, by voice.

```
1. INTAKE (PROTOTYPE)
   Asha opens "Get Assistance", speaks in Marathi.
   Bhashini ASR → text; LanguageContext keeps UI in Marathi.

2. UNDERSTAND + ROUTE (PROTOTYPE)
   POST /ai/understand → Groq classifies intent = boundary/survey correction.
   POST /ai/route → {departments:[SURVEY], reason:"boundary discrepancy claim"} (schema-validated).
   (LLM fails? deterministic pipeline_for() routes it anyway.)

3. CASE CREATION (PROTOTYPE)
   create_case_from_application(): guard checks no active SURVEY case on this parcel (else 409).
   Case CREATED→ACTIVE; SURVEY DepartmentTask spawned; timeline event + audit logged.

4. EVIDENCE ASSEMBLY (PROTOTYPE)
   Officer opens case → Parcel 360°: current geometry, RoR area, prior survey records,
   neighbour parcels, any prior boundary claims — pre-assembled.

5. FIELD VERIFICATION (PROTOTYPE)
   Officer assigns a Verifier → verifier captures GPS-tagged photo + measurement notes
   via /workflows/{id}/field-evidence. Verifier cannot decide (role topology).

6. DECISION (PROTOTYPE)
   Survey Officer compares current vs measured geometry (area delta), approves corrected polygon
   with a mandatory reason. Write is transactional; geometry versioned (case_parcel_geometry_versions).

7. PROPAGATION (TEAM DESIGN)
   Approved area change notifies Land Records (RoR area), Tax (reassessment), Planning (zoning check).

8. CLOSURE + FEEDBACK (PROTOTYPE)
   Case → RESOLUTION → FEEDBACK; Asha notified (in-app + bilingual SMS/Email), tracks status,
   leaves feedback. Every step is in the audit log and the case timeline.
```

**One sentence:** *voice request in Marathi → AI routes → case → pre-assembled evidence → verifier field proof → officer decision on versioned geometry → cross-department propagation → transparent, audited closure* — the fragmented land-governance journey, unified.

---
## 33. References

Credible, verifiable sources only. Standards and government infrastructure the design relies on — **no fabricated citations.**

**Standards & specifications (REFERENCE)**
- OGC GeoJSON — IETF RFC 7946, *The GeoJSON Format* (SRID 4326 / WGS84 geometry encoding).
- Mapbox Vector Tile Specification (the `.pbf` tile format served via `ST_AsMVT`).
- OpenAPI Specification (auto-generated by FastAPI — the "open API standards" the PS requires).
- WGS84 (EPSG:4326) / Web Mercator (EPSG:3857) coordinate reference systems.

**Government of India infrastructure & policy (REFERENCE)**
- Department of Land Resources — Land Stack initiative (PS SIH26014; pilots Chandigarh & Tamil Nadu, 31 Dec 2025).
- ULPIN (Unique Land Parcel Identification Number) — DILRMP / Digital India Land Records Modernization Programme.
- Bhashini — National Language Translation Mission (ULCA/Dhruva APIs; translation/transliteration/TTS/ASR).

**Data & geospatial sources (REFERENCE)**
- Google Earth Engine — Sentinel-2 imagery (Copernicus/ESA), Community tier.
- OpenStreetMap / Geofabrik India-zone PBF extracts (road networks for parcel snapping).
- PostGIS — spatial extension for PostgreSQL (spatial types, functions, GIST indexing).

**Frameworks & libraries (REFERENCE — versions in §12)**
- FastAPI, SQLAlchemy 2.0, GeoAlchemy2, Alembic, Celery, Pydantic 2.
- React, MapLibre GL JS, Vite, Tailwind, Zustand, Recharts.
- Groq (OpenAI-compatible API), pytesseract (Tesseract OCR), OpenCV, reportlab.

**Internal project documents (project artefacts, not external claims)**
- `docs/SIH_2026_BhoomiSetu_Data_Reference.md` — verified current-state data model (2026-09-23).
- `docs/BhoomiSetu_Unified_Workflow_Specification.md` — departmental workflow ground truth.
- `docs/bhoomisetu_officer_roles.md` — officer roles & value-add.
- `docs/architecture/FEATURES.md` — feature-by-feature implementation index.

> **Metrics deliberately omitted:** any performance, accuracy, or cost figure not measured on a real run is marked **DATA REQUIRED** in the relevant section rather than cited here. No source in this list is invented; where a claim depends on an unmeasured number, that number is flagged, not fabricated.

---

## 34. Final Summary

BhoomiSetu is a functional, parcel-centric, GIS-based Land Stack prototype that answers SIH26014 not by building a ninth department system, but by making **one parcel record** the point where every department's data and every citizen's request converge — under **one auditable workflow** and a **canonical-model-plus-adapters** design that respects the PS's hardest constraint: *land is a State subject.*

**What is real today (PROTOTYPE):** real PostGIS spatial SQL and MVT vector tiles over ~6,120 road-snapped parcels across 30 States/UTs; 58-table data model spanning the PS's three layers; 8 departmental officer roles with RBAC, JWT, and full audit logging; a unified case engine with lifecycle enforcement and the "one active request per type, multiple disputes allowed" invariant; Groq-backed AI intake/routing/explanation that is schema-validated, human-in-loop, and never authoritative; OCR document verification; live Google Earth Engine satellite change detection; an 11-language Bhashini UI with voice I/O; and a hardened Docker deployment.

**What is honestly labelled as design (TEAM DESIGN):** the full automatic cross-department propagation rule set, SLA sweeping, N-state adapter expansion, a trained ML predictive layer (pending labelled data), and the official-PDF integration completion.

**Why it should win:** it maps every PS requirement to a concrete, mostly-running module; it distinguishes fact from plan with claim labels rather than blurring them; it fabricates no statistic or reference; and its single most important design decision — the shared parcel record with cross-department consistency — *is* the fragmentation problem solved, not merely displayed.

> **One Parcel. Every Record. One Trusted Workflow.**

*This document is the Standard Technical Document the problem statement requires — covering API and interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX and color guidance, and deployment/scalability — with every technical claim traceable to running code or an explicitly labelled design.*
