# docs/architecture/ — Current State Reference

This directory is the **accurate, as-of-now description** of BhoomiSetu — what's built, how it's built, and what's genuinely still open. Everything here should reflect the running codebase; if you find something that doesn't, fix it in place rather than filing a new document about it.

For historical planning documents, completed punch lists, and superseded audits — the record of *how* the project got here — see [`docs/archive/`](../archive/README.md). The root-level [`Tech.md`](../../Tech.md)/[`BHOOMISETU.md`](../../BHOOMISETU.md) are the original team vision/recommended-architecture documents written *before* implementation started — kept as-is at the repo root, not folded in here, since they document intent rather than the as-built system.

| Document | What it covers |
|---|---|
| [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) | API standards, interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX guidelines, color schema summary, deployment/scalability — the nine areas a Standard Technical Document is expected to cover |
| [`FEATURES.md`](FEATURES.md) | Feature-by-feature narrative: what each feature does, the backend logic behind it, where it lives in the frontend |
| [`FEATURE_TECH_MAP.md`](FEATURE_TECH_MAP.md) | Same feature numbering as `FEATURES.md`, as a lookup table: library → endpoints → exact backend/frontend files |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Two color/visual systems: Part 1 is the portal (Citizen/Officer/Admin) Bauhaus system; Part 2 is the public landing page's literal-hex palette |
| [`BHASHINI_INTEGRATION.md`](BHASHINI_INTEGRATION.md) | Multilingual UI (11 languages, Bhashini-backed): architecture, what's built vs. open, process for adding new translatable strings |
| [`KNOWN_RISKS.md`](KNOWN_RISKS.md) | Latest full-stack security/performance/reliability audit — point-in-time snapshot, re-run rather than hand-edit |
| [`BACKLOG.md`](BACKLOG.md) | Everything genuinely still open, each item sourced from archived planning docs |
| [`DATABASE_IMPLEMENTATION_GUIDE.md`](DATABASE_IMPLEMENTATION_GUIDE.md) | PostGIS + vector tiles + background jobs implementation guide for SIH demo (P0 patterns from architecture guide) |
| [`official-document-code-review.md`](official-document-code-review.md) | Code review + implementation blueprint for Official Document Generation (Form 7/12-style Record of Rights PDF) |
| [`CUTOVER_AND_OPS_PLAN.md`](CUTOVER_AND_OPS_PLAN.md) | §6/§7 cutover runbook + ops maturity checklist — decisions needed, staging rehearsal, production cutover steps |
| [`ENV_CONFIGURATION.md`](ENV_CONFIGURATION.md) | Reference: where real `.env` lives, what keys are configured, how the copy from NestJS was done |

**Last reorganized:** 2026-09-17. Code comments citing an archived document by its old `docs/<name>.md` path (e.g. `docs/ADMIN_PANEL_ISSUES.md`) still point at real files under `docs/archive/` — those comments were left as-is since the rationale remains accurate.

**Removed duplicates:** Several exact-duplicate copies of archive documents left at `docs/` root from the 2026-09-11 reorganization were deleted. `docs/STANDARD_TECHNICAL_DOCUMENT.md` and root `FEATURES.md` were deleted — both are pre-reorganization drafts already rewritten as `SYSTEM_ARCHITECTURE.md` and `FEATURES.md` here.