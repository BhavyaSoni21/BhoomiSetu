# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## Priority order (as of 2026-09-19)

All items re-ranked flat — blocked/deferred items included but marked.

### P0 — Actionable, Internal (Blocking Tests/Dev)

*(none — the two former P0 items, frontend test stabilization and the Unified Map migration, are both complete as of 2026-09-23; see Done table.)*

### P1 — Newly found in 2026-09-23 frontend/backend audit (pages exist, backend/wiring pending)

12. **Officer "department" backend endpoints** — DONE 2026-09-23 (routes + real data where a model exists; honest empty/501 elsewhere). All ten literal routes are now declared above the `/{parcel_id}` catch-alls in `departments.py` (so none 422), staff-gated, and return the exact camelCase shapes the pages consume. Real data: `GET /encumbrance/fraud-prevention` (dispute∧restriction cross-check), `GET /survey/records`, `GET /tax/reassessment-queue`, `GET /tax/analytics`, `GET /registration/chain`. Honest stubs (feature needs a model that doesn't exist yet, so page renders its empty state instead of erroring): `GET /encumbrance/certificates`, `GET /encumbrance/certificate-requests`, `GET /survey/documents`, `GET /registration/duplicate-registry` → `[]`; `POST /survey/documents/upload` → 501. Covered by `tests/routers/test_departments_dashboards.py`. **Follow-ups all DONE 2026-09-23:** certificate PDF generation + store (`encumbrance_certificates` table, reportlab+QR generator, `POST /encumbrance/certificates/generate` → stored PDF via `supabase_storage`, `GET .../{id}/pdf`; `CertificateGeneratorPage` now generates + views/downloads real PDFs), survey field-document store (`survey_documents` table, multipart `POST /survey/documents/upload`, `GET .../{id}/file`), duplicate-registration detection (`list_duplicate_registrations`), tax overdue time-series (`_overdue_trend` feeds `overdueTrend`). New roundtrip tests in `test_departments_dashboards.py`.
13. **Profile editing / persistence** — DONE 2026-09-23. Root cause: the real editable fields + save mutations already existed and worked — `ProfileDetailsCard` (`useUpdateProfileDetails` → `POST /auth/profile/details`) and `ContactMethodCard` (`useUpdateContact` → `POST /auth/profile/contact` + OTP), both rendered on all three profile pages. The bug was a *second*, fake "global" edit/save layer in the bottom `ProfileActionBar`: on admin it toggled an edit mode whose "Save" only showed a success toast and persisted nothing; on citizen/officer the Save/Cancel branch never rendered (dead props). Fix: removed the fake edit/save from all three pages — the bar is now utilities only (its "Edit Profile" button scrolls to the real per-card editor; Download Summary + Contact Support unchanged). No behavioural duplication, no false "saved" toast. (Dead `RoleDashboard.tsx` still carries the old props harmlessly — it is exported but never routed.)
14. **Historical imagery: switch by year on the Parcel 360 map** — DONE 2026-09-23. Parcel 360's Overview map now renders `HistoricalMapView` (instead of the display-only `UnifiedMapWrapper` year `<select>`) whenever the parcel falls in a historical-imagery cluster, so its year picker re-fetches per-year categorized parcels and actually switches the view. See Done table.

### P1 — Substantially Implemented, Critical Gaps Remain

*(none — Official Document PDF moved to Done)*

### P2 — Blocked (External Dependency)
4. **Bhashini OCR / ALD** — Blocked on account provisioning. Bhashini's OCR returns `"Requested pipeline does not exist"`, ALD returns `"TaskType is not valid"`. Needs Bhashini support team enablement.

### P3 - Deferred (No Schema Support / Policy Needed)
5. ~~**Address-based fuzzy parcel search**~~ - Completed. Address fields (`street_address`, `locality`, `landmark`, `pincode`) have been added to the `Parcel` schema, and a pg_trgm GIN index powers fast fuzzy similarity search on the `address` query param.

### P4 — Low Priority, Unconfirmed Asks (Need Scoping)
6. **Penalty for intentional false claims** — No enforcement mechanism. Needs way to distinguish "intentional" from "genuine mistake" (manual officer judgment) — policy first, code second.
7. **Notify owner when parcel viewed** — In-app notifications exist but no parcel-view → notification write path. Needs consent flag on `citizen_parcels`, write path from parcel-view, and in-app messaging (doesn't exist).
8. **Duplicate/fraud cross-check on complaints** — Nothing compares new workflow/complaint against existing/rejected ones. Needs similarity check (same parcel + same type + overlapping details) at submission, surfaced to reviewing officer.
9. **Single-ULPIN instant ownership check** — One-field "enter ULPIN, get ownership" screen distinct from general Parcel Search — gated by OTP/rate-limiting instead of captcha.
10. **Offline field verification with sync** — No offline mode in frontend. Depends on Verifier role/field evidence capture (done) — this would be that feature's offline-capable variant (local queue + sync-on-reconnect).
11. **Onboarding tutorial tooltips** — No step-by-step onboarding UI. Pure frontend addition once target flow picked — genuinely last-priority, cosmetic.

---

## Done (Removed from Active Backlog)

| Item | Completed | Notes |
|------|-----------|-------|
| Admin session/timeout & token revocation | 2026-09-17 | `POST /users/{id}/revoke-sessions`, `last_activity_at`, idle timeout |
| OAuth login (Google) | 2026-09-18 | Google OAuth 2.0, bilingual Bhashini notifications, `preferred_language` |
| Workflow Configuration | 2026-09-17 | Admin-editable pipelines, CRUD API, hardcoded fallback |
| Governance Rules | 2026-09-17 | Admin-editable alert conditions, live evaluation, 5 seeded rules |
| Push/SMS/Email delivery | 2026-09-17 | Generic `send_sms`/`send_email`, notification delivery service |
| District field on officer accounts | 2026-09-17 | `User.district`, jurisdiction-aware routing |
| Verifier role & field evidence | 2026-09-17 | Separate role, `/verifier` portal, capture form, assign control |
| QR code per parcel | 2026-09-18 | Generated on official document PDF |
| General SMS outreach | 2026-09-17 | Generic `send_sms()` in `sms_service.py` |
| Frontend test i18n mock | 2026-09-17 | Global mock in `setup.ts`, `FALLBACK_STRINGS.en` |
| Test DB governance_rules | 2026-09-17 | Migration applied, 8 rules seeded, 3 tests passing |
| Official Document PDF (Form 7/12) | 2026-09-19 | View action, PDF viewer modal, authenticated user profile, multi-page, tests validate real values + overflow |
| OCR binary (Tesseract) | 2026-09-19 | Installed v5.5.3, 5 workflow tests unblocked, local pytesseract wrapper functional |
| AskAiWidget.test.tsx stabilization | 2026-09-21 | 14/14 passing |
| GovernanceAlertsPanel.test.tsx stabilization | 2026-09-21 | 19/19 passing |
| React Query mock setup | 2026-09-21 | PatchedQueryClient auto-populates default query data in setup.ts |
| MSW handlers setup | 2026-09-21 | Basic handlers for parcels, notifications, auth, users, generic fallbacks |
| HistoricalMapView → UnifiedMapWrapper migration | 2026-09-21 | Component now imports and renders UnifiedMapWrapper |
| AdminCombinedLayerMap → UnifiedMapWrapper migration | 2026-09-21 | Component now imports and renders UnifiedMapWrapper |
| AssignedVisitsPage → UnifiedMapWrapper migration | 2026-09-21 | Component now imports and renders UnifiedMapWrapper |
| Frontend test suite stabilization | 2026-09-23 | Was "107/323 failing"; now 323/323 passing. Root causes fixed: `FALLBACK_STRINGS` now merges `en.json` (i18n drift), shared MSW fixtures + preseeded query keys for portal integration tests, `en.json` reconciled to test expectations |
| Finish Unified Map migration | 2026-09-23 | Last item (AdminMapLayerAuthoringPage) confirmed covered via AdminCombinedLayerMap (UnifiedMapWrapper-backed). Also fixed the maplibre worker (`?url`) + elevation-layer expression that had blanked all GeoJSON layers |
| Official PDF "Summarise" action | 2026-09-23 | Was a raw `fetch('/api/parcels/...')` — wrong prefix (real route is `/api/v1`) and no auth bearer, so the button 404'd. Now routes through `apiService` (correct baseURL + token) |
| Verifier assignment panel for officers | 2026-09-23 | New `GET /cases/verifiers` (staff-readable, VERIFIER-scoped) returns verifiers + `activeTaskCount` (tasks not COMPLETED/CANCELLED). Replaces the two broken calls (admin-only `/users` → 403, non-existent `/cases/tasks/all` → always-0 workload). Declared before `/{case_id}` so it isn't shadowed. Test: `tests/routers/test_cases_verifiers.py` |
| Route-shadowing: `/cases/verifier/tasks` + `/cases/my` | 2026-09-23 | Item 16. Both literal routes were declared *after* the `/{case_id}*` catch-alls, so Starlette matched the catch-all first and 422'd (`case_id="verifier"`/`"my"`). Broke the verifier portal task list (`AssignedVisitsPage`) and the citizen dashboard/`MyCasesPage`. Relocated both declarations above `/{case_id}`. A route-match probe confirms `/tasks/my`, `/parcel/{id}`, `/from-application` were already safe. Test added to `test_cases_verifiers.py` (`test_literal_routes_not_shadowed_by_case_id`) |
| Encumbrance certificate PDF generation + store (#12a) | 2026-09-23 | `encumbrance_certificates` table + migration, reportlab+QR generator, `POST /encumbrance/certificates/generate` (snapshots encumbrances → stored PDF via `supabase_storage`, 90-day validity), `GET .../{id}/pdf`. `CertificateGeneratorPage` generates + views/downloads real PDFs. Roundtrip test in `test_departments_dashboards.py` |
| Survey field-document store (#12b) | 2026-09-23 | `survey_documents` table + migration, multipart `POST /survey/documents/upload` (15MB cap, GPS + type), `GET /survey/documents?parcelId=`, `GET .../{id}/file` (auth-gated, so `DocumentsPage` fetches via `apiService` blob not raw URL). Roundtrip test added |
| Duplicate-registration detection (#12c) + tax overdue time-series (#12d) | 2026-09-23 | `list_duplicate_registrations` groups registrations by normalized parcel/number; `_overdue_trend` feeds `tax/analytics` `overdueTrend`. Covered by existing dashboard tests |
| Historical imagery year switch on Parcel 360 (#14) | 2026-09-23 | Parcel 360 Overview map renders `HistoricalMapView` when the parcel is in a historical cluster, so its year picker re-fetches per-year categorized parcels and actually switches the view (replaced the display-only `UnifiedMapWrapper` `selectedYear`) |

---

## Not Tracked as Gaps (By Design)

- **No SQLite fallback** — `backend-py` is Postgres+PostGIS only (deliberate, per `PYTHON_MIGRATION_PLAN.md` §2).

---

## Not On This List On Purpose

- Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than session/timeout — all done (Workflow Oversight, Map Layer Authoring, Officer Monitoring, 4-stage Governance Alert flow).
- Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 — Land Claim, evidence upload, officer routing, historical spatial state all built (see `FEATURES.md` features 8, 26, 28).
- Real-time/WebSocket updates, notification "mark all read," bulk workflow actions — never scoped in this repo's documents.