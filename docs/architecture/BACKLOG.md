# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

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

## 9. Frontend UI for satellite-sourced Change Detection

**Status: backend done (2026-09-14), no way to trigger it from the app.** `POST /change-detection/analyze-satellite` (`app/services/earth_engine_service.py`) fetches real Sentinel-2 NDVI imagery from Google Earth Engine for given bounds/dates and runs it through the existing pixel-diff/governance-alert pipeline — but `ChangeDetectionPanel.tsx` (the only UI that calls this module) isn't mounted anywhere in the app (see `docs/architecture/FEATURES.md`'s Change Detection entry), and even if it were, it only has a form for the older manual-upload `/analyze` endpoint, not this one. Reachable today only via direct API call (curl, `/api/docs`). Needs either a new form (bounds + two dates, no file picker) added to that panel, or its own small officer-facing UI, before this is demoable without a terminal.

*Source: this session's Earth Engine integration work, 2026-09-14 — not previously scoped anywhere.*

## 10. Real satellite imagery for Historical Imagery Comparison

**Status: not started - a natural follow-on to item 9, not yet built.** `ClusterHistoricalSnapshot` rows (`docs/architecture/FEATURES.md`'s Historical Imagery Comparison entry) are still synthetic SVG-rendered PNGs generated at seed time, not real satellite data — the comparison logic itself is pure DB-record diffing and doesn't touch imagery at all, so this would be a cosmetic-but-credible upgrade: swap what `scripts/seed.py` writes into `ClusterHistoricalSnapshot.image_path` from `cluster_snapshot_generator.py`'s SVG render to `earth_engine_service.get_ndvi_visual_png()`'s output, once Google Earth Engine is confirmed usable server-side and item 9's caching/quota discipline (`PYTHON_MIGRATION_PROGRESS.md`'s Earth Engine entry) is respected — regenerating 25 snapshots (5 clusters × 5 years) on every reseed is meaningfully more Earth Engine usage than item 9's on-demand officer requests.

*Source: this session's Earth Engine integration work, 2026-09-14 — not previously scoped anywhere.*

---

## Not on this list on purpose

- **Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than item 1 above** — Workflow Oversight, Map Layer Authoring, Officer Monitoring, the 4-stage Governance Alert flow, and the rest of that punch list are all done; see `docs/architecture/FEATURES.md`.
- **Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 ("the four real upgrades")** — Land Claim, evidence upload tied to a claim, officer routing, and historical spatial state are all built (`docs/architecture/FEATURES.md` features 8, 26, 28) despite that document's own top-of-file status line still saying "§1-7 nothing implemented" — that line is stale, not this backlog.
- **Real-time/WebSocket updates, a notification "mark all read," bulk workflow actions** — never scoped anywhere in this repo's own documents; not a confirmed gap, just never proposed. Don't treat their absence here as a signal either way.
