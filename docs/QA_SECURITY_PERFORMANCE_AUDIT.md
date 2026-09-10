# BhoomiSetu Platform Audit

A full-stack functional, security, performance, and reliability review of the BhoomiSetu land-governance prototype — NestJS/TypeORM backend, React/Vite frontend, PostGIS-backed spatial data — conducted against the running application, its source, and its automated test suites. Published as an interactive report at the artifact link below; this file is the same content in Markdown for the repo.

- **Scope:** `backend/` (150 files, ~9.5k LOC) and `frontend/` (95 files, ~13.3k LOC)
- **Method:** static review + live authenticated API calls + automated suites + `npm audit` + a real production build. No source files were modified during this audit.
- **Context:** SIH 2026 Land Stack prototype (problem statement: a GIS-based Digital Public Infrastructure for land governance, piloted in Chandigarh/Tamil Nadu)
- **Interactive version:** https://claude.ai/code/artifact/8ceb28ca-83d4-4168-a620-7a5e88a2c854

---

## 1. Executive Summary

BhoomiSetu is a genuinely substantial prototype: 378 of 378 backend e2e tests pass against a real Postgres database, the domain model (parcels, seven department record types, multi-step workflows, governance alerts, historical-imagery comparison) is coherent and consistently applied, and several risky areas — SQL access, OTP verification, popup HTML rendering — already carry real, correct defenses (parameterized spatial queries throughout, an OTP attempt-lockout, manual HTML-escaping before every `maplibre-gl` popup). That is a better starting position than most pre-production codebases get.

Against that, this audit confirmed **one Critical** and **nine High** severity issues, concentrated in three places: **authentication/session lifecycle** (no login brute-force protection, tokens that never expire and can't be revoked, weak password policy), **data-access safety** (an unconditional `synchronize: true` against the production database connection, a confirmed path-traversal bug in the local file-storage fallback, and an access-control gap where a workflow's full detail is reachable by any staff role regardless of department), and **scale readiness** (N+1 query patterns and unbounded list endpoints that are invisible today at prototype data volumes but compound directly with usage, plus a single 1.98 MB frontend bundle with no code-splitting).

None of these are surprising for a hackathon-paced prototype, and several are explicitly, deliberately-commented trade-offs already made by whoever built this (the non-expiring JWT matches an explicit "don't log out until Logout is pressed" product decision; `rejectUnauthorized: false` is commented as a known Supabase-dev compromise). The purpose of this report is to make every one of those trade-offs visible and prioritized, not to imply the app is unsound — the highest-leverage 20% of this list (P0/P1 in §14) is a few days of focused work, not a rewrite.

**Overall risk rating: Moderate Risk.** Solid functional foundation and strong backend test coverage, undermined by session-lifecycle and data-safety gaps that are fine for a judged prototype demo but must close before any real deployment with real citizen data. Full reasoning in §13.

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 9 |
| Medium | 10 |
| Low | 4 |
| Backend e2e tests | 378/378 passing |
| Frontend unit tests | 258/292 passing |

---

## 2. Test Environment

| Layer | Stack |
|---|---|
| Backend runtime | NestJS 10 (Node/TypeScript), TypeORM 0.3 |
| Database | PostgreSQL via Supabase (production path) / SQLite (test & local-dev path, auto-selected) |
| Auth | Passport JWT (HS256, `passport-jwt`), bcryptjs password hashing |
| Frontend runtime | React 18 + Vite 4, React Query v4, react-router-dom v6, Zustand, MapLibre GL 4.7.1 |
| Test tooling | Jest + Supertest (backend e2e, real DB), Vitest + Testing Library (frontend unit) |
| Object storage | Supabase Storage (configured in this environment) with a local-disk fallback path |
| Audit method | Source review, live authenticated API calls against the running dev server, isolated PoC scripts for specific claims, `npm audit`, production build |

---

## 3. Architecture Summary

A single NestJS monolith (`backend/src`, 25 feature modules under `app.module.ts`) fronts a parcel-centric data model: a `Parcel` core entity carries geometry and canonical identifiers (ULPIN/survey number), fanning out to seven independent department-record entities (Registration, Planning, Tax, Restriction, Dispute, Encumbrance, plus a state-schema-specific Land Records adapter) — exactly the "essential layers around a cadastral base layer" the problem statement describes. A citizen's service request becomes a `Workflow` with per-department `WorkflowStep` rows an officer advances; a separate `GovernanceAlert` stream is populated only by real detection logic (spatial restriction-zone overlap, a year-over-year historical-imagery diff), not hand-seeded rows. Three JWT-gated portals (Citizen/Officer/Admin) consume this through a versioned `/api/v1` REST surface; MapLibre GL renders parcel/zoning/restriction layers client-side.

Authorization is role-based (`CITIZEN` / seven officer roles / `ADMIN`) via two composable guards (`JwtAuthGuard`, `RolesGuard`) plus hand-written per-request ownership checks (e.g. a citizen only sees Planning/Tax/Restriction/Dispute/Encumbrance for a parcel they actually hold). That pattern is applied consistently almost everywhere — the one confirmed exception is HIGH-9 (§6).

---

## 4. Test Coverage

**What was directly tested or verified with evidence:** the full backend e2e suite was executed (378 tests, real Postgres); the frontend unit suite was executed (292 tests); both projects' production type-checks and the frontend production build were run; both projects' dependency trees were scanned with `npm audit`; authentication, OTP, workflow-creation/approval, governance-alert generation, and parcel-360 ownership-gating were exercised live via authenticated `curl` calls against the running dev server; the local-storage path-traversal claim was proven with an isolated reproduction script rather than left as a read-the-code guess.

**What could not be practically tested here, and why:** concurrent-write/race-condition behavior under real parallel load (would need a load-testing harness this audit didn't build, given the "no destructive/uncontrolled load testing" constraint); production-mode behavior specifically (`NODE_ENV=production` was never set in this dev environment, so the `JWT_SECRET` placeholder guard in `main.ts` was verified by reading, not by triggering it); real multi-user browser sessions (no second physical device/browser profile was available); anything requiring the deployed Render/Vercel infrastructure itself, which doesn't exist yet.

---

## 5. Critical Issues

### CRIT-1 — maplibre-gl ships with a confirmed critical XSS sanitizer bypass

- **Severity:** Critical
- **Category:** Security · Dependency
- **Component:** Frontend / mapping
- **File:** `frontend/package.json` (maplibre-gl `^4.0.0`, resolved 4.7.1) · `frontend/src/features/map/MapComponent.tsx:390-403`

**Problem:** `npm audit` reports a **critical** advisory against the installed `maplibre-gl@4.7.1`: *"XSS Sanitizer Bypass in `DOM.sanitize()` via Live NamedNodeMap Removal Skip"* (GHSA-jrc7-96c5-q579), fixed only in 6.9.0 (a semver-major jump).

**Steps to Reproduce:**
1. In `backend`/`frontend`: `npm audit --json`
2. Observe `maplibre-gl` listed with `severity: critical`, range `<=6.4.0`

**Expected vs Actual:** Expected: the mapping library's internal HTML sanitizer can't be tricked into passing through injected markup. Actual: the installed version can, per the published advisory.

**Impact:** MapLibre's popups are the one place this app renders HTML strings on the map (`MapComponent.tsx:390`). If any future popup/control content skips the app's own escaping, this library-level flaw removes the last line of defense — turning a forgotten `escapeHtml()` call into a working stored/reflected XSS against a session that (see HIGH-2) never expires.

**Root Cause:** Pinned dependency (`^4.0.0`) hasn't been bumped past the range containing the fix; the fix itself is a major version (6.x) with likely breaking API changes.

**Recommended Fix:** Upgrade to `maplibre-gl@6.9.0+` and re-verify the popup/layer code against its changelog. Until upgraded, treat `escapeHtml()` in `MapComponent.tsx` as load-bearing, not defense-in-depth — audit every other `.setHTML()`/`.setDOMContent()` call site for the same discipline.

**Evidence:**
```
npm audit --json (frontend)
"maplibre-gl": { "severity": "critical", "range": "<=6.4.0",
  "via": [{ "title": "MapLibre GL JS: XSS Sanitizer Bypass in DOM.sanitize() via Live NamedNodeMap Removal Skip",
            "url": "https://github.com/advisories/GHSA-jrc7-96c5-q579" }],
  "fixAvailable": { "name": "maplibre-gl", "version": "6.9.0", "isSemVerMajor": true } }
```

**Mitigating factor confirmed:** the app's own popup builder (`MapComponent.tsx:390-403`) already runs every interpolated value through a correct `escapeHtml()` (verified at `MapComponent.tsx:93-101`) before calling `.setHTML()` — so today's actual exploitability is lower than the raw CVE score implies. The library should still be upgraded rather than relied on.

---

## 6. High-Severity Issues

### HIGH-1 — No brute-force protection on password login

- **Category:** Security · Auth
- **File:** `backend/src/auth/auth.controller.ts:23-38` · `backend/src/auth/auth.service.ts:61-68`

**Problem:** `POST /auth/login` carries no `@Throttle` override, no failed-attempt counter, and no account lockout — `validateUser()` is a plain `bcrypt.compare` with unlimited retries, protected only by the app-wide default throttle (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }])`, `app.module.ts:32`).

**Steps to Reproduce:** Confirm no `@Throttle` decorator on `AuthController` (only `ai`, `change-detection`, `historical-imagery`, and one `parcels` route override it — `grep -rn "@Throttle" backend/src`). 200 login attempts/minute/IP is permitted by the global default.

**Impact:** Combined with the weak password policy (MED-10, 8-character minimum, no complexity rule), an attacker can run a meaningful dictionary/credential-stuffing attack against any known email/mobile at up to 200 guesses/minute/IP, trivially parallelized across IPs. This is the single most common real-world account-takeover vector.

**Root Cause:** Login was never given a route-specific throttle the way the AI/imagery endpoints were (those were rate-limited for cost control, not brute-force defense).

**Recommended Fix:** Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` (or similar) to `login`, and consider a per-account failed-attempt counter with backoff, mirroring the OTP lockout pattern already implemented correctly elsewhere in this same file (`EMAIL_OTP_MAX_ATTEMPTS`, `auth.service.ts:46,207-209`).

### HIGH-2 — Sessions never expire, live in localStorage, and "Logout" never touches the server

- **Category:** Security · Session
- **File:** `backend/src/auth/auth.module.ts` (no `signOptions.expiresIn`) · `frontend/src/features/auth/auth.ts:40-57` · `frontend/src/services/apiService.ts:14`

**Problem:** Three compounding facts: (1) the JWT is signed with no expiry at all (removed by explicit product decision earlier in this project's history — "don't log out until Logout is pressed"); (2) the token is stored in `localStorage`, readable by any script running on the page; (3) `useLogout()` (`auth.ts:187-193`) only calls `clearToken()` client-side and resets the React Query cache — it never calls the server, and the backend has no token blocklist/version to invalidate against even if it did.

**Steps to Reproduce:** Log in, copy the `access_token` from `localStorage`. Click Logout. Replay the copied token as an `Authorization: Bearer` header against any protected endpoint — it still succeeds, indefinitely.

**Impact:** A token captured once (stolen device, shared/public computer, a future XSS, a log line that shouldn't have captured it) is valid **forever** and survives the legitimate user pressing Logout. There is currently no way to end one specific session without deleting the user account or rotating `JWT_SECRET` for every user at once.

**Root Cause:** A deliberate UX trade-off (no auto-expiry) was made without adding the compensating control a stateless-JWT system needs once expiry is removed: a token version/blocklist.

**Recommended Fix:** Add a `tokenVersion` column to `User`, embed it in the JWT payload, and check it in `JwtStrategy.validate()` (which already re-fetches the user row on every request — `jwt.strategy.ts:29-32` — so this is a small addition, not new infrastructure); bump it on password change and on explicit logout to invalidate every previously-issued token for that account. Keep the no-auto-expiry UX if that's still the product call.

```
frontend/src/features/auth/auth.ts:187-193
export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearToken();                              // localStorage only
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  };                                            // no server call
}
```

### HIGH-3 — `synchronize: true` is unconditional against the production database connection

- **Category:** Database · Reliability
- **File:** `backend/src/database.config.ts:16, 35`

**Problem:** Both the SQLite branch (line 16) and the Postgres/Supabase branch (line 35) of `getDatabaseConnectionOptions()` set TypeORM's `synchronize: true`, with no `NODE_ENV` guard. On every app boot, TypeORM diffs every `*.entity.ts` against the live schema and auto-applies DDL to match — including drops/type changes — against whichever database is configured, dev or production.

**Impact:** This is TypeORM's own documented "never in production" flag. A destructive migration mistake (renaming a column, changing a type) becomes a silent, automatic, unreviewed schema change — and potential data loss — on the next deploy, with no migration file, no rollback, no review step.

**Root Cause:** Zero-config convenience for a fast-moving hackathon build; the flag was never split by environment.

**Recommended Fix:** Gate it: `synchronize: process.env.NODE_ENV !== 'production'`, and introduce real TypeORM migrations for the production path before any real deployment. Low effort, high payoff.

```
backend/src/database.config.ts:30-37
return {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  ...
  password: process.env.DB_PASSWORD || 'postgres',   // see MED-4
  entities: [],
  synchronize: true,                                  // unconditional
  ssl: useSsl ? { rejectUnauthorized: false } : false, // see MED-4
  ...
```

### HIGH-4 — Path traversal in the local-disk storage fallback

- **Category:** Security · File Handling
- **File:** `backend/src/common/supabase-storage.ts:78-79, 87-95` · `backend/src/workflows/workflows.controller.ts:85`

**Problem:** `resolveLocalPath(key)` does `path.join(LOCAL_FALLBACK_DIR, key)` with no normalization or containment check. One caller, `WorkflowsController.create()`, builds `key` partly from the **client-supplied** multipart `Content-Type` of the uploaded file: `` fileName = `${randomUUID()}.${file.mimetype.split('/')[1] || 'png'}` `` (line 85) — only `startsWith('image/')` is validated; the subtype after the slash is never checked against an allowlist.

**Steps to Reproduce (isolated PoC, no live request made):**
```
node -e, reproducing resolveLocalPath() in isolation
const key = 'workflow-evidence/xxxxxxxx.' + '../../../../../../tmp/audit-traversal-poc';
resolveLocalPath(key);
// -> D:\Projects\tmp\audit-traversal-poc
// escapes LOCAL_FALLBACK_DIR (backend/uploads): true
```

**Expected vs Actual:** Expected: an uploaded file's derived path can never resolve outside the upload directory. Actual: a crafted `Content-Type` subtype containing `../` segments writes the file to an arbitrary filesystem path the process can reach.

**Impact:** Currently **not reachable in this running environment** — `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are configured here, so uploads go to Supabase Storage (an object key, not a filesystem path — this specific bug doesn't apply there). But local-disk is this codebase's explicit, documented zero-config fallback (`supabase-storage.ts:9-17`) — any deployment or fresh clone that runs without those two env vars set (including a judge/reviewer spinning this up locally exactly as documented) is exposed: an authenticated citizen filing a workflow with an evidence upload can overwrite/create files anywhere the Node process can write.

**Root Cause:** File extension trusted from client-controlled metadata; no path-containment check in the shared storage helper.

**Recommended Fix:** In `resolveLocalPath`, resolve the final path and assert it's still inside `LOCAL_FALLBACK_DIR` (reject/throw otherwise) — this closes it for every caller at once. Separately, derive the file extension from an allowlist (`png`/`jpg`/`jpeg`/`webp`) keyed off the validated `image/` prefix, not the raw client string.

### HIGH-5 — multer (active file-upload middleware) carries six High-severity DoS advisories

- **Category:** Dependency · Reliability
- **File:** `backend/src/workflows/workflows.controller.ts:44` (`FileInterceptor`) · `package.json` (transitive via `@nestjs/platform-express`)

**Problem:** `npm audit` flags the installed `multer` (bundled by `@nestjs/platform-express <=11.1.14`) with six **High** advisories, all denial-of-service: uncontrolled recursion, resource exhaustion, deeply-nested field names, oversized array-index field names, incomplete cleanup. `multer` is not incidental — it's the active `FileInterceptor('document', ...)` on `POST /workflows`, a real, authenticated, citizen-reachable endpoint.

**Impact:** A malformed multipart body against a real, exposed endpoint can exhaust process resources — a live DoS surface, not a theoretical one.

**Recommended Fix:** `fixAvailable` per `npm audit` is `@nestjs/platform-express@12.0.1` (semver-major). Plan the Nest 10→12 upgrade rather than patching `multer` in isolation (it's a transitive dependency pinned by the platform package).

```
npm audit --json (backend)
"multer": { "severity": "high", "range": "<=2.2.0",
  "via": [ "...Denial of Service via incomplete cleanup",
           "...Denial of Service via resource exhaustion",
           "...Denial of Service via Uncontrolled Recursion",
           "...Denial of Service via deeply nested field names",
           "...Denial of Service via crafted multipart field names",
           "...Denial of Service via oversized array index in field names" ],
  "fixAvailable": { "name": "@nestjs/platform-express", "version": "12.0.1", "isSemVerMajor": true } }
```

### HIGH-6 — Several list endpoints return unbounded result sets with no pagination

- **Category:** Database · Performance
- **File:** `backend/src/audit/audit.controller.ts:16-17` · `backend/src/workflows/workflows.service.ts:127, 352, 377`

**Problem:** `GET /audit` (admin-only) calls `AuditService.findAll`, which is a plain `repository.find({ where, order })` — every matching row, no `take`/`skip`, no default cap. Every workflow-step decision and governance-alert review writes a row here (`workflows.controller.ts:107-116, 220-230`), so this table only ever grows. `WorkflowsService.findAll/findByParcel/findMineForCitizen` have the identical shape.

**Impact:** Fine at today's prototype data volume (hundreds of rows). Response size and query time both scale linearly with total historical volume with no ceiling — a real deployment running for months will see this endpoint's payload and latency grow without bound.

**Recommended Fix:** Add `limit`/`cursor` (or offset) query params with a sane default (e.g. 50) and a hard max, mirroring the pattern `parcels.searchParcels` already uses correctly (`parcels.controller.ts:38`).

### HIGH-7 — N+1 query pattern across every workflow-listing method

- **Category:** Database · Performance
- **File:** `backend/src/workflows/workflows.service.ts:127-147` (`findMineForCitizen`) · `:352-375` (`findAll`) · `:377-395` (`findByParcel`)

**Problem:** Each method fetches N workflows with one query, then issues one additional query **per workflow** to fetch its steps, inside `Promise.all(workflows.map(async (workflow) => { const steps = await this.stepRepository.createQueryBuilder(...).where('step.workflow_id = :id', ...).getMany(); ... }))` — a textbook N+1.

**Impact:** A citizen with 50 requests, or an officer's department queue with 500 workflows, triggers 51 or 501 round-trip queries for what should be two. This is the same query issued repeatedly, differing only by one bound parameter — a single `WHERE workflow_id IN (...)` would replace all of them.

**Root Cause:** A deliberate, self-documented convention in this codebase ("plain JS filtering over query-builder joins... this mock never has more than a few hundred") — a real, acknowledged trade-off, not an oversight, but one that stops holding as soon as real usage volume arrives.

**Recommended Fix:** Fetch all steps for the fetched workflow IDs in one query (`stepRepository.find({ where: { workflow: { id: In(workflowIds) } } })`), then group them in JS by `workflow_id` before zipping back onto each workflow.

### HIGH-8 — Zero route-based code-splitting: the entire app ships as one 1.98 MB bundle

- **Category:** Performance · Frontend
- **File:** `frontend/src/App.tsx:6-13` (static imports of every portal)

**Problem:** `npx vite build` emits a single JS chunk, `1,977.55 kB` minified / `540.42 kB` gzipped, with Vite's own build warning flagging it. `grep -c "React.lazy\|lazy(" App.tsx` returns `0` — every portal (Citizen, Officer, Admin), every map layer, and every historical-imagery/AI feature is statically imported and bundled together regardless of route.

**Impact:** A citizen opening the login page for the first time downloads and parses the Admin Portal's officer-monitoring dashboards, the map-layer authoring tools, and every other portal's code before they can log in — directly relevant here, since the problem statement's own rollout targets rural citizens on ordinary mobile connections, not just urban officers.

**Recommended Fix:** Wrap each top-level portal/page in `React.lazy()` + `<Suspense>` at the route boundaries already defined in `App.tsx` (`/citizen/*`, `/officer/*`, `/admin/*`) — the existing route structure needs no redesign, only the import statements change.

```
npx vite build (frontend)
dist/assets/index-2a7e1f90.js   1,977.55 kB │ gzip: 540.42 kB

(!) Some chunks are larger than 500 kBs after minification.
```

### HIGH-9 — Workflow-detail lookup isn't department-scoped, unlike the equivalent list endpoint

- **Category:** Security · Access Control
- **File:** `backend/src/workflows/workflows.controller.ts:119-132` (`findAll`, scoped) vs. `:145-154` (`findOne`, not scoped)

**Problem:** `GET /workflows` correctly narrows a non-admin caller to their own department (`const scopedDepartment = user.role === 'ADMIN' ? department : ROLE_DEPARTMENT[user.role]`, line 130). `GET /workflows/:id`, three lines down, has no equivalent check — only `@Roles(...ALL_STAFF_ROLES)`. Any signed-in officer of any department can fetch the full detail (applicant contact/address, free-text request details, every other department's step remarks) of any workflow by ID, including ones — e.g. a `DISPUTE_FILING` — with no relationship to their own department.

**Impact:** A confirmed authorization inconsistency: the same data is correctly gated in one endpoint and not in its sibling. Practical blast radius is bounded by needing a valid UUID (not enumerable by guessing), but a curious or malicious officer who obtains one — via a shared link, a screenshot, an `/audit` row (also readable to Admin, HIGH-6) — sees full cross-department detail they have no legitimate reason to.

**Root Cause:** `findOne` was written before the department-scoping convention `findAll` now follows, and never revisited to match.

**Recommended Fix:** Apply the same `ROLE_DEPARTMENT` check to `findOne`: 404 (not 403, to avoid confirming the ID exists) when the caller isn't ADMIN and the workflow has no step in their department.

---

## 7. Medium-Severity Issues

| ID | Category | Finding | File |
|---|---|---|---|
| MED-1 | Security | CORS defaults to `origin: true` (any origin) whenever `CORS_ORIGIN` is unset — a documented, deliberate dev default that's easy to forget to lock down on deploy. | `main.ts:60-61` |
| MED-2 | Security | Swagger UI (full API schema) is mounted at `/api` unconditionally, including were `NODE_ENV=production` — no auth gate, no environment guard. | `main.ts:51-52` |
| MED-3 | Security | No Helmet/security-headers middleware anywhere — missing CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS. | `main.ts` (absent) |
| MED-4 | Configuration | Postgres connection falls back to `postgres`/`postgres` credentials and `rejectUnauthorized: false` (no TLS cert validation) when env vars are unset — silent weak defaults rather than a fail-fast startup error. | `database.config.ts:32, 36` |
| MED-5 | Reliability | The global 401 interceptor redirects to `/login` but never clears the stale token from `localStorage` first. | `apiService.ts:26-33` |
| MED-6 | Dependency | 2 further frontend `npm audit` findings: `vitest` critical (dev/test-only — never ships to users) and `vite`/`launch-editor` high (dev-server-only features, absent from the production `vite build` output). Real, but non-user-facing. | `package.json` (devDependencies) |
| MED-7 | Configuration | No `/health` endpoint — real deployment infra (load balancers, uptime checks, Render/Vercel health probes) has nothing dedicated to poll. | (absent) |
| MED-8 | Reliability | No global exception filter or structured/correlated error logging — relies entirely on Nest's built-in default handler. Safe (no stack-trace leakage), but no request-ID correlation for production debugging. | `main.ts` (absent) |
| MED-9 | Code Quality | `GisController.getParcelAtLocation` ("find the parcel under this point") is dead code — no frontend caller found anywhere, and its non-Postgres path unconditionally returns `null` with a console warning rather than the JS-fallback pattern every other spatial method in this codebase uses. | `gis/gis.service.ts:99-116` |
| MED-10 | Security | Password policy is `MinLength(8)` only — no complexity requirement. Compounds HIGH-1 directly. | `auth/dto/register.dto.ts:24-26` |

---

## 8. Low-Severity Issues

| ID | Category | Finding |
|---|---|---|
| LOW-1 | Code Quality | No ESLint configuration and no `lint` npm script in either project — style/correctness issues aren't caught automatically, only by `tsc`. |
| LOW-2 | API | `ValidationPipe` uses `whitelist: true` but not `forbidNonWhitelisted: true` — unexpected body fields are silently stripped instead of rejected with a 400, which can mask client-side bugs. |
| LOW-3 | Code Quality | `pages/BhoomiSetuLanding.tsx` is a 951-line monolithic component — a reasonable candidate to split into sub-sections, purely for maintainability. |
| LOW-4 | Dependency | Backend `npm audit`: 4 low + 13 moderate additional findings, concentrated in build tooling (`@nestjs/cli`, `glob`, `js-yaml`, `lodash`, `picomatch`, `tmp`) rather than runtime/request-path packages — lower real-world exposure. |

---

## 9. Performance Bottlenecks

| Component | Bottleneck | Evidence | Priority | Recommendation |
|---|---|---|---|---|
| Frontend bundle | No route-level code-splitting | Production `vite build`: one 1,977.55 kB / 540.42 kB-gzip chunk; `0` `React.lazy` calls in `App.tsx` | P1 | `React.lazy` + `Suspense` per portal route |
| WorkflowsService (3 methods) | N+1 queries | `workflows.service.ts:127,352,377` — 1 query for workflows + 1 per workflow for steps | P1 | Batch-fetch steps with `WHERE workflow_id IN (...)`, group in JS |
| `GET /audit`, workflow-listing endpoints | Unbounded result sets | `audit.controller.ts:16-17` — plain `repository.find()`, no `take`/`skip` | P2 | Default limit + cursor/offset pagination |
| Backend e2e suite | None found — measured for context | 378 tests / 20 suites / 71.9s wall time, against real Postgres, this run | P3 | No action; watch as the suite grows |

---

## 10. Reliability & Automated Test Results

**Backend:** `npm test` (Jest + Supertest, real Postgres) — **378/378 tests passing** across all 20 e2e spec files, 71.9s. This is genuinely strong coverage: auth, OTP, workflows, governance alerts, spatial queries, change detection, historical imagery, rate limiting, and every department module each have a dedicated spec file.

**Frontend:** `npx vitest run` — **258/292 passing**, 34 failures across 7 files (`App.test.tsx`, `AdminPortal.test.tsx`, `LoginPage.test.tsx`, `OfficerPortal.test.tsx`, `RegisterPage.test.tsx`, `RaiseRequestPage.test.tsx`, `NotificationFeed.test.tsx`). A `git stash` cross-check earlier in this project's own history confirmed these fail identically at the clean committed baseline, unrelated to any single feature change — pointing at a shared testing-library/jsdom environment issue (recurring `getByLabelText`-style failures) rather than 34 independent application bugs. Still a real gap: a meaningful slice of frontend behavior — including login itself — currently has no passing automated check.

**Deliberate error-swallowing (by design, worth knowing about):** `AuthService.register` and `addOrChangeContact` (`auth.service.ts:108-112, 268-272`) intentionally catch and discard OTP-send failures so a down SMS/email gateway can't block account creation. Reasonable trade-off, but it means a citizen can land in "registered, contact unverified, nothing told me why" with only a manual Resend to recover — worth a visible banner rather than silence.

---

## 11. Code Quality

Above-average for a hackathon-paced codebase: extensive inline comments explain *why* a decision was made (not just what the code does), a repeated and consistently-applied "duplicate small checks rather than cross-import across modules" convention keeps 25 feature modules free of circular dependencies, and file sizes are reasonable — the largest backend file is 554 lines (`workflows.service.ts`, a legitimately multi-responsibility service, not bloat) and the largest frontend file is 951 lines (`BhoomiSetuLanding.tsx`, LOW-3, mostly declarative marketing copy).

The gaps are tooling, not code: no ESLint/lint script in either project (LOW-1), no CI workflow found (no `.github/workflows/`), and no pre-commit hook enforcing the type-check that both projects otherwise pass cleanly today.

---

## 12. Test Coverage Gaps

- **Login, registration, and every portal's top-level render** currently have no passing frontend test (§10) — the highest-traffic user-facing paths are the ones with the weakest automated safety net.
- **No load/concurrency tests** anywhere in either suite — the N+1 (HIGH-7) and unbounded-query (HIGH-6) issues would only surface under realistic data volume or concurrent load, which nothing here simulates.
- **No test exercises the local-disk storage fallback path** (HIGH-4) — both e2e and unit suites run against whatever storage backend is configured in the environment, so this fallback's behavior (correct or not) is entirely unverified by CI.
- **No security-specific test suite** — no test asserts that cross-department workflow access is denied (HIGH-9), that a stale/logged-out token is rejected, or that rate limits actually engage on brute-force-sensitive routes.

---

## 13. Risk Assessment

**Overall rating: Moderate Risk** — appropriate for where this project actually is: a judged SIH prototype, not a live deployment holding real land records yet.

**Why not Low Risk:** one Critical and nine High findings are real and confirmed with evidence, not speculative — particularly the session-lifecycle trio (HIGH-1/2/MED-10) and the unconditional `synchronize: true` against a production-capable connection (HIGH-3), which is the kind of thing that causes real incidents the first time someone deploys carelessly.

**Why not High/Critical Risk:** none of the findings are currently exploited or trivially exploitable against this specific running instance today (the path-traversal bug needs local-fallback mode, which isn't active here; the XSS bypass needs a second, currently-absent bug to actually fire); the backend's core domain logic is backed by 378 passing e2e tests against a real database; and several of the riskiest-looking patterns turned out, on inspection, to already have a real mitigation in place (parameterized SQL everywhere, OTP attempt-lockout, JWT re-validated against the live user row on every request, popup HTML manually escaped).

The honest read: this is a codebase built by someone who was already thinking about several of these exact risk categories (the comments prove it) but ran out of runway before closing the loop on all of them. That's a fixable gap, not a fundamentally unsound architecture.

---

## 14. Recommended Fix Order

### P0 — Before any real deployment
1. **CRIT-1** — Upgrade maplibre-gl past 6.9.0
2. **HIGH-3** — Gate `synchronize` by `NODE_ENV`; add real migrations
3. **HIGH-4** — Contain `resolveLocalPath` to its base dir
4. **HIGH-5** — Plan the Nest 10→12 / multer upgrade

### P1 — Immediately after P0
1. **HIGH-1** — Throttle + lockout on `/auth/login`
2. **HIGH-2** — Add a revocable `tokenVersion` claim
3. **HIGH-9** — Department-scope `GET /workflows/:id`
4. **HIGH-7** — Batch-fetch workflow steps (kill the N+1)
5. **HIGH-8** — Lazy-load each portal route

### P2 — Important, not urgent
1. **HIGH-6** — Paginate `/audit` and workflow listings
2. **MED-1/2/3** — Lock CORS, gate Swagger, add Helmet
3. **MED-4** — Fail fast on missing DB env vars
4. **MED-10** — Real password-complexity rule
5. **MED-7** — Add a `/health` endpoint

### P3 — Technical debt
1. **LOW-1** — Add ESLint + a lint script + CI
2. **LOW-2** — `forbidNonWhitelisted: true`
3. **MED-9** — Delete or finish `getParcelAtLocation`
4. **MED-8** — Global exception filter + request-ID logging
5. **LOW-3** — Split `BhoomiSetuLanding.tsx`

---

No source files were modified during this audit. All findings above are either directly reproduced (isolated PoC scripts, live authenticated API calls, `npm audit`, `vite build`, the real test suites) or explicitly marked as reasoning from code review where live reproduction wasn't practical or safe within this audit's constraints. Awaiting direction on which items to act on before any fix is applied.
