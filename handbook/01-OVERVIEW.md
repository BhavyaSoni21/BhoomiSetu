# 01 — Overview

## What it is

**BhoomiSetu** ("Bhoomi" = land, "Setu" = bridge) is a functional prototype of an integrated, parcel-centric, GIS-based **Digital Public Infrastructure for land governance**. Its differentiator is cross-department consistency: each officer sees only their department's slice, but every action writes back to **one shared canonical parcel record** through **one auditable workflow engine**.

Tagline: **One Parcel. Every Record. One Trusted Workflow.**

## The problem (SIH26014 — "Land Stack")

Problem statement **SIH26014**, Department of Land Resources: build an integrated GIS-based digital platform bringing all land-related datasets, workflows, and services into a single interoperable framework. Core difficulty: **land is a State subject**, so formats, units, languages, and workflows vary by state. The ask is a scalable prototype **plus a Standard Technical Document** covering API/interoperability standards, data schemas, architecture, GIS standards, security, UI/UX, colour schema, and deployment/scalability.

**Fragmentation being solved** — real failures where disconnected departmental systems create blind spots:
- a registered sale deed never reaching the Record of Rights,
- tax assessed on stale area after a mutation,
- restricted land silently transferable via another department,
- disputed/mortgaged land slipping through an encumbrance blind spot,
- ad-hoc geometry edits with no audit trail.

The deeper framing is **trust** — verification, evidence chains, transparency, accountable decisions — not just information display.

**Pilots:** Land Stack pilots launched in **Chandigarh and Tamil Nadu on 31 December 2025**, with proposed expansion to one city + one village per State/UT, then nationwide.

## Roles (11 total)

| Group | Roles |
|-------|-------|
| Citizen | `CITIZEN` — landowner/applicant |
| Officers (8) | `LAND_RECORD` (Talathi/Tehsildar), `REGISTRATION` (Sub-Registrar), `PLANNING` (Town Planning), `TAX` (Revenue/Municipal), `RESTRICTION` (Collector), `ENCUMBRANCE` (EC wing), `DISPUTE` (Revenue Court), `SURVEY_OFFICER` (District Survey Office) |
| Verifier | `VERIFIER` — Authorized Field Verifier; collects evidence, **cannot decide**; deliberately excluded from staff roles (separation of duties) |
| Admin | `ADMIN` — system administrator |

`ALL_STAFF_ROLES` = the 8 officers + ADMIN. RBAC is enforced server-side; roles are non-interchangeable.

## Feature list (all PROTOTYPE)

**Platform core**
- Single canonical parcel record (ULPIN + internal `canonicalParcelId`).
- Unified case engine: `CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED`; one case → many `DepartmentTask`s.
- Configurable workflow pipelines; full audit logging; RBAC (11 roles) + JWT.
- Canonical envelope + State A / State B schema adapters (interoperability demo).

**Citizen**
- Parcel search, My Parcels, ownership verification, case/status tracking.
- "Get Assistance" AI intake: free-text/voice → classified, auto-routed case.
- 11-language UI with TTS/ASR (Bhashini) + bilingual SMS/Email.
- Offline-first PWA.

**Officer (×8)**
- Department-scoped queue with pre-assembled evidence chains (Parcel 360° + OCR match% + history).
- Mandatory-reason decisions; field-verification assignment.
- Geometry/area-delta review (Survey).

**Admin**
- User/role management, layer/rule config, "Workflow Oversight" pipeline editor, admin-only map-notes layer.

**GIS**
- Real PostGIS SQL (`ST_Intersects`/`ST_Contains`/`ST_AsMVT`), GIST-indexed.
- 20 map layers across 4 source types; MVT tiles at `/tiles/{layer}/{z}/{x}/{y}.pbf`.
- Real Indian geometry snapped to OSM roads.

**AI / analytics**
- Groq assistant (`openai/gpt-oss-20b`) for parcel/alert explanation, intake/routing.
- OCR verification (pytesseract + OpenCV tamper heuristic).
- Transparent weighted risk score (tax 0.4 / dispute 0.3 / alerts 0.2 / restriction 0.1) — a **heuristic, not a trained model**.
- Satellite change detection (Google Earth Engine, Sentinel-2 NDVI).

## Scale

~6,120 parcels across **58 cadastral clusters** spanning state capitals + one representative village per state, in 30 States/UTs. **59 database tables.** Backend ~560 tests; frontend ~35 vitest specs.

## Known limitations (honest)

- Automatic cross-department propagation rules are designed but not fully enforced (substrate exists).
- SLA-breach sweeper not built (configs stored/queried, not swept).
- Risk score is a heuristic, not ML.
- Interoperability proven for 2 states.
- Offline sync covers case creation only.
- No performance/load numbers yet.
- Official-document (RoR/EC) legal weight needs statutory backing.

See [09-SECURITY.md](09-SECURITY.md) for the security-specific known-risk register.
