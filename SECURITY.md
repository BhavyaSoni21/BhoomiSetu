# Security Policy

BhoomiSetu (SIH26014 — Land Stack) is a land-governance platform handling
citizen identity, parcel/cadastral records, and officer workflows. We take
security seriously and welcome responsible disclosure.

## Supported Versions

This is an actively developed project deployed from the `main` branch. Only
the current `main` (the live deployment) receives security fixes; older
commits and feature branches are not maintained.

| Version        | Supported          |
| -------------- | ------------------ |
| `main` (live)  | :white_check_mark: |
| older commits  | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's **Security → Report a vulnerability** (private
advisory) on this repository, or contact the maintainer directly through their
GitHub profile.

When reporting, please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a proof of concept if available).
- Affected component (frontend, backend API, database, deployment/config).

What to expect:

- **Acknowledgement:** within a few days.
- **Assessment:** we triage severity and confirm the issue.
- **Fix:** valid, in-scope issues are patched on `main` as a priority;
  we'll keep you updated and credit you if you'd like.

Out of scope: reports against superseded branches, automated scanner output
with no demonstrated impact, and issues in third-party services we don't
control (Render, Vercel, Google Earth Engine).

## Security Measures in Place

Current safeguards (see `docs/architecture/KNOWN_RISKS.md` for the full audit):

- **Authentication:** JWT-based auth; per-account login lockout after repeated
  failed attempts; per-IP rate limiting on the login route.
- **Authorization:** role-based access control (RBAC) enforced server-side;
  citizen / officer / verifier / admin roles are distinct and not
  interchangeable.
- **Data authority:** PostGIS is the authoritative store. The browser holds
  only cache, workspace, and an offline mutation queue — never passwords or
  secrets. Sensitive and final actions require connectivity (online-only).
- **Transport:** HTTPS enforced (HSTS); security headers set at the edge
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`).
- **Deployment:** backend container runs as a non-root user; dependencies are
  pinned and periodically audited (`pip-audit`, `npm audit`).
- **Auditing:** privileged and state-changing operations are recorded via the
  audit log.

> Note: BhoomiSetu is a prototype developed for Smart India Hackathon 2026.
> Some production-grade hardening (e.g. a strict Content-Security-Policy,
> multi-instance-safe lockout storage) is intentionally deferred and tracked
> in the docs above.
