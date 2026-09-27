# 07 — Dev Setup

## Prerequisites

- **PostgreSQL + PostGIS** (the app and the tests both require a real PostGIS DB; SRID 4326).
- **Python 3.10+** (backend).
- **Node.js** (frontend; Vite 4 / React 18).
- **Redis** — optional locally; only needed for background jobs (OCR, Earth Engine, ETL). Without it `.delay()` calls fail but the rest of the API runs.

## Backend

```bash
cd backend-py
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on POSIX
pip install -r requirements.txt

# configure — copy the template and fill DB creds + JWT_SECRET at minimum
cp .env.example .env

# apply schema (REQUIRED before running or testing)
alembic upgrade head

# optional demo data — DESTRUCTIVE: clears spatial tables first
python -m scripts.seed

# run
uvicorn app.main:app --reload --port 8000
```

Local API base: `http://localhost:8000/api/v1`. Swagger is on in dev (off in prod).

### Tests

```bash
cd backend-py
alembic upgrade head            # tests run against the real migrated DB
pytest --ignore=tests/legacy    # tests/legacy is broken (MVT SRID-0) — always exclude
```
Each test runs inside a SAVEPOINT that is rolled back, so the DB is left clean.

### Inspect the live schema (how 05-DATABASE-SCHEMA.md was generated)

```bash
cd backend-py
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -c "
import app.models
from app.database import Base
for t in sorted(Base.metadata.tables):
    tbl = Base.metadata.tables[t]
    print('===', t, '===')
    for c in tbl.columns:
        print(' ', c.name, c.type, 'PK' if c.primary_key else '', '' if c.nullable else 'NN')
"
```

## Frontend

```bash
cd frontend
npm install
# point at your backend (must include /api/v1); defaults to localhost:8000/api/v1
echo 'VITE_API_URL=http://localhost:8000/api/v1' > .env.local
npm run dev                     # Vite dev server
npm run test                    # vitest run
npm run build                   # tsc + vite build -> dist/
```

## After changing code

- Backend model change → create a migration (`alembic revision --autogenerate -m "..."`), review it, `alembic upgrade head`.
- Run `graphify update .` from the repo root to refresh the knowledge graph (`graphify-out/`) — AST-only, no API cost.
- For codebase questions, prefer `graphify query "<question>"` / `graphify explain "<concept>"` / `graphify path "<A>" "<B>"` before grepping.

## Running one-off shell commands in a Claude session

Type `! <command>` in the prompt for interactive commands (e.g. `gcloud auth login`) so their output lands in the conversation.
