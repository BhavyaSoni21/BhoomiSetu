# BhoomiSetu - GIS-based Land Governance Platform

BhoomiSetu is a GIS-based, parcel-centric land governance and interoperability platform designed to connect fragmented land-related datasets through a unified digital framework.

## Project Structure

```
SIH_2026_BhoomiSetu/
├── backend/                 # NestJS backend application
├── frontend/                # React frontend application
├── docker-compose.yml       # Docker Compose configuration for full stack
├── init-postgis.sql         # PostGIS database initialization script
├── Plan.md                  # Execution plan and implementation roadmap
├── BHOOMISETU.md            # Project vision and overview
├── Tech.md                  # Technical architecture and specifications
└── README.md                # This file
```

## Technology Stack

### Backend
- **Runtime**: Node.js 22+
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with PostGIS extension
- **ORM**: TypeORM
- **Authentication**: JWT
- **Validation**: class-validator / Zod
- **API Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: React.js (TypeScript)
- **Build Tool**: Vite
- **State Management**: Zustand
- **Server State**: TanStack Query
- **GIS Map**: MapLibre GL JS
- **Styling**: Tailwind CSS + shadcn/ui
- **Form Handling**: React Hook Form
- **Validation**: Zod

### Database
- **Primary**: PostgreSQL 16+ with PostGIS 3+
- **Spatial Data**: GeoJSON
- **Development Alternative**: SQLite (for initial development without PostGIS)

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose

## Getting Started

### Prerequisites
- Node.js 22+ and npm
- (Optional) Docker and Docker Compose for full stack deployment
- (Optional) PostgreSQL 16+ and PostGIS 3+ for production database

### Development Setup (Without Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SIH_2026_BhoomiSetu
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Edit .env as needed
   npm run seed          # Seed the database with mock data
   npm run start:dev     # Start in development mode
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev           # Start the frontend development server
   ```

### Production Setup (With Docker)

1. **Environment Variables**
   Create a `.env` file in the root directory with:
   ```
   JWT_SECRET=your_secret_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ```

2. **Start the full stack**
   ```bash
   docker-compose up --build
   ```

3. **Access the applications**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/api
   - PostgreSQL: localhost:5432

## API Endpoints

### GIS Endpoints
- `GET /api/v1/gis/parcels` - Get parcels with optional filtering (bbox, zoom, state, district)
- `GET /api/v1/gis/parcel-at-location` - Find parcel at specific coordinates (lat, lng)
- `GET /api/v1/gis/parcels/:id/geometry` - Get parcel geometry as GeoJSON
- `GET /api/v1/gis/parcels/:id/restrictions` - Get restrictions for a parcel

### Parcel Endpoints
- `GET /api/v1/parcels` - Search parcels by identifiers (ulpin, survey_number, plot_number, local_identifier, state, district)
- `GET /api/v1/parcels/:id` - Get parcel by ID
- `GET /api/v1/parcels/:id/360` - Get parcel 360° view (includes data from all departments)

### Authentication Endpoints
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token

### Department APIs (Mock)
- `GET /api/v1/integrations/land-records/:parcelId` - Land records data
- `GET /api/v1/integrations/registration/:parcelId` - Registration data
- `GET /api/v1/integrations/planning/:parcelId` - Planning/zoning data
- `GET /api/v1/integrations/tax/:parcelId` - Tax information
- `GET /api/v1/integrations/restriction/:parcelId` - Restriction data

### AI Endpoints
- `POST /api/v1/ai/query` - Natural language to structured query conversion
- `POST /api/v1/ai/parcels/:id/explain` - Get plain language explanation of parcel data
- `POST /api/v1/ai/alerts/:id/explain` - Get explanation of governance alert

## Development Phases

The implementation follows the MVP priority outlined in Tech.md Section 47:

1. **GIS Foundation** - PostGIS setup, parcel table, basic map visualization
2. **Parcel Core** - Parcel search, identifiers, basic parcel API
3. **Mock State Schemas** - Different state land record schemas for interoperability
4. **Mock Department APIs** - Independent APIs for 5 government departments
5. **Interoperability** - State adapters, canonical model, response aggregation
6. **Citizen Portal** - Search, map, parcel 360 view, service requests
7. **Officer Portal** - Workflow dashboard, verification interface, governance alerts
8. **Groq AI Integration** - Natural language query, parcel summary, alert explanation
9. **Change Detection** - Sample imagery comparison and alert generation
10. **Security and Audit** - Authentication, RBAC, audit logging, API security

## Implementation Status

Refer to `PLAN.md` for the detailed execution plan with checkboxes tracking progress.

## Database Notes

- **Development**: By default, the application uses SQLite in-memory database for easy setup without external dependencies
- **Production**: To use PostgreSQL with PostGIS, set `USE_SQLITE=false` in the backend `.env` file and ensure PostgreSQL/PostGIS is running
- **Spatial Operations**: The GIS service includes fallback behavior for development without PostGIS, with warnings indicating when spatial operations are disabled

## Mock Data

The application includes a seeding script (`backend/seed.ts`) that generates mock parcel data with:
- 200 parcels across 10 Indian states
- Random geometries within approximate state boundaries
- Various identifier types (ULPIN, survey numbers, plot numbers, local IDs)
- Relationships to parcel identifiers for cross-reference testing

## License

MIT