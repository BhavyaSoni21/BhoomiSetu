# BhoomiSetu - GIS-based Land Governance Platform

BhoomiSetu is a GIS-based, parcel-centric land governance and interoperability platform designed to connect fragmented land-related datasets through a unified digital framework.

## Project Structure

```
SIH_2026_BhoomiSetu/
├── backend/                 # NestJS backend application
├── frontend/                # React frontend application
├── docker-compose.yml       # Docker Compose configuration (see Docker note below)
├── init-postgis.sql         # PostGIS database initialization script
├── BHOOMISETU.md            # Project vision and overview
├── Tech.md                  # Technical architecture and specifications
└── README.md                # This file
```

## Technology Stack

### Backend
- **Runtime**: Node.js 22+
- **Framework**: NestJS (TypeScript)
- **Database**: SQLite for development, PostgreSQL + PostGIS for production
- **ORM**: TypeORM
- **Validation**: class-validator
- **API Documentation**: Swagger/OpenAPI (served at `/api`)
- **Testing**: Jest + Supertest (e2e)

### Frontend
- **Framework**: React (TypeScript)
- **Build Tool**: Vite
- **Server State**: TanStack Query
- **GIS Map**: MapLibre GL JS
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Testing**: Vitest + React Testing Library

> `zustand`, `react-hook-form`, `recharts`, and `zod` are installed as dependencies for upcoming phases but aren't wired into any component yet.

### Database
- **Primary (dev)**: SQLite (file-based, zero setup)
- **Primary (production)**: PostgreSQL 16+ with PostGIS 3+
- **Spatial Data**: GeoJSON (stored as text in SQLite dev mode; native `geometry` column in PostGIS)

## Getting Started

### Prerequisites
- Node.js 22+ and npm

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BhavyaSoni21/BhoomiSetu.git
   cd BhoomiSetu
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env   # defaults use SQLite, no edits needed for local dev
   npm run seed            # populate ./data/dev.sqlite with 200 mock parcels
   npm run start:dev       # start on http://localhost:3000
   ```

3. **Frontend setup** (in a second terminal)
   ```bash
   cd frontend
   npm install
   npm run dev              # start on http://localhost:5173
   ```

4. **Open the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api/v1
   - Swagger docs: http://localhost:3000/api

### Running Tests

```bash
# Backend e2e tests (Jest + Supertest, isolated in-memory SQLite)
cd backend
npm test

# Frontend component tests (Vitest + React Testing Library)
cd frontend
npm test
```

### Production / PostgreSQL

To run against PostgreSQL + PostGIS instead of SQLite, set `USE_SQLITE=false` and the `DB_*` variables in `backend/.env`, then run `init-postgis.sql` against your database before starting the backend.

`docker-compose.yml` sketches a full multi-service deployment (frontend, backend, PostGIS, per-department API instances, AI service), but no `Dockerfile` exists yet for `backend/` or `frontend/`, so `docker-compose up` will not build successfully today — this is planned for a later phase.

## API Endpoints

Implemented and covered by the backend test suite:

### GIS Endpoints
- `GET /api/v1/gis/parcels` - Get parcels with optional filtering (bbox, zoom, state, district, limit, offset)
- `GET /api/v1/gis/parcel-at-location` - Find parcel at specific coordinates (lat, lng) — placeholder until PostGIS spatial queries are enabled
- `GET /api/v1/gis/parcels/:id/geometry` - Get parcel geometry as a GeoJSON Feature
- `GET /api/v1/gis/parcels/:id/restrictions` - Get restrictions for a parcel (placeholder, returns `[]`)

### Parcel Endpoints
- `GET /api/v1/parcels` - Search parcels by identifiers (ulpin, survey_number, plot_number, local_identifier, state, district)
- `GET /api/v1/parcels/:id` - Get parcel by ID
- `GET /api/v1/parcels/:id/360` - Get parcel 360° skeleton (per-department sections are `null` stubs until Phase 5 interoperability work lands)

### Planned (not yet implemented)
Auth, per-department mock APIs, AI query/explain endpoints, change detection, and audit logging are scaffolded as empty NestJS modules but have no controllers or routes yet. See the phase breakdown below.

## Development Phases

The implementation follows a phased MVP plan:

1. **GIS Foundation** ✅ done and tested — PostGIS/SQLite setup, parcel table, map visualization
2. **Parcel Core** 🚧 in progress — search and 360 skeleton above are already live; identifier table refinements still pending
3. **Mock State Schemas** — different state land record schemas for interoperability
4. **Mock Department APIs** — independent APIs for 5 government departments
5. **Interoperability** — state adapters, canonical model, response aggregation
6. **Citizen Portal** — search, map, parcel 360 view, service requests
7. **Officer Portal** — workflow dashboard, verification interface, governance alerts
8. **AI Integration** — natural language query, parcel summary, alert explanation
9. **Change Detection** — imagery comparison and alert generation
10. **Security and Audit** — authentication, RBAC, audit logging, API security

## Mock Data

`backend/seed.ts` generates 200 mock parcels with:
- Random coordinates within India's approximate bounding box (not constrained to actual state boundaries — a known limitation of the current seed script)
- State/district codes drawn from 10 Indian states
- Multiple identifier types per parcel (ULPIN, survey number, plot number, local ID) for cross-reference testing

## License

MIT
