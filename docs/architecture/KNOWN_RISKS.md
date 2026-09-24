# BhoomiSetu Platform Audit (Known Risks)

*Point-in-time audit, re-run 2026-09-24 against the **current FastAPI/Python backend** (`backend-py/`) and the React/Vite frontend. This supersedes the earlier NestJS-era audit (the project was ported from NestJS/TypeORM to FastAPI/SQLAlchemy — see `docs/archive/PYTHON_MIGRATION_PROGRESS.md`); most of that audit's findings are now resolved by the rewrite and are recorded below as such. This is not a living document — re-run rather than hand-edit as fixes land.*

- **Scope:** `backend-py/` (FastAPI, SQLAlchemy 2.0 + GeoAlchemy2, Alembic) and `frontend/` (React 18 + Vite 4, React Query v4, MapLibre GL).
- **Method:** static review against the source and the graphify knowledge graph, cross-checked against the automated test suites (pytest, ~560 backend tests; vitest, 35 frontend specs). No source files were modified during this audit.
- **Context:** SIH 2026 Land Stack prototype (GIS-based Digital Public Infrastructure for land governance; pilots Chandigarh / Tamil Nadu).

---

## 1. Executive Summary

The port from NestJS/TypeORM to FastAPI/SQLAlchemy closed the large majority of the previous audit's findings — not as a side effect, but because the rewrite adopted the recommended patterns directly: schema is now managed by **Alembic migrations** (no `synchronize`/`create_all` anywhere), JWTs carry a **revocable `tokenVersion`** re-checked on every request, `/auth/login` has **both** per-IP rate limiting **and** a per-account lockout, list endpoints are **paginated**, the workflow N+1 is gone (`selectinload`), every portal route is **lazy-loaded**, security headers and a `/health` endpoint exist, and Swagger is disabled in production.

What remains is smaller and specific. **One Critical persists unchanged from the old stack** — `maplibre-gl@4.7.1` still ships with the confirmed XSS-sanitizer-bypass advisory (fix is a semver-major jump to 6.9.0). Beyond that, this audit found a **staff list-cases endpoint that isn't department-scoped**, a **silently-broken idle-timeout middleware**, a **credentialed-any-origin CORS fallback** (safe only because a production boot-guard forces `CORS_ORIGIN`), and the **absence of a CSP** — which matters more than it would otherwise precisely because the maplibre XSS is still live and CSP is its natural compensating control.

**Overall risk rating: Low-to-Moderate.** The architecture is sound and the session/data-safety gaps that dominated the previous audit are closed. The residual list is a dependency upgrade, one access-control scope check, and two config/middleware fixes — hours of work, not a rewrite.

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 1 |
| Medium | 3 |
| Low | 2 |
| Backend tests | ~560 `def test_` across 56 files (pytest) |
| Frontend tests | 35 specs (vitest + MSW) |

---

## 2. Current Stack

| Layer | Stack |
|---|---|
| Backend runtime | FastAPI 0.115 on uvicorn 0.34 (Python) |
| ORM / spatial | SQLAlchemy 2.0 + GeoAlchemy2; PostGIS via psycopg2 |
| Migrations | Alembic (48 version files) — no auto-`create_all` |
| Auth | JWT via `python-jose[cryptography]` (HS256); password hashing via `bcrypt` directly (passlib dropped); Google OAuth |
| Rate limiting | `slowapi` (per-IP) + per-account `login_guard` |
| Async jobs | Celery + Redis |
| Frontend | React 18.2, Vite 4.4, React Query v4, react-router-dom v6, Zustand, MapLibre GL 4.7.1, Tailwind 3.3 |
| Object storage | Supabase Storage (private bucket) + contained local-disk fallback |

---

## 3. Open Findings

### CRIT-1 — maplibre-gl 4.7.1 ships with a confirmed critical XSS sanitizer bypass

- **Severity:** Critical · Security · Dependency
- **File:** `frontend/package.json` (`maplibre-gl` `^4.0.0`, resolved 4.7.1) · `frontend/src/features/map/MapComponent.tsx` (popup HTML)

**Problem:** the installed `maplibre-gl@4.7.1` carries advisory GHSA-jrc7-96c5-q579 — *"XSS Sanitizer Bypass in `DOM.sanitize()` via Live NamedNodeMap Removal Skip"* — vulnerable range `<=6.4.0`, fixed in 6.9.0 (semver-major). This is the **one finding carried over unchanged from the NestJS-era frontend**; the backend rewrite didn't touch it.

**Impact:** MapLibre popups are the one place the app renders HTML on the map. The app's own popup builder escapes interpolated values (mitigating factor), so exploitability today needs a second bug (a forgotten escape) — but with no CSP (MED-3) this library flaw is the last line of defense.

**Fix:** upgrade to `maplibre-gl@6.9.0+` and re-verify popup/layer code against its changelog; until then treat every `.setHTML()` call site's escaping as load-bearing, and add a CSP as compensating control.

### HIGH-1 — Staff `GET /cases` is not department-scoped

- **Severity:** High · Security · Access Control
- **File:** `backend-py/app/routers/cases.py` (`list_cases`, gated only on `ALL_STAFF_ROLES`)

**Problem:** the citizen self-scoping IDOR is fixed (a citizen only sees their own cases), but the staff path gates on role alone — any staff role can list cases across every department, unlike `GET /workflows`, which applies a `ROLE_DEPARTMENT` filter for non-ADMIN callers. This is the same inconsistency the old audit's HIGH-9 flagged for workflows (now fixed there), reappearing for cases.

**Fix:** apply the workflow department-scoping pattern to `list_cases`, or explicitly confirm cases are intended to be cross-department-visible and document that decision.

---

## 4. Medium / Low Findings

| ID | Sev | Finding | File |
|---|---|---|---|
| MED-1 | Medium | `LastActivityMiddleware` is a silent no-op: it calls `get_current_user(token)` with a raw string where the dependency expects `HTTPAuthorizationCredentials` + a DB session, inside a bare `except: pass`. Idle-timeout tracking never runs. Low impact today (idle timeout defaults to 0/disabled) but the feature won't work as written. | `app/middleware.py` |
| MED-2 | Medium | CORS falls back to `"*"` when `CORS_ORIGIN` is unset **and** sets `allow_credentials=True` — a credentialed-any-origin config. Safe in production only because `main.py` refuses to boot there without `CORS_ORIGIN`; any non-production deployment is exposed. | `app/config.py`, `app/main.py` |
| MED-3 | Medium | No Content-Security-Policy on backend responses or in `frontend/vercel.json`. Other headers are present (X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, HSTS, Permissions-Policy). CSP is the natural compensating control for CRIT-1 and is absent. | `app/middleware.py`, `frontend/vercel.json` |
| LOW-1 | Low | JWTs carry no `exp` claim (deliberate "stay logged in until Logout" product decision). Mitigated by the revocable `tokenVersion` (logout/password-change invalidate all prior tokens server-side) and an optional idle-timeout hook (default off). Documented trade-off, not an oversight. | `app/auth/deps.py` |
| LOW-2 | Low | Token stored in `localStorage` (readable by any script on the page). Standard SPA trade-off; the `tokenVersion` revocation limits blast radius. Revisit if CRIT-1/CSP aren't closed. | `frontend/src/features/auth/auth.ts` |

---

## 5. Resolved Since the NestJS Audit

Recorded so the previous audit's findings aren't re-investigated as open. Each was closed by the FastAPI rewrite:

| Old ID | Finding | How it's resolved now |
|---|---|---|
| HIGH-1 | No login brute-force protection | Per-IP `slowapi` `20/minute` on `/login` + per-account `login_guard` (5 fails → 15-min lock) |
| HIGH-2 | Non-expiring, non-revocable sessions | Revocable `tokenVersion` in JWT, re-checked every request; `/logout` bumps it server-side |
| HIGH-3 | `synchronize: true` against prod DB | No TypeORM; Alembic migrations only (48 files), no `create_all` |
| HIGH-4 | Path traversal in local-disk storage | `_resolve_local_path` rejects keys escaping the fallback dir (with a test); prod uses a private Supabase bucket |
| HIGH-5 | multer DoS advisories | multer gone; uploads via `python-multipart` (Starlette) |
| HIGH-6 | Unbounded list endpoints | `limit`/`offset` on audit, workflows, cases; `skip`/`limit` on citizen listings |
| HIGH-7 | N+1 on workflow steps | `selectinload(Workflow.steps)` batch-loads |
| HIGH-8 | No route code-splitting (1.98 MB bundle) | Every portal/page `React.lazy` + `Suspense` in `App.tsx` |
| HIGH-9 | Workflow detail not dept-scoped | `find_one` 404s a non-ADMIN officer with no step in their department (see HIGH-1 above for the same gap still open on *cases*) |
| MED-2 | Swagger exposed in production | `docs_url`/`openapi_url` = None in production |
| MED-3 | No security headers | `SecurityHeadersMiddleware` (X-Frame-Options, HSTS in prod, etc.) + `vercel.json` headers — CSP still pending (MED-3 above) |
| MED-7 | No `/health` endpoint | `GET /health` liveness (no DB round-trip) |
| MED-8 | No exception filter / request-ID | `RequestIdMiddleware` + registered exception handlers returning `{statusCode,message,error,requestId}` |

RBAC is intact and distinct — CITIZEN, eight officer roles, ADMIN (`ALL_STAFF_ROLES`), with VERIFIER deliberately excluded from staff roles (separation of duties), enforced via `require_roles(*roles)`.

---

## 6. Recommended Fix Order

1. **CRIT-1** — upgrade maplibre-gl to 6.9.0+ (re-verify popups) — the one genuinely open Critical.
2. **HIGH-1** — department-scope staff `GET /cases` (or document cross-department intent).
3. **MED-3** — add a CSP (compensating control for CRIT-1) on both `vercel.json` and backend responses.
4. **MED-2** — drop `allow_credentials` when origin is the `"*"` fallback, or fail fast on unset `CORS_ORIGIN` outside production too.
5. **MED-1** — fix or remove `LastActivityMiddleware` so idle-timeout works or is honestly absent.

---

*No source files were modified during this audit. Findings are from static review cross-checked against the graphify graph and the automated suites; where live reproduction wasn't run (e.g. the maplibre CVE), the finding cites the advisory and the installed version rather than a fresh exploit.*
