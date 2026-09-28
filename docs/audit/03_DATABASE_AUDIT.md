# 03 — Database Audit

**Date:** 2026-09-28. SQLAlchemy 2 + GeoAlchemy2/PostGIS, Alembic migrations.

## DB-01 — Unindexed FKs on `department_tasks` (Medium)
- **Feature:** officer/admin task queues, workload counts.
- **Observed:** `department_tasks` foreign keys (case_id, department_id, assigned_verifier_id) lack indexes (models/case.py:149-197). Task-list and verifier-workload queries do sequential scans; fine at seed scale, degrades with volume.
- **Expected:** indexed FKs for the columns joined/filtered on.
- **Root cause:** columns declared without `index=True`; no composite index for the common (department_id, status) filter.
- **Fix:** add indexes + Alembic migration (follow `alembic/versions/` `_now()` base pattern). Candidate: `ix_department_tasks_case_id`, `ix_department_tasks_department_id`, `ix_department_tasks_assigned_verifier_id`, and `(department_id, status)` composite.
- **Regression test:** `EXPLAIN` on the task-list query shows index scan; migration `upgrade head` on scratch DB succeeds and `downgrade` reverses.
- **Status:** OPEN

## Timestamp/timezone note
- Case/workflow tables use naive-UTC `_now()` (case_service.py:114) consistently. `AuditLog.created_at` uses `func.now()` into a non-`timestamptz` column (models/audit.py:57) — DB-timezone dependent; if the audit-idempotency/UTC migration (plan B2) is not yet applied, audit timestamps may drift from the app's UTC store. Confirm and align to one UTC store, convert on display.

## Verified already-OK
- Workflow state machine + transition validation present.
- Migrations apply cleanly aside from the legacy MVT test-fixture DB issue (see `12_TEST_RESULTS.md`, TEST-01).
- No N+1 detected in the audited case/verifier read paths beyond the missing indexes above.
