# **BHOOMISETU**

## **Technical Architecture, Implementation Plan and API Specification**

### **GIS-Based Parcel-Centric Land Governance Prototype**

---

# **1\. DOCUMENT PURPOSE**

This document defines the technical implementation plan for **BhoomiSetu**, a GIS-based, parcel-centric land governance prototype aligned with the interoperability principles described in the Land Stack problem statement.

The prototype is designed around:

* Mock land datasets.  
* Simulated State-level schemas.  
* Independent mock departmental systems.  
* API-based interoperability.  
* GIS parcel visualization.  
* Parcel-level information aggregation.  
* Simulated governance workflows.  
* Role-Based Access Control.  
* Audit logging.  
* AI-assisted decision support.

The system is intentionally designed as a **functional prototype architecture**.

It does not require access to real government databases.

---

# **2\. TECHNICAL DESIGN PRINCIPLE**

The central technical principle is:

> **Existing systems remain independent. BhoomiSetu connects them.**

The architecture therefore avoids putting all departmental data into one giant database.

Instead:

MOCK STATE / DEPARTMENT SYSTEMS  
              │  
              ▼  
        DEPARTMENT APIs  
              │  
              ▼  
     INTEROPERABILITY LAYER  
              │  
              ▼  
       CANONICAL DATA MODEL  
              │  
              ▼  
        BHOOMISETU CORE  
              │  
              ▼  
          PARCEL 360°

This is important because a real Land Stack-style ecosystem would need to integrate heterogeneous systems rather than assume that every department will abandon its existing infrastructure for humanity's favourite activity: another database migration.

---

# **3\. RECOMMENDED TECH STACK**

## **3.1 Frontend**

| Component | Technology |
| ----- | ----- |
| Framework | React.js |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Component Library | shadcn/ui |
| State Management | Zustand |
| Server State | TanStack Query |
| GIS Map | MapLibre GL JS or Leaflet |
| Charts | Recharts |
| Form Handling | React Hook Form |
| Validation | Zod |

### **Recommended Choice**

React \+ TypeScript  
        \+  
Vite  
        \+  
Tailwind CSS  
        \+  
MapLibre GL JS

MapLibre GL JS is recommended when a more advanced vector-map experience is required.

Leaflet is acceptable if development simplicity is prioritized.

---

# **3.2 Backend**

| Component | Technology |
| ----- | ----- |
| Runtime | Node.js |
| Language | TypeScript |
| Framework | NestJS |
| API Architecture | REST |
| Validation | class-validator / Zod |
| ORM | Prisma or TypeORM |
| API Documentation | Swagger / OpenAPI |
| Authentication | JWT |
| Password Hashing | Argon2 or bcrypt |

### **Recommended Choice**

Node.js  
   \+  
TypeScript  
   \+  
NestJS

NestJS is recommended because the project contains multiple modules, roles, APIs, workflows, and services.

A plain Express backend would work, but it will become increasingly unpleasant as the project grows. Humans already have enough reasons to hate their own codebase.

---

# **3.3 GIS and Spatial Database**

| Component | Technology |
| ----- | ----- |
| Database | PostgreSQL |
| Spatial Extension | PostGIS |
| Spatial Data Format | GeoJSON |
| GIS Operations | PostGIS Functions |
| Optional GIS Server | GeoServer |

### **Core GIS Stack**

PostgreSQL  
      \+  
PostGIS  
      \+  
GeoJSON  
      \+  
MapLibre / Leaflet

PostGIS will handle:

* Parcel polygons.  
* Point-in-polygon queries.  
* Spatial intersections.  
* Distance calculations.  
* Restriction zone intersections.  
* Zoning overlays.

---

# **3.4 AI Layer**

| Component | Technology |
| ----- | ----- |
| AI Gateway | Backend AI Service |
| LLM Provider | Groq API |
| Backend SDK | OpenAI-compatible SDK or Groq SDK |
| Structured Output | JSON Schema |
| Prompt Validation | Zod / Pydantic |
| AI Processing | Server-side only |

The AI service must be separated from the main business logic.

USER REQUEST  
     │  
     ▼  
BHOOMISETU BACKEND  
     │  
     ▼  
AI SERVICE  
     │  
     ▼  
GROQ API  
     │  
     ▼  
STRUCTURED RESPONSE  
     │  
     ▼  
VALIDATION  
     │  
     ▼  
APPLICATION RESPONSE

---

# **3.5 Optional Computer Vision / Change Detection**

For the prototype:

| Component | Technology |
| ----- | ----- |
| Image Processing | Python |
| API Service | FastAPI |
| Computer Vision | OpenCV |
| ML Framework | PyTorch |
| Spatial Processing | Rasterio / GeoPandas |

Recommended approach:

Python  
   \+  
FastAPI  
   \+  
OpenCV

Do not begin by training a custom satellite AI model.

For the MVP, use:

* Sample before image.  
* Sample after image.  
* Precomputed change region.  
* OpenCV difference demonstration.

This is technically valid for demonstrating the architecture without wasting half the hackathon teaching a GPU to detect rectangles.

---

# **4\. OVERALL TECHNICAL ARCHITECTURE**

                        CLIENT LAYER  
                              │  
          ┌───────────────────┼───────────────────┐  
          ▼                   ▼                   ▼

     CITIZEN PORTAL     OFFICER PORTAL      ADMIN PORTAL  
          │                   │                   │  
          └───────────────────┼───────────────────┘  
                              │  
                              ▼  
                       API GATEWAY  
                              │  
                              ▼  
                    BHOOMISETU BACKEND  
                              │  
       ┌──────────────────────┼──────────────────────┐  
       ▼                      ▼                      ▼

 PARCEL MODULE         WORKFLOW MODULE        AI MODULE  
       │                      │                      │  
       ▼                      ▼                      ▼

 GIS SERVICE          AUDIT SERVICE       GROQ AI SERVICE  
       │                      │  
       ▼                      ▼

 POSTGIS             AUDIT DATABASE  
       │  
       ▼  
CANONICAL PARCEL MODEL  
       │  
       ▼  
INTEROPERABILITY ENGINE  
       │  
 ┌─────┼────────┬──────────┬──────────┬──────────┐  
 ▼     ▼        ▼          ▼          ▼

RoR   REG     PLANNING    TAX     RESTRICTION  
API   API       API        API        API

      MOCK DEPARTMENT SYSTEMS

---

# **5\. RECOMMENDED PROJECT STRUCTURE**

## **Backend**

backend/  
│  
├── src/  
│   │  
│   ├── auth/  
│   ├── users/  
│   ├── parcels/  
│   ├── gis/  
│   ├── interoperability/  
│   ├── adapters/  
│   ├── workflows/  
│   ├── departments/  
│   ├── ai/  
│   ├── audit/  
│   ├── notifications/  
│   └── common/  
│  
├── prisma/  
│  
└── docker/

---

## **Frontend**

frontend/  
│  
├── src/  
│   │  
│   ├── components/  
│   ├── pages/  
│   ├── features/  
│   │  
│   ├── features/parcels/  
│   ├── features/map/  
│   ├── features/workflow/  
│   ├── features/ai/  
│   └── features/admin/  
│  
├── hooks/  
├── services/  
├── store/  
└── types/

---

# **6\. DATABASE ARCHITECTURE**

BhoomiSetu should use two database concepts.

## **Database Type A**

### **BhoomiSetu Core Database**

Contains:

* Users.  
* Roles.  
* Canonical parcels.  
* GIS references.  
* Workflow records.  
* Audit records.  
* API integration metadata.

## **Database Type B**

### **Mock Department Databases**

Simulated independently for:

* Land Records.  
* Registration.  
* Planning.  
* Taxation.  
* Restrictions.

The architecture therefore demonstrates independent source systems.

---

# **7\. CORE DATABASE SCHEMA**

## **7.1 USERS**

users

| Field | Type |
| ----- | ----- |
| id | UUID |
| name | VARCHAR |
| email | VARCHAR |
| password\_hash | VARCHAR |
| role\_id | UUID |
| created\_at | TIMESTAMP |
| updated\_at | TIMESTAMP |

---

## **7.2 ROLES**

roles

| Field | Type |
| ----- | ----- |
| id | UUID |
| name | VARCHAR |
| description | TEXT |

Example roles:

CITIZEN  
LAND\_RECORD\_OFFICER  
REGISTRATION\_OFFICER  
PLANNING\_OFFICER  
ADMIN

---

# **8\. CANONICAL PARCEL DATABASE SCHEMA**

## **parcels**

parcels

| Field | Type |
| ----- | ----- |
| id | UUID |
| canonical\_parcel\_id | VARCHAR |
| ulpin | VARCHAR |
| state\_code | VARCHAR |
| district\_code | VARCHAR |
| local\_body\_code | VARCHAR |
| geometry | GEOMETRY(POLYGON) |
| area\_sq\_m | DECIMAL |
| created\_at | TIMESTAMP |
| updated\_at | TIMESTAMP |

---

# **9\. PARCEL IDENTIFIER TABLE**

A parcel can have multiple identifiers.

parcel\_identifiers

| Field | Type |
| ----- | ----- |
| id | UUID |
| parcel\_id | UUID |
| identifier\_type | VARCHAR |
| identifier\_value | VARCHAR |
| source\_state | VARCHAR |
| source\_department | VARCHAR |

Example:

ULPIN              → ULPIN-123456

SURVEY\_NUMBER      → 42/3

PLOT\_NUMBER        → 121

LOCAL\_PARCEL\_ID    → MH-XYZ-982

This prevents the system from depending entirely on ULPIN availability.

---

# **10\. SOURCE DATA METADATA**

data\_sources

| Field | Type |
| ----- | ----- |
| id | UUID |
| department | VARCHAR |
| state\_code | VARCHAR |
| api\_base\_url | VARCHAR |
| schema\_version | VARCHAR |
| adapter\_version | VARCHAR |
| last\_sync | TIMESTAMP |

---

# **11\. MOCK STATE DATABASE SCHEMAS**

The prototype should demonstrate at least two deliberately different State schemas.

This is extremely important.

If every State mock uses the same columns and the same identifiers, then you have not actually demonstrated interoperability. You have demonstrated that identical databases can exchange data, which is roughly as shocking as discovering water is wet.

---

# **12\. MOCK STATE A SCHEMA**

## **Example: State A**

Land records use:

survey\_number  
subdivision\_number  
owner\_name  
village\_code  
area\_hectares

### **Table**

state\_a\_land\_records

| Field | Type |
| ----- | ----- |
| record\_id | UUID |
| survey\_number | VARCHAR |
| subdivision\_number | VARCHAR |
| owner\_name | VARCHAR |
| village\_code | VARCHAR |
| area\_hectares | DECIMAL |
| record\_status | VARCHAR |

### **Example**

{  
  "survey\_number": "42",  
  "subdivision\_number": "3",  
  "owner\_name": "Sample Citizen",  
  "village\_code": "VIL001",  
  "area\_hectares": 0.85  
}

---

# **13\. MOCK STATE B SCHEMA**

## **Example: State B**

Land records use:

plot\_id  
holder\_name  
locality\_id  
land\_extent\_sqft  
record\_category

### **Table**

state\_b\_land\_records

| Field | Type |
| ----- | ----- |
| record\_id | UUID |
| plot\_id | VARCHAR |
| holder\_name | VARCHAR |
| locality\_id | VARCHAR |
| land\_extent\_sqft | DECIMAL |
| record\_category | VARCHAR |

### **Example**

{  
  "plot\_id": "P-9087",  
  "holder\_name": "Sample Citizen",  
  "locality\_id": "LOC900",  
  "land\_extent\_sqft": 9150,  
  "record\_category": "Urban"  
}

---

# **14\. STATE ADAPTER MAPPING**

The adapter converts source schemas into the canonical model.

## **State A**

survey\_number  
       │  
       ▼  
source\_identifier

owner\_name  
       │  
       ▼  
ownership.owner\_name

area\_hectares  
       │  
       ▼  
area\_sq\_m

---

## **State B**

plot\_id  
       │  
       ▼  
source\_identifier

holder\_name  
       │  
       ▼  
ownership.owner\_name

land\_extent\_sqft  
       │  
       ▼  
area\_sq\_m

---

# **15\. CANONICAL PARCEL RESPONSE**

All department responses are transformed into a common structure.

{  
  "parcel\_id": "UUID",  
  "identifiers": {  
    "ulpin": "optional",  
    "survey\_number": "optional",  
    "plot\_number": "optional",  
    "local\_identifier": "required"  
  },  
  "location": {  
    "state": "State A",  
    "district": "District X",  
    "locality": "Village Y"  
  },  
  "spatial": {  
    "area\_sq\_m": 3440,  
    "geometry": {}  
  },  
  "sources": \[  
    {  
      "department": "LAND\_RECORDS",  
      "status": "AVAILABLE"  
    }  
  \]  
}

---

# **16\. MOCK DEPARTMENT SYSTEMS**

The prototype will simulate five departments.

## **1\. Land Records Department**

Responsible for:

* Ownership.  
* Record of Rights.  
* Survey information.

---

## **2\. Registration Department**

Responsible for:

* Registration status.  
* Transaction records.  
* Registration history.

---

## **3\. Planning Department**

Responsible for:

* Land use.  
* Zoning.  
* Master plan information.

---

## **4\. Tax Department**

Responsible for:

* Property tax.  
* Tax status.  
* Outstanding amount.

---

## **5\. Restriction Department**

Responsible for:

* Environmental zones.  
* Protected areas.  
* Other restrictions.

---

# **17\. MOCK DEPARTMENT API ARCHITECTURE**

Each mock department should run independently.

Example:

Department A API

http://mock-land-records:3001

Department B API

http://mock-registration:3002

Department C API

http://mock-planning:3003

Department D API

http://mock-tax:3004

The BhoomiSetu backend integrates these systems.

---

# **18\. BHOOMISETU CORE API ENDPOINTS**

## **Authentication**

### **Register**

POST /api/v1/auth/register

### **Login**

POST /api/v1/auth/login

### **Refresh Token**

POST /api/v1/auth/refresh

---

# **19\. USER ENDPOINTS**

### **Get Current User**

GET /api/v1/users/me

### **Get User by ID**

GET /api/v1/users/:id

### **Update User**

PATCH /api/v1/users/:id

---

# **20\. PARCEL ENDPOINTS**

## **Search Parcels**

GET /api/v1/parcels

Query parameters:

?ulpin=  
?survey\_number=  
?plot\_number=  
?local\_identifier=  
?state=  
?district=

---

## **Get Parcel**

GET /api/v1/parcels/:parcelId

---

## **Get Parcel Geometry**

GET /api/v1/parcels/:parcelId/geometry

---

## **Get Parcel 360**

GET /api/v1/parcels/:parcelId/360

Response combines:

* GIS.  
* Ownership.  
* Registration.  
* Planning.  
* Tax.  
* Restrictions.

---

# **21\. GIS ENDPOINTS**

## **Get Map Parcels**

GET /api/v1/gis/parcels

Supports:

bbox  
zoom  
state  
district

---

## **Find Parcel by Coordinates**

GET /api/v1/gis/parcel-at-location

Example:

?lat=19.076  
\&lng=72.877

---

## **Check Spatial Restrictions**

GET /api/v1/gis/parcels/:parcelId/restrictions

---

# **22\. DEPARTMENT INTEROPERABILITY ENDPOINTS**

## **Land Records**

GET /api/v1/integrations/land-records/:parcelId

---

## **Registration**

GET /api/v1/integrations/registration/:parcelId

---

## **Planning**

GET /api/v1/integrations/planning/:parcelId

---

## **Tax**

GET /api/v1/integrations/tax/:parcelId

---

## **Full Aggregation**

GET /api/v1/integrations/parcel/:parcelId

The response passes through:

API CALL  
   │  
   ▼  
IDENTIFIER RESOLUTION  
   │  
   ▼  
STATE ADAPTER  
   │  
   ▼  
SCHEMA VALIDATION  
   │  
   ▼  
CANONICAL TRANSFORMATION  
   │  
   ▼  
RESPONSE AGGREGATION

---

# **23\. WORKFLOW API ENDPOINTS**

## **Create Workflow**

POST /api/v1/workflows

---

## **Get Workflow**

GET /api/v1/workflows/:workflowId

---

## **Update Workflow Status**

PATCH /api/v1/workflows/:workflowId/status

---

## **Get Parcel Workflows**

GET /api/v1/parcels/:parcelId/workflows

---

# **24\. WORKFLOW DATABASE SCHEMA**

workflows

| Field | Type |
| ----- | ----- |
| id | UUID |
| parcel\_id | UUID |
| workflow\_type | VARCHAR |
| current\_status | VARCHAR |
| created\_by | UUID |
| created\_at | TIMESTAMP |
| updated\_at | TIMESTAMP |

---

## **workflow\_steps**

workflow\_steps

| Field | Type |
| ----- | ----- |
| id | UUID |
| workflow\_id | UUID |
| department | VARCHAR |
| assigned\_role | VARCHAR |
| status | VARCHAR |
| action | VARCHAR |
| remarks | TEXT |
| completed\_at | TIMESTAMP |

---

# **25\. SIMULATED WORKFLOW**

CITIZEN REQUEST  
      │  
      ▼  
WORKFLOW CREATED  
      │  
      ▼  
LAND RECORD REVIEW  
      │  
      ▼  
REGISTRATION REVIEW  
      │  
      ▼  
PLANNING REVIEW  
      │  
      ▼  
OFFICER DECISION  
      │  
      ▼  
AUDIT LOG  
      │  
      ▼  
CITIZEN NOTIFICATION

---

# **26\. AUDIT API**

## **Get Audit History**

GET /api/v1/audit

---

## **Get Parcel Audit History**

GET /api/v1/parcels/:parcelId/audit

---

# **27\. AUDIT DATABASE SCHEMA**

audit\_logs

| Field | Type |
| ----- | ----- |
| id | UUID |
| user\_id | UUID |
| role | VARCHAR |
| action | VARCHAR |
| entity\_type | VARCHAR |
| entity\_id | UUID |
| metadata | JSONB |
| created\_at | TIMESTAMP |

Example:

USER:  
Officer 123

ACTION:  
WORKFLOW\_APPROVED

ENTITY:  
Parcel ABC

TIME:  
Timestamp

---

# **28\. AI SERVICE ARCHITECTURE**

Groq should be integrated only through the backend.

FRONTEND  
    │  
    ▼  
BHOOMISETU BACKEND  
    │  
    ▼  
AI SERVICE  
    │  
    ▼  
GROQ API

Never expose:

GROQ\_API\_KEY

in:

* Frontend code.  
* GitHub repositories.  
* Client-side environment variables.

The API key must exist only in server-side environment configuration.

---

# **29\. RECOMMENDED GROQ USE CASES**

## **29.1 Natural Language Parcel Query**

Example:

Show me all parcels with  
pending tax and a land-use restriction.

The AI converts the request into structured query intent.

Example output:

{  
  "filters": {  
    "tax\_status": "PENDING",  
    "has\_restriction": true  
  }  
}

The backend then executes the actual database query.

The LLM must never directly execute unrestricted SQL.

---

## **29.2 Parcel 360 Summary**

The AI can summarize structured parcel information.

Example:

Parcel Summary:

Ownership information is available.  
Registration status is verified.  
The parcel is located in a residential zone.  
One planning restriction requires officer review.

---

## **29.3 Governance Alert Explanation**

Input:

{  
  "physical\_change\_detected": true,  
  "building\_permission": "NOT\_FOUND",  
  "zone": "RESIDENTIAL"  
}

AI output:

{  
  "risk\_level": "MEDIUM",  
  "explanation": "A physical change was detected but no corresponding permission record was found.",  
  "recommended\_action": "OFFICER\_REVIEW"  
}

---

## **29.4 Document and Data Explanation**

The AI can explain complex records to citizens in simpler language.

The source data remains authoritative.

The AI explanation is only an interpretation layer.

---

# **30\. GROQ STRUCTURED OUTPUT STRATEGY**

AI responses should always be validated.

Preferred architecture:

USER QUERY  
     │  
     ▼  
PROMPT TEMPLATE  
     │  
     ▼  
GROQ MODEL  
     │  
     ▼  
STRUCTURED JSON  
     │  
     ▼  
ZOD VALIDATION  
     │  
     ▼  
BACKEND SERVICE

Example AI response structure:

{  
  "summary": "string",  
  "risk\_level": "LOW | MEDIUM | HIGH",  
  "findings": \[  
    {  
      "type": "string",  
      "description": "string"  
    }  
  \],  
  "recommended\_action": "string"  
}

The system should reject malformed responses before they reach application logic.

---

# **31\. GROQ AI ENDPOINTS**

## **Natural Language Query**

POST /api/v1/ai/query

Request:

{  
  "query": "Show parcels with pending tax."  
}

---

## **Parcel Explanation**

POST /api/v1/ai/parcels/:parcelId/explain

---

## **Governance Alert Explanation**

POST /api/v1/ai/alerts/:alertId/explain

---

# **32\. AI SECURITY RULES**

The AI service must not:

* Modify ownership.  
* Approve legal transactions.  
* Change government records.  
* Execute unrestricted SQL.  
* Make autonomous legal decisions.

The AI service may:

* Explain.  
* Summarize.  
* Classify.  
* Extract.  
* Generate structured query intent.  
* Recommend officer review.

---

# **33\. CHANGE DETECTION SERVICE**

## **API**

POST /api/v1/change-detection/analyze

Input:

Before Image  
After Image

Pipeline:

IMAGE T1  
   │  
   ▼  
IMAGE PREPROCESSING  
   │  
   ▼  
IMAGE T2  
   │  
   ▼  
CHANGE ANALYSIS  
   │  
   ▼  
CHANGE REGION  
   │  
   ▼  
SPATIAL INTERSECTION  
   │  
   ▼  
AFFECTED PARCEL  
   │  
   ▼  
GOVERNANCE ALERT

---

# **34\. AI / CHANGE DETECTION DATABASE**

governance\_alerts

| Field | Type |
| ----- | ----- |
| id | UUID |
| parcel\_id | UUID |
| alert\_type | VARCHAR |
| severity | VARCHAR |
| source | VARCHAR |
| status | VARCHAR |
| explanation | TEXT |
| created\_at | TIMESTAMP |

---

# **35\. MOCK DATA REQUIREMENTS**

The prototype should create approximately:

## **Parcel Data**

100–500 mock parcels

Each parcel should contain:

* Geometry.  
* Local identifier.  
* State.  
* District.  
* Area.

---

## **Ownership Data**

At least:

100 ownership records

---

## **Registration Data**

At least:

100 registration records

---

## **Planning Data**

Include:

* Residential.  
* Commercial.  
* Agricultural.  
* Mixed-use.

---

## **Restriction Data**

Include sample zones such as:

* Environmental restriction.  
* Protected area.  
* Flood-prone area.

---

# **36\. MOCK DATA RELATIONSHIP**

PARCEL  
   │  
   ├── LAND RECORD  
   │  
   ├── REGISTRATION  
   │  
   ├── PLANNING  
   │  
   ├── TAX  
   │  
   └── RESTRICTIONS

Each dataset must be capable of being queried independently.

---

# **37\. AUTHENTICATION FLOW**

USER LOGIN  
    │  
    ▼  
AUTH API  
    │  
    ▼  
PASSWORD VALIDATION  
    │  
    ▼  
JWT GENERATED  
    │  
    ▼  
ROLE EXTRACTED  
    │  
    ▼  
ACCESS CONTROL

---

# **38\. ROLE-BASED ACCESS CONTROL**

## **Citizen**

Access:

Parcel Search  
Public Parcel Information  
Service Requests  
Workflow Status

---

## **Officer**

Access:

Assigned Workflows  
Department Data  
Review Actions  
Governance Alerts

---

## **Admin**

Access:

User Management  
Role Management  
Integration Monitoring  
System Configuration

---

# **39\. SECURITY REQUIREMENTS**

The prototype should implement:

* JWT authentication.  
* Role-Based Access Control.  
* Password hashing.  
* Input validation.  
* API validation.  
* Rate limiting.  
* Audit logging.  
* Environment-based secrets.  
* HTTPS in deployment.

Sensitive API keys must be stored as:

Environment Variables

Example:

DATABASE\_URL  
JWT\_SECRET  
GROQ\_API\_KEY

---

# **40\. API DOCUMENTATION**

Swagger should be integrated.

Recommended endpoint:

/api/docs

Every API should include:

* Request schema.  
* Response schema.  
* Authentication requirement.  
* Role requirement.  
* Error responses.

---

# **41\. ERROR RESPONSE FORMAT**

All APIs should return a consistent error structure.

{  
  "success": false,  
  "error": {  
    "code": "PARCEL\_NOT\_FOUND",  
    "message": "The requested parcel does not exist."  
  }  
}

---

# **42\. SUCCESS RESPONSE FORMAT**

{  
  "success": true,  
  "data": {}  
}

---

# **43\. DEPLOYMENT ARCHITECTURE**

For the MVP:

DOCKER COMPOSE  
      │  
      ├── Frontend Container  
      │  
      ├── Backend Container  
      │  
      ├── PostgreSQL \+ PostGIS  
      │  
      ├── Mock Department APIs  
      │  
      └── Python AI / CV Service

---

# **44\. RECOMMENDED DOCKER SERVICES**

services:

  frontend

  backend

  database

  land-records-api

  registration-api

  planning-api

  tax-api

  ai-service

---

# **45\. DEVELOPMENT ENVIRONMENT**

Recommended:

Node.js 22+  
TypeScript  
Python 3.11+  
PostgreSQL 16+  
PostGIS 3+  
Docker  
GitHub

---

# **46\. DEVELOPMENT PHASES**

## **PHASE 1**

### **GIS Foundation**

Build:

* PostgreSQL.  
* PostGIS.  
* Parcel table.  
* GeoJSON import.  
* Interactive map.

---

## **PHASE 2**

### **Parcel Core**

Build:

* Parcel search.  
* Parcel identifiers.  
* Parcel API.  
* Parcel 360 base structure.

---

## **PHASE 3**

### **Mock State Schemas**

Build:

* State A schema.  
* State B schema.  
* Different identifiers.  
* Different measurement units.

---

## **PHASE 4**

### **Mock Department APIs**

Build independent APIs.

---

## **PHASE 5**

### **Interoperability**

Build:

* State Adapter.  
* Identifier resolver.  
* Canonical transformer.  
* Response aggregator.

---

## **PHASE 6**

### **Citizen Portal**

Build:

* Search.  
* Map.  
* Parcel 360\.  
* Service request.

---

## **PHASE 7**

### **Officer Portal**

Build:

* Workflow dashboard.  
* Verification interface.  
* Governance alerts.

---

## **PHASE 8**

### **Groq AI Integration**

Build:

* Natural language query.  
* Parcel summary.  
* Alert explanation.

---

## **PHASE 9**

### **Change Detection**

Build:

* Sample imagery comparison.  
* Change region.  
* Parcel intersection.  
* Alert generation.

---

## **PHASE 10**

### **Security and Audit**

Implement:

* Authentication.  
* RBAC.  
* Audit logging.  
* API security.

---

# **47\. RECOMMENDED MVP PRIORITY**

The implementation priority should be:

1\. GIS MAP  
      │  
      ▼  
2\. PARCEL SEARCH  
      │  
      ▼  
3\. PARCEL 360°  
      │  
      ▼  
4\. MOCK DEPARTMENT APIs  
      │  
      ▼  
5\. STATE ADAPTER  
      │  
      ▼  
6\. CANONICAL MODEL  
      │  
      ▼  
7\. SIMULATED WORKFLOW  
      │  
      ▼  
8\. RBAC  
      │  
      ▼  
9\. AUDIT LOG  
      │  
      ▼  
10\. GROQ AI  
      │  
      ▼  
11\. CHANGE DETECTION

Do not reverse this order.

A project with a beautiful AI chatbot and no functioning parcel interoperability layer is not an intelligent land governance platform. It is a chatbot standing next to a map, which is apparently a business model now.

---

# **48\. FINAL RECOMMENDED STACK**

## **Frontend**

React  
TypeScript  
Vite  
Tailwind CSS  
shadcn/ui  
Zustand  
TanStack Query  
MapLibre GL JS

## **Backend**

Node.js  
TypeScript  
NestJS  
REST API  
Swagger  
JWT  
Zod / class-validator

## **Database**

PostgreSQL  
PostGIS  
JSONB

## **Mock Integrations**

Independent NestJS / Express APIs

## **AI**

Groq API  
Structured JSON Responses  
Zod Validation  
Backend-only API Integration

## **Computer Vision**

Python  
FastAPI  
OpenCV  
GeoPandas  
Rasterio

## **Deployment**

Docker  
Docker Compose  
Cloud Deployment

---

# **49\. FINAL TECHNICAL BUILD FLOW**

MOCK STATE DATA  
      │  
      ▼  
MOCK DEPARTMENT DATABASES  
      │  
      ▼  
DEPARTMENT APIs  
      │  
      ▼  
BHOOMISETU INTEROPERABILITY ENGINE  
      │  
      ▼  
STATE / SCHEMA ADAPTER  
      │  
      ▼  
IDENTIFIER RESOLUTION  
      │  
      ▼  
CANONICAL PARCEL MODEL  
      │  
      ▼  
POSTGRESQL \+ POSTGIS  
      │  
      ▼  
BHOOMISETU BACKEND  
      │  
 ┌────┼─────┬──────────────┐  
 ▼    ▼     ▼              ▼

GIS  WORKFLOW AI          AUDIT  
 │     │     │              │  
 ▼     ▼     ▼              ▼

PARCEL OFFICER GROQ      HISTORY  
MAP    SYSTEM  AI  
 │  
 ▼  
FRONTEND  
 │  
 ┌───────┼─────────┐  
 ▼       ▼         ▼

CITIZEN OFFICER     ADMIN

---

# **50\. FINAL TECHNICAL PRINCIPLE**

BhoomiSetu should be built as:

> **A deterministic land governance platform with AI assistance, not an AI platform pretending to govern land.**

The authoritative layers are:

GIS DATA  
DATABASE  
DEPARTMENT APIs  
WORKFLOW ENGINE  
RBAC  
AUDIT LOG

The AI layer is supplementary:

EXPLAIN  
SUMMARIZE  
CLASSIFY  
EXTRACT  
GENERATE STRUCTURED INTENT  
RECOMMEND REVIEW

This separation makes the architecture technically credible, safer, easier to demonstrate, and significantly more feasible for a functional prototype.

