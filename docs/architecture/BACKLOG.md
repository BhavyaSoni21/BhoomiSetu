# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## Priority order (as of 2026-09-16)

Items 9, 10, 11, 14, 15, 19, and 26 are done and have moved to `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` (features 18, 26, 22, 31, 9, 30, and 10/16/30 respectively) — no longer listed below. Re-ranked 2026-09-16: item #11 turned out to already be fully wired in the actual code (`ParcelSearch.tsx` already calls `/multilingual/transliterate` for Roman-script queries under a non-English UI language) — the prior BACKLOG.md text describing it as "not started" was itself stale, caught while starting on it. Item #26's own scoped middle bullet ("governance alerts may not be department-scoped") turned out to be a false gap once built — this endpoint's own existing test suite (`test_governance.py::TestFindAll`) asserts every staff role sees every alert regardless of department, by design; a department field was added for a frontend badge, but the endpoint stays unscoped. Item #14 shipped as scoped — a bundled variable-weight Noto Sans Devanagari font (fetched from Google Fonts' own repo) covers Hindi, and the existing seed-time PNG generator was deliberately left in place (still used by the OCR-verification demo flow) rather than removed, narrower than the item's original "replace" framing but avoiding an unrelated, riskier removal. Also fixed an ordering bug from the previous ranking (#25 was listed *above* #14 despite #25's own text saying to do it *after* #14). Most actionable first:

1. **#25 — Seed-time OCR regression (`extracted_text=None`).** One-line fix — the seeded document images #14 would have retired are still in place, so this one-line fix is still worth doing now rather than being subsumed.
2. **#8 — `district` field on officer accounts.** Small, real prerequisite for jurisdiction-aware AI routing.
3. **#3 / #4 — Admin-editable workflow pipelines / governance rules.** Both genuine schema+engine rewrites — the biggest lift on this list, do these once the smaller items are clear.
4. **#1 — Admin session revoke UI + idle timeout.** Partially done (real server-side revocation on logout already ships); the admin-facing controls and timeout are what's left.
5. **#13 — Frontend test suite's i18n test-mock gap.** Real, known, lower priority — doesn't block any feature from working, only test coverage.

**Also found by the audit, not backlog-worthy:** `frontend/src/features/citizen/ComingSoonCard.tsx` and `frontend/src/features/officer/ComingSoonCard.tsx` are dead code — built but never rendered anywhere in the app. Not a functional gap, just cleanup opportunity; safe to delete whenever someone's touching that area, no dedicated pass needed for it alone.

**Blocked on something outside this codebase, not actionable right now:**
- **#2** — OAuth login (needs a registered external provider app).
- **#7** — Bhuvan/ISRO GIS integration (needs a feasibility spike + provider access).
- **#12** — Bhashini OCR/ALD (blocked on Bhashini's own account provisioning).

**Deliberately deferred, no action needed:** #6 (address-based fuzzy search — no schema gap that needs filling yet).

**Low priority, not yet confirmed as real asks** (#16–18, #20–24 — see the "Low priority" section below): revisit only if one is specifically requested.

---

## 1. Admin session/timeout & token revocation

**Status: partially done (2026-09-11) — real revocation exists, admin-facing controls and timeout don't.** JWTs still never expire (that no-auto-expiry UX is an unchanged, deliberate product decision) and a session still normally ends only when the frontend's own Logout button is clicked, but that click now actually ends it server-side: `User.tokenVersion` (`backend/src/users/user.entity.ts`) is embedded in every JWT and checked on every request (`JwtStrategy.validate()`), and `POST /auth/logout` bumps it — so a captured/replayed token stops working the moment the real user logs out, closing `docs/architecture/KNOWN_RISKS.md` HIGH-2. Still genuinely open: no admin-facing "revoke this specific user's session(s)" control, no idle/inactivity timeout, and no session table (tokenVersion is a single per-user counter, not a per-session record) — so this item stays here rather than moving to FEATURES.md.

*Source: `docs/archive/ADMIN_PANEL_ISSUES.md` (the one item-9 sub-item never picked up).*

## 2. OAuth-based login (Google/etc.) as an additional method

**Status: not started — needs an external provider registration only the deploying party can do.** Email/mobile+password is the only login path today. Adding OAuth needs a real app registered with a provider (client ID/secret, redirect URIs), which isn't something that can be scoped or built without that account access.

*Source: `docs/archive/FEATURE_AUDIT.md` §6/§8 item 15, `docs/architecture/SYSTEM_ARCHITECTURE.md` §9.3.*

## 3. Workflow Configuration (admin-editable review pipelines)

**Status: not started — a genuine workflow-engine rewrite, not an additive feature.** Which departments review which `workflowType`, and in what order, is currently `workflows.service.ts`'s hardcoded `pipelineFor()`/`PIPELINES_BY_TYPE` map. Making this admin-editable needs a `WorkflowPipelineConfig` table (workflow type → ordered department/role steps) and `pipelineFor()` reading from it instead — the workflow engine's actual source of truth changes, not just a new settings page in front of it.

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

**Status: small, real prerequisite for jurisdiction-aware routing.** AI-based request routing (`docs/architecture/FEATURES.md` feature 28) currently routes by department only, not department *and* district — an officer in one district can be routed a request from another. Adding a `district` field to officer accounts is the missing piece to make routing genuinely jurisdiction-aware, not just department-aware.

*Source: `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §6.*

## 12. Bhashini OCR / ALD — blocked on account provisioning

**Status: blocked, not a code problem.** Bhashini's OCR pipeline returns `"Requested pipeline does not exist with this submitter"` and ALD (Audio Language Detection) returns `"TaskType is not valid"` for this project's Bhashini account — both need a request to Bhashini's support/dashboard team to enable, or (for ALD) confirming the correct task type, before either can be built.

*Source: `docs/architecture/BHASHINI_INTEGRATION.md` §7.*

## 13. Frontend test suite doesn't cover the Bhashini `LanguageContext` migration

**Status: partially patched (2026-09-15), real gap remains.** `useTranslation()` (`context/LanguageContext.tsx`) throws if no `<LanguageProvider>` wraps the component tree, and ~26 component test files never did — the old `react-i18next` setup didn't need one, since it used real English resource strings loaded via a side-effect import. A global mock added to `frontend/src/test/setup.ts` stops the outright crash (same pattern as the existing `ResizeObserver`/`matchMedia` stubs), but its `t(key)` fallback just returns the raw key, not real English copy — so tests asserting on literal UI text (e.g. `screen.getByLabelText('Email')`) still fail (~190 tests across files like `LoginPage.test.tsx`, `App.test.tsx`, `ParcelSearch.test.tsx`). Fixing this properly needs the test mock's `t()` to resolve real English strings (e.g. reading `backend-py/static/ui_strings_en.json`) instead of echoing the key, or updating each affected assertion — neither done yet.

*Source: this session's i18n-removal validation work, 2026-09-15 — not previously scoped anywhere.*

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

## 25. Seed-time OCR regression: seeded parcel documents have `extracted_text=None`

**Status: real regression from the NestJS original, found 2026-09-15 during a route-by-route migration parity check.** `backend/seed.ts:982,990` ran real Tesseract OCR on every generated parcel-document PNG at seed time and stored the result in `extractedText`. `backend-py/scripts/seed.py:980` hardcodes `extracted_text=None` instead — the script's own docstring (`seed.py:8-11`) says this was deliberately deferred "until ParcelsModule ports OCR," but that module landed (`app/document_verification/ocr.py` + `field_matcher.py`, used live by workflow evidence uploads and `identify-from-document`) and the seed script was never updated to match. Real consequence: `workflows_service._build_verification_precheck()` (`workflows_service.py:117-124`) falls back to a parcel's existing `ParcelDocument.extracted_text` when a citizen files a request with no fresh evidence upload — for every seeded document that's `None`, so the automatic OCR pre-check silently does nothing for any demo/seeded parcel, only for citizens who upload their own evidence. Fix is a one-line call to `extract_text()` on the rendered PNG in `seed.py`, matching what `seed.ts` did — though this may become moot once item 14 (on-demand document generation) retires stored/seeded document images entirely, so worth sequencing after that decision lands rather than fixing twice.

*Source: this session's NestJS-vs-backend-py parity audit, 2026-09-15.*

**Not tracked as a gap, by design:** `backend-py` has no SQLite fallback (`postgis.py`/`geo-utils.ts`'s hand-rolled JS geometry math was deliberately not ported — Postgres+PostGIS only, per `PYTHON_MIGRATION_PLAN.md` §2's single-database constraint). Confirmed deliberate, not an oversight, and the project doesn't want SQLite support restored — noted here only so it isn't rediscovered and mistakenly re-flagged as a regression later.

**Environment gap, not a product backlog item:** `pytesseract` (OCR — `app/document_verification/ocr.py`, used live by evidence uploads/`identify-from-document`/the automatic verification pre-check) needs the `tesseract` binary on PATH, which isn't installed on the primary dev machine used this session at all — confirmed 2026-09-16 (5 evidence-upload tests in `test_workflows.py` fail on `TesseractNotFoundError`). Not a code gap; whoever owns that machine needs to install Tesseract for OCR to actually run there.

---

## Not on this list on purpose

- **Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than item 1 above** — Workflow Oversight, Map Layer Authoring, Officer Monitoring, the 4-stage Governance Alert flow, and the rest of that punch list are all done; see `docs/architecture/FEATURES.md`.
- **Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 ("the four real upgrades")** — Land Claim, evidence upload tied to a claim, officer routing, and historical spatial state are all built (`docs/architecture/FEATURES.md` features 8, 26, 28) despite that document's own top-of-file status line still saying "§1-7 nothing implemented" — that line is stale, not this backlog.
- **Real-time/WebSocket updates, a notification "mark all read," bulk workflow actions** — never scoped anywhere in this repo's own documents; not a confirmed gap, just never proposed. Don't treat their absence here as a signal either way.
