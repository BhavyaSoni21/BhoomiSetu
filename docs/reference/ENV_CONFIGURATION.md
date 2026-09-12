# Env Configuration — Reference Only

**This document is documentation, not configuration.** Nothing in this
repository's code, build process, or CI reads this file — it exists so a
person can look up where real environment configuration actually lives
and how it got there, without that lookup material being mixed into any
backend's own source directory.

## Where the real `.env` lives

`backend-py/.env` — gitignored, never committed, holds real secrets.
Follows the exact key set and ordering of `backend-py/.env.example`
(the checked-in, values-blank template every key's own purpose is
documented against).

There is **no** repo-root `.env` anymore. `docker-compose.yml`'s
`backend-py` service loads `backend-py/.env` directly via `env_file:`,
overriding only the handful of values that must match the compose
topology itself (`DB_HOST=postgis`, the fixed DB port/name, and the
local-only `RATE_LIMIT_ENABLED` toggle) via its own `environment:` block
— `environment:` entries win over `env_file:` ones for the same key.

## How it got there (2026-09-12)

`backend/.env` (the original NestJS app's own secrets) was the source —
the two apps share the same third-party providers (Groq, Gemini,
OpenRouter, Supabase, TextBee, Zoho Mail), so the same real keys were
copied over rather than obtaining new ones. `backend/`'s own `.env`
still exists, untouched, for whatever's left of the grace period before
`backend/` itself is removed (see `docs/architecture/CUTOVER_AND_OPS_PLAN.md`
§6 step 6) — it is not the source of truth for `backend-py` going
forward, `backend-py/.env` is.

Key names copied (values never appear here or in any chat/log — this is
a reference to *what* was configured, not the configuration itself):

- `JWT_SECRET` — intentionally kept identical between the two apps
  during their side-by-side period (see `backend-py/.env.example`'s own
  comment on this), so a token minted by one validates against the
  other.
- `GROQ_API_KEY`, `GROQ_MODEL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (historical-imagery's
  narrative step)
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`, `TEXTBEE_SIM_SUBSCRIPTION_ID`
  (SMS OTP delivery)
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`,
  `MAIL_FROM` (email OTP delivery)

Left as `backend-py`-specific, not copied from anywhere:
- `DB_*` — points at `backend-py`'s own database (`bhoomisetu_py`), not
  `backend`'s (which no longer exists — see
  `docs/architecture/PYTHON_MIGRATION_PROGRESS.md`'s note on the
  `bhoomisetu` database being retired, not merged).
- `CORS_ORIGIN` — left blank (dev default: any origin allowed).
- `ENVIRONMENT` — set to `development` locally, not `production` (the
  app refuses to start in `production` mode without a real, non-default
  `JWT_SECRET` and real DB credentials — both already true here, but
  `development` is the honest label for what this actually is).

## A known pitfall hit while doing this copy, worth remembering

The first copy pass used `sed` with manual `/`-escaping to substitute
values containing forward slashes (`GROQ_MODEL`, `SUPABASE_URL`,
`OPENROUTER_MODEL` all contain `/`). That escaping was subtly wrong and
silently corrupted those three values (e.g. `GROQ_MODEL` became
`openaiGROQ_MODEL=openai/gpt-oss-20bgpt-oss-20b`) — caught only because
the corrupted `GROQ_MODEL` caused a real, visible `404 model_not_found`
error from Groq at runtime (falling back to Gemini instead, per
`groq_service.py`'s own fallback design), not because anything checked
the file's contents directly. Fixed by reconstructing those three lines
with `awk`'s plain string concatenation (`$1==key { print key"="val }`)
instead of any regex-based substitution — safe regardless of what
characters the value contains, since no regex ever parses it. If this
copy ever needs redoing, prefer that approach over `sed`/`perl`
substitution for any value that might contain `/`, `&`, or other
regex-metacharacters.
