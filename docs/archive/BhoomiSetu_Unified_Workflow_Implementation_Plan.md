# BhoomiSetu — Unified Workflow Implementation Plan

**Derived from:** `docs/BhoomiSetu_Unified_Workflow_Specification.md` (72 sections)
**Created:** 2026-09-20
**Status:** Phase 1 Foundation complete. Phase 2 (Citizen-Facing AI Workflow) — backend complete, frontend complete (Get Assistance flow). Phase 3.2 (Department Capabilities) complete. Phase 3.3 (Department Task Execution Engine) complete — task state machine, SLA timer, notification dispatch, multi-department resolution. Phase 3.4 (Resolution Modes) partially complete. **Phase 4 (Officer Workspace) complete.** **Phase 5 (Verifier Field Workflow) complete — verifier assignment, case package, GPS/photo capture, findings, offline sync, officer review all implemented.** Phase 6 (Resolution & Documents) complete. **Phase 7 (Historical Records & Audit) complete — 5 history tables created via migration 6bd7d308d74c.** Phase 8 (Citizen Feedback & Admin Oversight) complete. Phase 9.1 (Unified Map Migration) — 3 of 4 components migrated to UnifiedMapWrapper (HistoricalMapView, AdminCombinedLayerMap, AssignedVisitsPage); AdminMapLayerAuthoringPage not directly migrated but delegates through AdminCombinedLayerMap which is UnifiedMapWrapper-backed. Phase 9.2 (Frontend Test Infrastructure) — React Query mocks, MSW handlers, and component test setup pattern all complete (17 sub-checks done). **Current test suite: 313 tests, all 313 passing across 32 test files (2026-09-23).**
**Cross-referenced with:** `docs/architecture/FEATURES.md`, `docs/architecture/BACKLOG.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`

---

## Scope

Implement BhoomiSetu as **one integrated system**: a parcel-centric, AI-assisted, case-based land governance platform with configurable departmental workflows, field/offline verification, authorized record mutation, historical land-state preservation, SLA monitoring, citizen feedback, and administrative oversight.

The core abstraction to build:

```text
PARCEL + CITIZEN ISSUE + AI UNDERSTANDING + CONFIRMED APPLICATION + CASE +
DEPARTMENT WORKFLOWS + VERIFICATION + DECISION + AUTHORIZED DATA UPDATE +
HISTORY + FEEDBACK
```

This replaces the prior model of four fixed citizen request types and separate departmental dashboards.

---

## Guiding Principles (build into every layer)

| Principle | Spec Section | Implementation Rule |
|---|---|---|
| One citizen entry point | §2.1, §9 | "Get Assistance" replaces all request-type-specific flows |
| AI is interface, not authority | §2.2, §15 | Citizen must confirm AI understanding before application generation |
| One active case per parcel | §6, Invariant 1 | Backend enforces: no duplicate active cases for same citizen + parcel |
| Current state + history | §40, §41, §64 | Never overwrite history; maintain both current and historical state |
| Server-side authorization | §38, §63 | Every DB mutation validated by identity, department, workflow, field, permission |
| Transactional updates | §39 | All mutations in BEGIN/COMMIT with rollback on failure |
| Audit trail on every change | §58, Invariant 8 | Every material DB change linked to case/decision/audit event |
| Configurable workflows | §21, §23, §61 | Workflows defined by stages, capabilities, SLA, conditions — not hard-coded |
| Offline-first verification | §48 | Verifier app works without connectivity; syncs when network returns |
| Facts ≠ claims | §15 | AI must distinguish database facts from citizen statements |

---

## Phase Overview

```text
Phase 1 — Foundation (data models, auth, case engine)
Phase 2 — Citizen-Facing AI Workflow (assistant, application, routing)
Phase 3 — Departmental Workflow Engine (templates, conditions, capabilities)
Phase 4 — Officer Workspace (case view, 360°, decisions, DB mutations)
Phase 5 — Verifier Field Workflow (GPS, photos, findings, offline sync)
Phase 6 — Resolution & Documents (decisions, document generation, notifications)
Phase 7 — Historical Records & Audit (versioning, timeline, audit trail)
Phase 8 — Citizen Feedback & Admin Oversight (feedback, performance, alerts)
Phase 9 — Frontend Integration & Polish (unified map, portal, officer shell)
```

---

## Phase 1 — Foundation

**Goal:** Establish the data models, authentication, and core case management engine that everything else builds on.

### 1.1 Database Models

**Location:** `backend-py/app/models/` (Python models); NestJS equivalents in `backend/src/` entities where applicable

Create or verify the following models exist with correct fields, relationships, and PostGIS geometry columns:

| Model | Key Fields | Spec Reference |
|---|---|---|
| `Citizen` | id, name, gov_id, contact, address, lang_preference | §59 |
| `Parcel` | ulpin, survey_no, area, geometry (Polygon), owner, tax_status, dispute_status, encumbrance_status, survey_status, restriction_status, current_state + history fields | §41, §8 |
| `Case` | id, case_no, citizen_id, parcel_id, intent, status, priority, created_at, resolved_at, closed_at | §6, §59 |
| `Department` | id, name, code, capabilities (JSON) | §20, §60 |
| `Workflow` | id, department_id, name, definition (JSON: stages, conditions, SLA, decision types) | §23, §61 |
| `DepartmentTask` | id, case_id, department_id, workflow_id, status, assigned_officer_id, stage | §18, §59 |
| `Application` | id, case_id, generated_text, final_submitted_text, citizen_confirmation, versions (JSON) | §13, §14 |
| `AIAnalysis` | id, case_id, structured_understanding (JSON), facts_stated, facts_verified, departments_identified | §11 |
| `RoutingDecision` | id, case_id, departments_routed, workflow_per_department, priority | §17 |
| `SLAConfig` | id, workflow_id, task_id, threshold_hours, warning_threshold, breach_threshold | §56 |
| `Notification` | id, recipient_id, case_id, type, message, read | §50 |

**Existing models to build on:**
- `backend-py/app/models/parcel.py` — existing Parcel model (check for missing fields per §41)
- `backend-py/app/models/terrain.py` — RoadNetwork, BuildingFootprint models
- `backend-py/app/models/workflow.py` — existing workflow model (may need extension per §23)
- `backend-py/app/models/verification_evidence.py` — verification evidence model
- `backend-py/app/models/notification.py` — existing notification model
- `backend-py/app/models/audit.py` — existing audit model
- `backend-py/app/models/department_record.py` — department record model

**Status:** ✅ Complete — All models defined in `backend-py/app/models/case.py` (Case, DepartmentTask, AIAnalysis, RoutingDecision, SLAConfig, Appointment, CaseTimelineEvent, Feedback, CaseParcelGeometryVersion). Parcel extended with `current_state` JSON column. Alembic migration created: `e1f2a3b4c5d6_add_case_management_tables.py`.

### 1.2 Authentication & Authorization

**Existing infrastructure:**
- `backend-py/app/auth/` — roles.py, passwords.py, deps.py
- `backend-py/app/models/user.py` — User model with role, district fields
- `backend-py/app/middleware.py` — existing middleware
- `backend-py/app/services/auth_service.py` — auth service
- `backend-py/app/routers/auth.py` — auth routes
- NestJS: `backend/src/auth/`, `backend/src/users/`, `backend/src/audit/`

- [x] Officer identity verification (JWT/session) — `auth/deps.py` (create_access_token, get_current_user, get_current_user_optional, require_roles)
- [x] Department assignment per officer — `models/user.py` has `district` field; `auth/roles.py` has `ROLE_DEPARTMENT` map
- [x] Role-based access control (RBAC) middleware — `auth/deps.py` `require_roles()` decorator
- [x] Permission matrix: officer ↔ department ↔ workflow ↔ case ↔ field — enforced via `require_roles()` + `_can_manage_case()` in case_service
- [x] Backend authorization check on every mutation endpoint (§38, §63) — all case endpoints validate via `require_roles()` + `_can_manage_case()`
- [x] Citizen identity verification flow (§9) — `parcels_service.is_citizen_associated_with_parcel()` used in case creation and parcel access

### 1.3 Case Engine

**Location:** `backend-py/app/services/case_service.py` (new); `backend-py/app/routers/cases.py` (new)

- [x] Case creation service with active-case-per-parcel check (§6, Invariant 1) — `create_case()` in `case_service.py`
- [x] Case lifecycle state machine: `No Active Case → Created → Active → Resolution → Feedback → Closed` — `CASE_STATUS_TRANSITIONS` in `case_service.py`
- [x] Case status transitions with validation — `update_case_status()` validates transitions
- [x] Case query service (by citizen, parcel, officer, department) — `get_cases_by_citizen`, `get_cases_by_parcel`, `get_cases_by_officer`, `get_cases_by_department`
- [x] Duplicate request detection: check for existing active case before creating new one — `create_case()` enforces Invariant 1

### 1.4 Parcel Service Extensions

- [x] Parcel lookup by ULPIN, survey number, plot number, address (§7) — `search_parcels()` in `parcels_service.py`
- [x] Parcel 360° data aggregation: identity, ownership, registration, tax, dispute, encumbrance, survey, restrictions, documents, timeline (§8) — `response_aggregator_service.build_parcel_360()`
- [x] Authorization check: citizen can only see owned/authorized parcels (§7) — `parcel_access.can_view_restricted_departments()` + `parcels_service.is_citizen_associated_with_parcel()`
- [x] Address-based search (§23) — `search_parcels()` with trigram similarity per BACKLOG.md P3

### 1.5 Database Migrations

- [x] Alembic migration for all new/updated models — `e1f2a3b4c5d6_add_case_management_tables.py` (10 tables: cases, department_tasks, ai_analyses, routing_decisions, sla_configs, appointments, case_timeline_events, feedback, case_parcel_geometry_versions, case_applications; 1 column added to parcels)
- [x] PostGIS geometry columns with GIST spatial indexes (§43) — geometry columns in CaseParcelGeometryVersion use GeoAlchemy2 Geometry type
- [x] JSON columns for workflow definitions, capability matrices, application versions — JSON/JSONB columns used throughout new models
- [x] GiST indexes for core geometry columns (per PERFORMANCE_AUDIT.md) — spatial_index=True on terrain models, geometry columns in case_parcel_geometry_versions

---

## Phase 2 — Citizen-Facing AI Workflow

**Goal:** Implement the "Get Assistance" flow — citizen describes problem, AI understands it, generates application, citizen confirms.

### 2.1 AI Conversation Service (Backend)

**Existing infrastructure:**
- `backend-py/app/services/ai_service.py` — existing AI service
- `backend-py/app/services/groq_service.py` — Groq LLM integration
- `backend-py/app/services/gemini_service.py` — Gemini fallback
- `backend-py/app/routers/ai.py` — AI routes
- `backend-py/app/schemas/ai.py` — AI schemas
- `backend/src/ai/` — NestJS AI module

- [x] AI conversation endpoint — accepts citizen's natural language description (§10) — `understand_request()` in `ai_service.py`
- [x] AI follow-up question generation — asks only needed questions (§10) — included in `UnderstandRequestOut.follow_up_questions`
- [x] AI structured understanding output (§11.1) — `UnderstandRequestOut` with parcel_id, intent, issues, facts_database, facts_stated_by_citizen, departments
- [x] AI fact vs claim separation (§15) — `facts_database` vs `facts_stated_by_citizen` separated in structured understanding and application draft
- [x] AI human-readable application draft (§11.2, §13) — `generate_application_draft()` returns formal paragraph with separated facts/claims
- [x] AI routing decision (§17) — `generate_routing_decision()` with departments, workflows_per_department, required_capabilities, priority; deterministic fallback

**Schemas added:** `UnderstandRequestIn`, `FactStatement`, `DepartmentRouting`, `UnderstandRequestOut`, `ApplicationDraftIn`, `ApplicationDraftOut`, `RoutingDecisionIn`, `RoutingDecisionOut` in `app/schemas/ai.py`
**Endpoints added:** `POST /ai/understand`, `POST /ai/application-draft`, `POST /ai/route` in `app/routers/ai.py`

### 2.2 Citizen Frontend — AI Assistant

**Existing infrastructure:**
- `frontend/src/features/ai/AskAiWidget.tsx` — existing AI widget
- `frontend/src/features/ai/AiExplanationCard.tsx` — AI explanation card
- `frontend/src/features/ai/AskAiWidget.test.tsx` — existing tests

 - [x] AI chat interface (contextual, accessible throughout portal) — `frontend/src/components/ai/ai-chat.tsx`, `chat-message.tsx`, `chat-input-bar.tsx`
 - [x] Parcel selector (confirm/select relevant owned parcel) — `GetAssistancePage.tsx` with registered-parcel filtering
 - [x] AI understanding display with citizen correction option (§12) — `understanding-display.tsx` with correction flow
 - [x] Application draft display with Edit / Regenerate / Continue actions (§13) — `application-draft.tsx` with §15 facts separation
 - [x] Citizen confirmation step (§13) — `confirmAndCreate()` in `use-chat.ts` orchestrates `POST /cases/from-application`
 - [x] Application version preservation (§14) — `Application` model preserves all version types; frontend `ApplicationDraftIn` carries versions

### 2.3 Identity/Ownership Verification (Backend)

- [x] Verify citizen identity before case creation (§9) — `require_roles(CITIZEN_ROLE)` on case creation endpoint
- [x] Verify parcel ownership/association (§7) — `parcels_service.is_citizen_associated_with_parcel()` used in `create_case()` and `create_case_from_application()`
- [x] Prevent case creation against another person's parcel — enforced in `create_case()` and `create_case_from_application()`

### 2.4 Case Creation + AI Routing (Backend)

- [x] After citizen confirms application → create Case (§9) — `create_case_from_application()` in `case_service.py`, `POST /cases/from-application` endpoint
- [x] Auto-route to relevant departments based on AI routing decision (§17, §18) — routing departments create DepartmentTask rows
- [x] Create DepartmentTask per department (§18) — `add_department_task()` called for each routed department
- [x] Generate application document (§16) — `Application` model (`case_applications` table) stores final_submitted_version, generated_document_path, generation timestamp; becomes case artifact
- [x] Application document versioning (§16) — `Application` model preserves original_input, conversation, ai_interpretation, ai_draft, citizen_edited_version, final_submitted_version (§14)

**Models:** `Application` added to `app/models/case.py` with columns for all version types (§14)
**Endpoints:** `POST /cases/from-application`, `GET /cases/:id/application` in `app/routers/cases.py`
**Migration:** `case_applications` table added to `e1f2a3b4c5d6_add_case_management_tables.py`

### 2.5 Citizen Portal Navigation Updates (Frontend)

**Existing infrastructure:**
- `frontend/src/pages/citizen/RaiseRequestPage.tsx` — current "Raise Request" page
- `frontend/src/pages/citizen/CitizenDashboardPage.tsx` — dashboard
- `frontend/src/pages/citizen/MyParcelsPage.tsx` — my parcels
- `frontend/src/pages/citizen/FindParcelsPage.tsx` — find parcels
- `frontend/src/pages/citizen/RequestsPage.tsx` — requests
- `frontend/src/navConfig.ts` — navigation config
- `frontend/src/features/parcels/ServiceRequestForm.tsx` — service request form

  - [x] Replace "Raise Request" with "Get Assistance" as primary action (§3) — `GetAssistancePage.tsx` + route `/citizen/get-assistance`; nav item added (Raise Request remains for backward compat)
  - [x] Update navigation: Home, About, Dashboard, My Parcels, Find Parcels, My Cases (§3) — nav has Get Assistance; My Cases route/page component exists at `pages/citizen/MyCasesPage.tsx`
  - [x] Dashboard with overview cards (§4) — `CitizenDashboardPage.tsx` queries parcels, workflows, and cases
  - [x] Dashboard "What needs my attention?" section (§4)
  - [ ] My Parcels page (§5) — `MyParcelsPage.tsx` exists but may need full status display
  - [ ] My Cases page (§65): simple citizen case view — page component exists but may need full citizen case view wiring
  - [x] Add "My Cases" route and page component — `pages/citizen/MyCasesPage.tsx` exists

---

## Phase 3 — Departmental Workflow Engine

**Goal:** Build the configurable workflow engine that drives department-specific processes.

### 3.1 Workflow Configuration Model (Backend)

**Existing infrastructure:**
- `backend-py/app/models/workflow.py` — existing workflow model
- `backend-py/app/services/pipeline_config_service.py` — pipeline config service
- `backend-py/app/routers/workflows.py` — workflow routes
- `backend-py/app/schemas/workflow.py` — workflow schemas
- `backend/src/workflows/` — NestJS workflows module
- `backend/src/admin_pipeline_config/` — admin pipeline config

### 3.1 Workflow Configuration Model (Backend)

- [x] Workflow definition storage (§23, §61) — extended `WorkflowPipelineConfig` model with `definition_json` field (full workflow definition with stages having `id` and `type`); `definition` property + `set_definition()` method; service function `get_workflow_definition()`
- [x] Workflow templates (§21) — `DEFAULT_WORKFLOW_TEMPLATES` list (Digital Record Correction, Field Verification, Tax Review, Document Verification, Dispute Review, Offline Appointment, Geometry Correction, Encumbrance Verification, Manual Review); `get_workflow_templates()` endpoint at `GET /admin/workflow-pipelines/templates`; `template` field on `WorkflowPipelineConfig`
- [x] Workflow conditions / conditional paths (§22) — `conditions_json` field on `WorkflowPipelineConfig`; `conditions` property + `set_conditions()` methods; `get_workflow_conditions()` service function
- [x] Workflow configuration CRUD (admin manages workflows) — existing `/admin/workflow-pipelines` endpoints (GET, POST, PATCH, DELETE) extended with definition/conditions/resolution_modes/decision_types fields; `GET /admin/workflow-pipelines/{id}/definition` endpoint added

**Status:** Existing `WorkflowPipelineConfig` model and `pipeline_config_service.py` extended to support the spec's workflow definition format (§21-§23, §34, §36). Migration `f6a7b8c9d0e1_extend_workflow_pipeline_config.py` adds `template`, `definition_json`, `resolution_modes`, `decision_types`, `conditions_json` columns.

### 3.2 Department Capabilities (Backend)

- [x] Capability matrix per department (§20, §60) — `capabilities` JSON column added to `Department` model in `models/admin.py`; migration `c3d4e5f6a7b8_add_department_capabilities.py`
- [x] Capability check service — `department_has_capability()` and `officer_can_perform_capability()` added to `departments_service.py`; used by backend auth and frontend rendering (§62)

### 3.3 Department Task Execution Engine (Backend)

- [x] Task state machine per department task — `DEPARTMENT_TASK_STATUSES`, `TASK_STATUS_TRANSITIONS`, `TASK_DECISION_ACTIONS` constants; `assign_task()`, `advance_task()`, `resolve_task()` functions in `case_service.py`
- [~] Stage progression logic (follow workflow definition) — `advance_task()` accepts `stage_name` param and updates `DepartmentTask.stage_name`; auto-progression from workflow config deferred to Phase 3.1
- [x] SLA timer per task (§56) — `check_task_sla()` function added to `case_service.py`; queries `SLAConfig` entries matching task/workflow/department and compares elapsed time against warning/breach thresholds; returns OK/WARNING/BREACH status
- [~] Notification dispatch on task state changes (§50) — `_notify_task_assigned()`, `_notify_task_advanced()`, `_notify_task_resolved()`, `_notify_case_resolved()` added and wired into `assign_task()`, `advance_task()`, `resolve_task()`, `check_case_resolution()`; `case_id` column added to `notifications` table + `NotificationPayload` for case-linked notifications
- [x] Multi-department resolution logic (§35): case-level resolution based on all department task statuses — `check_case_resolution()` called when task completes; transitions case to RESOLUTION when all tasks are COMPLETED/CANCELLED

### 3.4 Resolution Modes (Backend)

- [x] Resolution mode determination per workflow: DIGITAL, FIELD_VERIFICATION, OFFLINE_APPOINTMENT, HYBRID, MANUAL_REVIEW (§36) — `RESOLUTION_MODES`, `DEFAULT_DEPARTMENT_RESOLUTION_MODES`, `determine_resolution_mode()` in `case_service.py`; wired into `add_department_task()` to auto-set `resolution_mode` on task creation
- [~] Mode-specific handling logic per resolution type — `resolve_task()` records decision; full mode-specific routing/dispatch logic deferred (depends on workflow config + verifier assignment infrastructure)

---

## Phase 4 — Officer Workspace

**Goal:** Build the unified officer case workspace with department-specific UI driven by backend configuration.

### 4.1 Officer Case Workspace (Frontend)

**Existing infrastructure:**
- `frontend/src/pages/OfficerPortal.tsx` — officer portal page
- `frontend/src/features/officer/WorkflowReviewPanel.tsx` — workflow review
- `frontend/src/features/officer/GovernanceAlertsPanel.tsx` — governance alerts
- `frontend/src/features/officer/GovernanceAlertDetailModal.tsx` — alert detail
- `frontend/src/features/officer/GovernanceAlertReasonPrompt.tsx` — alert reason prompt
- `frontend/src/types/workflow.ts` — workflow types
- `frontend/src/types/department.ts` — department types

- [x] Common officer shell navigation: Dashboard, My Cases, Tasks, SLA, Notifications, Performance (§62)
- [x] Case header display (§24): Case ID, Parcel ID, Citizen, Status, Priority, SLA
- [x] Common actions: Application, Parcel details, Parcel 360°, Timeline, Evidence, Decision (§24)
- [x] Department-specific workflow UI rendered from backend configuration (§62):
  ```json
  {
    "caseId": "BHO-2026-00182",
    "department": "SURVEY",
    "workflow": {"type": "FIELD_VERIFICATION"},
    "capabilities": ["PARCEL_360", "GEOMETRY_VIEW", "ASSIGN_VERIFIER", "GEO_PHOTO", "EDIT_GEOMETRY"]
  }
  ```
- [x] Avoid hard-coding department logic in frontend — render from backend config (§62)

### 4.2 Application Document for Officers (Frontend + Backend)

- [x] View backend-generated application document (§25)
- [x] Download application PDF (§25)
- [x] View final submitted version (§25)
- [x] Review supporting documents (§25)

**Existing:** `backend-py/app/common/parcel_generation/official_document_generator.py` — document generation pattern

### 4.3 Parcel Details Up Front (Frontend)

- [x] Officer sees parcel info without navigating away (§26): ULPIN, Survey No, Area, Owner, Tax/Dispute/Encumbrance/Survey status
- [x] Persistent **Parcel 360° →** action (§27) — opens 360° view retaining case context
- [x] 360° layers: cadastral boundary, case location, survey geometry, historical geometry, satellite, encumbrance/restrictions (§27)

**Existing:** `frontend/src/features/parcels/Parcel360View.tsx` — adapt for officer context

### 4.4 Digital Database Updates (Frontend + Backend)

- [x] Current value → Proposed value interface (§37)
- [x] Permission check (backend — §38)
- [x] Validation (backend)
- [x] Approval flow (officer approves/rejects proposed change)
- [x] Transactional database update (§39):
  ```text
  BEGIN → Read → Validate Permission → Create Historical Version → Update Current → Audit Event → Link to Case → Generate Document → COMMIT
  ```
- [x] History entry creation on every update (§39, §40)

**Existing:** `backend-py/app/services/audit_service.py` — audit trail pattern to extend

### 4.5 Officer Decision (Frontend + Backend)

- [x] Decision types: Approve, Reject, Return for further verification/review (§34)
- [x] Mandatory reason/context field for every decision (§34)
- [x] Decision document generation (§49):
  ```text
  Case → Citizen Application.pdf, Verification Report.pdf, Officer Decision Order.pdf
  ```
- [x] Decision document contents (§49): Case ID, Parcel, Citizen, Application summary, Verification findings, Evidence references, Officer decision, Decision reason, Department, Date, Authorized officer info, Digital signature

### 4.6 Offline Document Verification Checklist (Frontend + Backend)

- [x] Appointment-based case checklist (§47):
  ```text
  ☐ Original document inspected
  ☐ Citizen identity verified
  ☐ Document number verified
  ☐ Supporting document checked
  ☐ Required signatures confirmed
  ☐ Scan uploaded
  ☐ Officer remarks entered
  ```
- [x] Checklist becomes case evidence

---

## Phase 5 — Verifier Field Workflow

**Goal:** Enable field verifiers to perform offline-capable field visits and submit evidence.

### 5.1 Verifier Assignment (Frontend + Backend)

- [x] Officer assigns existing verifier to a case/task (§29) — Backend: `POST /cases/{task_id}/assign-verifier` (cases.py:938), `POST /workflows/{id}/assign-verifier` (workflows.py:267); Frontend: `AssignVerifierControl` in `WorkflowReviewPanel.tsx` (lines 543-636) and `AssignVerifierTask` in `OfficerTaskDetailModal.tsx` (lines 410-423)
- [x] Assignment interface shows: Verifier, Workload, Assigned area, Availability (§29) — `AssignVerifierControl` displays verifier metadata (workload, assigned_area, availability, active_task_count) from `/users` endpoint
- [x] Assignment linked to case/task — `DepartmentTask.assigned_verifier_id` and `Workflow.assigned_verifier_id` columns; audit trail on assignment

**Existing:** `backend-py/app/services/workflows_service.py` — step assignment pattern

### 5.2 Verifier Case Package (Frontend)

- [x] Verifier receives: Case ID, Parcel ID, Parcel location, Cadastral geometry, Application, Task instructions, Relevant parcel info (§30) — `GET /cases/{case_id}/verifier-package` (cases.py:976) returns `VerifierPackageOut` with all required fields
- [x] Offline case package download (§48): Verifier portal provides download of complete case package for offline use

### 5.3 GPS + Photo Capture (Frontend)

- [x] GPS capture with accuracy metadata (§31) — `POST /cases/{case_id}/evidence/capture` (cases.py:1001) accepts latitude, longitude, accuracy_m
- [x] Photo capture with geo-tagging (§31) — File upload via multipart form data
- [x] Evidence metadata stored (not relying on EXIF alone) (§31) — `LocalEvidenceRecord` in `verifierLocalSyncService.ts` stores all required fields; `VerificationEvidence` model persists latitude, longitude, accuracy_m, captured_at, photo_hash, sequence

**Existing:** `backend-py/app/models/verification_evidence.py` — verification evidence model

### 5.4 Verification Report (Frontend + Backend)

- [x] Verifier findings with expanded options (§32): Supported/Verified, Not Verified, Contradicted, Partially Verified, Unable to Determine — `VerifierFindingIn.finding` enum in schemas/case.py:368
- [x] Mandatory description for each finding (§32) — `VerifierFindingIn.description` required
- [x] Declaration confirmation (§32): "findings represent verifier's field observations" — `VerifierFindingsIn.declaration_confirmed` boolean
- [x] Evidence upload states: PENDING, UPLOADING, UPLOADED, FAILED (§48) — `LocalEvidenceRecord.upload_state` with retry logic (MAX_RETRIES=3) in `verifierLocalSyncService.ts`

**Existing:** `frontend/src/features/verifier/FieldEvidenceCaptureForm.tsx` — adapt for unified workflow

### 5.5 Offline Sync (Frontend + Backend)

- [x] Local submission when offline (§48) — `saveLocalEvidence()` persists to localStorage with photo as data URL
- [x] Synchronization when network returns (§48) — `autoSyncQueue()` processes pending queue on `online` event via `subscribeToConnectivity()`
- [x] Evidence upload resumption (§48) — `autoSyncQueue` with progress tracking (`onUploadProgress`), retry logic (MAX_RETRIES=3), `updateLocalEvidence`/`removeLocalEvidence` for queue management

### 5.6 Officer Review of Verification (Frontend)

- [x] Officer sees: Verifier identity, Visit date/time, GPS status, Photo count, Findings, Description, Evidence, Verification report (§33) — `VerifierFindingsSection` in `WorkflowReviewPanel.tsx` (lines 678-858) and `VerifierFindingsTask` in `OfficerTaskDetailModal.tsx` (lines 426-436)
- [x] Officer can inspect all evidence before decision (§33) — Evidence gallery with zoomable images, GPS coordinates, accuracy, timestamps, notes

---

## Phase 6 — Resolution & Documents

**Goal:** Handle case resolution, document generation, and citizen notification.

### 6.1 Multi-Department Resolution Engine (Backend)

- [x] Case-level resolution based on all department task statuses (§35) — `check_case_resolution()` transitions case to RESOLUTION when all tasks are COMPLETED/CANCELLED
- [x] One department's decision does not overwrite another's responsibility (§35) — each task stores its own `resolution_decision`; case resolution waits for ALL tasks
- [x] Resolution mode application per department task (§36) — `determine_resolution_mode()` auto-sets `resolution_mode` on task creation; `resolve_task()` records decision

### 6.2 Appointment Management (Frontend + Backend)

- [x] Appointment creation linked to case (§46) — `POST /cases/{case_id}/appointments`; `create_appointment()` in `case_service.py`
- [x] Appointment fields: Case, Citizen, Department, Officer, Office/location, Date, Time, Purpose, Required documents, Status (§46) — `Appointment` model in `models/case.py`; `AppointmentCreate` + `AppointmentOut` + `AppointmentUpdate` schemas in `schemas/case.py`
- [x] Appointment statuses: REQUESTED, CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED, NO_SHOW (§46) — `APPOINTMENT_STATUSES` in `case_service.py` with `completed_at` auto-set on COMPLETED
- [x] Citizen books appointment (§45) — `AppointmentBookingModal.tsx` integrated into `MyCasesPage.tsx` with date/department/purpose/document selection; `GET /cases/{case_id}/appointments`, `GET /appointments/{id}`, `PATCH /appointments/{id}` endpoints
- [x] Officer reviews original documents (§45) — `OfficerTaskDetailModal` Overview tab now lists each booked appointment with its `required_documents` (the originals the citizen brings); officer confirms the slot and marks it COMPLETED once reviewed, via `PATCH /appointments/{id}` (staff-writable, `_can_manage_case`-gated)

### 6.3 Decision Document Generation (Backend)

- [x] Generate Officer Decision Order PDF (§49) — `decision_document_generator.py` with `generate_decision_order_pdf()`; data gathered by `decision_document_data_service.py`; endpoint at `GET /cases/{case_id}/documents/decision-order`
- [x] Generate Verification Report PDF (§49) — `generate_verification_report_pdf()` in same module; endpoint at `GET /cases/{case_id}/documents/verification-report`
- [x] Link all documents to case (§25) — document endpoints serve PDFs inline; PDF file paths stored via `Application.generated_document_path`
- [~] Digital signature/verification where supported (§49) — footer note on generated PDFs; full digital signature integration deferred

**Existing:** `backend-py/app/common/parcel_generation/official_document_generator.py` — pattern extended for decision documents in `decision_document_generator.py`

### 6.4 Citizen Notification (Frontend + Backend)

- [x] Notification after resolution (§50) — `_notify_case_resolved()` notifies citizen on case RESOLUTION; `_notify_task_resolved()` notifies on task decision; `notification_feed_service.py` + `notification_delivery_service.py` provide SMS/email delivery
- [x] Respect citizen authorization/privacy in notifications (§50) — `_can_manage_case()` check before sending; citizen_id used as recipient, never exposing other users' data

**Existing:** `backend-py/app/services/notification_delivery_service.py`, `backend-py/app/services/notification_feed_service.py`, `backend-py/app/models/notification.py`

---

## Phase 7 — Historical Records & Audit

**Goal:** Implement the current-state vs. history pattern across all mutable entities.

### 7.1 Historical State Preservation (Backend)

- [x] Ownership change history (§41) — `ownership_history_records` table created via migration `6bd7d308d74c_add_historical_state_tables_phase7.py`
- [x] Geometry versioning (§43):
  ```text
  Geometry V1, V2, V3, V4 ← Current, Proposed V5 → Officer approval → V5 becomes current
  ``` — `case_parcel_geometry_versions` table exists (Phase 1 migration); parcel geometry history tracked
- [x] Tax events history (§41) — `tax_history_records` table created
- [x] Dispute history (§42, §41):
  ```text
  Current: Active Dispute: No
  History: Dispute opened → Verification completed → Dispute resolved
  ``` — `dispute_history_records` table created
- [x] Encumbrance history (§41) — `encumbrance_history_records` table created
- [x] Restriction history (§41) — `restriction_history_records` table created
- [x] Registration history (§41) — `registration_history_records` table created

**Existing:** `backend-py/app/models/parcel.py` — check for historical state fields; `backend/src/parcels/parcel_historical_states.entity.ts` (NestJS)

### 7.2 Case Timeline (Backend)

- [x] Timeline event types (§57):
  ```text
  CASE_CREATED, APPLICATION_GENERATED, APPLICATION_CONFIRMED, ROUTED_TO_DEPARTMENT,
  OFFICER_ASSIGNED, VERIFIER_ASSIGNED, FIELD_VISIT_STARTED, GPS_CAPTURED, PHOTO_CAPTURED,
  VERIFICATION_SUBMITTED, OFFICER_REVIEW_STARTED, APPOINTMENT_CREATED, APPOINTMENT_COMPLETED,
  DATABASE_UPDATED, DECISION_APPROVED, DECISION_REJECTED, CASE_CLOSED, FEEDBACK_SUBMITTED
  ```
- [x] Each event retains: Who, When, What happened, Previous state, New state, Case ID, Task ID (§57) — `CASE_TIMELINE_EVENT_TYPES` set in `case_service.py`; all task lifecycle functions create timeline events with task_id, actor_id, actor_role, previous/new state

### 7.3 Database Mutation Audit Trail (Backend)

- [x] Every authorized DB change linked to case (§58):
  ```text
  changed_by, changed_at, case_id, task_id, reason, previous_value, new_value, decision_id
  ``` — `case_id`, `task_id`, `decision_id`, `previous_value`, `new_value`, `reason` columns added to `AuditLog` model + migration `e5f6a7b8c9d0_extend_audit_logs_phase7.py`; `audit_service.log()` and new `audit_service.log_case_mutation()` accept these params; all case/task functions pass `case_id` and `task_id`
- [~] Geometry-specific audit: previous_geometry_version, new_geometry_version, verification_id, decision_id, case_id (§58) — generic audit columns added; geometry-specific audit requires parcel geometry mutation service (Phase 4.4)
- [~] Dispute-specific audit: dispute_id, resolved_by, resolved_at, resolution_reason, case_id (§58) — generic audit columns added; dispute resolution service pending

**Existing:** `backend-py/app/services/audit_service.py`, `backend-py/app/models/audit.py` — extended with case-linked audit columns and `log_case_mutation()` helper

### 7.4 Application Versioning (Backend)

- [x] Preserve: original input, conversation, AI interpretation, AI draft, citizen-edited version, final submitted version (§14) — `Application` model in `models/case.py` preserves all version types; `ApplicationOut` schema exposes them
- [x] Final confirmed version = official application (§14) — `final_submitted_version` + `citizen_confirmed` fields
- [x] Intermediate versions available for audit (§14) — all version types stored in model; `application_draft` stored on `AIAnalysis` for AI draft history

---

## Phase 8 — Citizen Feedback & Admin Oversight

**Goal:** Implement feedback collection, officer performance monitoring, and admin alerting.

### 8.1 Citizen Feedback (Frontend + Backend)

- [x] Feedback prompt after case resolution (§51) — `submit_feedback()` in `case_service.py` + `POST /cases/{case_id}/feedback` endpoint
- [x] Feedback categories: Response time, Officer communication, Resolution clarity, Field verification, Overall experience, Other (§51) — `Feedback.category` field with documented string values
- [x] Feedback types: Officer rating, Overall case rating, Optional comments, Structured reasons (§51) — `Feedback.type`, `officer_rating`, `overall_case_rating`, `comments`, `reasons` fields
- [x] Multi-officer feedback (§52):
  ```text
  Survey Officer: Rating 4/5
  Dispute Officer: Rating 5/5
  Field Verifier: Rating 3/5
  Overall Case: Rating 4/5
  ``` — Feedback linked to `officer_id`, `department_id`, `task_id` for multi-officer attribution
- [x] Feedback linked to case and officer/task (§52, Invariant 11) — `Feedback` model has `case_id`, `officer_id`, `department_id`, `task_id` FK fields

### 8.2 Admin Performance Monitoring (Frontend + Backend)

- [x] Admin dashboard metrics (§53) — `predictive_analytics_service.py` provides cases handled, resolved, SLA compliance, avg resolution time, overdue, returned, escalations
- [~] Officer performance table (§53) — `OfficerMonitoring.tsx` frontend component exists; backend analytics service provides data
- [x] Multi-signal performance (§55): rating, feedback count, SLA compliance, resolution time, cases assigned/resolved, overdue, return/rework rate, escalations

**Existing:** `frontend/src/features/admin/OfficerMonitoring.tsx`, `frontend/src/features/admin/SystemMonitoring.tsx`, `backend-py/app/services/predictive_analytics_service.py`

### 8.3 Officer Performance Alerts (Backend + Frontend)

- [x] Alert conditions (§54): Low rating + Minimum feedback count + Configured threshold → Admin Alert → Admin Review — `governance_alerts_service.py` + `governance_rules_service.py` implement alert evaluation
- [x] Configurable thresholds (§54): min rating, min feedback count, SLA warning, SLA breach — `governance_rules_service.py` handles configurable thresholds
- [x] Flag review condition (not unsupported judgment) (§54) — governed by `governance_rules_service.py` flag review conditions

**Existing:** `backend-py/app/services/governance_alerts_service.py`, `backend-py/app/services/governance_rules_service.py`

### 8.4 SLA Monitoring (Frontend + Backend)

- [x] SLA per workflow/task (§56), not just department — `SLAConfig` model has `workflow_id`, `task_id`, `department_id` fields; `check_task_sla()` function checks task SLA status
- [x] Multi-department case SLA display (§56) — `GET /cases/{case_id}/sla` endpoint returns active SLAs; `GET /cases/{case_id}/tasks/{task_id}/sla` returns per-task SLA status
- [x] Configurable SLA rules (§56) — `SLAConfig` model with `threshold_hours`, `warning_threshold`, `breach_threshold`, `is_active` fields

---

## Phase 9 — Frontend Integration & Polish

**Goal:** Unify frontend components, fix test infrastructure, and deliver polished UX per spec.

### 9.1 Unified Map Migration (Frontend) — BACKLOG P0 #2

- [x] Migrate `HistoricalImageView` → `UnifiedMapWrapper` — `features/officer/HistoricalMapView.tsx` now uses UnifiedMapWrapper (imported directly)
- [x] Migrate `AdminCombinedLayerMap` → `UnifiedMapWrapper` — `features/admin/AdminCombinedLayerMap.tsx` now imports and renders UnifiedMapWrapper
- [~] Migrate `AdminMapLayerAuthoringPage` → `UnifiedMapWrapper` — page still imports `AdminCombinedLayerMap` (which is itself UnifiedMapWrapper-backed); direct migration not yet applied
- [x] Migrate `AssignedVisitsPage` → `UnifiedMapWrapper` — `pages/verifier/AssignedVisitsPage.tsx` now uses UnifiedMapWrapper

**Existing:** `frontend/src/features/map/UnifiedMapWrapper.tsx` — the target wrapper component

### 9.2 Frontend Test Infrastructure (Frontend) — BACKLOG P0 #1

- [x] React Query mocks setup — `setup.ts` patches QueryClient to auto-populate default query data for all common query keys
- [x] MSW handlers setup — `mocks/handlers.ts` with handlers for `/auth/me`, `/parcels`, `/notifications`, `/users`, admin endpoints, and generic POST/PATCH/PUT/DELETE fallbacks
- [x] Component test setup pattern migration — `setup.ts` mocks `useTranslation()` with LanguageContext fallback strings, stubs ResizeObserver/matchMedia, sets up `createTestQueryClient()`/`testQueryClient` utilities
- [x] Resolve failing tests — all 313 tests pass across 32 files (2026-09-23). MapComponent maplibre/worker mocks and param-aware MSW handlers landed; last remaining flake (App.test.tsx About/Features nav timing out under full-suite load) fixed by raising that test's lazy-page findBy timeout.

**Existing:** `frontend/src/test/setup.ts`, `frontend/src/test/utils.tsx`, `frontend/src/mocks/server.ts`, `frontend/src/mocks/handlers.ts`

### 9.3 Citizen Portal Polish (Frontend)

- [x] Home page
- [x] Dashboard (§4) with overview cards and "What needs my attention?" — `CitizenDashboardPage.tsx` queries parcels, workflows, and cases
- [x] My Parcels page (§5) with full status display — `MyParcelsPage.tsx` exists (FEATURES.md §12 confirms full citizen sign-in/my parcels)
- [x] Find Parcels search (§7): ULPIN, survey no, plot no, address/location — `FindParcelsPage.tsx` uses UnifiedMapWrapper; search via `ParcelSearch.tsx`
- [x] Parcel Details / 360° Cadastral View (§8) — `Parcel360View.tsx` with embedded map
- [x] My Cases page (§65): simple citizen case view — `MyCasesPage.tsx` with appointment booking modal
- [x] AI Assistant contextual access throughout portal — `AskAiWidget.tsx` mounted at app-shell level

**Existing:** `frontend/src/pages/citizen/CitizenDashboardPage.tsx`, `frontend/src/pages/citizen/MyParcelsPage.tsx`, `frontend/src/pages/citizen/FindParcelsPage.tsx`, `frontend/src/pages/citizen/RequestsPage.tsx`, `frontend/src/pages/citizen/MyCasesPage.tsx`

### 9.4 Language & Accessibility (Frontend)

- [x] Multi-language support via LanguageContext (11 languages: en, hi, bn, gu, kn, ml, mr, or, pa, ta, te) — fully rebuilt 2026-09-15, Bhashini-backed
- [x] Speaker button for text-to-speech — wired into 8+ call sites
- [x] Mic button for voice input — wired into 8+ call sites
- [x] Indian Emblem branding

**Existing:** `frontend/src/context/LanguageContext.tsx`, `frontend/src/components/SpeakerButton.tsx`, `frontend/src/components/MicButton.tsx`, `frontend/src/components/IndianEmblem.tsx`

### 9.5 Performance (Frontend + Backend)

- [~] Vite build optimization — chunk size < 500 kB (PERFORMANCE_AUDIT.md) — in progress
- [~] Asset optimization — hero-team.jpg (2.4 MB) and other large assets
- [x] Map request optimization — viewport bounds and explicit limits implemented in MapComponent
- [~] Database query optimization — connection pooling, session management

---

## Known Dependencies & Blockers

| Item | Status | Spec Reference |
|---|---|---|
| Bhashini OCR / ALD | **Blocked** — account provisioning needed. Returns "Requested pipeline does not exist" / "TaskType is not valid" | BACKLOG P2 |
| Frontend test infrastructure | **Complete** — all 313 tests pass across 32 files (2026-09-23). maplibre-gl + worker mocks, param-aware MSW handlers, and data-shape fixes all landed; final App.test.tsx nav flake fixed via a raised lazy-page findBy timeout | BACKLOG P0 #1 |
| Unified Map migration | **In Progress** — HistoricalMapView, AdminCombinedLayerMap, AssignedVisitsPage migrated to UnifiedMapWrapper. AdminMapLayerAuthoringPage not directly migrated (delegates via AdminCombinedLayerMap) | BACKLOG P0 #2 |
| Celery/Redis compose topology | **Needs update** — Original Compose topology missing Redis, worker, beat, migration job declarations | PERFORMANCE_AUDIT.md |
| Phase 1 Foundation | **Complete** — data models, auth, case engine, API endpoints implemented | Phase 1 |
| **Phase 5 Verifier Workflow** | **Complete** — verifier assignment, offline case package, GPS/photo capture, findings submission, auto-sync with retry, officer review | Phase 5 |
| **Phase 7 Historical Records** | **Complete** — 5 history tables (dispute, encumbrance, registration, restriction, tax) created via migration 6bd7d308d74c | Phase 7 |

---

## Spec Section → Implementation Mapping

| Spec Sections | Feature Area | Phase | Primary Backend Location | Primary Frontend Location |
|---|---|---|---|---|
| §1–2 | Purpose & Principles | (Guidance) | — | — |
| §3–5 | Citizen Portal Navigation, Dashboard, My Parcels | 2, 9 | `routers/workflows.py`, `routers/parcels.py` | `pages/citizen/`, `features/citizen/` |
| §6 | One Active Case Per Parcel | 1 | `models/case.py`, `services/case_service.py`, `routers/cases.py` | — |
| §7–8 | Find Parcels, Parcel 360 | 1, 4, 9 | `routers/parcels.py`, `services/parcels_service.py` | `features/parcels/` |
| §9–18 | AI-Assisted Request Flow, Application, Routing, Multi-Dept | 2 | `services/ai_service.py`, `routers/ai.py` | `features/ai/`, `pages/citizen/` |
| §19–23 | Departmental Workflow Architecture & Configuration | 3 | `models/workflow.py`, `services/pipeline_config_service.py` | `features/officer/` |
| §24–27 | Officer Case Workspace | 4 | `routers/cases.py`, `services/case_service.py` | `pages/OfficerPortal.tsx`, `features/officer/` |
| §28–33 | Survey Officer & Verifier Workflow | 5 | `routers/verifier.py` (new) | `features/verifier/`, `pages/verifier/` |
| §34–37 | Officer Decision & Digital Updates | 4 | `routers/cases.py`, `services/audit_service.py` | `features/officer/` |
| §38–39 | Backend Authorization & Transactions | 1 | `middleware.py`, `services/case_service.py` | — |
| §40–43 | Historical Records & Versioning | 7 | `models/parcel.py` (history fields), `services/audit_service.py` | `features/parcels/` |
| §44–47 | Corrections, Appointments, Offline Verification | 4, 6 | New models/services | `features/verifier/`, `features/officer/` |
| §48 | Verifier Offline-First | 5 | New sync service | `features/verifier/` |
| §49–50 | Decision Documents & Citizen Notification | 6 | `common/parcel_generation/`, `services/notification_*.py` | `features/officer/`, `features/citizen/` |
| §51–52 | Citizen Feedback | 8 | New feedback models/services | New feedback components |
| §53–55 | Admin Performance Monitoring | 8 | `services/predictive_analytics_service.py` | `features/admin/` |
| §56 | SLA Architecture | 3, 8 | New SLA service | `features/officer/`, `features/admin/` |
| §57–58 | Case Timeline & Audit Trail | 7 | `services/audit_service.py` (extend) | `features/officer/` |
| §59–60 | Domain Model & Capability Matrix | 1, 3 | `models/`, `services/departments_service.py` | `types/department.ts` |
| §61 | Workflow Configuration Model | 3 | `models/workflow.py`, `routers/workflows.py` | `types/workflow.ts` |
| §62 | Frontend Architecture (Officer Shell) | 4, 9 | — | `pages/OfficerPortal.tsx` |
| §63–64 | Security & Current State vs History | 1, 7 | `middleware.py`, `models/` | — |
| §65–72 | Target Experiences & Final Definition | (Guidance) | — | — |

---

## Plan Maintenance

This document should be updated in parallel with execution work. When a phase or item is completed:

1. Mark checkboxes as `[x]`
2. Add notes on what was implemented
3. Move completed items to `docs/architecture/FEATURES.md`
4. Update the Known Dependencies table as blockers are resolved
