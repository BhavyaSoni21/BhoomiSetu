# Deployment (Render + Vercel)

Backend (FastAPI + PostGIS + Celery) runs on **Render**; frontend (Vite SPA) on
**Vercel**. The one non-obvious part is secrets: Render/Vercel don't let you
upload files, so every secret — including the Google Earth Engine service-account
key — goes in as an **environment-variable string**, not a file.

## The GEE key (the "can't upload JSON files" problem)

Locally you point `GEE_SERVICE_ACCOUNT_KEY_PATH` at the downloaded `*.json` key.
On Render there's no file to point at, so instead paste the **entire contents**
of that JSON key into `GEE_SERVICE_ACCOUNT_KEY_JSON` as a single value (Render's
env-var editor accepts multi-line paste). The app feeds it to Earth Engine as
`key_data` (see `app/services/earth_engine_service.py:gee_credentials`). If both
`_KEY_JSON` and `_KEY_PATH` are set, JSON wins. Leave both blank to run without
Earth Engine — only `/change-detection/analyze-satellite` degrades (503); manual
upload still works.

Same idea for any other file-shaped secret: paste the content, don't upload.

## Backend on Render

1. Push this repo to GitHub.
2. Render dashboard → **Blueprints** → point at this repo. `render.yaml` defines
   the API web service, a Celery worker, and a Redis (Key Value) instance.
3. Fill the `sync: false` env vars in the dashboard (they're intentionally blank
   in `render.yaml` so no secret is committed):
   - **DB**: `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME` from your Supabase
     pooler (or a Render Postgres). `DB_SSL=true` is preset.
   - **JWT_SECRET**: a real random secret (production boot refuses the placeholder).
   - **CORS_ORIGIN**: your Vercel URL(s), comma-separated.
   - **FRONTEND_URL**: your Vercel URL (used for deep links / OAuth redirect).
   - Third-party keys as needed: `GROQ_API_KEY`, `GEMINI_API_KEY`,
     `OPENROUTER_API_KEY`, `GEE_SERVICE_ACCOUNT_EMAIL` + `GEE_SERVICE_ACCOUNT_KEY_JSON`,
     `SUPABASE_*`, `TEXTBEE_*`, `MAIL_*`, `GOOGLE_OAUTH_*`, `ULCA_*`.
   - `REDIS_URL` is wired automatically from the Redis instance.
4. Render sets `$PORT`; the Dockerfile's `CMD` already binds it.
5. Migrate the DB once (Render Shell on the API service, or locally against the
   same DB): `alembic upgrade head`. Seed only if you want demo data:
   `python -m scripts.seed` (destructive — clears spatial tables).

Redis is required for background jobs (OCR, Earth Engine, ETL, master-plan
recompute) to actually run. Without it, `.delay()` calls will fail when hit; the
rest of the API is unaffected.

## Frontend on Vercel

1. Vercel → **New Project** → import this repo, root directory `frontend/`.
   Framework preset **Vite** (build `npm run build`, output `dist`).
2. Set **`VITE_API_URL`** to your Render API base, including the path prefix:
   `https://bhoomisetu-api.onrender.com/api/v1`.
3. `frontend/vercel.json` already rewrites all routes to `index.html` for SPA
   client-side routing.
4. After the first frontend deploy, put the Vercel URL back into the backend's
   `CORS_ORIGIN` and `FRONTEND_URL` on Render, and into the Google OAuth
   authorized redirect (`<VERCEL_URL>/auth/callback`).

## Checklist

- [ ] `JWT_SECRET` is a real secret, not `change_this_in_production`
- [ ] `CORS_ORIGIN` = the Vercel URL (not blank → not wide-open in prod)
- [ ] GEE key pasted as `GEE_SERVICE_ACCOUNT_KEY_JSON` string
- [ ] `alembic upgrade head` run against the prod DB
- [ ] `VITE_API_URL` on Vercel points at the Render `/api/v1` base
