# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## Priority order (as of 2026-09-19)

All items re-ranked flat — blocked/deferred items included but marked.

### P0 — Actionable, Internal (Blocking Tests/Dev)
1. **Frontend test infrastructure** — HistoricalImageryPanel.test.tsx ✅ DONE (8/8 passing). Remaining: ~184 failing tests need React Query mocks, MSW handlers, component test setup pattern migration (actionable, internal)
2. **Finish Unified Map migration** — Migrate HistoricalMapView, AdminCombinedLayerMap, AdminMapLayerAuthoringPage, Verifier AssignedVisitsPage to UnifiedMapWrapper (actionable, internal)

### P1 — Substantially Implemented, Critical Gaps Remain

*(none — Official Document PDF moved to Done)*

### P2 — Blocked (External Dependency)
4. **Bhashini OCR / ALD** — Blocked on account provisioning. Bhashini's OCR returns `"Requested pipeline does not exist"`, ALD returns `"TaskType is not valid"`. Needs Bhashini support team enablement.

### P3 — Deferred (No Schema Support / Policy Needed)
5. **Address-based fuzzy parcel search** — Deferred. `Parcel` has no street/locality/landmark fields; ULPIN/survey-number/plot-number search covers how Indian land records are actually identified. Revisit only if concrete need emerges.

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

---

## Not Tracked as Gaps (By Design)

- **No SQLite fallback** — `backend-py` is Postgres+PostGIS only (deliberate, per `PYTHON_MIGRATION_PLAN.md` §2).

---

## Not On This List On Purpose

- Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than session/timeout — all done (Workflow Oversight, Map Layer Authoring, Officer Monitoring, 4-stage Governance Alert flow).
- Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 — Land Claim, evidence upload, officer routing, historical spatial state all built (see `FEATURES.md` features 8, 26, 28).
- Real-time/WebSocket updates, notification "mark all read," bulk workflow actions — never scoped in this repo's documents.