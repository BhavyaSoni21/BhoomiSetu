# BhoomiSetu — Open Backlog

**Purpose:** the single place to look for "what's genuinely still not built," now that `docs/architecture/FEATURES.md` only describes what exists. Assembled 2026-09-11 while reorganizing `docs/` — every item below is salvaged from an archived planning/audit document (cited per item) and re-checked against the current codebase before being kept here, so this list should be trusted over the archived source it came from if the two ever disagree.

If you finish one of these, move it into `docs/architecture/FEATURES.md`/`FEATURE_TECH_MAP.md` and delete it from here — don't leave a done item marked open.

---

## 1. Admin session/timeout & token revocation

**Status: not started — no existing pattern to build on.** JWTs never expire today; a session ends only when the frontend's own Logout button is clicked (a deliberate product decision, not an oversight — see `docs/architecture/KNOWN_RISKS.md`, which independently flags this as a High-severity finding for real deployment). There is no session table, no token revocation, no multi-row-per-user concept anywhere in this codebase. The closest analog is the email-OTP lifecycle on `User` (hashed code + expiry + attempt counter) — a reasonable *template* for a sessions table's shape, but this is still new work from the ground up.

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

---

## Not on this list on purpose

- **Everything in `docs/archive/ADMIN_PANEL_ISSUES.md` other than item 1 above** — Workflow Oversight, Map Layer Authoring, Officer Monitoring, the 4-stage Governance Alert flow, and the rest of that punch list are all done; see `docs/architecture/FEATURES.md`.
- **Everything in `docs/archive/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3 ("the four real upgrades")** — Land Claim, evidence upload tied to a claim, officer routing, and historical spatial state are all built (`docs/architecture/FEATURES.md` features 8, 26, 28) despite that document's own top-of-file status line still saying "§1-7 nothing implemented" — that line is stale, not this backlog.
- **Real-time/WebSocket updates, a notification "mark all read," bulk workflow actions** — never scoped anywhere in this repo's own documents; not a confirmed gap, just never proposed. Don't treat their absence here as a signal either way.
