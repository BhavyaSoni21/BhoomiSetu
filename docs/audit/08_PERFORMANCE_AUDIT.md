# 08 — Performance Audit

**Date:** 2026-09-28.

## Findings

- **DB-01 (Medium):** unindexed `department_tasks` FKs → sequential scans on task-list / verifier-workload queries. Fine at seed/demo scale; add indexes before any load beyond a handful of users. See `03_DATABASE_AUDIT.md`.
- **DEP-01 (Medium):** no stuck-job reaper — a hung Celery/background job stays "in progress" indefinitely, and health is liveness-only so it won't surface. See `09_DEPLOYMENT_AUDIT.md`.

## Frontend
- Build succeeds (exit 0). No render-loop or unbounded-list defects surfaced in the audited pages.
- React Query caching in use; loading states present (no infinite-loading bug).

## Verdict
No performance blocker for a demo at seed scale. Address DB-01 before any multi-user load test. No profiling was run against production data volumes — this is a static/structural assessment, not a load test.
