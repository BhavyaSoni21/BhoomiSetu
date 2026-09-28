# 01 — BhoomiSetu Master Audit Report

**Date:** 2026-09-28
**Scope:** Full pre-demo audit (backend FastAPI + PostGIS, React/TS frontend, AI chain, deployment).
**Method:** 6 parallel read-only investigation agents (graphify-first) + mechanical evidence (npm audit, pip-audit, git secret scan, pytest, build). Findings verified against current code (post-commit `ec011db` "correction-plan Phase 0/1"); already-fixed items excluded.

## Verdict

Demo-ready with caveats. No secrets in the repo, dead-code clean, frontend build passes. Two **P0 judge-visible** UI defects (raw i18n keys on the landing page, fake profile completeness/timestamps) should be fixed before a live demo. One **High** IDOR (SEC-01) and one **High** reliability bug (REL-01) are the top backend risks. Dependency advisories (maplibre-gl critical, vite high) are real but low demo-risk.

## Severity summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | SEC-04 |
| High | 5 | SEC-01, SEC-05, REL-01, API-01, UI-01, UI-02 |
| Medium | 8 | SEC-02, SEC-03, SEC-06, DB-01, DEP-01, API-02, TEST-01 |
| Low/P2 | 3 | UI-03, UI-04, UI-05 |

## Category reports

- Security → `02_SECURITY_AUDIT.md`
- Database → `03_DATABASE_AUDIT.md`
- API contracts → `04_API_AUDIT.md`
- UI/UX → `05_UI_UX_AUDIT.md`
- GIS → `06_GIS_AUDIT.md`
- AI → `07_AI_AUDIT.md`
- Performance → `08_PERFORMANCE_AUDIT.md`
- Deployment → `09_DEPLOYMENT_AUDIT.md`
- SIH demo readiness → `10_SIH_DEMO_READINESS.md`
- Open issues (CSV) → `11_OPEN_ISSUES.csv`
- Test results → `12_TEST_RESULTS.md`

## Pre-demo fix priority (recommended order)

1. **UI-01** raw i18n keys on landing page — visible on first load. ~15 min.
2. **UI-02** fake profile completeness/lastActive — visible when opening any profile. ~30 min.
3. **REL-01** undefined logger in AI error path — a chat error becomes a hard 500/NameError. ~5 min.
4. **API-01** blank officer task-detail fields — casing mismatch. ~15 min.
5. **SEC-01** case-document IDOR — scope before demoing multi-role.

## Final consolidated table

| ID | Severity | Category | Issue | Root Cause | Fix | Status | Verified |
|---|---|---|---|---|---|---|---|
| SEC-01 | High | Security | Case-document IDOR | `_can_manage_case` unscoped | Add jurisdiction scoping | OPEN | No |
| SEC-02 | Medium | Security | Permissive CORS | broad allow_origins | Restrict origins | OPEN | No |
| SEC-03 | Medium | Security | Invariant TOCTOU | read-then-write, no lock | Recheck in txn | OPEN | No |
| SEC-04 | Critical | Dependency | maplibre-gl XSS | vulnerable version | Upgrade | OPEN | No |
| SEC-05 | High | Dependency | vite advisory | vulnerable version | Upgrade | OPEN | No |
| SEC-06 | Medium | Dependency | starlette/pillow/cairosvg | outdated | Pin patched | OPEN | No |
| REL-01 | High | Reliability | AI error path NameError | undefined `logger` | Define logger | OPEN | No |
| DB-01 | Medium | Database | Unindexed department_tasks FKs | missing indexes | Add indexes+migration | OPEN | No |
| DEP-01 | Medium | Deployment | No job reaper / liveness-only health | missing readiness | Add reaper+readiness | OPEN | No |
| API-01 | High | API/UI | Blank officer task fields | snake/camel mismatch | Align casing | OPEN | No |
| API-02 | Medium | Offline | Non-idempotent replay + silent loss | no idempotency | Idempotency keys | OPEN | No |
| UI-01 | High | UI/i18n | Raw i18n keys (landing) | missing keys/fallback | Add keys | OPEN | No |
| UI-02 | High | UI/Data | Fake completeness/lastActive | hardcoded literals | Compute real | OPEN | No |
| UI-03 | P1 | UI/Theme | Dark-mode contrast | no dark: override | Use ink token | OPEN | No |
| UI-04 | P2 | UI | Empty-vs-error confusion | no isError branch | Add error branch | OPEN | No |
| UI-05 | P2 | UI | Table clip | no overflow-x-auto | Add wrapper | OPEN | No |
| TEST-01 | Medium | Testing | Legacy suite collection error | psycopg InternalError | Fix/quarantine | OPEN | No |
