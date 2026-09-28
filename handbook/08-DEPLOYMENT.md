# 08 — Deployment

## Topology

| Component | Host | Notes |
|-----------|------|-------|
| Backend (FastAPI) | **Render** | `render.yaml` Blueprint = API web service + Celery worker + Redis ("Key Value") |
| Frontend (Vite SPA) | **Vercel** | root `frontend/`, preset Vite, build `npm run build`, output `dist` |
| Database | Supabase Postgres pooler (or Render Postgres) | PostGIS; `DB_SSL=true` preset |
| Redis | Render Key Value | required for background jobs; `REDIS_URL` auto-wired |

## Secrets model

Render/Vercel can't upload files, so file-shaped secrets are pasted as env-var strings. The **GEE service-account key** goes whole into `GEE_SERVICE_ACCOUNT_KEY_JSON` (JSON wins over `_KEY_PATH`). Leave both blank to run without Earth Engine — only `/change-detection/analyze-satellite` degrades to 503.

## Backend env vars (`sync: false` — you fill them)

- **Required (prod boot refuses to start otherwise):** `DB_HOST/PORT/USERNAME/PASSWORD/NAME`, `JWT_SECRET` (a real secret — the placeholder is rejected), `CORS_ORIGIN` (Vercel URL(s), comma-separated).
- `FRONTEND_URL`.
- **Recommended (prod):** `TRUSTED_HOSTS` — comma-separated hostnames the API answers on (e.g. `bhoomisetu-api.onrender.com`). Activates `TrustedHostMiddleware` (Host-header validation / BadHost mitigation); unset means allow-any. See [09-SECURITY.md](09-SECURITY.md).
- **Optional third-party:** `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GEE_*`, `SUPABASE_*`, `TEXTBEE_*`, `MAIL_*`, `GOOGLE_OAUTH_*`, `ULCA_*` (Bhashini).
- `REDIS_URL` auto-wired by the Blueprint.
- Full template lives in `backend-py/.env.example`.

## Frontend env var

- **`VITE_API_URL`** = Render API base **including `/api/v1`**, e.g. `https://bhoomisetu-api.onrender.com/api/v1`.
- `frontend/vercel.json` rewrites all routes to `index.html` (SPA).

## Post-deploy loop

1. Deploy backend → get its URL.
2. Deploy frontend with `VITE_API_URL` → get the Vercel URL.
3. Put the Vercel URL back into backend `CORS_ORIGIN` + `FRONTEND_URL`, and into the Google OAuth redirect (`<VERCEL_URL>/auth/callback`).

## Migrations & seed on the target DB

```bash
alembic upgrade head
python -m scripts.seed     # optional demo data — DESTRUCTIVE (clears spatial tables)
```

## Docker (local full stack)

`docker compose up --build` brings up: frontend (nginx `5173:80`), backend (`8000:8000`, non-root `appuser`), `migrate`, `worker`, `redis`, `postgis` (image `postgis/postgis:15-3.3`, DB `bhoomisetu_py`, port not published).

## Health & jobs

- **Liveness:** `GET /health` (always 200 if the process is up).
- **Readiness:** `GET /health/ready` — checks the app can actually serve (DB reachable); point the platform's health check here so a booted-but-not-ready instance isn't sent traffic.
- **Stuck-job reaper:** `POST /api/v1/jobs/reap` (ADMIN) requeues/fails jobs wedged past their deadline. Wire it to a scheduler (Celery beat / cron) or hit it manually.

## Gotchas

- Redis absent → `.delay()` background jobs fail silently; the rest of the API is unaffected.
- Without EE creds, satellite change detection returns 503 by design.
- CORS falls back to `"*"` with credentials only when `CORS_ORIGIN` is unset — safe only because the prod boot-guard forces it to be set (see [09-SECURITY.md](09-SECURITY.md), MED-2).
