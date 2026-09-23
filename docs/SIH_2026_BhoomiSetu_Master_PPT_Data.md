# SIH 2026 --- BhoomiSetu / Land Stack

## Master Data & Content Document for 6-Slide Idea Submission PPT

> **Purpose:** This document is the single source of truth for
> generating the SIH 2026 Idea Submission PPT. It contains the problem
> framing, solution, architecture, workflows, technology stack, data
> model, AI/GIS components, feasibility, impact, prototype evidence, and
> references required by the PPT-generation agent.
>
> **Submission constraint:** Final PPT = exactly 6 slides, including
> title slide. Use the provided SIH 2026 template without changing the
> required slide pointers.

------------------------------------------------------------------------

# 0. SOURCE-OF-TRUTH POLICY

## Source hierarchy

1.  **Official SIH 2026 PPT template** --- controls slide structure and
    required pointers.
2.  **Official problem statement supplied by the team** --- controls the
    problem definition and expected solution.
3.  **Finalized BhoomiSetu project architecture and implementation
    decisions** --- controls team-proposed solution details.
4.  **Verified external references** --- used only for supporting
    technical/governance claims.
5.  **Prototype evidence** --- screenshots, working modules, APIs,
    workflows, and measured results.

## Claim labels

Use one of these labels internally:

-   **PS FACT** --- directly supported by the problem statement.
-   **TEAM DESIGN** --- proposed/finalized by the team.
-   **PROTOTYPE** --- actually implemented or demonstrated.
-   **VERIFIED METRIC** --- measured result with evidence.
-   **REFERENCE** --- external supporting source.
-   **DATA REQUIRED** --- must be supplied before final PPT generation.

Never convert a TEAM DESIGN into a PROTOTYPE claim unless the feature
actually exists.

------------------------------------------------------------------------

# 1. SUBMISSION METADATA

  -----------------------------------------------------------------------
  Field                   Value                   Status
  ----------------------- ----------------------- -----------------------
  Event                   Smart India Hackathon   PS FACT
                          2026                    

  Problem Statement ID    SIH26014                TEAM / PS INPUT

  Problem Statement       Land Stack              PS FACT

  Solution Name           BhoomiSetu              TEAM DESIGN

  PS Category             Software                DATA REQUIRED / PORTAL
                                                  CONFIRMATION

  Theme                   DATA REQUIRED           DATA REQUIRED

  Team ID                 DATA REQUIRED           DATA REQUIRED

  Team Name               DATA REQUIRED           DATA REQUIRED

  Institution             Shah & Anchor Kutchhi   TEAM INFO
                          Engineering College,    
                          Mumbai                  

  Final slide count       6                       TEMPLATE REQUIREMENT
  -----------------------------------------------------------------------

### Working positioning

**BhoomiSetu** is proposed as a parcel-centric, GIS-based Land Stack
platform that integrates heterogeneous land-governance systems around a
common parcel identity and exposes interoperable services to citizens
and government departments.

------------------------------------------------------------------------

# 2. PROBLEM STATEMENT --- FACTUAL FOUNDATION

## Core problem

Land governance in India is fragmented across multiple institutions and
departmental systems.

Relevant datasets include:

-   Cadastral maps
-   Record of Rights (RoR)
-   Registration records
-   Land-use information
-   Master Plans
-   Building permissions
-   Restrictions
-   Property taxation
-   Utility infrastructure
-   Other land-related databases

These systems can differ in:

-   Data formats
-   Database structures
-   Measurement units
-   Field definitions
-   Languages
-   Terminology
-   Administrative workflows

## Resulting problems

-   Duplication of effort
-   Inconsistent records
-   Delays in ownership information
-   Limited transparency
-   Difficulty accessing land-related services
-   Weak interoperability between departments
-   Difficulty creating a common state-level framework

## Required transformation

### Current

`Fragmented Departments → Disconnected Data → Manual/Disconnected Workflows → Limited Visibility`

### Target

`Parcel-Centric Land Stack → Interoperable Data → Integrated Workflows → Citizen + Officer Services`

------------------------------------------------------------------------

# 3. SOLUTION OVERVIEW

## Solution title

### BhoomiSetu --- Parcel-Centric Land Stack for Integrated Land Governance

## One-line proposition

**Unify fragmented land-governance systems around every parcel, using
GIS and a common parcel identity to connect data, workflows and
services.**

## Core concept

The platform does **not require replacing every existing departmental
system**.

Instead:

`Existing Department Systems` →
`State Adapters / Interoperability Layer` → `Canonical Land Data Model`
→ `Parcel + ULPIN Identity` → `Land Stack Core` →
`GIS / Workflow / Analytics` →
`Citizen + Officer + Department Interfaces`

## Core design principle

### One Parcel → One Unified View

Every parcel becomes the central integration unit.

A parcel can connect to:

-   Spatial boundary
-   ULPIN / parcel identity
-   Ownership / RoR
-   Registration
-   Encumbrance / mortgage
-   Land use / zoning
-   Master plan
-   Building permissions
-   Property taxation
-   Utilities
-   Environmental / restriction zones
-   Disputes and administrative workflows
-   Other service-specific information

------------------------------------------------------------------------

# 4. LAND STACK DATA LAYER MODEL

## Layer 1 --- BASE SPATIAL LAYER

The spatial foundation.

### Contains

-   Georeferenced cadastral maps
-   Parcel boundaries
-   Parcel identifiers
-   ULPIN / common parcel identity

### Purpose

Provides the geographic framework for connecting all other datasets.

------------------------------------------------------------------------

## Layer 2 --- ESSENTIAL GOVERNANCE LAYERS

### Ownership & Rights

-   Record of Rights
-   Ownership information
-   Rights associated with parcel

### Transaction

-   Registration data
-   Transaction status
-   Encumbrance
-   Mortgage / liability information

### Planning & Permission

-   Master Plans
-   Land-use / zoning
-   Building permissions
-   Approvals / restrictions

------------------------------------------------------------------------

## Layer 3 --- ADDITIONAL / USE-CASE LAYERS

-   Utility infrastructure
-   Property taxation
-   Valuation references
-   Infrastructure networks
-   Environmental zones
-   Restriction zones
-   Other service linkages
-   Dispute information
-   Department-specific datasets

------------------------------------------------------------------------

# 5. PARCEL 360° CONCEPT

## Purpose

Provide a unified parcel-level view instead of forcing a user to search
multiple systems.

## Parcel 360° information

### Identity

-   ULPIN
-   Source parcel IDs
-   Administrative location
-   Geometry

### Ownership

-   RoR
-   Ownership information
-   Rights

### Transactions

-   Registration
-   Transaction status
-   Encumbrance
-   Mortgage

### Planning

-   Land use
-   Zoning
-   Master plan
-   Building permissions

### Fiscal

-   Property tax
-   Valuation reference

### Infrastructure

-   Utilities
-   Roads / infrastructure networks

### Risk / Restrictions

-   Environmental zones
-   Restriction zones
-   Dispute / governance information
-   AI-generated risk indicators where supported

------------------------------------------------------------------------

# 6. FINAL SYSTEM ARCHITECTURE

## High-level architecture

``` text
┌───────────────────────────────────────────────────────────────┐
│                         USER CHANNELS                         │
│  Citizen Portal │ Officer Dashboard │ Admin │ Department UI │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                    API / ACCESS LAYER                         │
│ REST │ OpenAPI │ Authentication │ RBAC │ Rate Limiting       │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                       LAND STACK CORE                         │
│                                                               │
│ Parcel Core │ GIS Engine │ Interoperability │ Workflow       │
│ Analytics   │ AI/ML      │ Notification     │ Audit          │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                   CANONICAL LAND DATA MODEL                   │
│ Parcel │ ULPIN │ Geometry │ Ownership │ Rights │ Restrictions│
│ Transaction │ Planning │ Tax │ Utilities │ Disputes           │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                  STATE ADAPTER / DATA LAYER                   │
│ Schema Mapping │ Validation │ Transformation │ ID Mapping    │
│ State-specific language / terminology / units / workflows    │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                 EXISTING DEPARTMENT SYSTEMS                   │
│ Land Records │ Registration │ Planning │ Building │ Tax       │
│ Utilities │ Restrictions │ Disputes │ Other State Systems    │
└───────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 7. DETAILED ARCHITECTURE COMPONENTS

## 7.1 Frontend / User Experience

### Citizen Portal

Core functions:

-   Parcel search
-   Map-based parcel selection
-   Parcel 360° view
-   Ownership information access where permitted
-   Transaction/status tracking
-   Service requests
-   Land-related information discovery
-   Citizen notifications

### Officer Dashboard

Core functions:

-   GIS parcel exploration
-   Parcel 360°
-   Department-specific workflow
-   Request management
-   Cross-department information
-   Verification tasks
-   Risk / analytics dashboard
-   Audit trail
-   Status monitoring

### Admin / Configuration

-   State configuration
-   Department configuration
-   Roles and permissions
-   Dataset configuration
-   Workflow configuration
-   Audit / monitoring

------------------------------------------------------------------------

# 8. LAND STACK CORE SERVICES

## Parcel Core

Responsibilities:

-   Parcel registry
-   ULPIN mapping
-   Source ID mapping
-   Parcel metadata
-   Parcel relationships
-   Parcel search
-   Parcel 360°

## GIS Service

Responsibilities:

-   Parcel rendering
-   Spatial queries
-   Layer management
-   Geometry operations
-   Map search
-   GeoJSON services
-   Spatial filtering

## Interoperability Engine

Responsibilities:

-   Connect departmental systems
-   Transform data
-   Validate incoming data
-   Map source schemas to canonical schema
-   Map source identifiers to parcel identity
-   Handle API exchange
-   Track integration errors

## State Adapter

Responsibilities:

-   State-specific schemas
-   Field mapping
-   Terminology mapping
-   Unit conversion
-   Language/configuration mapping
-   Workflow configuration
-   Department-specific integration rules

## Workflow Engine

Responsibilities:

-   Service request lifecycle
-   Department routing
-   Verification
-   Escalation
-   Status transitions
-   Approval / rejection
-   Audit events
-   Notifications

## Analytics Engine

Responsibilities:

-   Governance dashboards
-   Operational analytics
-   Parcel-level analytics
-   Department performance views
-   Planning insights

## AI / ML Layer

Proposed capabilities:

-   Explainable land-risk analysis
-   Satellite imagery change detection
-   Change-to-parcel mapping
-   Anomaly detection
-   Predictive analytics where data supports it
-   Decision-support assistance

AI must support human decision-making and must not be presented as
automatically replacing official verification or statutory decisions.

## Notification Service

Potential channels:

-   In-app notifications
-   Email
-   SMS / other configured channels

Only include channels actually implemented in the prototype.

## Audit Service

Records:

-   User
-   Role
-   Action
-   Parcel
-   Request
-   Timestamp
-   Previous state
-   New state
-   Relevant system event

------------------------------------------------------------------------

# 9. CANONICAL DATA MODEL

## Core entities

``` text
Parcel
 ├── Parcel Identity
 │    ├── ULPIN
 │    ├── State Parcel ID
 │    └── Source System IDs
 │
 ├── Geometry
 │    ├── Boundary
 │    ├── Centroid
 │    └── Spatial Reference
 │
 ├── Ownership / Rights
 │    ├── RoR
 │    └── Rights
 │
 ├── Registration
 │    ├── Transactions
 │    └── Status
 │
 ├── Encumbrance
 │    └── Mortgage / Liability
 │
 ├── Planning
 │    ├── Land Use
 │    ├── Zoning
 │    └── Master Plan
 │
 ├── Permissions
 │    └── Building Approvals
 │
 ├── Fiscal
 │    ├── Property Tax
 │    └── Valuation
 │
 ├── Utilities
 │    └── Infrastructure Links
 │
 ├── Restrictions
 │    ├── Environmental
 │    └── Administrative
 │
 ├── Disputes
 │    └── Dispute Records
 │
 └── Requests / Workflows
      └── Service Lifecycle
```

## Core identifier strategy

### ULPIN

ULPIN is treated as the suggested common parcel identifier.

Where source systems have different identifiers:

`Source Parcel ID → State Adapter → Canonical Parcel Mapping → ULPIN / Unified Parcel Identity`

Do not assume that every source dataset already contains ULPIN.

------------------------------------------------------------------------

# 10. STATE ADAPTER ARCHITECTURE

## Why State Adapter is necessary

Land administration varies across states.

Differences can occur in:

-   Schema
-   Field names
-   Field counts
-   Units
-   Language
-   Terminology
-   Administrative hierarchy
-   Workflow
-   Existing APIs
-   Legacy systems

## Adapter pipeline

``` text
State Source System
        ↓
Schema Detection / Mapping
        ↓
Field Transformation
        ↓
Unit / Terminology Normalization
        ↓
Identifier Mapping
        ↓
Validation
        ↓
Canonical Land Model
        ↓
Land Stack Services
```

## Replication model

``` text
                 LAND STACK CORE
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
 State Adapter A   State Adapter B   State Adapter C
       │               │                │
 State Systems     State Systems     State Systems
```

This allows the core platform to remain common while state-specific
integration logic is isolated.

------------------------------------------------------------------------

# 11. GIS PIPELINE

## GIS data pipeline

``` text
Cadastral / Spatial Source
        ↓
Ingestion
        ↓
Coordinate / Projection Validation
        ↓
Geometry Validation
        ↓
Parcel Boundary Processing
        ↓
Parcel ID / ULPIN Mapping
        ↓
Canonical Spatial Store
        ↓
GIS API / Tile / GeoJSON Services
        ↓
Map Client
```

## GIS functions

-   Parcel visualization
-   Layer toggling
-   Parcel selection
-   Spatial search
-   Attribute filtering
-   Spatial relationships
-   Administrative boundary filtering
-   Environmental / restriction overlays
-   Utility overlays
-   Planning overlays

------------------------------------------------------------------------

# 12. DATA INGESTION & INTEROPERABILITY PIPELINE

``` text
SOURCE DATA
   │
   ├── API
   ├── CSV
   ├── Database
   ├── GeoJSON
   ├── Shapefile / GIS source
   └── Other configured source
          │
          ▼
INGESTION LAYER
          │
          ▼
SCHEMA MAPPING
          │
          ▼
DATA VALIDATION
          │
          ▼
NORMALIZATION
          │
          ▼
IDENTIFIER MAPPING
          │
          ▼
GEOSPATIAL LINKING
          │
          ▼
CANONICAL DATA MODEL
          │
          ▼
LAND STACK
```

## Validation categories

-   Required-field validation
-   Data-type validation
-   Range validation
-   Geometry validation
-   Duplicate detection
-   Identifier consistency
-   Referential integrity
-   Source provenance

------------------------------------------------------------------------

# 13. API ARCHITECTURE

## API principles

-   REST-based service interfaces
-   OpenAPI documentation
-   JSON
-   GeoJSON for spatial responses where appropriate
-   Versioned APIs
-   Authentication
-   Role-based authorization
-   Audit logging
-   Validation
-   Error handling

## Example logical API groups

``` text
/api/v1/auth
/api/v1/parcels
/api/v1/gis
/api/v1/ownership
/api/v1/registration
/api/v1/encumbrances
/api/v1/planning
/api/v1/building
/api/v1/tax
/api/v1/utilities
/api/v1/disputes
/api/v1/requests
/api/v1/workflows
/api/v1/analytics
/api/v1/ai
/api/v1/admin
/api/v1/audit
```

These are logical endpoint groups, not claims that every endpoint
already exists.

------------------------------------------------------------------------

# 14. AUTHENTICATION & SECURITY

## Authentication

Proposed:

-   JWT
-   OAuth2-compatible authentication flow where required

## Authorization

Role-based access control.

Potential roles include:

-   Citizen
-   Department Officer
-   Verifier
-   Administrator
-   Department-specific officer roles

Use only roles actually configured in the prototype when describing
implemented functionality.

## Security controls

-   Password / credential protection
-   Token-based authentication
-   Role-based authorization
-   API validation
-   HTTPS/TLS in deployment
-   Audit logging
-   Least-privilege access
-   Sensitive-data access restrictions
-   Backup and recovery
-   Monitoring

------------------------------------------------------------------------

# 15. WORKFLOW ENGINE

## Generic service-request lifecycle

``` text
Citizen / Officer
      ↓
Create Request
      ↓
Parcel Identification
      ↓
Request Validation
      ↓
Department Routing
      ↓
Officer Assignment
      ↓
Verification
      ↓
Department Action
      ↓
Cross-Department Dependency
      ↓
Decision / Update
      ↓
Audit + Notification
      ↓
Request Closure
```

## Important parcel/request rule

### One parcel → one request of a given request identity

No two requests may represent the same request on the same parcel.

However:

### One parcel may have multiple distinct disputes

Different disputes can exist simultaneously on the same land parcel as
long as they are separate matters.

This distinction must be preserved in the data model and workflow
design.

------------------------------------------------------------------------

# 16. DEPARTMENTAL WORKFLOW MODEL

The system should route work according to departmental capability.

## Example routing logic

``` text
Request
  ↓
Identify Parcel
  ↓
Identify Request Type
  ↓
Determine Responsible Department
  ↓
Check Required Dependencies
  ↓
Create / Route Task
  ↓
Officer Verification
  ↓
Department Action
  ↓
Update Parcel / Request State
  ↓
Notify Relevant Users
```

## Department capability model

Each department should have configurable:

-   Responsibilities
-   Request types
-   Required data
-   Allowed actions
-   Verification authority
-   Approval authority
-   Escalation rules
-   SLA/configuration fields
-   Dependencies on other departments

Do not hard-code a universal workflow because state and departmental
procedures can vary.

------------------------------------------------------------------------

# 17. DISPUTE MODEL

## Parcel vs dispute distinction

A parcel is the spatial entity.

A dispute is a separate administrative/legal matter associated with a
parcel.

Therefore:

``` text
PARCEL P001
 ├── Dispute D001
 ├── Dispute D002
 └── Dispute D003
```

But:

``` text
PARCEL P001
 ├── Request R001 — valid
 └── Duplicate Request R001 — prohibited
```

## Dispute data

Potential fields:

-   Dispute ID
-   Parcel ID / ULPIN
-   Dispute type
-   Parties / permitted references
-   Department
-   Status
-   Date
-   Documents
-   Actions
-   Hearing / process status
-   Resolution
-   Audit history

Use only fields actually implemented in the prototype.

------------------------------------------------------------------------

# 18. AI / ML PIPELINE

## A. Satellite change detection

``` text
Satellite Image
      ↓
Preprocessing
      ↓
Image Comparison
      ↓
Change Detection
      ↓
Changed Area
      ↓
Spatial Intersection
      ↓
Affected Parcel / ULPIN
      ↓
Governance Check
      ↓
Officer Review
      ↓
Decision / Workflow
```

## B. Explainable land-risk engine

Potential signals:

-   Spatial restriction overlap
-   Land-use mismatch
-   Registration/encumbrance indicators
-   Planning constraints
-   Detected land-use change
-   Other verified parcel attributes

Pipeline:

``` text
Parcel Data
   +
Spatial Layers
   +
Governance Attributes
   ↓
Feature Extraction
   ↓
Risk Model / Rule Engine
   ↓
Risk Indicators
   ↓
Explanation
   ↓
Officer Review
```

The AI output should be treated as decision support, not as an automatic
legal determination.

## C. Analytics

Possible outputs:

-   Parcel-level insights
-   Workflow analytics
-   Planning dashboards
-   Change-detection summaries
-   Department operational dashboards

Do not include model accuracy or performance figures unless measured.

------------------------------------------------------------------------

# 19. TECHNOLOGY STACK

## Frontend

  Component   Technology     Purpose
  ----------- -------------- -------------------------
  UI          React          Web application
  Language    TypeScript     Type safety
  Build       Vite           Frontend build tooling
  Styling     Tailwind CSS   UI styling
  State       Zustand        Client state
  Maps        MapLibre       Interactive GIS maps
  Charts      Recharts       Analytics visualization

## Backend

  Component          Technology   Purpose
  ------------------ ------------ --------------------
  API                FastAPI      Backend services
  Language           Python       Backend / GIS / AI
  Validation         Pydantic     Data validation
  ORM                SQLAlchemy   Database access
  Background tasks   Celery       Asynchronous jobs

## Database

  Component           Technology   Purpose
  ------------------- ------------ ------------------------------------
  Relational DB       PostgreSQL   Core application data
  Spatial DB          PostGIS      Geospatial data
  Cache / messaging   Redis        Caching and asynchronous workloads

## GIS / Geospatial

  Component               Technology   Purpose
  ----------------------- ------------ -----------------------------
  GIS server              GeoServer    Geospatial services
  Geospatial processing   GeoPandas    Vector processing
  Raster processing       Rasterio     Raster/satellite processing
  GIS utilities           GDAL         Data conversion/processing
  Client map              MapLibre     Browser mapping

## AI / ML

  -----------------------------------------------------------------------
  Component               Technology              Purpose
  ----------------------- ----------------------- -----------------------
  ML                      scikit-learn            Classical ML

  Deep learning           PyTorch                 ML/deep-learning
                                                  workloads

  Image processing        OpenCV                  Image analysis

  Satellite/change        Team-selected pipeline  Spatial change analysis
  detection                                       
  -----------------------------------------------------------------------

## API / Standards

-   REST
-   OpenAPI
-   JSON
-   GeoJSON
-   Versioned APIs

## Authentication / Security

-   JWT
-   RBAC
-   Audit logs
-   HTTPS/TLS
-   Secure API validation

## Infrastructure

-   Docker
-   Nginx
-   Object storage
-   GitHub Actions / CI pipeline

### Important

The PPT should only display technologies actually used or committed for
the prototype. If a listed technology has not been implemented, label it
as proposed rather than implemented.

------------------------------------------------------------------------

# 20. DEPLOYMENT ARCHITECTURE

``` text
                    USERS
                      │
                      ▼
                 NGINX / TLS
                      │
                      ▼
             React Web Application
                      │
                      ▼
                FastAPI API
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     Redis         PostgreSQL     Object Storage
                     │
                  PostGIS
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      GIS         Workflow       AI/ML
    Services      Services      Services
```

## Deployment principles

-   Containerized services
-   Environment-specific configuration
-   Database backup
-   Monitoring
-   Logging
-   Horizontal scaling where required
-   GIS optimization
-   Caching for frequently requested spatial data
-   Separation of heavy processing from user-facing requests

------------------------------------------------------------------------

# 21. GIS PERFORMANCE / SCALABILITY STRATEGY

Large spatial datasets can make a web application slow if everything is
rendered directly from the database.

## Strategy

### Data layer

-   PostGIS spatial indexing
-   Partitioning where justified
-   Optimized spatial queries

### API layer

-   Bounding-box filtering
-   Pagination
-   Response simplification
-   Caching
-   GeoJSON only for appropriate query sizes

### Map layer

-   Vector tiles / tiled services where appropriate
-   Layer-specific loading
-   Zoom-dependent detail
-   Lazy loading
-   Server-side filtering

### Application layer

-   Redis caching
-   Background processing
-   Asynchronous jobs
-   Avoid loading all parcels at once

## Key principle

**Do not render the entire national-scale parcel dataset in the
browser.**

Render only the spatial extent and detail required by the current user
view.

------------------------------------------------------------------------

# 22. PROTOTYPE SCOPE

## Prototype deployment concept

The problem statement expects a scalable prototype.

The proposed prototype focuses on demonstrating the architecture with:

-   One city
-   One village
-   Mock/sample land datasets
-   Multiple departmental data sources
-   State-specific schema examples
-   Parcel-centric GIS
-   Citizen interface
-   Officer dashboard
-   Interoperability
-   Workflow
-   Analytics
-   AI-assisted governance features where implemented

## Demonstration modules

### Module 1 --- GIS Parcel Explorer

-   Search parcel
-   Select parcel
-   View boundary
-   Toggle layers
-   View parcel information

### Module 2 --- Parcel 360°

-   Identity
-   Ownership
-   Registration
-   Encumbrance
-   Planning
-   Building
-   Tax
-   Utilities
-   Restrictions
-   Disputes

### Module 3 --- State Adapter

Demonstrate how different source schemas map into a common canonical
model.

### Module 4 --- Department Integration

Demonstrate mock departmental sources.

### Module 5 --- Workflow

Demonstrate request creation, routing, verification, action and closure.

### Module 6 --- Citizen Portal

-   Parcel discovery
-   Information access
-   Service request
-   Status tracking

### Module 7 --- Officer Dashboard

-   Requests
-   GIS context
-   Parcel 360°
-   Verification
-   Workflow
-   Analytics

### Module 8 --- AI / Change Detection

Where implemented:

-   Satellite change detection
-   Parcel association
-   Governance/risk signal
-   Explainable output
-   Officer review

------------------------------------------------------------------------

# 23. END-TO-END DEMONSTRATION FLOW

Use this as the main PPT/demo story:

``` text
CITIZEN / OFFICER
       ↓
SEARCH PARCEL
       ↓
GIS PARCEL SELECTED
       ↓
ULPIN IDENTIFIED
       ↓
PARCEL 360°
       ↓
┌────────────────────────────────────────────┐
│ Ownership │ Registration │ Planning        │
│ Tax       │ Building     │ Utilities       │
│ Restrictions │ Disputes  │ Other Layers    │
└────────────────────────────────────────────┘
       ↓
REQUEST / VERIFICATION
       ↓
WORKFLOW ENGINE
       ↓
DEPARTMENT ROUTING
       ↓
CROSS-DEPARTMENT DATA
       ↓
OFFICER ACTION
       ↓
AUDIT + STATUS UPDATE
       ↓
CITIZEN / DEPARTMENT OUTPUT
```

------------------------------------------------------------------------

# 24. FEASIBILITY

## Technical feasibility

Supported by modular components:

-   React frontend
-   FastAPI backend
-   PostgreSQL/PostGIS
-   GIS services
-   REST/OpenAPI
-   State adapters
-   Containerized deployment

## Integration feasibility

The architecture isolates state-specific differences through:

-   State adapters
-   Canonical data model
-   Schema mapping
-   Validation
-   API transformation
-   Identifier mapping

## Operational feasibility

Role-based interfaces separate:

-   Citizens
-   Officers
-   Verifiers
-   Administrators
-   Departments

## Scalability feasibility

``` text
Prototype
   ↓
City + Village
   ↓
State-level deployment
   ↓
Multiple states
   ↓
National framework
```

This is a proposed scalability path, not a claim of nationwide
deployment.

------------------------------------------------------------------------

# 25. CHALLENGES → RISKS → MITIGATION

  -----------------------------------------------------------------------
  Challenge               Risk                    Mitigation
  ----------------------- ----------------------- -----------------------
  State-wise schema       Integration failure     State Adapter +
  differences                                     canonical schema

  Different terminology   Incorrect mapping       Configurable
                                                  metadata/terminology
                                                  mapping

  Legacy systems          Limited                 API/data adapters
                          interoperability        

  Data quality            Incorrect parcel        Validation +
                          information             provenance + audit

  Spatial complexity      Slow GIS performance    PostGIS indexes +
                                                  tiled/lazy rendering +
                                                  caching

  Access control          Unauthorized data       JWT + RBAC + audit
                          access                  

  Large datasets          Performance degradation Spatial filtering +
                                                  background processing

  Workflow variation      Incorrect routing       Configurable department
                                                  workflows

  AI false positives      Misleading decision     Explainability +
                          support                 officer review

  State replication       High customization cost Configuration-driven
                                                  state adapters
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 26. INNOVATION / UNIQUENESS

## 1. Parcel as the integration primitive

Instead of treating departments as isolated applications, the platform
organizes governance information around the parcel.

## 2. ULPIN-oriented common identity

The architecture uses a common parcel identity to connect heterogeneous
datasets.

## 3. State Adapter model

State-specific data and workflows are isolated from the common core.

This allows replication without rewriting the entire platform.

## 4. Parcel 360°

Multiple land-governance domains become discoverable from one parcel
context.

## 5. Workflow-aware interoperability

Integration is not limited to data exchange.

The platform also connects:

`Data → Department → Task → Verification → Action → Audit`

## 6. Explainable geospatial intelligence

AI/ML is positioned as decision support using parcel-linked spatial and
governance signals.

## 7. Citizen + government ecosystem

The same parcel-centric foundation supports:

-   Citizen services
-   Officer workflows
-   Department integration
-   Planning
-   Analytics

------------------------------------------------------------------------

# 27. IMPACT & BENEFITS

## Citizens

-   Easier parcel discovery
-   Centralized land information view
-   Better service visibility
-   Transaction/service status tracking
-   Reduced dependence on disconnected information sources

## Government Officers

-   Unified parcel context
-   Faster information discovery
-   Cross-department visibility
-   GIS-supported decisions
-   Workflow tracking
-   Auditability

## Departments

-   Interoperable data exchange
-   Common parcel context
-   Reduced duplication
-   Configurable integrations
-   Shared spatial framework

## Governance

-   Better data-driven planning
-   Transparent service workflows
-   Integrated administrative information
-   Better traceability

## Economic

Potential benefits:

-   Reduced information friction in land transactions
-   Better access to verified land information
-   More efficient administrative processes
-   Improved planning and decision support

Do not add monetary savings without measured evidence.

## Environmental

Potential support through:

-   Environmental restriction layers
-   Spatial monitoring
-   Satellite-based change detection
-   Planning overlays

Do not claim quantified environmental impact without evidence.

------------------------------------------------------------------------

# 28. BEFORE → AFTER STORY

## BEFORE

``` text
Land Records ─────┐
Registration ────┤
Planning ────────┤
Building ────────┤
Tax ─────────────┤──→ Fragmented systems
Utilities ───────┤
Restrictions ────┘
```

Problems:

-   Multiple systems
-   Different schemas
-   Disconnected workflows
-   Repeated searches
-   Limited cross-department context

## AFTER

``` text
                 LAND STACK
                     │
              PARCEL / ULPIN
                     │
     ┌───────────────┼────────────────┐
     │               │                │
 Governance       GIS            Workflow
     │               │                │
     └───────────────┼────────────────┘
                     │
            Citizen + Officer
                     │
               Better visibility
```

------------------------------------------------------------------------

# 29. RESEARCH / REFERENCES DATA

## Problem-statement source

**Department of Land Resources / SIH problem statement supplied by
team**

Use the exact problem statement as the primary factual source.

## SIH template

**Smart India Hackathon 2026 Idea Presentation Format**

Use as the authority for:

-   Six-slide structure
-   Required pointers
-   Submission formatting

## SIH presentation guidance

**SIH Winners Vault --- Techdoodles**

Use only as presentation strategy reference:

-   Problem-first storytelling
-   Visual slides
-   Working prototype
-   Explicit uniqueness
-   Feasibility/scalability preparedness

Do not present this document as an official SIH judging rubric.

## Technical references to add before final PPT

### GIS

-   OGC standards
-   GeoJSON specification
-   PostGIS documentation
-   GeoServer documentation
-   GDAL documentation
-   MapLibre documentation

### API

-   OpenAPI specification
-   REST architectural principles

### Security

-   OAuth 2.0
-   JWT
-   OWASP guidance

### AI / ML

Add only the exact research papers and documentation used by the actual
prototype.

### Land governance

Add verified official Government of India / Department of Land Resources
references relevant to:

-   Land Stack
-   ULPIN
-   Digital land records
-   Land administration
-   GIS / cadastral modernization

------------------------------------------------------------------------

# 30. REQUIRED PROTOTYPE EVIDENCE

The final PPT should use real screenshots wherever possible.

## Required screenshots

### Slide 1

-   Hero / system visual

### Slide 2

-   Main product screen or Parcel 360° screenshot

### Slide 3

-   Architecture diagram
-   GIS map screenshot
-   Technical stack visual

### Slide 4

-   Workflow screen
-   Deployment / scalability diagram

### Slide 5

-   Citizen portal
-   Officer dashboard
-   Impact visual

### Slide 6

-   QR code(s)
-   Research/reference cards

## Minimum high-value prototype screenshots

1.  GIS parcel map
2.  Parcel 360° page
3.  Citizen request page
4.  Officer workflow dashboard
5.  State Adapter / integration demonstration
6.  AI/change-detection output, if implemented

------------------------------------------------------------------------

# 31. VISUAL DIAGRAM INVENTORY

## Diagram A --- Land Stack overview

``` text
Departments
    ↓
State Adapters
    ↓
Canonical Model
    ↓
Parcel / ULPIN
    ↓
Land Stack
    ↓
Citizens + Officers
```

## Diagram B --- Three-layer land model

``` text
┌─────────────────────────────────┐
│ ADDITIONAL / USE-CASE           │
│ Utilities • Tax • Environment   │
│ Infrastructure • Restrictions   │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ ESSENTIAL GOVERNANCE            │
│ RoR • Registration • Planning   │
│ Building • Encumbrance • Zoning│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ BASE SPATIAL                    │
│ Cadastral • Parcel • ULPIN     │
└─────────────────────────────────┘
```

## Diagram C --- Technical architecture

Use the architecture from Section 6.

## Diagram D --- Interoperability

``` text
Department Systems
       ↓
State Adapter
       ↓
Schema + Metadata Mapping
       ↓
Validation
       ↓
Identifier Mapping
       ↓
Canonical Parcel Model
       ↓
Land Stack
```

## Diagram E --- Workflow

Use the workflow from Section 15.

## Diagram F --- AI change detection

Use the pipeline from Section 18.

## Diagram G --- Scalability

``` text
City + Village Prototype
          ↓
State Configuration
          ↓
State Deployment
          ↓
Multi-State Replication
          ↓
National Framework
```

------------------------------------------------------------------------

# 32. SLIDE-BY-SLIDE DATA ALLOCATION

# SLIDE 1 --- TITLE PAGE

### Must contain

-   Smart India Hackathon 2026
-   Problem Statement ID: SIH26014
-   Problem Statement Title: Land Stack
-   Theme: \[DATA REQUIRED\]
-   PS Category: \[DATA REQUIRED\]
-   Team ID: \[DATA REQUIRED\]
-   Team Name: \[DATA REQUIRED\]
-   Solution visual: BhoomiSetu / Land Stack

### Main visual

Fragmented systems → Parcel/ULPIN → Land Stack → Citizen/Government

------------------------------------------------------------------------

# SLIDE 2 --- IDEA TITLE

### Headline

**BhoomiSetu --- One Parcel. Every Record.**

### Core message

A parcel-centric GIS platform that connects fragmented land-governance
datasets, workflows and services through a common parcel identity and
interoperable state adapters.

### Show

-   Problem → Solution
-   Parcel/ULPIN at center
-   Departments around it
-   Citizen/officer outputs
-   4--6 uniqueness points

------------------------------------------------------------------------

# SLIDE 3 --- TECHNICAL APPROACH

### Show architecture

``` text
Users
 ↓
React / Web
 ↓
API Layer
 ↓
Land Stack Core
 ↓
Canonical Model
 ↓
State Adapter
 ↓
Department Systems
```

### Show technology stack

**Frontend** React + TypeScript + Vite + Tailwind + Zustand + MapLibre +
Recharts

**Backend** FastAPI + Python + Pydantic + SQLAlchemy + Celery

**Data** PostgreSQL + PostGIS + Redis

**GIS** GeoServer + GDAL + GeoPandas + Rasterio

**AI/ML** PyTorch + OpenCV + scikit-learn

**Integration** REST + OpenAPI + JSON + GeoJSON

**Security** JWT + RBAC + Audit Logs

**Infrastructure** Docker + Nginx + Object Storage + GitHub Actions

### Main visual

Architecture diagram + GIS screenshot.

------------------------------------------------------------------------

# SLIDE 4 --- FEASIBILITY AND VIABILITY

### Show

`Challenge → Risk → Mitigation`

Primary challenges:

-   State data heterogeneity
-   Legacy systems
-   Data quality
-   GIS scale
-   Workflow differences
-   Security
-   AI false positives

### Main mitigation concepts

-   State adapters
-   Canonical schema
-   Validation
-   PostGIS optimization
-   Configurable workflows
-   RBAC + audit
-   Human-in-the-loop AI

### Scalability

`Prototype → State → Multi-State → National Framework`

------------------------------------------------------------------------

# SLIDE 5 --- IMPACT AND BENEFITS

### Target audiences

-   Citizens
-   Officers
-   Departments
-   Planning/governance stakeholders

### Main outcomes

**Citizens** Better access and visibility

**Officers** Unified parcel context + workflows

**Departments** Interoperability + reduced fragmentation

**Governance** Data-driven planning + traceability

**Environmental** Spatial restriction + monitoring support

### Main visual

Before → After

------------------------------------------------------------------------

# SLIDE 6 --- RESEARCH AND REFERENCES

### Include

-   Official problem statement source
-   SIH template
-   Government land-governance sources
-   ULPIN references
-   GIS standards
-   API standards
-   Security references
-   AI/ML research actually used
-   Dataset references actually used
-   GitHub / prototype URL
-   Demo URL
-   Up to 3 QR codes

------------------------------------------------------------------------

# 33. REQUIRED TEAM INPUT BEFORE FINAL PPT

## Critical

-   [ ] Official Problem Statement ID confirmation
-   [ ] Official Problem Statement Title confirmation
-   [ ] Theme
-   [ ] PS Category
-   [ ] Team ID
-   [ ] Registered Team Name
-   [ ] Final solution name
-   [ ] Actual implemented technologies
-   [ ] Actual prototype modules
-   [ ] Actual architecture confirmation

## Important

-   [ ] Prototype URL
-   [ ] GitHub URL
-   [ ] Demo URL
-   [ ] GIS screenshots
-   [ ] Parcel 360° screenshot
-   [ ] Citizen portal screenshot
-   [ ] Officer dashboard screenshot
-   [ ] Workflow screenshot
-   [ ] AI/change-detection screenshot
-   [ ] State adapter demonstration
-   [ ] Actual dataset list
-   [ ] Actual API list
-   [ ] Actual measured performance

## Evidence required for quantitative claims

-   [ ] GIS query latency
-   [ ] API latency
-   [ ] Dataset size
-   [ ] Number of integrated datasets
-   [ ] Number of parcels in prototype
-   [ ] AI accuracy
-   [ ] Change-detection accuracy
-   [ ] Workflow processing time
-   [ ] Any cost/efficiency improvement

Do not place any of these numbers in the PPT until verified.

------------------------------------------------------------------------

# 34. FINAL PPT GENERATION RULES

The PPT-generation agent must:

1.  Use the supplied official SIH 2026 template.
2.  Preserve the six required slide pointers.
3.  Generate exactly six slides.
4.  Use the title slide as Slide 1.
5.  Do not include the template's instruction slide in the final deck.
6.  Keep paragraphs out.
7.  Use diagrams and infographics as primary communication.
8.  Keep text concise.
9.  Use real prototype screenshots where available.
10. Do not invent statistics.
11. Do not invent partnerships.
12. Do not invent implementation status.
13. Distinguish proposed vs implemented features.
14. Keep architecture technically consistent with this document.
15. Keep the same terminology throughout.
16. Ensure every technology shown is actually used or explicitly
    labelled proposed.
17. Use QR codes only for verified URLs.
18. Export the final submission as PDF.

------------------------------------------------------------------------

# 35. MASTER ONE-SENTENCE STORY

> **BhoomiSetu turns fragmented land-governance systems into a
> parcel-centric Land Stack by connecting heterogeneous state datasets
> through adapters, a canonical data model and ULPIN-linked GIS, then
> exposing unified workflows and services to citizens and government.**

------------------------------------------------------------------------

# 36. MASTER ARCHITECTURE STORY

> **Existing departmental systems remain the sources of specialized
> data; BhoomiSetu connects them through configurable state adapters and
> a canonical parcel model, with ULPIN-oriented identity at the center,
> while GIS, workflow, analytics and AI services turn integrated data
> into actionable citizen and government services.**

------------------------------------------------------------------------

# 37. MASTER DEMO STORY

> **Search a parcel → identify its ULPIN → open Parcel 360° → inspect
> ownership, registration, planning, tax, utilities and restrictions →
> create or process a service request → route it to the responsible
> department → verify and act → record the audit trail → expose the
> updated status to the authorized user.**

------------------------------------------------------------------------

# 38. MASTER DIFFERENTIATOR

> **The key differentiator is not simply putting land datasets on one
> map; it is creating a configurable parcel-centric integration layer
> that connects heterogeneous state systems, data and workflows without
> requiring every department to be replaced by one new system.**

------------------------------------------------------------------------

# 39. PPT GENERATION HANDOFF

## Final slide count

**6**

## Slide titles

1.  TITLE PAGE
2.  IDEA TITLE
3.  TECHNICAL APPROACH
4.  FEASIBILITY AND VIABILITY
5.  IMPACT AND BENEFITS
6.  RESEARCH AND REFERENCES

## Core solution

**BhoomiSetu --- Parcel-Centric Land Stack**

## Core identity

**Parcel + ULPIN**

## Core architecture

**Users → API → Land Stack Core → Canonical Model → State Adapters →
Existing Department Systems**

## Core data model

**Base Spatial → Essential Governance → Additional / Use-Case Layers**

## Core workflow

**Parcel Search → Parcel 360° → Request → Routing → Verification →
Department Action → Audit → Status**

## Core technical stack

**React / TypeScript / Vite / Tailwind / Zustand / MapLibre / Recharts**

**FastAPI / Python / Pydantic / SQLAlchemy / Celery**

**PostgreSQL / PostGIS / Redis**

**GeoServer / GDAL / GeoPandas / Rasterio**

**PyTorch / OpenCV / scikit-learn**

**REST / OpenAPI / JSON / GeoJSON**

**JWT / RBAC / Audit Logs**

**Docker / Nginx / Object Storage / GitHub Actions**

## Core innovation

-   Parcel-centric integration
-   ULPIN-oriented identity
-   State Adapter architecture
-   Parcel 360°
-   Workflow-aware interoperability
-   Explainable geospatial intelligence
-   Citizen + government ecosystem

## Core feasibility strategy

**Canonical Model + State Adapters + Validation + Configurable
Workflows + Spatial Optimization + RBAC**

## Core impact

**Citizens + Officers + Departments + Governance + Planning**

## Main visual assets

-   Land Stack hero
-   Problem → solution infographic
-   Three-layer data architecture
-   Technical architecture
-   GIS screenshot
-   Parcel 360° screenshot
-   Workflow diagram
-   Challenge-risk-mitigation matrix
-   Before/after impact graphic
-   Reference cards
-   QR codes

## Missing data

-   Official theme
-   Team ID
-   Registered team name
-   Confirmed PS category
-   Final prototype evidence
-   Verified metrics
-   Final reference URLs
-   Actual dataset inventory
-   Actual deployment/demo links

------------------------------------------------------------------------

# END OF MASTER DATA DOCUMENT
