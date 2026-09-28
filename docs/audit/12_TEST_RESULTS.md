# 12 — Test Results

**Date:** 2026-09-28.

## Frontend build
- `npm run build` (tsc + vite): **PASS** (exit 0).

## Dependency audits
- **npm audit:** exit 1 — **2 critical** (incl. maplibre-gl XSS), **1 high** (vite), **4 moderate**. → SEC-04/05.
- **pip-audit:** exit 1 — 85 findings total; runtime-relevant: **starlette, pillow, cairosvg**. → SEC-06.

## Secret scan
- Git secret scan: **CLEAN** — no credentials committed; `.gitignore` covers `.env*`, service-account keys, `client_secret_*.json`.

## Backend pytest
- **Collection error (TEST-01):** `tests/legacy/test_mvt_tiles.py` raises `sqlalchemy.exc.InternalError` (psycopg) **at collection**, which aborts the entire default run (`5 warnings, 1 error in 37.26s`). This is a test-fixture/DB issue, not a runtime defect in MVT serving.
  - **Fix:** repair the legacy test's DB fixture or quarantine `tests/legacy` from the default collection (`--ignore=tests/legacy` or a pytest marker).
- **Rerun excluding legacy** (`pytest -q --ignore=tests/legacy`): **PASS — 623 passed**, 5 deprecation warnings, in 1705.62s (28m25s), exit 0. Command:
  ```
  cd backend-py && .venv/Scripts/python.exe -m pytest -q --ignore=tests/legacy
  ```
  Warnings are all upstream deprecations (anyio BlockingPortal alias, google.api_core Python 3.10 EOL, gotrue→supabase_auth, Pydantic class-based Config) — no action required for demo.

## Regression tests to add (from findings)
- Land-record auth: anon → 401/403 on the six mutations (Phase 0 fix — add coverage).
- SEC-01: officer in district X → 403 on a case in district Y.
- SEC-03: concurrent workflow transitions → one succeeds.
- REL-01: both AI providers raise → deterministic fallback, no NameError.
- API-01: fully-populated task fixture → no blank modal field.
- API-02: replay same queued item twice → one server record.
- UI-01: grep-assert no `landing.govAlignment.departments.` renders literally.
- UI-02: profile with N/M fields → correct completeness %.
- DB-01: `EXPLAIN` shows index scan on task-list query; migration up/down clean.

## Environment note
- `python`/`python3` resolve to the Windows Store alias in Git Bash; use `.venv/Scripts/python.exe` directly, and `node -e` for JSON parsing of audit output.
