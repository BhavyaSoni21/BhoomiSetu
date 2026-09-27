# 03 — Backend (`backend-py/`)

FastAPI application; **source of truth** for the whole system. (A retired NestJS backend once lived in `backend/` — it is gone; `backend-py/` is authoritative.)

## Stack

| Concern | Technology |
|---------|------------|
| Framework | FastAPI 0.115.x + Uvicorn |
| Validation | Pydantic 2.10.x — `CamelModel` base emits camelCase to the frontend |
| ORM | SQLAlchemy 2.0.x + GeoAlchemy2 0.16.x (PostGIS geometry) |
| Driver | psycopg2 |
| Migrations | Alembic (49 migrations; baseline `ff7c6e8d9c1f`) |
| Auth | python-jose (HS256 JWT), bcrypt |
| Rate limiting | slowapi (200/min default; tighter on AI/OCR/imagery) |
| Async jobs | Celery + Redis (OCR, Earth Engine, ETL, master-plan recompute) |
| Python | 3.10+ (uses PEP 604 unions) |

## App layout

```
backend-py/app/
├── main.py            # app factory, middleware, router mounting, prod boot guards
├── config.py          # Settings (pydantic-settings); all env vars
├── database.py        # engine, SessionLocal, Base
├── auth/              # deps.py (require_roles), JWT, password hashing
├── models/            # 59 SQLAlchemy models (see 05-DATABASE-SCHEMA.md)
├── schemas/           # Pydantic request/response (CamelModel)
├── routers/           # ~27 API routers
├── services/          # ~40 business-logic services
├── common/            # pagination, shared helpers
alembic/versions/      # 49 migration files
scripts/               # seed, translate_ui_strings.py, etc.
static/                # ui_strings_{lang}.json (11 languages)
tests/                 # pytest against real PostgreSQL/PostGIS
```

## Routing

- All routers mount under `/api/v1` **except** `health` (no prefix) and `multilingual` (self-prefixed `/api/v1/multilingual`).
- `land_records` mounts two routers: `state_a_router` + `state_b_router` (the interoperability demo).
- Router groups: auth, users, parcels, gis/spatial (MVT tiles), cases, workflows, departments, land_records, verification/evidence, notifications + notification_feed, multilingual, ai, ocr, change-detection, historical-imagery, analytics, admin, sync, health.

## Auth model

- **JWT HS256**, payload `{sub, email, role, tokenVersion}`. **No `exp` claim by design** — a session stays valid until logout bumps `token_version`; optional idle timeout (default 0).
- `require_roles(*roles)` is the dependency: no roles = any authenticated user; role mismatch = **403**; unauthenticated = **401**.
- Per-account lockout: 15 min after 5 failed logins → 429 *before* credential validation (in-memory / process-local).
- Registration uses `pending_registrations` + OTP (email/SMS) before a `users` row is created; Google OAuth supported.

## Middleware & error contract

Order: `RequestId → LastActivity → SecurityHeaders`, plus exception handlers. Every error returns a structured envelope:

```json
{ "statusCode": 4xx, "message": "...", "error": "...", "requestId": "..." }
```

CORS allows configured origins (`CORS_ORIGIN`) plus a Vercel preview regex.

## Production boot guards (`main.py`)

Refuses to start in production if any of these is unset/placeholder: `JWT_SECRET`, DB credentials, `CORS_ORIGIN`. Swagger is disabled in production.

## External integrations (all with fallbacks)

| Service | Use | Fallback |
|---------|-----|----------|
| Groq (`openai/gpt-oss-20b`) | AI intake, routing, explanations | 503 + deterministic routing |
| Google Earth Engine | Sentinel-2 change detection | 503 |
| Bhashini (ULCA/Dhruva) | translate / transliterate / TTS / ASR | raw key / cached fallback |
| OpenRouter | historical-comparison narratives only | plain facts |
| TextBee | SMS | in-app notification |
| SMTP | email | in-app notification |
| Supabase Storage | file storage (private bucket) | local-disk fallback |

`google-generativeai` (Gemini) is configured but **not wired** into any endpoint.

## Rate limits

200/min default; 30/min for AI / change-detection / imagery; 20/min for OCR.

## Testing

- Real **PostgreSQL + PostGIS** required; each test runs in a SAVEPOINT rolled back after. Needs `alembic upgrade head` first.
- `tests/legacy/` is broken/manual (an MVT SRID-0 extent-collection error) — exclude with `--ignore=tests/legacy`.
- See [07-DEV-SETUP.md](07-DEV-SETUP.md) to run them.
