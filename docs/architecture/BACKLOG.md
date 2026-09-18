# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## Priority order (as of 2026-09-17)

All items re-ranked flat — blocked/deferred items included but marked. Items #1, #3, #4, #5, #8, #12, #13 are done/substantially implemented. Item #14 has core renderer done but critical end-to-end gaps.

1. **Frontend test infrastructure** — HistoricalImageryPanel.test.tsx ✅ DONE (8/8 passing). Remaining: ~184 failing tests need React Query mocks, MSW handlers, component test setup pattern migration (actionable, internal)
2. **Finish Unified Map migration** — Migrate HistoricalMapView, AdminCombinedLayerMap, AdminMapLayerAuthoringPage, Verifier AssignedVisitsPage to UnifiedMapWrapper (actionable, internal)
3. **Backend test DB migration** — ✅ DONE (2026-09-17) Applied governance_rules migration + seeded 8 default rules. 3 tests passing.
4. **OCR binary** — Install Tesseract on dev machine (5 workflow tests fail on TesseractNotFoundError) (actionable, internal)
5. **#6 Address-based fuzzy parcel search** — Deferred (no street/locality fields on Parcel); revisit if concrete need emerges
6. **#2 OAuth login** — Blocked (needs external provider registration by deploying party)
7. **#17 QR code per parcel** — Low priority, unconfirmed ask
8. **#18 General SMS outreach channel** — Low priority, unconfirmed ask
9. **#20 Penalty for intentional false claims** — Low priority, unconfirmed ask
10. **#21 Notify owner when parcel viewed** — Low priority, unconfirmed ask
11. **#22 Duplicate/fraud cross-check on complaints** — Low priority, unconfirmed ask
12. **#23 Offline field verification with sync** — ✅ DONE (2026-09-17) Verifier role check + field evidence workflow implemented
13. **#24 Onboarding tutorial tooltips** — Low priority, unconfirmed ask

---

## 1. Admin session/timeout & token revocation

**Status: done (2026-09-17).** 

- ✅ `POST /api/v1/users/{id}/revoke-sessions` — admin can revoke a specific user's sessions by bumping `token_version` (audit-logged, self-revoke blocked)
- ✅ `User.last_activity_at` column + `LastActivityMiddleware` — updated on each authenticated request
- ✅ `idle_timeout_minutes` config + enforcement in `get_current_user()` — when > 0, reject tokens where `last_activity_at` is older than the threshold even if `token_version` matches

JWTs never expire by design (session only ends on explicit logout or admin revoke). The idle timeout adds an *additional* expiration condition without changing the no-auto-expiry UX.

*Source: `docs/archive/ADMIN_PANEL_ISSUES.md` (the one item-9 sub-item never picked up).*

## 2. OAuth-based login (Google/etc.) as an additional method

**Status: blocked — needs external provider registration.** Email/mobile+password is the only login path today. Adding OAuth needs a real app registered with a provider (client ID/secret, redirect URIs), which isn't something that can be scoped or built without that account access. No code work possible until deploying party provides credentials.

*Source: `docs/archive/FEATURE_AUDIT.md` §6/§8 item 15, `docs/architecture/SYSTEM_ARCHITECTURE.md` §9.3.*

## 3. Workflow Configuration (admin-editable review pipelines)

**Status: done (2026-09-17).**

- ✅ `WorkflowPipelineConfig` table (migration `8771cd30e6b0`) — workflow_type (unique), stages_json (JSON array), is_active, created_at/updated_at
- ✅ `pipeline_config_service.py` — CRUD operations + `get_pipeline_stages_for_workflow_type()` that reads from DB with hardcoded fallback
- ✅ Admin API at `/api/v1/admin/workflow-pipelines` — GET (list), POST (create), PATCH (update), DELETE (remove) — all audit-logged
- ✅ `workflows_service.py` updated — `_pipeline_for(db, workflow_type)` now calls `pipeline_config_service.get_pipeline_stages_for_workflow_type()`
- ✅ Hardcoded defaults preserved as fallback when no DB config exists
- ✅ Tests: 12 pipeline config tests + existing workflow tests updated for fallback behavior

*Source: `docs/archive/FRONTEND_UPGRADE_SPEC.md` §7.*

## 4. Governance Rules (admin-editable alert conditions)

**Status: done (2026-09-17).** Full CRUD for governance rules with live rule evaluation.

- ✅ `GovernanceRule` table (migration `a1b2c3d4e5f6`) — alert_type, name, description, condition_config (JSON), default_severity, explanation_template, is_active, department, created_at/updated_at
- ✅ `governance_rules_service.py` — CRUD operations + `evaluate_rules_for_parcel()` that reads live from DB with seeded fallback
- ✅ Admin API at `/api/v1/admin/governance-rules` — GET (list with filters), POST (create), PATCH (update), DELETE (remove) — all audit-logged
- ✅ Refactored 3 services: `change_detection.py`, `historical_imagery.py`, `governance_alerts_service.py` — all now call `governance_rules_service.evaluate_rules_for_parcel()` instead of hardcoded logic
- ✅ Seeded 5 default rules: RESTRICTION_DETECTED, UNAUTHORIZED_CHANGE, TAX_OVERDUE, FLOOD_ZONE_OVERLAP, ENCROACHMENT_RISK
- ✅ Tests: 19 governance tests pass (filtering, 4-stage verification, CRUD)

*Source: `docs/archive/FRONTEND_UPGRADE_SPEC.md` §7.*

## 5. Real push/SMS/email delivery for in-app notifications

**Status: done (2026-09-17).** Extended the in-app notification feed with real SMS/email delivery channels.

- ✅ Added generic `send_sms(mobile_number, message)` to `sms_service.py` (TextBee)
- ✅ Added generic `send_email(to, subject, body_text, body_html)` to `email_service.py` (Zoho SMTP)
- ✅ Created `notification_delivery_service.py` — orchestrates delivery using verified user contact info (`email_verified`, `mobile_verified`)
- ✅ Updated `notification_feed_service.notify_users()` with optional `deliver=True` parameter
- ✅ Enabled delivery for all notification types:
  - **Workflows**: assigned, step decision (citizen), admin escalation, admin reopen
  - **Governance alerts**: resolved/dismissed notifications to department officers
- ✅ Uses existing User model fields (`email`, `mobile_number`, `email_verified`, `mobile_verified`) — no schema changes needed
- ✅ Graceful degradation: if SMS/email not configured or user has no verified contact, falls back to in-app only

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6, `docs/archive/FEATURE_AUDIT.md`.*

## 6. Address-based fuzzy parcel search

**Status: deferred — no schema support.** `Parcel` has no street/locality/landmark fields; ULPIN/survey-number/plot-number search covers how Indian land records are actually identified. Revisit only if a concrete need for free-text address entry emerges.

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6.*

## 8. District field on officer accounts

**Status: done (2026-09-17).** 

- ✅ `User.district` column (nullable, String(40)) added via migration `557c0fbfd423`
- ✅ `CreateUser` schema accepts optional `district` (validated: only for staff roles)
- ✅ `PublicUserOut` schema returns `district` field
- ✅ `POST /api/v1/users` accepts `district` on creation, audit-logged
- ✅ Jurisdiction-aware routing in `workflows_service.py:_notify_assigned_officers()`, `escalate_step()`, `reopen_step()` — only notifies officers in the parcel's district

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6.*

## 12. Bhashini OCR / ALD — blocked on account provisioning

**Status: blocked — not a code problem.** Bhashini's OCR pipeline returns `"Requested pipeline does not exist with this submitter"` and ALD (Audio Language Detection) returns `"TaskType is not valid"` for this project's account. Both need Bhashini's support/dashboard team to enable, or (for ALD) confirming the correct task type.

*Source: `docs/architecture/BHASHINI_INTEGRATION.md` §7.*

## 13. Frontend test suite — i18n mock done, infrastructure gaps remain

**Status: i18n mock substantially fixed (2026-09-17), infrastructure gaps remain.** `useTranslation()` (`context/LanguageContext.tsx`) throws if no `<LanguageProvider>` wraps the component tree, and ~26 component test files never did. Global mock added to `frontend/src/test/setup.ts` stops the crash. **Fixed 2026-09-17:** mock's `t(key)` now resolves real English strings from `FALLBACK_STRINGS.en` instead of echoing the raw key. Added missing `authPage.*` keys used by `LoginPage`.

**Remaining gaps (~196 tests fail):**
1. Missing React Query mocks for `useQuery`/`useMutation` — provide default query data in test setup
2. Missing MSW handlers for API routes hit during tests
3. Component-specific test setup (providers, router, etc.)
4. Add missing translation keys to `FALLBACK_STRINGS.en` as discovered (ongoing)

*Source: i18n-removal validation work, 2026-09-15.*

---

### 14. On-Demand Official Document PDF (Form 7/12)

**Status: Core renderer complete — critical end-to-end gaps remain.** Full code review at `docs/architecture/official-document-code-review.md`.

**Completed:**
- PDF renderer (`official_document_generator.py`) with exact Form 7/12 layout, English/Hindi, QR code, watermark
- Data assembler (`land_record_pdf_service.py`) pulling parcel, ownership, tax, crop, registration, workflow
- Route `GET /parcels/{id}/documents/official-pdf` with citizen access control
- "Download Official Document" button on Parcel 360

**Critical Gaps (must fix before demo):**
- **C1** Tests only check PDF signature (`%PDF-`), not rendered values (owner name, survey no, ULPIN, mutation, tax, crop)
- **C2** Assembler never reads authenticated user profile — `User` fields (name, email, mobile, address, govt ID, occupation) not in PDF data contract
- **C3** No **View Official Document** action — only download; no PDF viewer modal with zoom
- **C4** Backend deployment target unconfirmed (NestJS vs Python backend route conflict)

**Major Gaps:**
- Profile data source policy undefined (workflow creator vs authenticated user)
- Single-page canvas overflows with many ownership/crop rows
- Object URL revoked immediately after download click (brittle)
- No error state for failed PDF generation

**Required Fixes:**
1. Add `ProfileInfo` to `LandRecordPDFData`, pass `User` through assembler/service/route
2. Render profile block in PDF, make layout multi-page safe (Platypus or `showPage()`)
3. Return `Content-Disposition: inline` for View flow
4. Create `OfficialPdfViewerModal` frontend component with iframe viewer
5. Add View/Download buttons, proper blob URL lifecycle, error handling
6. Add `pypdf` content assertions to tests; add integration + security + overflow tests

*Source: `docs/architecture/official-document-code-review.md` (2026-09-17 code review).*

---

### 15. Unified Map Feature Set — Every Map (Except Landing) Must Have

**Status: substantially implemented (2026-09-17).** Core unified map wrapper created and deployed to OfficerMapPage, FindParcelsPage, Parcel360View, and HomePage (landing page uses static Parcel-example.png image instead of interactive map).

**Completed:**
1. **Hierarchical State → District → City/Village dropdown** — Backend endpoint `/gis/clusters-hierarchical` created (returns clusters grouped by state/district). Frontend `UnifiedMapWrapper` component implements the 3-level cascading dropdown.
2. **"Locate" button** — Added to `UnifiedMapWrapper`, bumps recenterSignal to re-fit map to selected parcel's context.
3. **Satellite + Terrain toggle** — Added terrain raster source (OpenTopoMap) to `MapComponent.BASE_STYLE` with 3-way Street/Satellite/Terrain toggle.
4. **Layer filters (toggle panel)** — Preserved from `MapComponent`, controlled via `visibleLayerKeys` prop and `showLayerPanel` in `UnifiedMapWrapper`.
5. **Year selection for historical satellite images** — Added to `UnifiedMapWrapper` with `showYearSelector`, `historicalYears`/`years` props, visible to officers/admins.
6. **Cluster lock** — Map constrains to selected cluster bounds via `focusBounds` + cluster lock indicator badge.

**Updated Pages:**
- `OfficerMapPage` — Uses `UnifiedMapWrapper` with cluster dropdown, year selector, layer panel, locate button
- `FindParcelsPage` (Citizen) — Uses `UnifiedMapWrapper` with cluster dropdown, layer panel (zoning only), locate button
- `Parcel360View` — Uses `UnifiedMapWrapper` with year selector (when historical cluster exists), locate button, full layer panel for staff
- `HomePage` (Landing) — Replaced live GIS preview with static `/Parcel-example.png` image

**Remaining:**
- `HistoricalMapView` — Still uses internal year dropdown; can migrate to `UnifiedMapWrapper` later
- `AdminCombinedLayerMap` / `AdminMapLayerAuthoringPage` — Separate admin-only map components; can migrate later
- `Verifier AssignedVisitsPage` — No map yet; needs map added or link to Parcel 360
- Test database needs governance_rules migration applied for full test pass

### Current Gap Matrix (Updated)

| Map / Page | State/District/City Dropdown | Locate | Satellite + Terrain | Layer Filters | Year Select (Officer/Admin) | Map Lock to Cluster |
|------------|------------------------------|--------|---------------------|---------------|----------------------------|---------------------|
| **Landing (HomePage)** | N/A (static image) | N/A | N/A (static image) | N/A | N/A | N/A |
| **OfficerMapPage** | ✅ Hierarchical | ✅ | ✅ Street/Satellite/Terrain | ✅ 10 layers | ✅ | ✅ Via focusBounds |
| **FindParcelsPage (Citizen)** | ✅ Hierarchical | ✅ | ✅ Street/Satellite/Terrain | ✅ 10 layers (zoning only) | ❌ (citizen) | ✅ Via focusBounds |
| **Parcel360View (All)** | ✅ Hierarchical (via cluster dropdown) | ✅ | ✅ Street/Satellite/Terrain | ✅ Full (staff) / Zoning (citizen) | ✅ (officer) | ✅ Via focusBounds |
| **HistoricalMapView (Officer)** | ❌ (own year dropdown) | Via Parcel360 | Parcel Map / Satellite Photo | Via MapComponent | ✅ Own dropdown | Via `fitToParcels` |
| **AdminCombinedLayerMap** | ❌ | ❌ | Street only | ✅ 4 layers | ❌ | ❌ |
| **AdminMapLayerAuthoringPage** | ❌ | ❌ | Street only | ❌ | ❌ | ❌ |
| **Verifier AssignedVisitsPage** | No map | No map | No map | No map | No map | No map |

---

## Low priority — unconfirmed asks, not previously scoped

The items below came from a feature-parity check (2026-09-15) and are new ideas, not confirmed product asks — kept deprioritized until specifically requested. Each needs its own scoping pass before work starts.

### 16. Dedicated single-ULPIN instant ownership check

A one-field "enter a ULPIN, get ownership back" screen distinct from general Parcel Search — gated by OTP or rate-limiting instead of captcha. Both OTP and rate limiting infra exist; this would wire them to a single-identifier lookup.

### 17. QR code per parcel

Generate/display a unique QR code per parcel (on official document or Parcel 360) encoding its identifier for quick lookup. No QR generation exists in the codebase.

### 18. General SMS outreach channel

TextBee is wired for OTP only. A broader outreach channel (e.g. notifying feature-phone users of decisions/alerts by SMS) would reuse that integration but needs its own trigger points and opt-in/consent model — distinct from item #5's "deliver existing in-app notifications via SMS/email."

### 20. Penalty for intentional false claims

No penalty/enforcement mechanism exists. Would need a way to distinguish "intentionally false" from "genuine mistake" (manual officer judgment) before any penalty logic — policy question first, code second.

### 21. Notify owner when their parcel is viewed, with anonymized in-app contact

In-app notifications exist but nothing notifies an owner their parcel was viewed, and no in-app messaging hides phone/email between users. Needs consent flag on `citizen_parcels`, write path from parcel-view to notification, and a real messaging feature (doesn't exist).

### 22. Duplicate/fraud cross-check on new complaints

Nothing compares a new workflow/complaint against existing/rejected ones. Would need similarity check (same parcel + same type + overlapping details) at submission, surfaced to reviewing officer.

### 23. Offline field verification with later sync

No offline mode exists in frontend. Depends on Verifier role/field evidence capture (feature 30, done) — this would be that feature's offline-capable variant (local queue + sync-on-reconnect), not standalone.

### 24. Onboarding tutorial tooltips

No step-by-step onboarding UI exists. Pure frontend addition once a target flow is picked — genuinely last-priority, cosmetic rather than functional.

---

## Environment gaps (not product backlog, but block tests locally)

### Test database missing `governance_rules` table

**Status: ✅ RESOLVED (2026-09-17).** Migration applied + seeded 8 default rules (RESTRICTION_ZONE_OVERLAP, UNAUTHORIZED_CHANGE_DETECTED, RESTRICTION_DETECTED, DISPUTE_DETECTED, TAX_OVERDUE + legacy rules). All 3 tests passing:
- `test_change_detection.py::TestAnalyze::test_detects_a_real_change_and_creates_a_governance_alert_only_for_the_affected_parcel`
- `test_historical_imagery.py::TestCompare::test_detects_real_category_changes_and_creates_correctly_severed_alerts`
- `test_historical_imagery.py::TestCompare::test_falls_back_to_real_facts_when_the_narrative_call_fails`

### Tesseract OCR binary not installed

**Status: blocks 5 workflow tests.** `pytesseract` needs `tesseract` binary on PATH (used by `app/document_verification/ocr.py` for evidence uploads, `identify-from-document`, automatic verification pre-check). Install Tesseract on dev machine to pass 5 evidence-upload tests in `test_workflows.py`. Note: OpenCV (`cv2`) is used separately for document authenticity analysis (sharpness/blur/edge detection), not OCR.

---

## Not tracked as a gap, by design

`backend-py` has no SQLite fallback (`postgis.py`/`geo-utils.ts`'s hand-rolled JS geometry math deliberately not ported — Postgres+PostGIS only, per `PYTHON_MIGRATION_PLAN.md` §2's single-database constraint). Confirmed deliberate, not an oversight. Project doesn't want SQLite support restored — noted only to prevent mistaken regression flagging.

---

## Not on this list on purpose

- **Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than item 1 above** — Workflow Oversight, Map Layer Authoring, Officer Monitoring, 4-stage Governance Alert flow, rest of that punch list are all done; see `docs/architecture/FEATURES.md`.
- **Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 ("the four real upgrades")** — Land Claim, evidence upload tied to a claim, officer routing, historical spatial state are all built (`docs/architecture/FEATURES.md` features 8, 26, 28) despite that document's own status line still saying "§1-7 nothing implemented" — that line is stale.
- **Real-time/WebSocket updates, notification "mark all read," bulk workflow actions** — never scoped in this repo's documents; not a confirmed gap, just never proposed.
