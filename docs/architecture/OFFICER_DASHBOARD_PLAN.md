# BhoomiSetu — Officer Dashboard Plan

## Overview

This plan defines **role-specific dashboards and navigation** for all 8 officer roles + Admin, based on the workflows documented in `docs/bhoomisetu_officer_roles.md`. Currently, all officers see identical tabs; this plan assigns each role only the tabs/widgets relevant to their department.

---

## 1. Officer Role → Department Mapping

| Officer Role | Department Code | Real-World Equivalent |
|---|---|---|
| `LAND_RECORD_OFFICER` | `LAND_RECORDS` | Talathi / Tehsildar (RoR, 7/12, mutation) |
| `REGISTRATION_OFFICER` | `REGISTRATION` | Sub-Registrar (IGR) |
| `PLANNING_OFFICER` | `PLANNING` | Town Planning / Master Plan authority |
| `TAX_OFFICER` | `TAX` | Revenue/Municipal tax dept |
| `RESTRICTION_OFFICER` | `RESTRICTION` | Collector's office (ceiling, forest, govt land) |
| `ENCUMBRANCE_OFFICER` | `ENCUMBRANCE` | Sub-Registrar's encumbrance wing |
| `DISPUTE_OFFICER` | `DISPUTE` | Tehsildar's Revenue Court |
| `SURVEY_OFFICER` | `SURVEY` | District Survey Office / Survey & Settlement |
| `ADMIN` | (All) | System Administrator |

---

## 2. Navigation Tabs per Officer Role

### Base Tabs (All Officers)
| Tab | Path | Purpose |
|---|---|---|
| **Dashboard** | `/officer` | Role-specific overview with department widgets |
| **Assigned Requests** | `/officer/requests` | Workflow steps assigned to this officer's department |
| **Profile** | `/officer/profile` | Account settings, password, preferences |

### Department-Specific Tabs

| Officer Role | Additional Tabs |
|---|---|
| **Land Record Officer** | Documents (merged into Assigned Requests) |
| **Registration Officer** | Duplicate Registry (`/officer/duplicate-registry`) — review flagged duplicate/conflicting registrations, Registration Chain (`/officer/registration-chain`) — full registration history per parcel |
| **Planning Officer** | Map (`/officer/map`) — zoning overlay review |
| **Tax Officer** | Reassessment Queue (`/officer/reassessment-queue`) — mutation-triggered reassessments, Tax Analytics (`/officer/tax-analytics`) — collection rates, overdue trends, demand vs. collected |
| **Restriction Officer** | Governance Alerts (`/officer/alerts`) — restriction-related alerts |
| **Encumbrance Officer** | Fraud Prevention (`/officer/fraud-prevention`) — parcels with disputes/restrictions used for loans, Certificate Generator (`/officer/certificate-generator`) — issue encumbrance certificates (PDF) |
| **Dispute Officer** | Governance Alerts (`/officer/alerts`) — dispute-related alerts, Historical Imagery (`/officer/historical-imagery`) — evidence review |
| **Survey Officer** | Map (`/officer/map`) — field measurement overlay, Change Detection (`/officer/change-detection`) — geometry change flags, Documents (`/officer/documents`) — field evidence upload |

### Tab Access Matrix

| Tab | Land Record | Registration | Planning | Tax | Restriction | Encumbrance | Dispute | Survey | Admin |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assigned Requests | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Governance Alerts | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Historical Imagery | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Change Detection | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Map | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Documents | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Duplicate Registry** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Registration Chain** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Reassessment Queue** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Tax Analytics** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Fraud Prevention** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Certificate Generator** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

**Notes:**
- **Governance Alerts**: Only departments with alert types mapped in backend (`governance_alerts_service.py:_ALERT_TYPE_DEPARTMENT`) get this tab — currently `LAND_RECORDS`, `RESTRICTION`, `TAX`, `DISPUTE`. Adding `SURVEY` since change detection triggers survey requests.
- **Map**: Planning (zoning review) and Survey (field measurement overlay) need map access.
- **Change Detection**: Survey Officer reviews geometry change flags from satellite/Drone imagery.
- **Historical Imagery**: Dispute Officer reviews temporal evidence; Survey Officer verifies historical boundaries.
- **Documents**: Survey Officer uploads field evidence (GPS logs, photos, sketches).
- **Duplicate Registry**: Registration Officer reviews system-flagged duplicate/conflicting registrations on same survey number (per officer roles doc: "automatic duplicate-registration flagging").
- **Registration Chain**: Full registration history per parcel — supports Registration Officer's job of "linking registered documents to the RoR update chain."
- **Reassessment Queue**: Tax Officer handles mutation-triggered reassessments (per officer roles doc: "reassessment requests after mutation" — "auto-triggered when Land Record Officer approves a mutation").
- **Tax Analytics**: Collection rates, overdue trends, demand vs. collected — for Revenue/Municipal tax dept oversight.
- **Fraud Prevention**: Encumbrance Officer sees parcels under dispute/restriction being used for new loan applications (per officer roles doc: "preventing exactly the kind of fraud — mortgaging disputed/restricted land").
- **Certificate Generator**: Issues encumbrance certificates (PDF) — core Encumbrance Officer workflow ("issues the encumbrance certificate (PDF) or updates the encumbrance ledger").

---

## 3. Dashboard Widgets per Role

Each dashboard shows:
1. **Header** — Officer name, role badge, department label
2. **Department-Specific Widget** — "What needs my attention" list from mock department API
3. **Workflow Queue** — Pending workflow steps assigned to this department
4. **Stats Cards** — Role-relevant metrics

### Widget Configuration by Department

| Department | Widget Endpoint | Widget Title (i18n key) | Columns |
|---|---|---|---|
| `LAND_RECORDS` | (via workflow queue) | — | — |
| `REGISTRATION` | `/registration/pending` | `officerDashboard.pendingRegistrationsHeading` | Parcel ID, Transaction Type, Date |
| `PLANNING` | `/planning/pending-permissions` | `officerDashboard.pendingPermissionsHeading` | Parcel ID, Land Use, Zoning |
| `TAX` | `/tax/overdue` | `officerDashboard.overdueTaxHeading` | Parcel ID, Outstanding Amount, Last Payment |
| `RESTRICTION` | (via workflow queue) | — | — |
| `ENCUMBRANCE` | (via workflow queue) | — | — |
| `DISPUTE` | (via workflow queue) | — | — |
| `SURVEY` | `/survey/pending` | **NEW:** `officerDashboard.pendingSurveysHeading` | Parcel ID, Survey Type, Status, Date |

### Stats Cards per Role

| Role | Card 1 | Card 2 | Card 3 | Card 4 |
|---|---|---|---|---|
| **Land Record** | Pending Mutations | Approved Today | Total Decided | Within SLA |
| **Registration** | Pending Registrations | Duplicate Flags | Approved Today | Total Decided |
| **Planning** | Pending Permissions | Zoning Conflicts | Approved Today | Total Decided |
| **Tax** | Overdue Parcels | Reassessments Pending | Collected Today | Within SLA |
| **Restriction** | Flag Change Requests | Active Restrictions | Reviewed Today | Blocks Triggered |
| **Encumbrance** | Pending Certificates | New Mortgages | Fraud Prevented | Total Decided |
| **Dispute** | Active Disputes | Escalated to Collector | Resolved Today | Evidence Complete |
| **Survey** | Pending Surveys | In-Progress Fieldwork | Completed Today | Geometry Updated |

---

## 4. Assigned Requests Page — Workflow Step Filtering

Already implemented: `AssignedRequestsPage` receives `department` prop and filters workflow steps by `ROLE_DEPARTMENT`. No changes needed.

**Additional enhancement**: Show department-specific column hints:
- **Land Record**: Show OCR match % column
- **Registration**: Show "Duplicate Flag" badge
- **Planning**: Show "Zoning Conflict" badge (red if mismatch)
- **Tax**: Show "Auto-Reassessment Triggered" indicator
- **Restriction**: Show "Blocks Transfer" warning icon
- **Encumbrance**: Show "Dispute/Restriction Check" status
- **Dispute**: Show "Evidence Chain Complete" badge
- **Survey**: Show "Area Delta" and "Geometry Updated" columns

---

## 5. Admin Portal — Rights & Pages

### Current Admin Pages (Keep All)
| Page | Path | Purpose |
|---|---|---|
| Dashboard | `/admin` | System overview, top-risk parcels |
| Departments | `/admin/departments` | CRUD department directory |
| System Monitoring | `/admin/system-monitoring` | Health, activity log |
| Workflows | `/admin/workflows` | Cross-department oversight, "Alert Officer" / "Decide Myself" / "Send Back" |
| Map Layers | `/admin/map-layers` | Zoning, restriction, infrastructure, admin notes authoring |
| Officer Monitoring | `/admin/officer-monitoring` | Queue sizes, decision rates, avg time |
| Profile | `/admin/profile` | Account settings |

### New Admin Capabilities for 8th Role

1. **Departments Page** — Already supports arbitrary department codes; `SURVEY` will appear automatically once seeded.

2. **Workflows Oversight** — `DEPARTMENTS` constant in `AdminWorkflowOversightPage.tsx` already updated to include `SURVEY`.

3. **Officer Monitoring** — Query groups by role; `SURVEY_OFFICER` will appear automatically.

4. **New: Role Permission Matrix** (Future) — Admin UI to toggle tab/widget visibility per role without code changes.

---

## 6. Implementation Tasks

### Phase 1: Navigation & Routing (OfficerPortal.tsx)
- [x] Make tab rendering conditional on `user.role`
- [x] Add `SURVEY` to `DEPARTMENT_HAS_ALERTS` (for Governance Alerts tab)
- [x] Create role → allowedTabs mapping
- [x] Add routes for new tabs: `/duplicate-registry`, `/registration-chain`, `/reassessment-queue`, `/tax-analytics`, `/fraud-prevention`, `/certificate-generator`, `/documents`

### Phase 2: Dashboard Widgets (OfficerDashboardPage.tsx)
- [x] Add `SURVEY` to `DEPARTMENT_WIDGETS` with `/survey/pending` endpoint
- [x] Add Survey stats cards (pending, in-progress, completed, geometry-updated)
- [x] Add i18n keys for Survey widget headings/empty states
- [x] Add Registration stats cards (duplicate flags)
- [x] Add Tax stats cards (reassessments pending, collection rate)
- [x] Add Encumbrance stats cards (fraud prevented, certificates issued)

### Phase 3: Assigned Requests Enhancements
- [ ] Add department-specific column renderers (OCR match %, zoning conflict, area delta, etc.)

### Phase 4: Survey Officer Pages
- [x] Verify `/officer/map` works for Survey (field measurement overlay)
- [x] Verify `/officer/change-detection` shows geometry change flags
- [x] Add `/officer/documents` route for field evidence upload (reuse Verifier capture form pattern)

### Phase 5: Registration Officer Pages
- [x] Create `DuplicateRegistryPage` — list flagged duplicates from registration mock data
- [x] Create `RegistrationChainPage` — show full registration history per parcel

### Phase 6: Tax Officer Pages
- [x] Create `ReassessmentQueuePage` — mutation-triggered reassessments (link to Land Record mutations)
- [x] Create `TaxAnalyticsPage` — charts for collection rates, overdue trends, demand vs collected

### Phase 7: Encumbrance Officer Pages
- [x] Create `FraudPreventionPage` — cross-reference encumbrance requests with dispute/restriction records
- [x] Create `CertificateGeneratorPage` — PDF generation for encumbrance certificates

### Phase 8: i18n Keys
- [ ] Add Survey widget keys to `en.json` and `hi.json`
- [ ] Add Survey stats card keys
- [ ] Add Survey-specific column header keys
- [ ] Add Registration/Tax/Encumbrance new tab keys to `en.json` and `hi.json`

### Phase 9: Backend Verification
- [ ] Verify `GET /survey/pending` endpoint returns data (seeded)
- [ ] Verify `GET /survey/:parcelId` works
- [ ] Verify SurveyRecord model fields match frontend expectations
- [ ] Add backend endpoints for duplicate registry, registration chain, reassessment queue, tax analytics, fraud prevention, certificate generator

### Phase 10: Complete Migration to Bhashini Static Translations
- [ ] Remove all `useTranslation` / `t()` calls from officer pages
- [ ] Replace with `useLanguage` context fetching from `/api/v1/multilingual/ui-text/{lang}`
- [ ] Update `backend-py/static/ui_strings_en.json` with all officer dashboard keys
- [ ] Run `python scripts/batch_translate_ui.py` to generate all 11 language files
- [ ] Verify LanguageContext loads correct language file on login/language change
- [ ] Remove react-i18next dependency if no longer used anywhere

---

## 7. i18n Keys to Add (English)

```json
"officerDashboard": {
  "pendingSurveysHeading": "Pending Surveys",
  "pendingSurveysEmpty": "No pending survey measurements",
  "tableColSurveyType": "Survey Type",
  "tableColSurveyStatus": "Status",
  "tableColMeasuredArea": "Measured Area (sq m)",
  "tableColAreaDelta": "Area Delta",
  "tableColGeometryUpdated": "Geometry Updated",
  "tableColSurveyDate": "Survey Date",
  "surveyStatsPending": "Pending Surveys",
  "surveyStatsInProgress": "In-Progress Fieldwork",
  "surveyStatsCompleted": "Completed Today",
  "surveyStatsGeometryUpdated": "Geometry Updated"
},
"officerNav": {
  "duplicateRegistry": "Duplicate Registry",
  "registrationChain": "Registration Chain",
  "reassessmentQueue": "Reassessment Queue",
  "taxAnalytics": "Tax Analytics",
  "fraudPrevention": "Fraud Prevention",
  "certificateGenerator": "Certificate Generator"
},
"officerDashboard": {
  "duplicateRegistryHeading": "Duplicate Registrations",
  "duplicateRegistryEmpty": "No duplicate registrations flagged",
  "registrationChainHeading": "Registration Chain",
  "reassessmentQueueHeading": "Pending Reassessments",
  "reassessmentQueueEmpty": "No reassessments pending",
  "taxAnalyticsHeading": "Tax Analytics",
  "fraudPreventionHeading": "Fraud Prevention Dashboard",
  "certificateGeneratorHeading": "Encumbrance Certificate Generator",
  "tableColDuplicateFlag": "Duplicate Flag",
  "tableColOriginalReg": "Original Registration",
  "tableColConflictingReg": "Conflicting Registration",
  "tableColChainStep": "Chain Step",
  "tableColRegDate": "Registration Date",
  "tableColReassessmentReason": "Reassessment Reason",
  "tableColMutationRef": "Mutation Reference",
  "tableColFraudRisk": "Fraud Risk Level",
  "tableColDisputeStatus": "Dispute Status",
  "tableColRestrictionStatus": "Restriction Status",
  "tableColCertificateNo": "Certificate Number",
  "tableColIssueDate": "Issue Date",
  "tableColValidity": "Validity",
  "registrationStatsDuplicateFlags": "Duplicate Flags",
  "taxStatsReassessmentsPending": "Reassessments Pending",
  "taxStatsCollectionRate": "Collection Rate",
  "encumbranceStatsFraudPrevented": "Fraud Prevented",
  "encumbranceStatsCertificatesIssued": "Certificates Issued"
}
```

---

## 8. Summary: What Each Officer Sees

| Role | Tabs (Count) | Key Differentiator |
|---|---|---|
| **Land Record** | 4 | OCR match % in queue, mutation-focused stats |
| **Registration** | 6 | Duplicate Registry, Registration Chain, duplicate flags widget |
| **Planning** | 5 | Zoning conflict overlay on Map tab |
| **Tax** | 6 | Reassessment Queue, Tax Analytics, overdue tax widget |
| **Restriction** | 5 | Restriction flags block transfers, Governance Alerts |
| **Encumbrance** | 6 | Fraud Prevention, Certificate Generator, fraud prevented stats |
| **Dispute** | 6 | Evidence chain, Historical Imagery, Governance Alerts |
| **Survey** | 7 | Field measurement, Change Detection, Map overlay, Documents |
| **Admin** | 13 | Full oversight, all departments, system config |

---

*Plan created: 2026-09-19*
*Source: `docs/bhoomisetu_officer_roles.md`, `frontend/src/pages/OfficerPortal.tsx`, `frontend/src/pages/officer/OfficerDashboardPage.tsx`, `backend-py/app/auth/roles.py`*

---

## 9. Implementation Progress Summary (2026-09-19)

### ✅ Completed (Phases 1-7)

**Phase 1: Navigation & Routing**
- OfficerPortal.tsx: Added all 7 new routes (duplicate-registry, registration-chain, reassessment-queue, tax-analytics, fraud-prevention, certificate-generator, documents)
- DEPARTMENT_HAS_ALERTS updated with SURVEY department
- Role-based tab routing structure in place

**Phase 2: Dashboard Widgets**
- OfficerDashboardPage.tsx: Added SURVEY to DEPARTMENT_WIDGETS with `/survey/pending` endpoint and 7 columns (Parcel ID, Survey Type, Status, Measured Area, Area Delta, Geometry Updated, Survey Date)
- Department-specific stats cards for all 8 roles implemented via departmentStats object
- Icons added: MapPin, Upload, Radio for survey-specific metrics

**Phase 4: Survey Officer Pages**
- DocumentsPage.tsx: Complete field evidence upload with modal, GPS coordinates, document types (FIELD_SKETCH, GPS_LOG, PHOTO_EVIDENCE, MEASUREMENT_SHEET, BOUNDARY_MARKER, OTHER), verification workflow
- Map & Change Detection pages already existed and functional

**Phase 5: Registration Officer Pages**
- DuplicateRegistryPage.tsx: Flagged duplicates table with risk scoring, duplicate flag types (EXACT_MATCH, OVERLAPPING_BOUNDARY, SAME_OWNER_MULTIPLE, SUSPECTED_FRAUD), status workflow
- RegistrationChainPage.tsx: Full registration history per parcel grouped by chain step, transaction types, mutation linking

**Phase 6: Tax Officer Pages**
- ReassessmentQueuePage.tsx: Mutation-triggered reassessments with reason codes, difference calculations, summary cards
- TaxAnalyticsPage.tsx: KPI cards, collection trend chart (bar), collection by category progress bars, top overdue parcels table, reassessment summary

**Phase 7: Encumbrance Officer Pages**
- FraudPreventionPage.tsx: Cross-referencing encumbrance requests with disputes/restrictions, risk levels (CRITICAL/HIGH/MEDIUM/LOW), summary cards
- CertificateGeneratorPage.tsx: Two-tab interface (Generate/Issued), certificate requests management, PDF download/view, encumbrance listing per certificate

### 🔄 In Progress / Pending

**Phase 3: Assigned Requests Enhancements** — Department-specific column renderers not yet implemented

**Phase 8: i18n Keys** — All new keys need to be added to en.json and hi.json (see §7 for complete list)

**Phase 9: Backend Verification** — Mock data endpoints need backend implementation

**Phase 10: Bhashini Migration** — Full translation system migration pending

### Files Created/Modified

**New Files (7):**
- `frontend/src/pages/officer/DuplicateRegistryPage.tsx`
- `frontend/src/pages/officer/RegistrationChainPage.tsx`
- `frontend/src/pages/officer/ReassessmentQueuePage.tsx`
- `frontend/src/pages/officer/TaxAnalyticsPage.tsx`
- `frontend/src/pages/officer/FraudPreventionPage.tsx`
- `frontend/src/pages/officer/CertificateGeneratorPage.tsx`
- `frontend/src/pages/officer/DocumentsPage.tsx`

**Modified Files (2):**
- `frontend/src/pages/OfficerPortal.tsx` — Added 7 new route imports and Route entries
- `frontend/src/pages/officer/OfficerDashboardPage.tsx` — Added SURVEY widget config, department stats for all 8 roles, new lucide icons