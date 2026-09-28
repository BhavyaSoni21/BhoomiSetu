# 02 — Security Audit

**Date:** 2026-09-28. Verified against current code (post-`ec011db`). Phase 0 fixes (unauth land-record CRUD, public department lookups) were confirmed applied and are **excluded**.

## Mechanical evidence

- **Secret scan (git):** CLEAN. `.gitignore` covers `.env*`, service-account keys, `client_secret_*.json`. `frontend/.env.production` contains only a public API URL. No credentials committed.
- **npm audit:** 2 critical (incl. maplibre-gl XSS), 1 high (vite), 4 moderate.
- **pip-audit:** 85 findings total; runtime-relevant: starlette, pillow, cairosvg.

---

## SEC-01 — Case-document IDOR (High)
- **Category:** Broken object-level authorization
- **Role/Route:** Officer/Citizen · `GET /cases/{id}/documents` (cases.py:289-335)
- **Observed:** Any authenticated staff role can manage/read any case regardless of jurisdiction.
- **Expected:** Access scoped to the caller's district/department (as tasks already are).
- **Root cause:** `_can_manage_case` (case_service.py:118-125) checks role only, no jurisdiction — unlike `_can_manage_task` (case_service.py:1380-1396).
- **Fix:** Add district/department scoping mirroring `_can_manage_task`. Confirm intended rule first (could affect cross-district officer flows).
- **Regression test:** officer A (district X) gets 403 on a case in district Y.
- **Status:** OPEN

## SEC-02 — Permissive CORS (Medium)
- **Route:** all · main.py:112-123
- **Observed/Root cause:** broad `allow_origins`. **Fix:** restrict to known frontend origins (Vercel prod + localhost dev).
- **Regression test:** disallowed Origin gets no `Access-Control-Allow-Origin`.
- **Status:** OPEN

## SEC-03 — Workflow invariant TOCTOU (Medium)
- **Route:** workflow transitions · case_service.py:187-210
- **Observed:** invariant read then written without a lock — concurrent transitions can both pass.
- **Fix:** re-check invariant inside the transaction (SELECT ... FOR UPDATE) or enforce via DB constraint.
- **Regression test:** two concurrent transitions → one succeeds, one rejected.
- **Status:** OPEN

## SEC-04 — maplibre-gl XSS + second critical (Critical, dependency)
- **Fix:** upgrade maplibre-gl to a patched release; re-run `npm audit`. **Status:** OPEN

## SEC-05 — vite advisory (High, dependency)
- **Fix:** upgrade vite. Dev/build-time exposure; low runtime demo risk. **Status:** OPEN

## SEC-06 — starlette / pillow / cairosvg (Medium, dependency)
- **Fix:** pin patched versions in requirements; re-run `pip-audit`. **Status:** OPEN

## Verified already-OK (no action)
- Unauthenticated land-record CRUD — **fixed** (require_roles added).
- Public per-parcel department lookups — **fixed** (auth added).
- JWT HS256 + token_version revocation, bcrypt, slowapi rate limiting — present and correct.
