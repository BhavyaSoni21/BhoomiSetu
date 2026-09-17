# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## Priority order (as of 2026-09-16)

Items 1, 3, 8, 9, 10, 11, 14, 15, 19, and 26 are done and have moved to `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` (features 18, 26, 22, 31, 9, 30, and 10/16/30 respectively) — no longer listed below. Re-ranked 2026-09-17: item #1 (admin session revoke + idle timeout), #3 (admin-editable workflow pipelines with `WorkflowPipelineConfig` table + CRUD API), and #8 (district field on officers with jurisdiction-aware routing in `workflows_service.py`) are now implemented. Item #11 turned out to already be fully wired in the actual code (`ParcelSearch.tsx` already calls `/multilingual/transliterate` for Roman-script queries under a non-English UI language) — the prior BACKLOG.md text describing it as "not started" was itself stale, caught while starting on it. Item #26's own scoped middle bullet ("governance alerts may not be department-scoped") turned out to be a false gap once built — this endpoint's own existing test suite (`test_governance.py::TestFindAll`) asserts every staff role sees every alert regardless of department, by design; a department field was added for a frontend badge, but the endpoint stays unscoped. Item #14 shipped as scoped — a bundled variable-weight Noto Sans Devanagari font (fetched from Google Fonts' own repo) covers Hindi, and the existing seed-time PNG generator was deliberately left in place (still used by the OCR-verification demo flow) rather than removed, narrower than the item's original "replace" framing but avoiding an unrelated, riskier removal. Item #25 (seed-time OCR regression, `extracted_text=None`) is now fixed — `seed.py` calls the real `document_verification.ocr.extract_text()` on the rendered PNG, same as `seed.ts` did — and dropped from this list. Most actionable first:

1. **#4 — Admin-editable governance rules.** Genuine schema+engine rewrite — the biggest lift on this list.
2. **#13 — Frontend test suite's i18n test-mock gap.** Real, known, lower priority — doesn't block any feature from working, only test coverage.
3. **#14 — Unified Map Feature Set.** Every map (officer, citizen, admin, verifier — not landing) needs: hierarchical State/District/City dropdown, Locate button, Satellite+Terrain toggle, Layer filters, Year selector for satellite (officer/admin), and map lock to selected cluster bounds. Affects 8+ map components.

**Also found by the audit, not backlog-worthy:** `frontend/src/features/citizen/ComingSoonCard.tsx` and `frontend/src/features/officer/ComingSoonCard.tsx` are dead code — built but never rendered anywhere in the app. Not a functional gap, just cleanup opportunity; safe to delete whenever someone's touching that area, no dedicated pass needed for it alone.

**Blocked on something outside this codebase, not actionable right now:**
- **#2** — OAuth login (needs a registered external provider app).
- **#7** — Bhuvan/ISRO GIS integration (needs a feasibility spike + provider access).
- **#12** — Bhashini OCR/ALD (blocked on Bhashini's own account provisioning).

**Deliberately deferred, no action needed:** #6 (address-based fuzzy search — no schema gap that needs filling yet).

**Low priority, not yet confirmed as real asks** (#16–18, #20–24 — see the "Low priority" section below): revisit only if one is specifically requested.

---

## 1. Admin session/timeout & token revocation

**Status: done (2026-09-17).** 

- ✅ `POST /api/v1/users/{id}/revoke-sessions` — admin can revoke a specific user's sessions by bumping `token_version` (audit-logged, self-revoke blocked)
- ✅ `User.last_activity_at` column + `LastActivityMiddleware` — updated on each authenticated request
- ✅ `idle_timeout_minutes` config + enforcement in `get_current_user()` — when > 0, reject tokens where `last_activity_at` is older than the threshold even if `token_version` matches

JWTs never expire by design (session only ends on explicit logout or admin revoke). The idle timeout adds an *additional* expiration condition without changing the no-auto-expiry UX.

*Source: `docs/archive/ADMIN_PANEL_ISSUES.md` (the one item-9 sub-item never picked up).*

## 2. OAuth-based login (Google/etc.) as an additional method

**Status: not started — needs an external provider registration only the deploying party can do.** Email/mobile+password is the only login path today. Adding OAuth needs a real app registered with a provider (client ID/secret, redirect URIs), which isn't something that can be scoped or built without that account access.

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

**Status: not started — same scale of lift as item 3.** Conditions like "flood-zone parcel → alert" or a tax-overdue threshold are hardcoded in `seed.ts` and the change-detection/governance-alert creation logic. The ask (confirmed with the user in the original spec) is real CRUD, not just a read-only settings view: a `GovernanceRule` table (condition type, threshold, resulting severity) with full admin create/edit/delete, and every rule-evaluation call site (tax-overdue check, restriction-zone overlap, the unauthorized-change check) reading live from that table instead of a hardcoded condition.

*Source: `docs/archive/FRONTEND_UPGRADE_SPEC.md` §7.*

## 5. Real push/SMS/email delivery for in-app notifications

**Status: not started, scope deliberately excluded so far.** The notification feed (`docs/architecture/FEATURES.md` feature 27) is in-app only — polling a feed, not a delivered message. Email/SMS infrastructure already exists in the codebase (Zoho SMTP + TextBee, `notifications/`) but only for auth OTP delivery; wiring workflow/governance-alert notifications through the same channels is unscoped work, not a small config change.

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6, `docs/archive/FEATURE_AUDIT.md`.*

## 6. Address-based fuzzy parcel search

**Status: deliberately deferred, real schema gap.** `Parcel` has no street/locality/landmark fields today; ULPIN/survey-number/plot-number search already covers how Indian land records are actually identified, so this was explicitly deferred rather than built speculatively. Revisit only if a concrete need for free-text address entry shows up.

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6.*

## 7. Bhuvan (ISRO GIS) integration

**Status: not scoped — needs a feasibility spike first** (API availability, auth model, rate limits) before this can even become a real plan item.

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

**Status: blocked, not a code problem.** Bhashini's OCR pipeline returns `"Requested pipeline does not exist with this submitter"` and ALD (Audio Language Detection) returns `"TaskType is not valid"` for this project's Bhashini account — both need a request to Bhashini's support/dashboard team to enable, or (for ALD) confirming the correct task type, before either can be built.

*Source: `docs/architecture/BHASHINI_INTEGRATION.md` §7.*

## 13. Frontend test suite doesn't cover the Bhashini `LanguageContext` migration

**Status: partially patched (2026-09-15), real gap remains.** `useTranslation()` (`context/LanguageContext.tsx`) throws if no `<LanguageProvider>` wraps the component tree, and ~26 component test files never did — the old `react-i18next` setup didn't need one, since it used real English resource strings loaded via a side-effect import. A global mock added to `frontend/src/test/setup.ts` stops the outright crash (same pattern as the existing `ResizeObserver`/`matchMedia` stubs), but its `t(key)` fallback just returns the raw key, not real English copy — so tests asserting on literal UI text (e.g. `screen.getByLabelText('Email')`) still fail (~190 tests across files like `LoginPage.test.tsx`, `App.test.tsx`, `ParcelSearch.test.tsx`). Fixing this properly needs the test mock's `t()` to resolve real English strings (e.g. reading `backend-py/static/ui_strings_en.json`) instead of echoing the key, or updating each affected assertion — neither done yet.

*Source: this session's i18n-removal validation work, 2026-09-15 — not previously scoped anywhere.*

---

## 14. Unified Map Feature Set — Every Map (Except Landing) Must Have

**Status: not started — new requirement from user (2026-09-17).** Currently, map capabilities are fragmented across 8+ map components with inconsistent features. The requirement: **every map** in the app (officer, citizen, admin, verifier — **not the Home/Landing page**) must have all five:

1. **Hierarchical State → District → City/Village dropdown** showing the selected cluster — replaces ad-hoc cluster-only pickers.
2. **"Locate" button** — pans/zooms to the currently selected parcel (Parcel 360 has this; OfficerMapPage, FindParcelsPage, AdminCombinedLayerMap, HistoricalMapView do not).
3. **Satellite + Terrain toggle** — `MapComponent` has Street/Satellite; `AdminCombinedLayerMap` only has Street; `HistoricalMapView` has Parcel Map/Satellite Photo (officer-only); terrain source missing everywhere.
4. **Layer filters (toggle panel)** — `MapComponent` has 10 layers; `AdminCombinedLayerMap` has 4; `AdminMapLayerAuthoringPage` has none on the map; others inconsistent.
5. **Year selection for historical satellite images** — only `HistoricalMapView` has this (officer-only); must be available to **officers and admins** on all their maps.

**Additional UX constraint:** When a cluster is selected via the dropdown, the map must **lock to that cluster's bounds** — zoom constrained to a sensible range (e.g. 12–18), pan sensitivity reduced, and the base parcels fetch scoped to that cluster (already done via `focusBounds` in `OfficerMapPage` → `MapComponent`).

### Current Gap Matrix

| Map / Page | State/District/City Dropdown | Locate | Satellite + Terrain | Layer Filters | Year Select (Officer/Admin) | Map Lock to Cluster |
|------------|------------------------------|--------|---------------------|---------------|----------------------------|---------------------|
| **Landing (HomePage)** | ❌ (fixed Pune) | ❌ | Street/Satellite only | ❌ (`showLayerPanel={false}`) | ❌ | ❌ |
| **OfficerMapPage** | ✅ Cluster only | ❌ | Street/Satellite | ✅ 10 layers | ❌ | Partial (`focusBounds`) |
| **FindParcelsPage (Citizen)** | ❌ | ❌ | Street/Satellite | ✅ 10 layers (citizen sees only zoning) | ❌ | ❌ |
| **Parcel360View (All)** | ❌ | ✅ | Via HistoricalMapView (officer) | Via MapComponent | Via HistoricalMapView (officer) | ❌ |
| **HistoricalMapView (Officer)** | ❌ | Via Parcel360 | Parcel Map / Satellite Photo | Via MapComponent | ✅ Year dropdown | Via `fitToParcels` |
| **AdminCombinedLayerMap** | ❌ | ❌ | Street only | ✅ 4 layers | ❌ | ❌ |
| **AdminMapLayerAuthoringPage** | ❌ | ❌ | Street only (via AdminCombinedLayerMap) | ❌ | ❌ | ❌ |
| **Verifier AssignedVisitsPage** | No map | No map | No map | No map | No map | No map |

### Implementation Approach

- Create a **shared `UnifiedMapWrapper` component** that composes `MapComponent` + the new controls (dropdown, locate, basemap+terrain, year select) and enforces the cluster lock (viewport constraints via `maplibregl` `minZoom`/`maxZoom` + `dragPan`/`scrollZoom` sensitivity).
- Replace `MapComponent` usage in `OfficerMapPage`, `FindParcelsPage`, `Parcel360View`, `AdminCombinedLayerMap`, `AdminMapLayerAuthoringPage` with the wrapper.
- Add a map to `Verifier AssignedVisitsPage` (or link to Parcel 360 with the new map).
- Backend: add `/gis/clusters` endpoint supporting hierarchical state→district→city query (extend existing `/change-detection/clusters`), and `/gis/satellite-image` with year param for terrain tiles (extend Esri or add new source).
- Terrain: add a third raster source (e.g. Esri World Topo Map or OpenTopoMap) to `BASE_STYLE` alongside Street/Satellite.

*Source: user requirement 2026-09-17.*

---

## Low priority — not started, not previously scoped

The items below came out of a feature-parity check against a separate requirements list (2026-09-15) and are new ideas, not confirmed product asks — kept here deliberately deprioritized until one is actually wanted. None have design/investigation behind them yet; each needs its own scoping pass before work starts.

## 16. Dedicated single-ULPIN instant ownership check

A one-field "enter a ULPIN, get ownership back" screen distinct from today's general Parcel Search (feature 3) — gated by OTP or rate-limiting instead of a captcha. Both OTP (feature 11) and rate limiting (feature 23) already exist as infra; this would be a thin new screen/endpoint wiring them to a single-identifier lookup, not new plumbing.

## 17. QR code per parcel

Generate and display a unique QR code per parcel (e.g. on the official document from item 14, or on Parcel 360) encoding its identifier for quick lookup. No QR generation exists anywhere in the codebase today.

## 18. General SMS outreach channel

TextBee (`notifications/`) is wired for OTP delivery only. A broader outreach channel (e.g. notifying feature-phone users of a decision or alert by SMS) would reuse that same integration but needs its own trigger points and opt-in/consent model — distinct from item 5's "deliver existing in-app notifications via SMS/push/email," which is the closer match if this is really about workflow/alert delivery rather than open-ended outreach.

## 20. Penalty for intentional false claims

No penalty/enforcement mechanism exists. Would need a way to distinguish "intentionally false" from "genuine mistake" (manual officer judgment call, presumably) before any penalty logic could apply — policy question first, code second.

## 21. Notify owner when their parcel is viewed, with anonymized in-app contact

In-app notifications (feature 27) exist but nothing today notifies an owner that someone looked up their parcel, and there's no in-app messaging channel that hides phone/email between two users. Needs a consent flag on `citizen_parcels`, a write path from parcel-view to notification, and a real messaging feature — the last of which doesn't exist in any form yet.

## 22. Duplicate/fraud cross-check on new complaints

Nothing today compares a new workflow/complaint against existing or previously-rejected ones. Would need a similarity check (same parcel + same complaint type + overlapping details) run at submission time, surfaced to the reviewing officer.

## 23. Offline field verification with later sync

No offline mode exists anywhere in the frontend. Depends on the Verifier role/field evidence capture (`docs/architecture/FEATURES.md` feature 30, done) — this would be that feature's offline-capable variant (local queue + sync-on-reconnect), not a standalone piece.

## 24. Onboarding tutorial tooltips

No step-by-step onboarding UI exists in any portal today. Pure frontend addition once a target flow (citizen registration? first service request?) is picked — genuinely last-priority, cosmetic rather than functional.

---

**Not tracked as a gap, by design:** `backend-py` has no SQLite fallback (`postgis.py`/`geo-utils.ts`'s hand-rolled JS geometry math was deliberately not ported — Postgres+PostGIS only, per `PYTHON_MIGRATION_PLAN.md` §2's single-database constraint). Confirmed deliberate, not an oversight, and the project doesn't want SQLite support restored — noted here only so it isn't rediscovered and mistakenly re-flagged as a regression later.

**Environment gap, not a product backlog item:** `pytesseract` (OCR — `app/document_verification/ocr.py`, used live by evidence uploads/`identify-from-document`/the automatic verification pre-check) needs the `tesseract` binary on PATH, which isn't installed on the primary dev machine used this session at all — confirmed 2026-09-16 (5 evidence-upload tests in `test_workflows.py` fail on `TesseractNotFoundError`). Not a code gap; whoever owns that machine needs to install Tesseract for OCR to actually run there. Note: OpenCV (`cv2`) is used separately for document authenticity analysis (sharpness/blur/edge detection), not for OCR.

---

## Not on this list on purpose

- **Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than item 1 above** — Workflow Oversight, Map Layer Authoring, Officer Monitoring, the 4-stage Governance Alert flow, and the rest of that punch list are all done; see `docs/architecture/FEATURES.md`.
- **Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 ("the four real upgrades")** — Land Claim, evidence upload tied to a claim, officer routing, and historical spatial state are all built (`docs/architecture/FEATURES.md` features 8, 26, 28) despite that document's own top-of-file status line still saying "§1-7 nothing implemented" — that line is stale, not this backlog.
- **Real-time/WebSocket updates, a notification "mark all read," bulk workflow actions** — never scoped anywhere in this repo's own documents; not a confirmed gap, just never proposed. Don't treat their absence here as a signal either way.
