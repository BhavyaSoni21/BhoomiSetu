# 09 — Security

Overall posture (audit re-run 2026-09-24, current FastAPI stack): **Low-to-Moderate**.

## Measures in place

- **Auth:** JWT (HS256); per-account login lockout (15 min after 5 failed logins → 429 *before* credential validation); per-IP rate limiting on `/login`.
- **RBAC:** enforced server-side via `require_roles(*roles)`; citizen/officer/verifier/admin roles distinct and non-interchangeable; verifier deliberately excluded from staff roles (separation of duties).
- **Data authority:** PostGIS is authoritative; the browser holds only cache/workspace/offline queue — never passwords/secrets. Sensitive/final actions are online-only.
- **Transport:** HTTPS enforced (HSTS); edge security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) via `SecurityHeaders` middleware.
- **Boot guards:** production refuses to start with unset/placeholder `JWT_SECRET`, missing DB creds, or unset `CORS_ORIGIN`. Swagger off in prod.
- **Host validation:** `TrustedHostMiddleware` rejects requests whose `Host` header isn't in `TRUSTED_HOSTS` (comma-separated) — mitigates Starlette BadHost path-poisoning (PYSEC-2026-161). No-op `["*"]` until `TRUSTED_HOSTS` is set, so set it in prod.
- **Rate limits:** 200/min default; 30/min AI/change-detection/imagery; 20/min OCR.
- **Auditing:** privileged/state-changing ops recorded in `audit_logs`; case transitions in `case_timeline_events`.
- **Deployment:** non-root backend container; dependencies pinned; periodic `pip-audit` / `npm audit`.
- **Mock dept endpoints:** `land_records.py` and per-parcel dept lookups are env-flag gated (`EXPOSE_MOCK_DEPT_APIS` / `require_mock_dept_apis_enabled`) → **404 in prod**, so demonstration adapters aren't live.

## JWT design (deliberate)

HS256, payload `{sub, email, role, tokenVersion}`, **no `exp` claim**. Session stays valid until logout bumps `token_version` (revocable); optional idle timeout (default 0). This is a documented prototype trade-off.

## Known risks (open register)

| ID | Severity | Issue |
|----|----------|-------|
| ~~CRIT-1~~ | ~~Critical~~ | **RESOLVED (2026-09-28):** `maplibre-gl` upgraded 4.7.1 → 6.11.2; `npm audit` 0 critical/0 high. (XSS sanitizer-bypass GHSA-jrc7-96c5-q579.) |
| HIGH-1 | High | Staff `GET /cases` (`list_cases`) is **not department-scoped** (unlike `GET /workflows`). |
| MED-1 | Medium | `LastActivityMiddleware` is a silent no-op — idle timeout never actually runs. |
| MED-2 | Medium | CORS falls back to `"*"` with `allow_credentials=True` when `CORS_ORIGIN` unset (safe only because the prod boot-guard forces it). |
| MED-3 | Medium | No Content-Security-Policy (natural compensating control for CRIT-1). |
| LOW-1 | Low | JWTs carry no `exp` (deliberate; mitigated by revocable `tokenVersion`). |
| LOW-2 | Low | Token stored in `localStorage`. |

Explicitly deferred hardening: strict CSP, multi-instance-safe lockout storage (current lockout is in-memory / process-local). Starlette DoS advisories PYSEC-2026-{2280,2281,248,249} are fixed only in Starlette 1.x, which no released FastAPI (≤0.141.1) supports — blocked upstream; low risk (DoS-class), revisit when a Starlette-1.0-compatible FastAPI ships.

## Handling credentials in this repo

- Never print or log secret **values** (Bhashini keys, JWT secret, DB password) — reference by name/length only.
- Secrets live only in server-side env config, never in frontend code or the repo.

## Disclosure

Private GitHub Security advisory; only `main` (live) is supported.
