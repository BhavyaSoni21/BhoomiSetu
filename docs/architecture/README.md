# docs/architecture/ — Current State

This directory is the accurate, as-of-now description of BhoomiSetu — what's built, how it's built, and what's genuinely still open. Everything here should reflect the running codebase; if you find something that doesn't, that's a bug in the docs, fix it in place rather than filing a new document about it.

For historical planning documents, completed punch lists, and superseded audits — the record of *how* the project got here — see [`docs/archive/`](../archive/README.md) instead. The root-level [`Tech.md`](../../Tech.md)/[`BHOOMISETU.md`](../../BHOOMISETU.md) are the original team vision/recommended-architecture documents written *before* implementation started — kept as-is at the repo root, not folded in here, since they document intent rather than the as-built system.

| Document | What it covers |
|---|---|
| [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) | API standards, interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX guidelines, color schema summary, deployment/scalability — the nine areas a Standard Technical Document is expected to cover for this problem statement |
| [`FEATURES.md`](FEATURES.md) | Feature-by-feature narrative: what each feature does, the backend logic behind it, where it lives in the frontend |
| [`FEATURE_TECH_MAP.md`](FEATURE_TECH_MAP.md) | The same feature numbering as `FEATURES.md`, but as a lookup table: library → endpoints → exact backend/frontend files |
| [`BHASHINI_INTEGRATION.md`](BHASHINI_INTEGRATION.md) | The multilingual UI (feature 22) deep-dive: Bhashini architecture, what's built vs. still open, and the process for adding new translatable strings |
| [`BhoomiSetu_Bhashini_Support_Doc.pdf`](BhoomiSetu_Bhashini_Support_Doc.pdf) | Bhashini's own (external, not team-authored) support/reference document, kept alongside `BHASHINI_INTEGRATION.md` for context |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Two color/visual systems, kept in one file since they're on the same topic: Part 1 is the portal (Citizen/Officer/Admin) Bauhaus system; Part 2 is the public landing page's own literal-hex palette |
| [`KNOWN_RISKS.md`](KNOWN_RISKS.md) | The most recent full-stack security/performance/reliability audit — a point-in-time snapshot, re-run rather than hand-edited as fixes land |
| [`BACKLOG.md`](BACKLOG.md) | Everything genuinely still open, each item sourced from wherever it was originally scoped in `docs/archive/` |
| [`PYTHON_MIGRATION_PLAN.md`](PYTHON_MIGRATION_PLAN.md) | The committed plan to move the backend from NestJS/TypeScript to Python/FastAPI for production: build `backend-py` independently module-by-module, validate against the ported test suite, single planned-downtime cutover — the *how* is settled, not open |
| [`PYTHON_MIGRATION_PROGRESS.md`](PYTHON_MIGRATION_PROGRESS.md) | Execution status of the plan above, updated phase by phase — in progress, started 2026-09-11 |

**Last reorganized:** 2026-09-11 (moved/merged out of a flatter `docs/` that mixed current references with historical planning documents). Code comments that cite an archived document by its old `docs/<name>.md` path (e.g. `docs/ADMIN_PANEL_ISSUES.md`, `docs/FRONTEND_UPGRADE_SPEC.md`) still point at real files, just under `docs/archive/` now — those comments were left as-is rather than rewritten, since the rationale they record is still accurate even though the exact path moved.

**2026-09-15 follow-up cleanup:** a handful of loose duplicate/superseded documents left behind at `docs/` root from the original reorg (exact copies of files already in `docs/archive/`, plus pre-rename drafts of `SYSTEM_ARCHITECTURE.md`/`FEATURES.md`/`DESIGN_SYSTEM.md`) were finally deleted — see `docs/archive/README.md`'s own note on this for the full list. `docs/` root now holds only `Logo.png` (referenced directly by the repo-root `README.md`) alongside the `architecture/`, `archive/`, and `reference/` subfolders.
