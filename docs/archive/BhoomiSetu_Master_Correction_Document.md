# BhoomiSetu Master Correction Document
## Mobile UI, Functional, Data, GIS, Workflow, Localization & Reliability Audit

**Project:** BhoomiSetu  
**Document type:** Master correction / remediation specification  
**Source:** Mobile and desktop screenshots supplied during the UI audit  
**Purpose:** Consolidate the observed bugs, likely root causes, required fixes, acceptance criteria, and implementation priorities into one engineering document.

---

## 1. Purpose

This document is the single correction reference for the issues identified from the supplied BhoomiSetu screenshots.

The objective is **not** to patch individual screenshots independently. The objective is to identify the shared engineering causes behind the visible failures and correct them at the appropriate layer:

```text
Database
   ↓
Service / Workflow Layer
   ↓
FastAPI / API DTO
   ↓
Frontend API Adapter
   ↓
State Management
   ↓
Shared Components
   ↓
Responsive UI
   ↓
Localization / Theme
```

The implementation must preserve the existing BhoomiSetu functionality and visual identity.

---

# 2. Core Engineering Rules

## 2.1 No fake data

Do not add dummy:

- users
- verifiers
- parcels
- activity events
- satellite images
- cases
- requests
- workflow states
- GIS coordinates

to make screenshots appear correct.

If data genuinely does not exist, show a correct empty state.

---

## 2.2 No fake success

Do not convert:

```text
API failure → Success
Missing imagery → Fake imagery
Missing verifier → Fake verifier
Empty activity log → Fake activity
Broken route → Static page
```

into apparent functionality.

Fix the underlying system.

---

## 2.3 Do not patch every page independently

Repeated bugs must be fixed through shared systems.

Examples:

```text
Multiple pages overflow
→ Responsive layout system

Multiple pages stuck loading
→ Shared async state/error handling

Multiple pages expose UUIDs
→ Shared presentation formatter

Multiple pages show raw enum values
→ Shared status mapping

Multiple pages break in Hindi
→ Shared i18n/responsive typography

Multiple activity screens disagree
→ Single audit-event source
```

---

# 3. Priority Definitions

### P0 — Critical

Breaks core functionality, data correctness, security, or an essential workflow.

### P1 — High

Major UX/data problem that affects normal operation.

### P2 — Medium

Responsive, localization, accessibility, or secondary functionality issue.

### P3 — Polish

Visual refinement after functionality is stable.

---

# 4. Master Issue Register

## ISSUE-001 — Registration Chain Infinite Loading

**Priority:** P0

### Observed

Registration Chain can remain on:

```text
Loading pending queue...
```

while another state/screenshot shows actual historical parcel data.

### Likely causes

- API request never resolves.
- Backend timeout.
- Wrong endpoint.
- Wrong role filter.
- Incorrect response schema.
- Frontend `loading` state never reset.
- Unhandled rejected promise.
- Race condition between multiple requests.
- Stale request overwriting newer state.

### Solution

Implement:

```text
idle
 ↓
loading
 ↓
success
 ↓
data
```

or:

```text
idle
 ↓
loading
 ↓
error
 ↓
retry
```

Always clear loading in `finally`.

Use request cancellation for stale requests.

### Acceptance

- Loading never continues indefinitely.
- Success displays data.
- Empty dataset displays empty state.
- API error displays error state.
- Retry works.

---

## ISSUE-002 — Registration Chain Incorrect Zero Count

**Priority:** P0

### Observed

Registration Chain may display:

```text
Parcels With History (0)
```

even when historical records exist elsewhere.

### Likely causes

- Different APIs used by different components.
- Incorrect filter.
- Wrong user/jurisdiction.
- Stale cached data.
- Count calculated from an empty frontend array.

### Solution

Use one authoritative data source and calculate count from the same dataset.

---

## ISSUE-003 — Registration Chain Search

**Priority:** P1

### Observed

Search UI exists but filtering may not correctly operate against loaded data.

### Solution

Support:

- Parcel ID
- ULPIN
- Registration number

Use debounced server-side search for large datasets.

---

## ISSUE-004 — Case Package Fails

**Priority:** P0

### Observed

```text
Failed to load case package.
```

### Possible causes

- Wrong case ID.
- Missing documents.
- Storage failure.
- Authorization failure.
- Broken package-generation endpoint.
- Signed URL failure.
- MIME/Content-Disposition problem.
- Network timeout.

### Solution

Trace:

```text
GET CASE PACKAGE
→ API
→ authorization
→ document retrieval
→ package generation
→ storage
→ file response
→ browser download
```

Return structured errors.

---

## ISSUE-005 — Case Package Action Available When Package Is Not Ready

**Priority:** P1

### Solution

Disable action until required documents/package state is ready.

Use:

```text
Generating...
Ready → Download
Failed → Retry
```

---

## ISSUE-006 — Submit Report Validation

**Priority:** P0

Before report submission verify:

- valid case
- correct verifier assignment
- required evidence
- required remarks
- correct workflow stage
- correct permission

Prevent invalid workflow transitions.

---

## ISSUE-007 — Raw UUIDs in UI

**Priority:** P1

### Observed

UUIDs such as:

```text
f56c951e-f27c-4344-a7c7-ae23914c87a5
d9cc3946
```

appear directly in user-facing UI.

### Solution

Prefer:

- Case ID
- Request ID
- Parcel ID
- ULPIN
- Registration number

Keep UUIDs internally or in technical/debug contexts.

---

## ISSUE-008 — Raw Department UUID

**Priority:** P1

### Observed

Department field can show values similar to:

```text
d9cc3946
```

### Solution

API should expose department metadata or frontend should resolve:

```text
department_id
→ department_name
```

Display:

```text
Registration Department
```

---

## ISSUE-009 — Raw Workflow Enums

**Priority:** P1

### Observed

Values such as:

```text
IN_PROGRESS
UNDER_REVIEW
SUBMITTED
```

appear directly.

### Solution

Use shared presentation mapping:

```text
IN_PROGRESS → In Progress
UNDER_REVIEW → Under Review
SUBMITTED → Submitted
COMPLETED → Completed
```

Then localize labels.

---

## ISSUE-010 — Verifier Data Shows Raw i18n Keys

**Priority:** P0

### Observed

UI exposes:

```text
verifierPortal.workload
verifierPortal.assignedArea
verifierPortal.availability
verifierPortal.activeTasks
verifierPortal.unknown
```

### Likely causes

- Missing translation keys.
- Wrong translation namespace.
- API field names mistakenly passed to i18n.
- Incorrect component property mapping.

### Solution

Map backend data to UI labels before rendering.

Never render raw translation keys.

---

## ISSUE-011 — Verifier Data Displays `unknown`

**Priority:** P0

### Likely causes

- API property mismatch.
- Backend doesn't provide the field.
- Frontend expects different naming convention.
- Null/undefined handling is incorrect.

### Solution

Validate API response against TypeScript/Pydantic schemas.

Differentiate:

```text
Loading
Not provided
Not available
Not applicable
Unknown
```

---

## ISSUE-012 — Verifier Dropdown Malformed

**Priority:** P1

### Cause

Undefined fields are concatenated into dropdown labels.

### Solution

Use a safe formatter:

```text
Name
Workload
Assigned Area
Availability
Active Tasks
```

with explicit fallbacks.

---

# 5. Activity & Audit System

## ISSUE-013 — Duplicate Activity Events

**Priority:** P0

### Observed

Repeated identical activity events appear.

### Possible causes

Frontend:

- duplicate API calls
- React effect firing multiple times
- StrictMode side effect
- duplicate event dispatch

Backend:

- event emitted more than once
- retry without idempotency
- duplicate audit insertion

Database:

- duplicate records

### Solution

Trace event creation end-to-end.

Add immutable unique `event_id`.

Ensure one logical user action generates one audit event.

---

## ISSUE-014 — Activity Log Incorrect Timestamps

**Priority:** P1

### Possible causes

- Batch timestamp.
- Seeded timestamps.
- Server/client timezone mismatch.
- Incorrect date formatting.

### Solution

Store timestamps in UTC.

Convert for display using configured/user timezone.

Use one application-wide formatter.

---

## ISSUE-015 — Recent Activity Disagrees With Full Activity Log

**Priority:** P1

### Cause

Different APIs or query logic.

### Solution

Use the same authoritative audit service.

```text
AuditEvent
   ├── Recent query
   └── Full log query
```

---

## ISSUE-016 — Full Activity Log Loads Too Much Data

**Priority:** P1

### Solution

Use server-side pagination or cursor pagination.

Example:

```http
GET /activity-log?limit=20&cursor=...
```

Never download thousands of records just to display the first page.

---

## ISSUE-017 — Activity Filter Semantics Are Ambiguous

**Priority:** P1

If filter says `USERS`, define whether it means:

- all user actors
- citizen actors
- user-management activity

Use explicit labels.

---

## ISSUE-018 — Internal Activity Names Leak Into UI

Examples:

```text
AUTH_GOOGLE_LOGIN
PROFILE_UPDATED
```

### Solution

Use presentation mappings:

```text
AUTH_GOOGLE_LOGIN
→ Signed in with Google

PROFILE_UPDATED
→ Updated profile details
```

---

# 6. Mobile Responsive Problems

## ISSUE-019 — My Tasks Table Overflows

**Priority:** P1

### Solution

Desktop:

```text
Case | Stage | Status | Created | Actions
```

Mobile:

```text
Case
Stage
Status
Created
[Manage]
```

Use cards or deliberate horizontal scrolling.

---

## ISSUE-020 — Task Detail Tabs Overflow

**Priority:** P1

### Solution

Use horizontally scrollable tabs or responsive wrapping.

---

## ISSUE-021 — Task Detail Modal Exceeds Viewport

**Priority:** P1

Use:

```css
max-height: 90vh;
overflow-y: auto;
```

Keep modal header stable.

Prevent background page scrolling.

---

## ISSUE-022 — Dispute Modal Overflow

**Priority:** P1

Convert desktop two-column content to one-column mobile layout.

---

## ISSUE-023 — Dispute Workflow Controls Overflow

**Priority:** P1

Use:

- horizontal scrolling, or
- 2×2 mobile grid.

---

## ISSUE-024 — Historical Imagery Toolbar Overflow

**Priority:** P1

Desktop:

```text
Layers | Parcel Map | Satellite | Load 2026 | Locate
```

Mobile:

```text
Layers | Locate

Parcel Map | Satellite

Load 2026
```

---

## ISSUE-025 — GIS Controls Leave Map Container

**Priority:** P1

Anchor controls to a relative map container.

Create shared `MapControls`.

---

## ISSUE-026 — Registration Chain Mobile Table Overflow

**Priority:** P1

Use responsive cards or controlled table scrolling.

---

## ISSUE-027 — Hindi Page Overflow

**Priority:** P1

Hindi text must be allowed to expand.

Avoid fixed heights.

Use:

```css
min-height
height: auto
overflow-wrap
```

---

## ISSUE-028 — Email Overflow

**Priority:** P2

Use:

```css
overflow-wrap: anywhere;
```

and responsive layout.

---

# 7. Profile Problems

## ISSUE-029 — Profile Completeness May Be Hardcoded

**Priority:** P1

Observed value similar to:

```text
82%
```

### Solution

Calculate from actual profile fields.

Define the required fields and scoring rules centrally.

---

## ISSUE-030 — Profile Completeness Explanation May Not Match Data

**Priority:** P1

The missing fields listed must be dynamically derived.

Example:

```text
Missing:
• Mobile number
• Emergency contact
```

---

## ISSUE-031 — Recovery Contact Add Action

**Priority:** P1

Implement:

```text
Add
→ Input
→ Validate
→ Verify
→ Save
→ Refresh
```

---

## ISSUE-032 — Mobile Number Add Action

**Priority:** P1

Implement:

```text
Add
→ Number
→ OTP
→ Verify
→ Save
```

Profile completeness must update afterward.

---

## ISSUE-033 — Identity Verification Layout Breaks

**Priority:** P2

Stack:

```text
Email
Verified
Change
```

on mobile.

---

# 8. Theme / Visual Problems

## ISSUE-034 — Dark Theme Text Disappears

**Priority:** P1

### Cause

Hard-coded colors or incorrect theme tokens.

### Solution

Use semantic theme variables:

```text
--bg-primary
--bg-secondary
--surface
--text-primary
--text-secondary
--text-muted
--border
--success
--warning
--danger
```

---

## ISSUE-035 — Pending Badge Has Poor Contrast

**Priority:** P2

Use accessible contrast and explicit semantic status colors.

---

## ISSUE-036 — Manage Button Has Poor Contrast

**Priority:** P2

Provide visible:

- normal
- hover
- active
- focus
- disabled

states.

---

## ISSUE-037 — Login Logo Has Poor Visibility

**Priority:** P1

Check:

- logo asset
- transparent background
- dark/light variant
- dimensions
- object-fit
- container clipping

---

# 9. GIS Problems

## ISSUE-038 — Locate Button Does Not Work

**Priority:** P0

Implement:

```text
navigator.geolocation
→ coordinates
→ map.flyTo
→ location marker
```

Handle:

- permission denied
- unavailable
- timeout
- unsupported browser

---

## ISSUE-039 — Layer Control Does Not Properly Control Layers

**Priority:** P0

Create central map layer state.

---

## ISSUE-040 — Parcel Selection Must Be Real

Clicking a parcel should show authorized parcel information.

---

## ISSUE-041 — Historical Imagery Uses Generic Error

**Priority:** P0

Differentiate:

```text
NO_IMAGERY
CLOUD_COVER
INVALID_DATE
INVALID_GEOMETRY
PROVIDER_ERROR
AUTH_ERROR
NETWORK_ERROR
```

---

## ISSUE-042 — Imagery State Is Too Global

Store by:

```text
cluster_id
parcel_id
year
```

rather than one global error state.

---

# 10. Map Layer Authoring

## ISSUE-043 — All Layers Load at Once

**Priority:** P1

Use:

```text
filter
→ backend query
→ pagination
```

---

## ISSUE-044 — Layer Filters Are Cosmetic

**Priority:** P1

Filter controls must change API parameters.

Example:

```http
GET /map-layers?
type=restriction&
state=Maharashtra&
district=Pune
```

---

## ISSUE-045 — Layer Categories May Return Same Dataset

**Priority:** P1

Tabs must filter:

- Zoning
- Restrictions
- Infrastructure
- Admin Notes
- Combined View

---

## ISSUE-046 — Layer Authoring Has No Proper Empty State

Use:

```text
No restriction zones found.
Try another district or layer type.
```

---

## ISSUE-047 — GeoJSON Editing Needs Validation

**Priority:** P1

Validate:

- JSON
- GeoJSON
- geometry
- coordinates
- CRS
- polygon validity
- self-intersection

before PostGIS insertion/update.

---

## ISSUE-048 — Layer Delete Needs Confirmation

**Priority:** P0

Show:

- layer name
- affected parcel count
- impact warning
- Cancel
- Delete

---

## ISSUE-049 — Layer Mutations Need Audit Logging

Record:

```text
actor
timestamp
layer ID
old values
new values
reason
```

---

# 11. Notification System

## ISSUE-050 — Notification Toggles May Be Local Only

**Priority:** P1

Persist:

```text
SMS
Email
In-App
```

preferences to backend.

---

## ISSUE-051 — Notification Toggle Has No Save/Error State

Show:

```text
Saving...
Saved
Failed — restored previous value
```

---

## ISSUE-052 — SMS Should Depend on Verified Mobile

If no verified mobile exists:

```text
SMS notifications unavailable.
Verify your mobile number first.
```

Same principle for email.

---

# 12. Workflow Problems

## ISSUE-053 — Workflow Actions Must Depend on State

Example:

```text
ASSIGNED
→ Start

IN_PROGRESS
→ Capture Evidence

EVIDENCE_SUBMITTED
→ Review

COMPLETED
→ View / Download
```

Do not show mutation actions that are invalid for the current state.

---

## ISSUE-054 — Completed Task Still Shows Capture Evidence

If a task is `COMPLETED`, show appropriate read-only actions unless additional evidence is explicitly permitted.

---

## ISSUE-055 — Role Permissions Must Be Backend-Enforced

Every action must verify:

```text
user
role
department
permission
case
workflow stage
jurisdiction
```

Frontend hiding is not authorization.

---

## ISSUE-056 — Workflow State Must Come From Workflow Engine

Do not let individual frontend pages independently calculate case status.

---

# 13. Navigation Problems

## ISSUE-057 — Dead Buttons

Audit all:

- View
- Manage
- Add
- Change
- View Access Matrix
- View Activity Log
- Get Case Package
- Submit Report
- Load Satellite
- Locate
- Layers

Every button must either work or be intentionally disabled with an explanation.

---

## ISSUE-058 — Blank Routes

Every registered route must:

- render correctly
- load its data
- handle empty state
- handle error state
- respect authorization
- work on refresh/direct URL

---

# 14. Global i18n Problems

## ISSUE-059 — Raw Translation Keys

Search codebase for patterns such as:

```text
*.workload
*.assignedArea
*.availability
*.activeTasks
*.unknown
```

No translation key should appear in production UI.

---

## ISSUE-060 — Mixed English/Hindi/Marathi UI

When language is Hindi or Marathi, translate all supported user-facing strings consistently.

Do not translate only page headings.

---

## ISSUE-061 — Translation Length Breaks Layout

Test all UI at:

```text
320px
360px
375px
390px
412px
430px
768px
Desktop
```

for:

```text
English
Hindi
Marathi
```

---

# 15. Global Async State Architecture

Every async component should support:

```text
idle
loading
success
empty
error
retry
```

Avoid a global `loading` boolean for unrelated operations.

Use independent states:

```text
isActivityLoading
isCasePackageLoading
isNotificationSaving
isLayerLoading
isImageryLoading
```

---

# 16. API Error Architecture

Backend should return structured errors.

Example:

```json
{
  "code": "NO_IMAGERY",
  "message": "No suitable imagery was found.",
  "request_id": "..."
}
```

Frontend maps error codes to localized user-facing messages.

Never expose:

- stack traces
- SQL errors
- Python exceptions
- internal file paths
- secrets
- raw database identifiers

---

# 17. Responsive Breakpoint Testing

Mandatory viewport testing:

```text
320 × 800
360 × 800
375 × 812
390 × 844
412 × 915
430 × 932
768 × 1024
1366 × 768
1440 × 900
```

Except intentionally scrollable maps/tables, the following must satisfy:

```text
document.documentElement.scrollWidth
<=
window.innerWidth
```

---

# 18. Mobile Design Strategy

Do not simply shrink desktop.

Use:

```text
Desktop table
→ Mobile cards

Desktop toolbar
→ Mobile stacked controls

Desktop modal
→ Mobile full-screen/bottom sheet

Desktop multi-column metadata
→ Mobile vertical sections

Desktop navigation
→ Mobile drawer
```

---

# 19. Security Requirements

Backend must enforce:

- JWT authentication
- role-based authorization
- department permissions
- jurisdiction restrictions
- workflow-state permissions
- resource ownership where applicable

Do not rely on:

```text
hidden button
```

as a security mechanism.

---

# 20. Performance Requirements

Avoid loading entire datasets.

Use:

- server-side pagination
- cursor pagination where useful
- query filtering
- caching
- request deduplication
- lazy loading
- virtualized long lists
- optimized GIS queries
- PostGIS spatial indexes
- appropriate database indexes

Especially for:

- parcels
- registration history
- activity logs
- map layers
- cases
- tasks

---

# 21. Testing Matrix

Every affected feature must be tested with:

### Roles

```text
Citizen
Officer
Field Verifier
Admin
```

### Languages

```text
English
Hindi
Marathi
```

### Themes

```text
Light
Dark
```

### Devices

```text
Mobile
Tablet
Desktop
```

### Network

```text
Normal
Slow
Failed
Timeout
```

---

# 22. Acceptance Criteria

The correction is complete only when:

- No critical page remains infinitely loading.
- API errors produce meaningful error states.
- Empty datasets produce empty states.
- No raw translation keys appear.
- No raw backend UUIDs appear unnecessarily.
- No raw enum values appear in normal user-facing UI.
- Verifier data is correctly populated.
- Case packages can be retrieved when documents exist.
- Reports cannot be submitted in invalid workflow states.
- Activity events are not duplicated.
- Activity Log pagination works.
- Recent Activity and Full Activity Log use consistent data.
- Notification settings persist.
- GIS Locate works.
- GIS layer control works.
- Satellite imagery has meaningful error states.
- Map Layer Authoring filters server-side.
- GeoJSON is validated before persistence.
- Layer deletion requires confirmation.
- Layer changes are audited.
- Mobile pages do not overflow.
- Hindi and Marathi layouts remain usable.
- Dark mode has sufficient contrast.
- Every visible action has a valid destination/function.
- Backend authorization protects every privileged operation.
- No fake data has been introduced to hide failures.

---

# 23. Recommended Implementation Order

## Phase 1 — Core functionality

1. API/loading/error state architecture
2. Registration Chain
3. Case Package
4. Verifier assignment
5. Workflow actions
6. Activity/audit correctness
7. GIS Locate/layers
8. Satellite imagery
9. Notification persistence

## Phase 2 — Data correctness

10. Raw UUID removal
11. Enum presentation mapping
12. Department mapping
13. Profile completeness
14. Duplicate audit-event investigation
15. Correct counts
16. Correct workflow states

## Phase 3 — Responsive UI

17. My Tasks
18. Task Detail
19. Registration Chain
20. Historical Imagery
21. GIS
22. Dispute Modal
23. Map Layer Authoring
24. Profile
25. Activity Log

## Phase 4 — Localization and theme

26. Raw i18n-key audit
27. Hindi layout
28. Marathi layout
29. Dark theme
30. Light theme
31. Accessibility contrast

## Phase 5 — Final QA

32. Role testing
33. Mobile testing
34. Network failure testing
35. Regression testing
36. Security testing
37. Performance testing

---

# 24. Final Engineering Principle

The application should not be considered fixed merely because the screenshots look better.

The final state must satisfy:

```text
                BHOOMISETU
                    │
        ┌───────────┴───────────┐
        │                       │
   DATA CORRECTNESS        UI CORRECTNESS
        │                       │
   Database/API             Responsive
   Workflow                 Accessible
   Permissions              Localized
   Audit                    Themed
        │                       │
        └───────────┬───────────┘
                    │
             ACTUAL FUNCTIONALITY
                    │
          ┌─────────┴─────────┐
          │                   │
       Citizen             Officer
          │                   │
       Verifier             Admin
          │                   │
          └─────────┬─────────┘
                    │
             Same source of truth
```

A screenshot is evidence of a problem, not the specification of the implementation.

Fix the underlying system, then verify that the screenshot-level problem disappears.
