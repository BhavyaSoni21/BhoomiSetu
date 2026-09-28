# 09 — Deployment Audit

**Date:** 2026-09-28. Docker Compose (local) + Render (prod backend, onrender.com) + Vercel (prod frontend); Celery/Redis for background jobs.

## DEP-01 — No job reaper + liveness-only health (Medium)
- **Route:** `GET /health` (health.py:11-13); jobs (jobs.py:48-78).
- **Observed:** `/health` returns liveness only — it does not check DB/Redis/dependencies, so a degraded backend still reports healthy to Render. Background jobs have no reaper: a job that dies mid-run stays flagged in-progress forever.
- **Expected:** a readiness probe that verifies critical dependencies; a reaper that fails/requeues stale jobs.
- **Fix:** add a `/ready` (or extend `/health`) that pings DB + Redis; add a periodic reaper that marks jobs stale after a timeout. Point Render's health check at the readiness endpoint.
- **Regression test:** stop Redis → readiness returns unhealthy; stale job → reaper marks it failed.
- **Status:** OPEN

## Config / secrets
- **CLEAN:** `.gitignore` covers `.env*`, service-account keys, `client_secret_*.json`, with force-add exceptions for `backend-py/.env.example` and `frontend/.env.production`.
- `frontend/.env.production` = public API URL only (`https://bhoomisetu-ryh4.onrender.com/api/v1`). Prod VITE_API_URL default committed (commit 10d98d1) so the hosted build can't fall back to localhost — good.
- **SEC-02 (CORS):** verify prod `allow_origins` includes the Vercel domain and excludes wildcards before demo. See `02_SECURITY_AUDIT.md`.

## Dependency posture (see `12_TEST_RESULTS.md` for full numbers)
- npm: 2 critical / 1 high / 4 moderate. pip: runtime-relevant starlette/pillow/cairosvg.
- Upgrade before public exposure; none block a controlled demo.
