# BhoomiSetu — Unified Citizen, Departmental & Land Governance Workflow Specification

## 1. Purpose

BhoomiSetu is intended to function as a unified land-governance platform connecting citizens, parcel records, AI-assisted request creation, multiple government departments, field verifiers, officers, administrators, and historical land data.

The central architectural shift is:

> **Citizens should describe their land-related problem naturally. BhoomiSetu should understand the problem, generate the official application, route one case to all relevant departments, execute department-specific workflows, support field/offline verification where required, record the final decision, update the authorized current database state, preserve historical records, and collect citizen feedback.**

The system should therefore move away from a fixed citizen-facing model of four request types and toward a **single Case Management Platform with configurable departmental workflows**.

---

# 2. Core Product Principles

## 2.1 One citizen request entry point

Citizens should not have to decide which department or internal service category handles their problem.

The citizen should have one primary action:

**Get Assistance**

The citizen:

1. Selects or confirms the relevant owned parcel.
2. Explains the issue to the BhoomiSetu AI Assistant.
3. Answers follow-up questions asked by the AI.
4. Reviews the AI's understanding of the issue.
5. Reviews and edits the generated application.
6. Confirms the application.
7. Completes required verification.
8. Submits one case.

---

## 2.2 AI is an interface, not the final authority

The AI Assistant should:

- Ask questions about the problem.
- Identify relevant facts.
- Understand the citizen's intent.
- Use parcel/database context.
- Determine potentially affected departments/workflows.
- Generate a formal application.
- Help the citizen refine the application.

The AI should **not**:

- Invent facts.
- Turn allegations into established facts.
- Silently submit an application.
- Directly mutate authoritative land records without the required workflow and authorization.

The citizen must review and confirm the final application before submission.

---

# 3. Citizen Portal

## 3.1 Recommended primary navigation

The citizen portal should move toward:

- Home
- About
- Dashboard
- My Parcels
- Find Parcels
- My Cases

The current separate **Raise Request** destination should be replaced by **Get Assistance** as the primary request-creation action.

The AI Assistant should remain accessible contextually throughout the portal.

---

# 4. Citizen Dashboard

The dashboard should be parcel- and case-centric rather than application-centric.

## Recommended overview cards

- My Parcels
- Active Case
- Action Required
- Parcel Alerts

The dashboard should prominently show:

### What needs my attention?

Examples:

- Tax overdue
- Active dispute
- Document requiring action
- Appointment required
- Case update
- Feedback pending

### My Land

Show owned parcels and their current state.

### Recent Case Activity

Show recent events involving the citizen's parcels and cases.

### Services & Assistance

Provide access to common actions, with problem reporting opening the AI-assisted workflow rather than a departmental form.

---

# 5. My Parcels

The My Parcels page should show more than basic parcel identification.

Each parcel should display:

- Parcel ID
- ULPIN
- Survey number
- Region/location
- Area
- Ownership/association status
- Tax status
- Dispute status
- Encumbrance status
- Survey status
- Other relevant active conditions
- Active case status
- Last updated information

Example:

```text
Parcel P123

Ownership       Verified
Registration    Verified
Tax             Overdue
Dispute         Active
Encumbrance     None
Survey          Verified
```

The current **Raise Complaint / Request** action should become:

**Get Assistance**

If an active case already exists for the parcel, the interface should instead direct the citizen to the existing case.

---

# 6. One Active Case Per Citizen-Owned Parcel

A core business rule is:

> **A citizen must not be able to create multiple active cases for the same land parcel at the same time.**

The lifecycle is:

```text
No Active Case
      ↓
Case Created
      ↓
Case Active
      ↓
Resolution
      ↓
Feedback
      ↓
Case Closed
      ↓
Parcel becomes eligible for a new case
```

Before creating a case, the backend must check for an existing active case for the citizen and parcel.

If an active case exists:

```text
This parcel already has an active case.

Case: BHO-2026-00182
Status: Under Investigation

[View Case]
```

The system may evaluate whether a newly reported issue is related to the existing case or qualifies for a permitted exception, but the normal rule is one active case per parcel.

---

# 7. Find Parcels

The Find Parcels page should remain available.

Citizens should be able to search using supported parcel identifiers such as:

- ULPIN
- Survey number
- Plot number
- Address/location

The map should provide parcel discovery and preview.

For parcels not owned by the citizen:

- Show only information the citizen is authorized to view.
- Do not allow arbitrary case creation against another person's parcel.

For an owned parcel:

- Open the full permitted parcel view.
- Provide Get Assistance.

---

# 8. Parcel Details / 360° Cadastral View

The parcel details page should become the central parcel workspace.

It should include:

- Parcel identity
- Ownership
- Registration
- Tax
- Dispute
- Encumbrance
- Survey
- Restrictions
- Documents
- Timeline/history
- Current active case

A parcel can have multiple simultaneous states.

For example:

```text
Ownership       Verified
Registration    Verified
Tax             Overdue
Dispute         Active
Encumbrance     None
Survey          Verified
```

The system should not reduce all parcel conditions to one status.

---

# 9. Universal AI-Assisted Request Flow

The citizen-facing request workflow should be:

```text
Select/Confirm Parcel
        ↓
AI Conversation
        ↓
Issue Understanding
        ↓
Citizen Confirmation of Understanding
        ↓
Application Generation
        ↓
Citizen Review/Edit
        ↓
Identity/Ownership Verification
        ↓
Case Creation
        ↓
AI/Rules Routing
        ↓
Department Tasks
```

---

# 10. AI Conversation

The AI should ask only the questions needed to understand the issue.

Example:

Citizen:

> The boundary shown for my land is incorrect.

AI:

> Is the issue that the boundary shown in the records or map does not match the boundary you observe on the ground?

The AI can continue until it has enough information to create a structured understanding.

---

# 11. AI Output

The AI should produce two major outputs.

## 11.1 Structured case understanding

Example:

```json
{
  "parcel_id": "ULPIN0000538819",
  "intent": "BOUNDARY_DISPUTE",
  "issues": [
    "boundary_mismatch",
    "possible_encroachment"
  ],
  "facts_stated_by_citizen": [
    "boundary on map does not match physical boundary",
    "neighbour has occupied part of the land"
  ],
  "departments": [
    "SURVEY",
    "DISPUTE"
  ]
}
```

The exact schema should be finalized during implementation.

## 11.2 Human-readable application

The AI should generate a formal application paragraph/document based only on verified parcel information and facts provided or confirmed by the citizen.

---

# 12. Citizen Review of AI Understanding

Before application generation, the citizen should see:

```text
We understand your request as:

• Boundary discrepancy
• Possible encroachment

[Correct Something]
[Continue]
```

This prevents the AI's interpretation from silently becoming the official claim.

---

# 13. AI-Generated Application

The citizen must receive a formal application draft.

The application should include relevant:

- Case/parcel identification
- Subject
- Citizen-confirmed problem description
- Relevant parcel information
- Requested action
- Other required information

The application should be editable.

Actions:

- Edit
- Regenerate
- Continue

The citizen should explicitly confirm:

```text
I confirm that the information above is accurate.
```

The final citizen-confirmed application becomes the official submitted application.

---

# 14. Preserve Multiple Application Versions

The system should preserve:

- Original citizen input
- Conversation/transcript where appropriate
- AI structured interpretation
- AI-generated draft
- Citizen-edited version
- Final submitted version

The final confirmed version is the official application.

The original and intermediate versions should remain available for audit where appropriate.

---

# 15. Facts vs Claims

The application generator must distinguish:

### Database facts

Example:

```text
Recorded area: 135.07 m²
```

### Citizen statements

Example:

```text
Citizen reports that a neighbouring party has occupied part of the land.
```

The AI must not transform an allegation into an established legal fact.

For example, it should not automatically change:

> The citizen reports a possible encroachment.

into:

> The neighbour illegally encroached on the property.

---

# 16. Application Document Generation

The backend Python service should generate the official application document after the citizen confirms submission.

The generated document should become a case artifact.

Conceptually:

```text
Case
 ├── Application
 │    ├── generated document
 │    ├── generation timestamp
 │    ├── final submitted version
 │    └── citizen confirmation
 └── Evidence
```

The document should not be silently regenerated every time the case is opened.

Versioning should be used when a legitimate new document version is created.

---

# 17. AI Routing

The AI should not merely choose a department.

It should determine:

- Intent
- Issue type
- Relevant department(s)
- Relevant workflow(s)
- Required capabilities
- Potential priority
- Relevant parcel conditions

Example:

```json
{
  "department": "SURVEY",
  "workflow": "BOUNDARY_VERIFICATION",
  "required_capabilities": [
    "PARCEL_360",
    "FIELD_VERIFICATION",
    "GEO_PHOTO"
  ]
}
```

---

# 18. One Case, Multiple Departments

One citizen issue should produce one citizen-facing case.

Internally, that case can contain multiple department tasks.

Example:

```text
CASE C182
│
├── SURVEY TASK
│     Workflow: Boundary Verification
│
└── DISPUTE TASK
      Workflow: Encroachment Review
```

The citizen should not need to submit two applications.

Each department receives its own task while remaining linked to the same case.

---

# 19. Department-Specific Workflow Architecture

BhoomiSetu should not force every department into one identical workflow.

The correct architecture is:

> **Common Case Management Engine + Configurable Departmental Workflows**

Common platform capabilities include:

- Identity
- Parcel
- AI
- Routing
- SLA
- Notifications
- Audit
- Feedback
- Case lifecycle
- Document management

Department-specific workflows determine what happens after routing.

---

# 20. Department Capabilities

Each department should define what it can do.

Example:

## Survey

- View parcel geometry
- View cadastral records
- Open Parcel 360°
- Compare historical geometry
- Assign field verifier
- Receive geo-tagged photographs
- Review field evidence
- Propose geometry correction
- Update authorized survey data
- Submit decision

## Tax

- View tax records
- View payment history
- View outstanding amount
- Calculate overdue period
- Verify payment evidence
- Record payment
- Update tax status
- Submit decision

## Land Records

- View ownership record
- View RoR/7-12 where applicable
- Review corrections
- Edit permitted fields
- Request supporting documents
- Require appointment
- Verify originals
- Update authorized record fields
- Generate updated document
- Submit decision

## Registration

- View registration records
- Review documents
- Verify supporting documentation
- Determine digital/offline processing
- Require appointment where necessary
- Update authorized registration fields
- Submit decision

## Dispute

- Review dispute application
- Review historical disputes
- Review parcel records
- Review evidence
- Assign field verification where required
- Review verifier findings
- Record assessment
- Submit decision

Actual capabilities must reflect the department's legally authorized processes.

---

# 21. Workflow Templates

Possible reusable workflow templates include:

- Digital Record Correction
- Field Verification
- Tax Review
- Document Verification
- Dispute Review
- Offline Appointment
- Geometry Correction
- Encumbrance Verification
- Manual Review

Departments can use one or more workflow templates.

---

# 22. Workflow Conditions

Workflows should support conditional paths.

Example:

```text
Document Review
      ↓
Can this be resolved digitally?
      │
   ┌──┴──┐
  YES    NO
   │      │
   ▼      ▼
Digital  Appointment
Update    Required
```

Another:

```text
Survey Review
      ↓
Field verification required?
      │
   ┌──┴──┐
  YES    NO
   │      │
   ▼      ▼
Verifier Officer Review
   │      │
   └──┬───┘
      ▼
   Decision
```

---

# 23. Department Workflow Configuration

Each workflow should define:

- Stages
- Capabilities
- SLA
- Required documents
- Required evidence
- Whether a verifier is required
- Whether an appointment can be required
- Permitted database mutations
- Decision types
- Notifications
- Feedback rules

---

# 24. Officer Case Workspace

Every department officer should have a unified case workspace.

The case header should show:

```text
Case ID
Parcel ID
Citizen
Status
Priority where applicable
SLA
```

Common actions:

- Application
- Parcel details
- Parcel 360°
- Timeline
- Evidence
- Decision

Below the common case information, the department-specific workflow UI should appear.

---

# 25. Application Document for Officers

When a request reaches a department, the officer should immediately be able to view the backend-generated application document.

Actions:

- View application
- Download application
- View final submitted version
- Review supporting documents

The application should remain linked to the case.

---

# 26. Parcel Details Up Front

The officer should see relevant parcel information without navigating away.

Example:

```text
ULPIN
Survey Number
Area
Owner/authorized party
Tax status
Dispute status
Encumbrance status
Survey status
Other relevant active conditions
```

---

# 27. Parcel 360° Quick Access

The officer should have a small persistent action such as:

**Parcel 360° →**

It should open the existing parcel 360/cadastral interface while retaining case context.

The 360° view can expose relevant layers such as:

- Cadastral boundary
- Case location
- Survey geometry
- Historical geometry
- Satellite
- Encumbrance/restriction information where authorized

---

# 28. Survey Officer Workflow

For a boundary/survey case:

```text
Officer Review
      ↓
Assign Verifier
      ↓
Field Visit
      ↓
GPS + Photos
      ↓
Verification Report
      ↓
Officer Review
      ↓
Geometry/Survey Decision
```

The survey officer should be able to interact with parcel geometry from the frontend where authorized.

---

# 29. Verifier Assignment

The department officer should be able to assign an existing verifier.

The assignment interface should show relevant information such as:

- Verifier
- Current workload
- Assigned area
- Availability, where supported

The assignment should be associated with the case/task.

---

# 30. Verifier Field Workflow

The verifier should receive:

- Case ID
- Parcel ID
- Parcel location
- Cadastral geometry
- Application
- Task instructions
- Relevant parcel information

The verifier should be able to:

- Navigate to the parcel
- Capture GPS
- Capture photographs
- Capture geo-tagged photographs
- Add descriptions
- Record findings
- Declare whether the request is supported, unsupported, partially verified, or unable to determine
- Submit a verification report

---

# 31. Geo-Tagged Evidence

Photographs should be stored as evidence rather than simple files.

Metadata should include, where technically available:

```json
{
  "case_id": "C182",
  "parcel_id": "P123",
  "verifier_id": "V42",
  "latitude": "...",
  "longitude": "...",
  "accuracy_m": "...",
  "captured_at": "...",
  "photo_hash": "...",
  "sequence": 1
}
```

EXIF data should not be the sole source of location evidence.

---

# 32. Verifier Findings

The verifier should not be limited to a simple True/False option.

Possible findings:

- Supported / Verified
- Not verified
- Contradicted
- Partially verified
- Unable to determine

The verifier must provide a description explaining the finding.

A declaration should confirm that the submitted findings represent the verifier's field observations.

---

# 33. Officer Review of Verification

Once the verifier submits the report, the officer receives:

- Verifier identity
- Visit date/time
- GPS status
- Number of photographs
- Findings
- Description
- Evidence
- Verification report

The officer should be able to inspect all evidence before making a decision.

---

# 34. Officer Decision

The officer should be able to:

- Approve
- Reject
- Return for further verification/review

The exact decision types should be configurable per workflow.

The officer must provide context/reason for the decision.

Examples:

```text
Approval justification
Rejection reason
Additional verification required
```

The reason should be mandatory.

---

# 35. Multi-Department Decisions

Different department tasks within the same case may reach different conclusions.

Example:

```text
Case C182
│
├── Survey Task
│     Decision: Verified
│
└── Dispute Task
      Decision: Further Review Required
```

The case-level resolution engine should determine the final case state based on the status of its departmental tasks.

One department's decision should not automatically overwrite another department's responsibility.

---

# 36. Resolution Modes

Department workflows should support different resolution modes:

- DIGITAL
- FIELD_VERIFICATION
- OFFLINE_APPOINTMENT
- HYBRID
- MANUAL_REVIEW

The appropriate mode should be determined by the configured workflow and authorized departmental process.

---

# 37. Digital Database Updates

If a requested change can legally and operationally be performed online, the authorized officer should have an editing interface.

Example:

```text
Current Value:
Kavita Deshmukhh

Proposed Value:
Kavita Deshmukh
```

The officer should not directly edit arbitrary production fields.

The flow should be:

```text
Current Value
      ↓
Proposed Value
      ↓
Permission Check
      ↓
Validation
      ↓
Approval
      ↓
Database Transaction
      ↓
History Entry
      ↓
Case Updated
```

---

# 38. Backend Authorization for Database Mutations

Frontend button visibility is not sufficient.

The backend must verify:

- Officer identity
- Department
- Workflow
- Case
- Allowed field
- Current value
- Permission to modify the field
- Validation rules

Conceptually:

```text
Frontend
   ↓
API
   ↓
Authorization
   ↓
Department
   ↓
Workflow
   ↓
Allowed Mutation
   ↓
Database
```

---

# 39. Transactional Updates

Database mutations should be transactional.

Conceptually:

```text
BEGIN TRANSACTION

1. Read current record
2. Validate permission
3. Create historical version
4. Update current record
5. Create audit event
6. Link mutation to case
7. Generate updated document if needed

COMMIT
```

If something fails:

```text
ROLLBACK
```

This prevents partial updates.

---

# 40. Historical Records Must Never Be Deleted Simply Because the Current State Changed

A core BhoomiSetu rule:

> **Never replace history with current state. Maintain both.**

For example, when a dispute is resolved:

```text
Current:
active_dispute = false
```

But history should preserve:

```text
Dispute ID
Opened date
Resolved date
Resolution
Officer
Case ID
```

---

# 41. Parcel Current State + Historical State

The parcel should conceptually contain:

```text
CURRENT STATE
├── Owner
├── Area
├── Geometry
├── Tax status
├── Dispute status
├── Encumbrance status
└── Restriction status

HISTORY
├── Ownership changes
├── Geometry changes
├── Tax events
├── Disputes
├── Encumbrances
├── Restrictions
└── Registrations
```

---

# 42. Dispute Lifecycle

Example:

```text
12 Apr 2026
Dispute opened

03 Aug 2026
Verification completed

20 Sep 2026
Dispute resolved
```

Current parcel:

```text
Active Dispute:
No
```

Historical parcel record:

```text
Past Disputes:
1

12 Apr 2026 → 20 Sep 2026
Status: Resolved
```

The historical dispute must remain available.

---

# 43. Geometry Versioning

For parcel geometry changes, preserve versions.

Example:

```text
Geometry V1
Geometry V2
Geometry V3
Geometry V4 ← Current

Proposed Geometry V5
       ↓
Case C182
       ↓
Verification
       ↓
Officer approval
       ↓
V5 becomes current
```

Do not simply overwrite the previous geometry without preserving its historical version.

---

# 44. Land Records and Registration Corrections

If a citizen requests a change to a land-record or registration field:

Example:

```text
Intent:
NAME_CORRECTION

Current:
Kavita Deshmukhh

Requested:
Kavita Deshmukh
```

The officer reviews the request.

The system determines whether the correction is:

- Digitally resolvable
- Requires document verification
- Requires an offline appointment
- Requires another workflow

---

# 45. Offline Appointment Workflow

If an authorized officer determines that the request cannot be resolved online:

```text
Officer
   ↓
Resolution mode = OFFLINE_APPOINTMENT
   ↓
Reason recorded
   ↓
Citizen notified
   ↓
Citizen books appointment
   ↓
Officer reviews original documents
   ↓
Verification completed
   ↓
Decision
   ↓
Database update if approved
```

Possible reasons:

- Original document inspection required
- Physical signature required
- Identity verification required
- Statutory procedure requires appearance
- Supporting document unavailable digitally
- Other configured reason

---

# 46. Appointment Management

An appointment should belong to the case.

Appointment fields can include:

- Case
- Citizen
- Department
- Officer
- Office/location
- Date
- Time
- Purpose
- Required documents
- Status

Possible statuses:

```text
REQUESTED
CONFIRMED
RESCHEDULED
COMPLETED
CANCELLED
NO_SHOW
```

---

# 47. Offline Document Verification

For appointment-based cases, the officer should have a checklist.

Example:

```text
☐ Original document inspected
☐ Citizen identity verified
☐ Document number verified
☐ Supporting document checked
☐ Required signatures confirmed
☐ Scan uploaded
☐ Officer remarks entered
```

The completed checklist becomes part of the case evidence.

---

# 48. Verifier Workflow Should Be Offline-First

Field verifiers may lose network connectivity.

The verifier application should support:

```text
Download assigned case
      ↓
Offline case package
      ↓
Navigate to parcel
      ↓
Capture GPS
      ↓
Capture photos
      ↓
Write findings
      ↓
Submit locally
      ↓
Network returns
      ↓
Synchronize
```

The offline package should include the information necessary to perform the field task.

Evidence uploads should be resumable.

Example states:

```text
PENDING
UPLOADING
UPLOADED
FAILED
```

---

# 49. Decision Documents

The backend should generate a final decision document after the officer makes the decision.

Possible document set:

```text
Case
├── Citizen Application.pdf
├── Verification Report.pdf
└── Officer Decision Order.pdf
```

The decision document should contain:

- Case ID
- Parcel
- Citizen
- Application summary
- Verification findings
- Evidence references
- Officer decision
- Decision reason
- Department
- Date
- Authorized officer information
- Digital signature/verification mechanism where supported

---

# 50. Citizen Notification After Resolution

The citizen should receive the result in understandable form.

Example:

```text
CASE RESOLVED

Your land record has been updated.

Changed:
Owner Name

Previous:
Kavita Deshmukhh

Updated:
Kavita Deshmukh

Effective date:
20 Sep 2026

Updated through:
Case BHO-2026-00182

[View Updated Land Record]
```

The exact information displayed should respect citizen authorization and privacy.

---

# 51. Citizen Feedback

After the case/department decision is complete, the citizen should be asked to provide feedback.

Feedback can include:

- Officer rating
- Overall case rating
- Optional comments
- Structured reasons

Possible feedback categories:

- Response time
- Officer communication
- Resolution clarity
- Field verification
- Overall experience
- Other

---

# 52. Feedback for Multiple Officers

If multiple officers/verifiers were involved, feedback can be associated with the specific officer involved in the relevant task.

For example:

```text
Survey Officer
Rating: 4/5

Dispute Officer
Rating: 5/5

Field Verifier
Rating: 3/5

Overall Case
Rating: 4/5
```

This enables meaningful officer-level monitoring.

---

# 53. Admin Officer Performance Monitoring

Admin should be able to see:

- Cases handled
- Cases resolved
- SLA compliance
- Average resolution time
- Cases overdue
- Cases returned
- Escalations
- Citizen feedback
- Average rating
- Feedback count
- Performance alerts

Example:

| Officer | Department | Cases | SLA | Avg. Time | Rating | Feedback | Alerts |
|---|---|---:|---:|---:|---:|---:|---:|
| Officer A | Survey | 42 | 94% | 28h | 4.6 | 31 | 0 |
| Officer B | Dispute | 37 | 82% | 51h | 3.4 | 25 | 1 |
| Officer C | Tax | 58 | 97% | 19h | 4.8 | 47 | 0 |

The values above are illustrative only.

---

# 54. Officer Performance Alerts

A low rating should not automatically conclude that an officer is failing.

Instead:

```text
Low rating
    +
Minimum feedback count
    +
Configured threshold
    ↓
Admin Alert
    ↓
Admin Review
```

Thresholds should be configurable by Admin.

Possible configuration:

```text
Minimum rating threshold: [configured value]
Minimum feedback count: [configured value]
SLA warning threshold: [configured value]
SLA breach threshold: [configured value]
```

The system should flag a review condition rather than make an unsupported judgment about the officer.

---

# 55. Performance Should Use Multiple Signals

Officer monitoring should consider:

- Citizen rating
- Feedback count
- SLA compliance
- Average resolution time
- Cases assigned
- Cases resolved
- Overdue cases
- Return/rework rate
- Escalations

This provides more context than a rating alone.

---

# 56. SLA Architecture

SLA should belong to the relevant workflow/task rather than only the department.

For example:

```text
Survey
 ├── Boundary Verification → SLA A
 └── Geometry Correction → SLA B

Land Records
 ├── Name Correction → SLA C
 └── Ownership Change → SLA D
```

A multi-department case can show:

```text
Overall Case SLA
      ↓
Survey Task → time remaining
Dispute Task → time remaining
```

SLA rules should be configurable.

---

# 57. Case Timeline

Every significant case action should be recorded.

Examples:

```text
CASE_CREATED
APPLICATION_GENERATED
APPLICATION_CONFIRMED
ROUTED_TO_DEPARTMENT
OFFICER_ASSIGNED
VERIFIER_ASSIGNED
FIELD_VISIT_STARTED
GPS_CAPTURED
PHOTO_CAPTURED
VERIFICATION_SUBMITTED
OFFICER_REVIEW_STARTED
APPOINTMENT_CREATED
APPOINTMENT_COMPLETED
DATABASE_UPDATED
DECISION_APPROVED
DECISION_REJECTED
CASE_CLOSED
FEEDBACK_SUBMITTED
```

Each event should retain:

- Who
- When
- What happened
- Previous state
- New state
- Case ID
- Task ID where applicable

---

# 58. Database Mutation Audit Trail

Every authorized database change must be linked to its case.

Example:

```text
changed_by
changed_at
case_id
task_id
reason
previous_value
new_value
decision_id
```

For geometry:

```text
previous_geometry_version
new_geometry_version
verification_id
decision_id
case_id
```

For dispute resolution:

```text
dispute_id
resolved_by
resolved_at
resolution_reason
case_id
```

---

# 59. Recommended Core Domain Model

Conceptually:

```text
Citizen
   │
   └── Case
        │
        ├── Parcel
        ├── Application
        ├── AIAnalysis
        ├── RoutingDecision
        ├── DepartmentTask[]
        │       │
        │       ├── Officer
        │       ├── Workflow
        │       ├── SLA
        │       ├── VerifierAssignment
        │       ├── VerificationReport
        │       │       ├── GPS
        │       │       ├── Photos[]
        │       │       ├── Findings
        │       │       └── Description
        │       └── DepartmentDecision
        │
        ├── Appointment[]
        ├── Evidence[]
        ├── Timeline[]
        ├── DecisionDocument
        └── Feedback[]
```

---

# 60. Department Capability Matrix

Every department should have an explicit capability configuration.

Example:

| Capability | Survey | Tax | Land Records | Registration | Dispute |
|---|---:|---:|---:|---:|---:|
| View Parcel | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parcel 360° | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Application | ✓ | ✓ | ✓ | ✓ | ✓ |
| Assign Verifier | ✓ | Configurable | Configurable | Configurable | ✓ |
| Geo Photos | ✓ | No | No | No | Configurable |
| Edit Geometry | ✓ | No | No | No | Configurable |
| Edit Tax Data | No | ✓ | No | No | No |
| Edit Land Record | No | No | ✓ | Configurable | No |
| Digital Document Update | No | Configurable | ✓ | ✓ | No |
| Appointment | Configurable | Configurable | ✓ | ✓ | ✓ |
| Field Verification | ✓ | Configurable | Configurable | Configurable | ✓ |
| Decision | ✓ | ✓ | ✓ | ✓ | ✓ |

The actual authorization matrix must be configured according to the department's real authority.

---

# 61. Workflow Configuration Model

A workflow definition can conceptually look like:

```json
{
  "workflow": "SURVEY_BOUNDARY_VERIFICATION",
  "department": "SURVEY",
  "stages": [
    {
      "id": "officer_review",
      "type": "REVIEW"
    },
    {
      "id": "assign_verifier",
      "type": "ASSIGN_VERIFIER"
    },
    {
      "id": "field_visit",
      "type": "FIELD_VERIFICATION"
    },
    {
      "id": "evidence_review",
      "type": "EVIDENCE_REVIEW"
    },
    {
      "id": "decision",
      "type": "DECISION"
    }
  ]
}
```

Another workflow can define a completely different sequence.

---

# 62. Frontend Architecture

The frontend should use a common officer shell rather than separate independent applications for every department.

Common navigation:

- Dashboard
- My Cases
- Tasks
- SLA
- Notifications
- Performance

The case page should render department-specific components based on workflow capabilities.

Avoid hard-coding large amounts of department-specific logic in the frontend.

Instead, the backend should return the current workflow and permitted capabilities.

Example:

```json
{
  "caseId": "BHO-2026-00182",
  "department": "SURVEY",
  "workflow": {
    "type": "FIELD_VERIFICATION"
  },
  "capabilities": [
    "PARCEL_360",
    "GEOMETRY_VIEW",
    "ASSIGN_VERIFIER",
    "GEO_PHOTO",
    "EDIT_GEOMETRY"
  ]
}
```

The frontend renders the appropriate interface from this configuration.

---

# 63. Security and Authorization

Authorization must be enforced server-side.

Do not rely on simply hiding UI controls.

For every database mutation, the backend should check:

```text
Who is the user?
What department are they in?
What case are they working on?
What workflow is active?
What field are they trying to change?
Is that field editable in this workflow?
Does the user have permission?
Is the current record version valid?
```

---

# 64. Current State vs History

This should be a foundational BhoomiSetu principle:

> **Maintain current state for operational use and historical state for governance, audit, and transparency.**

Examples:

### Dispute

```text
Current:
No Active Dispute

History:
Dispute opened → Dispute resolved
```

### Owner Name

```text
Current:
Kavita Deshmukh

History:
Previous value
New value
Officer
Case
Date
Reason
```

### Geometry

```text
Current:
Geometry V5

History:
V1
V2
V3
V4
V5
```

---

# 65. Citizen Case Experience

The citizen should see a simple representation of a complicated internal process.

Example:

```text
MY CASE

BHO-2026-00182

Boundary Issue
Parcel ULPIN0000538819

Application submitted ✓
Survey officer assigned ✓
Field verification ✓
Officer review ●

Latest update:
Field verification completed.
The submitted evidence is under review.

SLA:
18 hours remaining
```

The citizen should not need to understand internal entities such as DepartmentTask, VerificationEvidence, RoutingRule, or database authorization.

---

# 66. Overall BhoomiSetu Architecture

```text
                    CITIZEN
                       │
                       ▼
                 AI ASSISTANT
                       │
                       ▼
              STRUCTURED ISSUE
                       │
                       ▼
             APPLICATION DRAFT
                       │
                       ▼
              CITIZEN CONFIRMS
                       │
                       ▼
                     CASE
                       │
                       ▼
               ROUTING ENGINE
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     SURVEY           TAX        LAND RECORDS
        │              │              │
    WORKFLOW        WORKFLOW       WORKFLOW
        │              │              │
        └──────────────┼──────────────┘
                       │
                 OTHER DEPARTMENTS
                       │
                       ▼
              DEPARTMENT OFFICER
                       │
                       ▼
            VERIFICATION / REVIEW
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       DIGITAL ACTION       FIELD/OFFLINE
             │                   │
             │              VERIFIER /
             │              APPOINTMENT
             │                   │
             └─────────┬─────────┘
                       ▼
                    DECISION
                       │
                       ▼
               AUTHORIZED UPDATE
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       CURRENT STATE          HISTORY
             │                   │
             └─────────┬─────────┘
                       ▼
                DECISION DOCUMENT
                       │
                       ▼
                    CITIZEN
                       │
                       ▼
                    FEEDBACK
                       │
                       ▼
                     ADMIN
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Ratings        SLA          Audit
          │
          ▼
     Alert Engine
          │
          ▼
     Admin Review
```

---

# 67. Recommended Core Invariants

These should become explicit system requirements.

### Invariant 1
A parcel may have multiple active citizen cases, but there must not be two active duplicate requests for the same issue on the same parcel.

### Invariant 2
A citizen must confirm the final AI-generated application before submission.

### Invariant 3
AI-generated claims must not be treated as verified facts unless supported by authoritative records or verified evidence.

### Invariant 4
A citizen case may contain multiple department tasks.

### Invariant 5
Each department task may use a different workflow.

### Invariant 6
Only authorized workflows can mutate specific database fields.

### Invariant 7
Database mutations must preserve historical state.

### Invariant 8
Every material database change must be linked to a case/decision and audit event.

### Invariant 9
Field verification evidence must remain associated with the verifier, case, parcel, timestamp, and available geo-location metadata.

### Invariant 10
Officer decisions must contain a reason/context.

### Invariant 11
Citizen feedback must be associated with the relevant case and officer/task where applicable.

### Invariant 12
Low-performance signals should trigger configurable Admin review alerts rather than automatic unsupported conclusions.

---

# 68. Target Citizen Experience

The citizen should ultimately experience BhoomiSetu as:

> **My land → Tell BhoomiSetu what is wrong → Review the application → Submit once → Track one case → Receive the decision → See what changed → Give feedback.**

The citizen should not need to understand the departmental routing.

---

# 69. Target Officer Experience

The officer should experience:

> **My cases → See application + parcel immediately → Open 360° view → Execute my department's workflow → Assign verifier/appointment when required → Review evidence → Make documented decision → Apply authorized database change → Close task.**

---

# 70. Target Verifier Experience

The verifier should experience:

> **Assigned field visit → Offline case information → Navigate to parcel → Capture GPS and photographs → Record findings → Submit report → Synchronize.**

---

# 71. Target Admin Experience

The Admin should experience:

> **Monitor cases → Monitor SLA → Monitor officer workload → Review citizen feedback → Receive performance alerts → Inspect audit trail → Monitor database changes → Manage workflow configuration.**

---

# 72. Final Product Definition

BhoomiSetu should not be treated as a collection of:

- Citizen pages
- Four request forms
- Department dashboards
- A chatbot
- A map
- A database

Instead, it should be implemented as one integrated system:

> **A parcel-centric, AI-assisted, case-based land governance platform with configurable departmental workflows, field/offline verification, authorized record mutation, historical land-state preservation, SLA monitoring, citizen feedback, and administrative oversight.**

The core abstraction is:

```text
PARCEL
   +
CITIZEN ISSUE
   +
AI UNDERSTANDING
   +
CONFIRMED APPLICATION
   +
CASE
   +
DEPARTMENT WORKFLOWS
   +
VERIFICATION
   +
DECISION
   +
AUTHORIZED DATA UPDATE
   +
HISTORY
   +
FEEDBACK
```

This should become the foundation for the next major BhoomiSetu implementation phase.
