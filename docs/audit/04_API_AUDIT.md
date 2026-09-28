# 04 — API Contract Audit

**Date:** 2026-09-28. FastAPI + Pydantic `CamelModel` (camelCase wire via `by_alias`); React Query v4 clients.

## API-01 — Blank officer task-detail fields, snake vs camel (High)
- **Feature/Role/Route:** Officer task-detail modal.
- **Observed:** Several fields render blank in `OfficerTaskDetailModal.tsx` (lines 73, 110, 514, 520-522) because the component reads snake_case properties while the API emits camelCase (or vice-versa on a subset of fields).
- **Expected:** every populated backend field shows in the modal.
- **Root cause:** field-name casing mismatch between the out-schema (camelCase alias) and the component's property access.
- **Fix:** align the component to the camelCase wire contract; add a shared response type so drift is caught by tsc.
- **Regression test:** render modal with a fully-populated task fixture; assert no expected field is empty.
- **Status:** OPEN

## API-02 — Verifier offline sync: non-idempotent replay + silent localStorage loss (Medium)
- **Feature/Role/Route:** Verifier `/submit` offline queue (`verifierLocalSyncService.ts`).
- **Observed:** replay (lines 170-241) re-POSTs without an idempotency key — a retried/duplicated submission can create duplicate field-evidence/findings. localStorage fallback (76-92) can silently drop entries (quota/parse failure) with no surfaced error.
- **Expected:** one logical submission = one server record; queue failures visible to the verifier.
- **Root cause:** no idempotency key on multipart replay; localStorage errors swallowed.
- **Fix:** attach a client-generated idempotency key per submission (backend dedups); surface queue read/write failures in the offline-status UI.
- **Regression test:** replay the same queued item twice → one server record; simulate localStorage failure → user-visible error.
- **Status:** OPEN

## Verified already-OK
- Evidence pipeline unified (Option 2): TaskSubmissionPage uploads photo **bytes** (multipart) to `POST /workflows/{id}/field-evidence`; findings post to `/cases/{caseId}/findings` (previous task-id mis-key → 403 is fixed). `add_field_evidence` accepts DepartmentTask-level verifier assignment. See memory `evidence-pipeline-unified`.
- Structured error middleware present; error responses carry codes.
- Pagination helper (`common/pagination.py`) and `CamelModel` base used consistently on audited endpoints.
