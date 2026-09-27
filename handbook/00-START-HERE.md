# BhoomiSetu Handbook — START HERE

**Purpose:** This `handbook/` directory is the single, current, code-verified reference for BhoomiSetu. A fresh chat or new contributor can read only these files and understand the whole project. Everything here was reconciled against the **live `backend-py/` (FastAPI) and `frontend/` (React) code** as of **2026-09-28**.

> **One Parcel. Every Record. One Trusted Workflow.**

## Read in this order

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Overview](01-OVERVIEW.md) | What BhoomiSetu is, the SIH26014 problem, roles, pilots, feature list |
| 02 | [Architecture](02-ARCHITECTURE.md) | System layers, canonical parcel model, interoperability, case/workflow engine |
| 03 | [Backend](03-BACKEND.md) | FastAPI app: routers, services, auth, middleware, external integrations |
| 04 | [Frontend](04-FRONTEND.md) | React SPA: portals, routing, map, offline PWA, state |
| 05 | [Database Schema](05-DATABASE-SCHEMA.md) | All 59 tables, columns, types, keys, PostGIS geometry |
| 06 | [Multilingual](06-MULTILINGUAL.md) | i18n keys + Bhashini, 11 languages, the 600-key sync + regen tool |
| 07 | [Dev Setup](07-DEV-SETUP.md) | Run backend + frontend locally, tests, migrations |
| 08 | [Deployment](08-DEPLOYMENT.md) | Render + Vercel, env vars, Docker |
| 09 | [Security](09-SECURITY.md) | Auth model, RBAC, posture, known risks |
| — | [Master Project Document](MASTER-PROJECT-DOCUMENT.md) | Full Standard-Technical-Document write-up: claim-labelled source of truth for every feature/metric |

## Ground truth vs. historical docs

- **Authoritative (current):** this handbook, plus `README.md`, `DEPLOYMENT.md`, `SECURITY.md`, `docs/reference/STANDARD_TECHNICAL_DOCUMENT.md`, and the SQLAlchemy models in `backend-py/app/models/`.
- **Historical / intent only (do NOT trust for as-built facts):** `docs/archive/BHOOMISETU.md` and `docs/archive/Tech.md` (identical pre-implementation vision docs — they describe a **NestJS/Prisma** stack and 100–500 mock parcels that were never the shipped design), and `docs/architecture/SYSTEM_ARCHITECTURE.md` (its backend sections still describe the retired NestJS/TypeORM/SQLite build; its React frontend sections remain current). The live backend is **FastAPI + PostGIS**, not NestJS.

## One-paragraph gist

BhoomiSetu is a functional prototype of GIS-based Digital Public Infrastructure for Indian land governance (SIH26014, "Land Stack"). It binds every land dataset — cadastral geometry, Record of Rights, registration, planning, tax, restrictions, encumbrances, disputes, survey — to **one shared parcel record** keyed by ULPIN + an internal `canonicalParcelId`, and drives every citizen/officer interaction through **one auditable case/workflow engine**. Backend: FastAPI + PostgreSQL/PostGIS (59 tables, ~6,120 parcels across 58 clusters). Frontend: React 18 + Vite + MapLibre, offline-first PWA, 11-language UI via Bhashini. 11 roles: Citizen, 8 department officers, Verifier (field evidence only), Admin.

**Core rule the whole project follows:** no fake data, no fake success — where data doesn't exist, show an honest empty state.
