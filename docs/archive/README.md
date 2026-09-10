# docs/archive/ — Historical Record

Planning documents, phase-by-phase build logs, gap analyses, and punch lists from earlier stages of the project — kept for their reasoning and dated history, not as a description of the system today. **For what's actually built, start at [`docs/architecture/`](../architecture/README.md) instead.**

Every document here says so itself at the top (each has its own "Status:" line explaining what's stale vs. still true), and several are still cited by exact filename in code comments as design rationale — that's why these were moved here rather than deleted outright. A comment like `// per docs/ADMIN_PANEL_ISSUES.md's Coming Soon #2` is still readable and still explains *why* a decision was made even though the file now lives at `docs/archive/ADMIN_PANEL_ISSUES.md` instead of `docs/ADMIN_PANEL_ISSUES.md` — the pointer is one directory stale, not broken.

| Document | What it was |
|---|---|
| [`ADMIN_PANEL_ISSUES.md`](ADMIN_PANEL_ISSUES.md) | The 2026-09-10 Admin/Officer Portal punch list (Workflow Oversight, Map Layer Authoring, Officer Monitoring, 4-stage Governance Alerts) — all done except one item, now tracked in `docs/architecture/BACKLOG.md` #1 |
| [`AUTH_VERIFICATION_UPGRADE.md`](AUTH_VERIFICATION_UPGRADE.md) | The original OTP/registration design capture — built, superseded by `FRONTEND_UPGRADE_SPEC.md`'s as-built endpoint list |
| [`CITIZEN_FEATURES_UPGRADE_PLAN.md`](CITIZEN_FEATURES_UPGRADE_PLAN.md) | Citizen-dashboard feature proposals — most were since built (Land Claim, AI routing, historical imagery); genuinely deferred items are in `docs/architecture/BACKLOG.md` #6-8 |
| [`FRONTEND_UPGRADE_SPEC.md`](FRONTEND_UPGRADE_SPEC.md) | The master frontend information-architecture document — almost entirely built; the two remaining engine-rewrite items (Workflow Configuration, Governance Rules) are in `docs/architecture/BACKLOG.md` #3-4 |
| [`FEATURE_AUDIT.md`](FEATURE_AUDIT.md) | A dated cross-reference of the official problem statement vs. what's built — gap count reached 0; OAuth is the one item still open, tracked in `docs/architecture/BACKLOG.md` #2 |
| [`Plan.md`](Plan.md) | The original phase-1-through-12 execution log, each phase with a dated verification note — accurate for the phases it covers, never extended past Citizen Sign-In |
| [`flow.md`](flow.md) | The original application-flow/role-distribution design, written before the portal restructuring it describes actually happened |

**Archived:** 2026-09-11, as part of splitting `docs/` into current-state reference (`docs/architecture/`) vs. historical record (here). Nothing below was edited — moved as-is, including any cross-references inside them that now point at a `docs/<name>.md` path that's since moved to `docs/architecture/` or `docs/archive/` (the same stale-but-readable trade-off as the code comments above).
