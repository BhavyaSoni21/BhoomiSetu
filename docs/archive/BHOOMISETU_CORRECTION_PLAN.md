# BhoomiSetu Correction Plan — Code-Verified

## Context

The `BhoomiSetu_Master_Correction_Document.md` (61 issues) is outdated. I audited the **actual** code (backend FastAPI + React/TS frontend) with three parallel Explore passes and confirmed each issue as REAL / ALREADY-OK / PARTIAL. This plan covers **only the confirmed-real issues**, fixed at the shared layer (not per-screen), plus new schemas/migrations where genuine data gaps exist. Roughly half the document's issues were already handled (react-query loading, layer control, parcel selection, workflow state machine, structured errors, most responsive tables, SMS-verified gating) and are excluded.

**User decisions:**
- Verifier fields: **add real columns + migration** (`availability`, `assigned_area`), populate API + wire UI.
- Registration chain: keep real fields only, **honest empty state** for missing linkage, **add** the genuinely-missing server-side search + pagination + count.

**Ground rule (from the doc, still valid):** no fake data, no fake success. Where data doesn't exist, show a correct empty state.

---

## Phase 0 — Security (P0) — ✅ DONE

The land-record CRUD and per-parcel department lookups are **deliberately
unguarded mock stand-ins** for external systems this app doesn't own (their
module docstrings say so — Tech.md #12/#13/#16-17). The earlier audit misread
them as auth holes; adding `require_roles` would have broken their intended
integration contract. The real risk is only their exposure on a **public
production host**, so instead of auth we gate them behind an env flag.

**S1 + S2. Mock external APIs exposed in production.** ✅ Added
`expose_mock_dept_apis` setting (`config.py`) + `require_mock_dept_apis_enabled`
guard (`auth/deps.py`) — returns **404** (not 403, so the endpoints look absent)
when `is_production and not expose_mock_dept_apis`. Applied to both land-record
routers (`land_records.py`, whole-router dep) and the 8 per-parcel lookups
(`departments.py`). Dev is unaffected; the staff-gated dashboard endpoints
(`/registration/pending|chain`, `/stats/*`, etc.) keep their `require_roles`.

**S3. `_can_manage_case` had no jurisdiction scoping.** ✅ Rewrote
(`case_service.py:118`) to mirror `_can_manage_task`: ADMIN manages any case;
a department officer manages a case only when it has a `DepartmentTask` in
their own department (`ROLE_DEPARTMENT[user.role]` → `Department.id` subquery);
citizens unchanged. Prior code let any staff role manage any case.

**Tests:** `tests/routers/test_phase0_security.py` — mock guard 404s in prod /
opts back in via flag / open in dev; `_can_manage_case` allows own-dept officer
+ ADMIN, denies unrelated-dept officer. (Writing the test caught a Postgres
UUID-cast `DataError` from a dead string-fallback branch, since removed.)

---

## Phase 1 — Backend data & audit correctness (P0/P1) — ✅ DONE

Implemented and covered by `tests/routers/test_phase1_data.py` (+ `test_phase0_security.py`). Two migrations added: `e3a4b5c60005` (verifier fields) and `f4b5c6d70006` (notification channel prefs); both applied with `alembic upgrade head`. Notes per item:
- **B1** ✅ `availability`/`assigned_area` columns on `User` + migration; populated in `list_verifiers_with_workload`; `VerifierWithWorkloadOut` emits `availability`/`assignedArea`. Kept `activeTaskCount` (frontend `VerifierAssignmentPanel` already reads it correctly; `WorkflowReviewPanel`'s drifted snake_case reads belong to Phase 2 F1/F3).
- **B2** ⚠️ PARTIAL — shipped the real fix: `AuditLog.created_at` now defaults to naive-UTC (`_utcnow`) matching the case/workflow convention. Idempotency dedup **deferred as YAGNI** (no caller passes a key, no observed duplicate-row bug). `timestamptz` column migration also deferred — the app stores naive-UTC uniformly, so a column-type change is cosmetic; revisit only if a reader assumes tz-aware.
- **B3** ✅ `list_registration_chain(db, q, limit, offset) -> (items, total)`; endpoint takes `q/limit/offset`, returns `{records, total}`. Linkage fields kept honest.
- **B4** ✅ Both PDF generators wrapped → `PACKAGE_GENERATION_FAILED` (logged).
- **B5** ✅ `department` relationship (`lazy="selectin"`) + `department_name`/`department_code` properties on `DepartmentTask`; schema emits them.
- **B6** ✅ `_audit_layer` wired into all 12 spatial mutations (zoning/restriction/infrastructure/admin-notes create/update/delete); shared `geojson_to_geometry` now rejects invalid (self-intersecting) geometry with 400; zoning + restriction deletes return `{affectedParcelCount, affectedParcelIds}` (infra/admin-notes have no parcel association → stay 204).
- **B7** ✅ `notify_sms`/`notify_email`/`notify_in_app` columns (default true) + migration; `GET/PATCH /notifications/preferences`; delivery honors per-channel opt-out (SMS/email in `notification_delivery_service`, in-app row suppressed in `notify_users`).

**B1. Verifier fields (columns + migration).** `GET /cases/verifiers` (`cases.py:128-168`) / `VerifierWithWorkloadOut` (`schemas/case.py:347-356`) emits only `active_task_count`; `availability`/`assignedArea` don't exist.
- Add `availability` (enum/str) + `assigned_area` (str) columns to the verifier/User model → new Alembic migration (see `alembic/versions/`, base `_now()` pattern).
- Populate in `cases.py:158-167`; add fields to `VerifierWithWorkloadOut`. Frontend reads `activeTasks` but backend sends `activeTaskCount` — align the names.

**B2. Audit idempotency + UTC timestamps.** `audit_service.log()` (`audit_service.py:40-57`) has no dedup — a retried action inserts a duplicate row. `AuditLog.created_at` (`models/audit.py:57`) uses `func.now()` into a non-`timestamptz` column (DB-TZ dependent).
- Add an optional idempotency key (or dedup on actor+action+entity within a short window) so one logical action = one event.
- Migrate `created_at` to `timestamptz`, default UTC; align with the naive-UTC `_now()` used by case/workflow tables (`case_service.py:114`). One app-wide UTC store, convert on display.

**B3. Registration chain: search + pagination + count.** `departments_service.list_registration_chain` (`departments_service.py:186-204`) loads all `REGISTERED` rows, no count/pagination/search.
- Add `limit/offset` + `q` (parcelId/registrationNumber) params to `departments.py:170`, filter+count in the service, return a list-response schema with `total`. Keep `previousOwner/considerationAmount/linkedMutationId/chainStep` **honest** (null / empty state — no invented linkage).

**B4. Case-package PDF generation unwrapped.** `cases.py:593,629` (decision-order / verification-report) aren't wrapped — a generation failure yields a generic 500.
- Wrap generation, return a specific structured error code (e.g. `PACKAGE_GENERATION_FAILED`) so the UI can show a real error + retry.

**B5. Department name to non-admins.** `DepartmentTaskOut` (`schemas/case.py:142-165`, +L195/206/219/279/288/341) exposes only `department_id` UUID; `Department.name/code` exist (`models/admin.py:23-38`) but only via ADMIN-only `/admin/departments`.
- Add `departmentName`/`departmentCode` to the task/case out-schemas and populate (server already has `_resolve_department_code`). Removes raw-UUID display without a frontend UUID→name round-trip.

**B6. Map-layer mutations: audit + geometry validity + delete impact.** `spatial.py` layer create/update/delete have **zero** `audit_service` calls; `spatial_service.py:36-42` validates only geometry *type* (no `ST_IsValid`/self-intersection); `delete_zoning_overlay` (`spatial.py:159-166`) deletes with no impact info.
- Add `audit_service.log()` to layer mutations (actor/layer id/old→new). Add `ST_IsValid` (or shapely `.is_valid`) check before PostGIS insert/update. Return affected `parcel_ids` count on delete so the UI can confirm.

**B7. Notification preferences persistence.** No model/endpoint for SMS/Email/InApp prefs (`notification_feed.py` only lists/reads).
- Add prefs columns to User (or a `notification_preferences` table) + migration + `GET/PATCH /notifications/preferences`. Gate in `notification_delivery_service.py:66-78` (already checks `mobile_verified`/`email_verified` — extend to also honor the user pref).

---

## Phase 2 — Frontend data correctness (P0/P1)

**F1. Verifier raw-key leak (P0, most visible).** `WorkflowReviewPanel.tsx` renders `t('verifierPortal.workload/.assignedArea/.availability/.activeTasks/.area/.unknown/...')` (L598-627, L755-849) but **none of those keys exist** in `LanguageContext.tsx`, and `t()` returns the raw key when missing (`LanguageContext.tsx:2569`). They render literally.
- Add the `verifierPortal.*` keys to `LanguageContext.tsx` (en + hi) **and** pass inline fallbacks at each `t(...)` (match the safe pattern in `VerifierAssignmentPanel.tsx`). After B1, feed real `availability`/`assignedArea`/`activeTasks`; the panel currently sources `/users` (L563) which lacks them — switch to `/cases/verifiers` or ensure `/users` VERIFIER rows are enriched.

**F2. Shared status-label util.** No shared enum→label map; raw enums render at `RegistrationChainPage.tsx:148,159` and ad-hoc maps duplicated across 6+ files (`OfficerTasksPage.tsx:21-37`, `DocumentsPage.tsx:128`, `MyCasesPage.tsx:12`, `AdminWorkflowOversightPage.tsx:19`, `WorkflowReviewPanel.tsx:190`, `AnalyticsDashboard.tsx:72-73`).
- Add one `statusLabel()` util reusing existing `cases.status.*` i18n keys (`LanguageContext.tsx:1179`). Apply at the raw sites (esp. RegistrationChainPage 148/159); consolidate the ad-hoc maps opportunistically.

**F3. Raw UUID in UI.** `WorkflowReviewPanel.tsx:756` renders `verifierId = actor_id` (raw UUID). RegistrationChainPage truncates UUIDs (112/163) — cosmetic.
- Resolve to verifier name (available once B1/verifier data flows). Fix the WorkflowReviewPanel one; leave truncated cosmetic ones.

**F4. Registration chain search wired.** `RegistrationChainPage.tsx:90-94` search `<input>` is decorative (no `value`/`onChange`).
- Add state, wire to input, and (with B3) query server-side by parcelId/registrationNumber. Also destructure `isError` (L27) and add an error branch (~L100) — currently a failed fetch shows the empty state.

**F5. Profile completeness computed.** `RoleDashboard.tsx` hardcodes `completeness` as a single boolean flip (L166/178/190) with a static `completenessMsg`.
- Compute % + missing-field list from actual profile fields (~L159-196). Define required fields + scoring once.

---

## Phase 3 — GIS, notifications UI, theme, responsive (P1/P2)

**G1. Locate button (P0 in doc — currently a no-op).** `UnifiedMapWrapper.tsx:427-429,597-606` — "Locate" only re-fits to the already-selected parcel; no geolocation. With nothing selected it's a silent no-op.
- Decision needed: **(a)** wire real `navigator.geolocation.getCurrentPosition` → `map.flyTo` + user marker + error branches (permission/unavailable/timeout/unsupported — reuse the guarded pattern in `EvidenceCapturePage.tsx:33-38`), or **(b)** relabel to "Recenter". Recommend (a) to match intent.

**G2. Historical/satellite imagery errors.** `HistoricalMapView.tsx:211-214` shows one catch-all string; parcel-year load error (`:95`) never surfaced.
- Map backend error codes (NO_IMAGERY/CLOUD_COVER/INVALID_DATE/…) to differentiated messages in `historicalImagery.ts`; surface the `useCategorizedParcels` error. State is already scoped per cluster+year (OK).

**G3. Notification toggles persist (pairs with B7).** `ContactMethodsCard.tsx:30-137` — SMS/Email/InApp are `useState(true)`, no persistence.
- Add react-query mutation to the B7 prefs endpoint + saving/saved/failed states. Wire the dead "+ Add" (L61) and "Change" (L90) buttons or disable them with a reason.

**G4. Dark-theme contrast fixes (semantic tokens exist in `index.css:9-139`).**
- `LoginPage.tsx:188-189` mobile logo forces `--brand-900` (near-black) on dark bg → invisible; use `--text-heading` or a dark override.
- `OfficerTasksPage.tsx:68` pending badge has no text color → invisible in dark; add explicit text color.
- `OfficerTasksPage.tsx:150` "Manage" link `text-brand-700` too dark on dark row → use `text-brand-600`/semantic link color.

**G5. Task-detail modal tab overflow.** `OfficerTaskDetailModal.tsx:345` tab `<nav>` has no `overflow-x-auto` inside an `overflow-hidden` modal → 5 tabs clip on narrow screens.
- Add `overflow-x-auto` to the nav wrapper (match `Parcel360View.tsx:401`).

---

## New schemas / migrations (summary)

| Change | Migration? | Files |
|---|---|---|
| Verifier `availability`, `assigned_area` (B1) | Yes | `models/user.py`, new `alembic/versions/*`, `schemas/case.py:347` |
| Audit idempotency key + `created_at`→`timestamptz` (B2) | Yes | `models/audit.py`, new migration, `audit_service.py` |
| Notification preferences (B7) | Yes | `models/user.py` or new table, migration, new router endpoints |
| Registration-chain list response + query params (B3) | No | `departments.py`, `departments_service.py`, `schemas/` |
| `departmentName/Code` on task/case out-schemas (B5) | No | `schemas/case.py` |

Reuse: `CamelModel` base (`schemas/base.py`), `resolve_pagination` (`common/pagination.py`), `require_roles` (auth deps), `audit_service.log()` (`audit_service.py:13`), `_resolve_department_code`, existing `cases.status.*` i18n keys.

---

## Verification

- **Backend:** `cd backend-py && pytest` (existing suites: `tests/routers/test_cases_verifiers.py`, `test_users.py`, `test_analytics.py`, `test_sync.py`). Add tests for: land-record auth (401/403 for anon on the six mutations), audit idempotency (one action → one row), registration-chain pagination/search, layer-mutation audit rows. Run `alembic upgrade head` on a scratch DB to confirm migrations.
- **Frontend:** `cd frontend && npm run test` (vitest) + `npm run build` (tsc). Grep-assert no `verifierPortal.` renders literally. Verify status labels resolve.
- **Manual E2E (`/run`):** verifier panel shows real fields not raw keys; registration-chain search filters + paginates; Locate uses geolocation; notification toggles persist across reload; dark-mode login logo + pending badge visible; task-detail tabs scroll on 360px.
- After code changes: `graphify update .` to refresh the graph.

## Explicitly out of scope (already-OK, verified)

react-query loading (no infinite-loading), layer visibility control, parcel selection, workflow state machine + transition validation, structured error middleware, SMS/email verified-contact gating, My Tasks / registration-chain / imagery-toolbar / email responsive, dispute modal layout, internal event-name formatting (`ActivityTimeline.formatAction`), unique audit PK.

---

## Known baseline test failures (pre-existing, for later correction)

Full suite as of Phase 1+2: **9 failed, 613 passed**. All 9 pre-date this
plan's work (verified: none touch a file modified by Phase 1/2). They are
**backend** tests — Phase 3 (frontend) will not affect them; each needs its
own backend fix. Listed most-actionable first.

**T1. Zoning overlap not rejected for identical/contained geometry** — REAL BUG.
`tests/routers/test_spatial.py::TestRestrictionZoneOverlapAndAlerts::test_rejects_a_second_overlapping_zoning_overlay_with_400_same_layer_type`.
A second overlay identical to (or contained by) an existing one is accepted (201) instead of rejected (400).
Root cause: `reject_if_overlapping` uses `ST_Overlaps`, which returns FALSE for identical/contained geometries (only TRUE for partial overlap). Fix: also test `ST_Contains`/`ST_Within`/`ST_Equals` (or use `ST_Intersects` minus shared-edge-only touches) in `spatial_service.py`.

**T2. Parcel listing count/filter/bbox — `test_gis.py::TestGetParcels` (5)** — needs triage (real bug vs seed/env-sensitive).
`test_returns_all_seeded_parcels_with_a_total_count`, `test_filters_by_state`, `test_filters_by_state_and_district_together`, `test_respects_limit`, `test_bbox_filters_to_intersecting_parcels_only`.
All hit `gis.py::get_parcels` (untouched by this plan). Assertion failures on counts/filters — confirm whether the endpoint logic is wrong or the test fixture/PostGIS SRID/bbox assumptions drifted.

**T3. Parcel360 response aggregator (2)** — needs triage.
`test_interoperability.py::TestResponseAggregatorBuildParcel360::test_aggregates_all_seven_departments_for_a_fully_linked_parcel`, `…::test_falls_back_to_local_body_code_for_locality_and_nulls_departments_when_nothing_is_linked`.
The 7-department aggregation / local-body-code fallback assertions fail.

**T4. Officer literal routes shadowed (1)**.
`test_departments_dashboards.py::test_literal_routes_not_shadowed_and_stubs_return_empty`.
A literal officer route is caught by a `/{parcel_id}` catch-all (422) or a stub returns non-empty. Fix: declare literal paths before the catch-all in the relevant router.

**T5. Frontend baseline drift (2, pre-existing)** — verified pre-existing (both
fail on unmodified HEAD, independent of Phase 2/3 work; i18n/redesign drift per
the `frontend_test_i18n_drift` note).
`LoginPage.test.tsx > lists the demo accounts for convenience` and
`MapComponent.test.tsx > calls onParcelClick when a parcel feature is clicked`.
Each needs its own frontend fix (the test spec predates a UI/i18n change).


