# Connecting the Frontend to `backend-py` — Detailed Plan

**Status (2026-09-12): both targets below are done.** `docker-compose.yml`
now points the frontend at `backend-py` (Target B) and the `backend`
service has been removed from the stack entirely — confirmed no real data
existed in its `bhoomisetu` database first, so that database was dropped
too, not merged (there was nothing to merge). `backend/`'s source is
still in the repo for the grace period `CUTOVER_AND_OPS_PLAN.md` §6
describes, just no longer part of `docker compose up`. The plan below is
kept as-is as the record of how this was done and verified, and as the
template for repeating the same rehearsal against a real staging
environment once §6 gets there.

This is a different, narrower document from
`CUTOVER_AND_OPS_PLAN.md`. That one is about the real, production §6
cutover, and is blocked on infrastructure decisions (hosting, domain,
staging) only the user can make. **This document needs none of that** —
it's about actually pointing a real, running frontend at `backend-py`
for the first time, starting entirely on `localhost`, fully reversible,
with no infrastructure commitment. Doing this well is also the single
best rehearsal for §6: everything this plan finds (a response shape
mismatch, a missing CORS header, a broken page) is a bug caught for free
before it could ever reach the real cutover.

---

## 1. What actually has to change, and where

There is exactly **one** wiring point in the entire frontend codebase —
confirmed by grepping `frontend/src` for every reference to an API base
URL:

```ts
// frontend/src/services/apiService.ts
const apiService = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  ...
});
```

Every HTTP call in the app goes through this one `axios` instance. No
page, hook, or component reads `VITE_API_URL` (or any other backend URL)
directly. That means connecting to `backend-py` is genuinely a one-line
change — the work in this plan is almost entirely about **verifying it
actually works**, not about finding and rewiring scattered integration
points.

**Important mechanical detail:** `VITE_API_URL` is a Vite **build-time**
env var (`import.meta.env.*` is inlined into the JS bundle when Vite
builds it, not read at runtime by a running server). Changing it and
restarting a container that's already built does nothing — the frontend
has to actually be rebuilt (`npm run dev` picks up a new `.env.local` on
its own; a Docker image needs `docker compose build frontend` again, not
just `up`).

Two places currently set this build-time value, both still pointing at
`backend/` (the NestJS app, port 3000) — nothing today points at
`backend-py`:

- `frontend/src/services/apiService.ts`'s own fallback (`||`) — used
  whenever `VITE_API_URL` isn't set at all, e.g. a bare `npm run dev`
  with no `.env.local`.
- `docker-compose.yml`'s `frontend` service, which bakes
  `VITE_API_URL: http://localhost:3000/api/v1` in as a Docker build
  `arg` — used whenever the whole stack is brought up via
  `docker compose up`.

---

## 2. Two connection targets, in order

Do **Target A** first, completely, before ever touching **Target B** —
A is disposable and affects nobody but you; B changes what `docker
compose up` gives *anyone* who runs it, including the repo's own default
onboarding path.

### Target A — a local frontend dev server, pointed at `backend-py` (do this first)

Nothing here touches a file tracked by git. It's a `.env.local` (already
covered by `.gitignore`) plus a normal `npm run dev`.

**Prerequisites — confirm these before starting, not during:**

1. `backend-py` and its database are up and healthy:
   ```
   docker compose up -d postgis backend-py
   curl http://localhost:8000/health   # {"status":"ok",...}
   ```
2. It has real seeded data. It already does as of this session (`220`
   parcels, the 8 demo staff accounts) — no need to re-run
   `scripts/seed.py`. If you ever do need to check:
   ```
   docker exec sih_2026_bhoomisetu-postgis-1 \
     psql -U postgres -d bhoomisetu_py -tAc "SELECT count(*) FROM parcels;"
   ```
   `scripts/seed.py` has **no idempotency guard** on the demo
   users/parcels it inserts — re-running it against an already-seeded
   database will hit duplicate-key errors, not silently skip. Only run
   it against a genuinely empty database.
3. The real API keys are wired through (done this session — Groq
   sanity-checked live via `POST /ai/query`). SMS/email OTP delivery
   (TextBee/Zoho Mail) has **not** been sanity-checked yet, since doing
   so sends a real message — see the smoke-test checklist in §3 for
   where that finally gets exercised, deliberately, once you're ready.

**The actual switch:**

```bash
cd frontend
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

Vite picks up `.env.local` automatically on start — no other config
change needed. Open the dev server URL it prints and you're now talking
to `backend-py`.

**Sign in as one of the seeded demo accounts** (from
`backend-py/scripts/seed.py`, password `Demo@123` for all of them — this
is a documented public demo credential already surfaced in the app's own
UI copy, not a secret):

- `admin@bhoomisetu.gov.in` — Admin
- `landrecords.officer@bhoomisetu.gov.in`, `registration.officer@...`,
  `planning.officer@...`, `dispute.officer@...`, `tax.officer@...`,
  `restriction.officer@...`, `encumbrance.officer@...` — one officer per
  department
- Citizen accounts also exist from the seed script (`citizen1@...`
  through `citizen20@...`, same password) — check the seed script or the
  admin user list for the exact set if a specific one is needed for a
  test (e.g. one with parcels already linked).

**Reverting Target A** is one file: delete `frontend/.env.local` (or
just stop setting it) and restart `npm run dev` — back to `backend/` on
port 3000, instantly, no cleanup, no data to reconcile (`backend-py`'s
database, `bhoomisetu_py`, is entirely separate from `backend`'s,
`bhoomisetu`).

### Target B — `docker-compose.yml`, so the whole stack points at `backend-py`

Only attempt this once Target A's smoke test (§3) is clean. This changes
the *default* behavior of `docker compose up` for anyone using this
repo, so:

- **Do it on its own branch** (e.g. `connect-frontend-to-backend-py`),
  not on `main` or `python-migration` directly — until you've decided
  this is the new default, not an experiment.
- The change itself, in `docker-compose.yml`:
  ```diff
     frontend:
       build:
         context: ./frontend
         args:
  -        VITE_API_URL: http://localhost:3000/api/v1
  +        VITE_API_URL: http://localhost:8000/api/v1
       ports:
         - "5173:80"
       depends_on:
  -      - backend
  +      - backend-py
  ```
- Then **rebuild**, not just restart — the build-time-arg point from §1
  means this does nothing without it:
  ```
  docker compose build frontend
  docker compose up -d
  ```
- Re-run the full smoke test in §3 again against this build — a
  Docker-built frontend and a Vite-dev-server frontend are close but not
  byte-identical (minification, base path handling), so this is a real,
  distinct check, not a formality.

---

## 3. Smoke-test checklist

Organized by portal, matching the app's actual route structure
(`frontend/src/App.tsx`: `/`, `/citizen/*`, `/officer/*`, `/admin/*`,
plus `/login`, `/register`, `/about`, `/features`, `/parcels/:id`). For
each item: does it load without error, does the data look real and
correct, and — the most reliable regression check available — **does it
match what the same seeded account sees against `backend/` on port
3000**, side by side in two browser tabs/windows. Any difference is
either a real bug to fix or a documented, intentional gap (see §4).

### Public (no login)
- [ ] Landing page (`/`) loads, no console errors
- [ ] About (`/about`) and Features (`/features`) pages load
- [ ] Login (`/login`) — sign in as `admin@bhoomisetu.gov.in` /
      `Demo@123`, lands on the Admin Portal
- [ ] Register (`/register`) — **this is the one flow now newly
      testable for real**, since real TextBee/Mail keys are wired. Try
      one full registration by email (real inbox needed to read the
      OTP) and, separately, one by mobile (real phone needed for the
      SMS) — deliberately exercising the delivery paths this session's
      earlier live-spec work explicitly could not
- [ ] `GET /parcels/:id` (a public parcel-360 deep link) loads for a
      real seeded parcel id

### Citizen Portal (sign in as a `citizenN@...` account with linked parcels)
- [ ] Dashboard loads, linked-parcel count and pending-request count
      look right
- [ ] Find Parcels — search by ULPIN/survey/plot number returns real
      results; map view renders, adjacent/nearby/cluster layers toggle
- [ ] My Parcels — linked parcels list correctly; try the Land Claim
      flow on an unclaimed parcel (upload a real land-document
      image/PDF — this is one of the OCR-precheck paths the live-spec
      harness explicitly could not verify, so worth deliberately
      exercising here)
- [ ] Raise Request — file a request against a linked parcel, with and
      without a file attachment
- [ ] Requests — list shows filed requests with live per-department
      status; detail view expands correctly
- [ ] Notifications — feed loads and reflects real activity
- [ ] Profile — view details; add/change a contact method and verify it
      via the OTP it sends (again, a real delivery this session's specs
      couldn't test)

### Officer Portal (sign in as one officer per department, at least once)
- [ ] Dashboard — pending-workflow count, alerts-requiring-attention
      count look right
- [ ] Assigned Requests — review a pending step: Approve one, Reject
      another, with required remarks; confirm the citizen who filed it
      would see the update (cross-check via the Citizen Portal in
      another tab/account)
- [ ] Governance Alerts — list loads, acknowledge/resolve/dismiss one,
      try "Explain with AI" (exercises the real Groq/Gemini key)
- [ ] Historical Imagery — pick a cluster, run a comparison for the one
      valid year pair, confirm a narrative renders (real OpenRouter key
      or the documented fallback-to-facts phrasing, either is correct)
- [ ] Map — layers render (zoning, restriction, infrastructure, change
      detection)
- [ ] Notifications and Profile load correctly

### Admin Portal (sign in as `admin@bhoomisetu.gov.in`)
- [ ] Dashboard — top-at-risk-parcels list renders with real scores
- [ ] Departments — directory loads; create/edit/delete one test
      department
- [ ] System Monitoring — activity log shows real audit entries,
      filterable by type
- [ ] Workflow Oversight — cross-department workflow list, filters work
- [ ] Map Layer Authoring — draw a test zoning overlay on the map,
      confirm it saves and appears in the combined view; delete it
      afterward
- [ ] Officer Monitoring — table loads with real per-officer pending/
      approved/rejected/avg-decision-time figures

### Cross-cutting
- [ ] Logging out and back in works; an expired/invalid token correctly
      redirects to `/login` (check the browser's dev tools Network tab
      for a real `401` triggering it, not a silent failure)
- [ ] No CORS errors in the browser console anywhere above — `backend-py`
      accepts any origin by default in dev (`CORS_ORIGIN` unset), so
      this should be clean; a CORS error here would indicate something
      genuinely wrong, not a config gap

---

## 4. Known, already-documented gaps to expect (not new bugs)

These were flagged during the live-Jest-spec conversion work and are
**expected**, not something this connection plan should "fix":

- Registration/OTP-verification and profile-contact-verification were
  proven correct in-process (pytest, with mocked SMS/email providers)
  but never against a real running server with real delivery — until
  now. This plan's smoke test is the first time these get a genuine
  end-to-end check; a failure here would be a **new**, real finding.
- Document-based parcel identification (`POST
  /parcels/identify-from-document`) and workflow evidence-upload OCR
  prechecks were similarly untested live for the same reason (no way to
  faithfully replicate backend-py's OCR text-matching from the Jest
  harness). Same as above — first real check happens in this plan's
  Citizen Portal section.
- AI-dependent responses (`/ai/query`, alert/parcel explanations,
  historical-imagery narratives) will differ in exact wording from
  whatever `backend/`'s equivalent produced historically — both call a
  real LLM, and LLM output isn't byte-reproducible. Judge these on
  *shape and correctness* (right intent, right risk level, a real fact
  mentioned), not exact text match.

---

## 5. Rollback

Both targets are fully reversible with no data cleanup:

- **Target A:** delete `frontend/.env.local`, restart `npm run dev`.
- **Target B:** revert the two `docker-compose.yml` lines, `docker
  compose build frontend && docker compose up -d`.

`backend-py`'s database (`bhoomisetu_py`) and `backend`'s
(`bhoomisetu`) are separate databases on the same Postgres instance —
nothing written while connected to `backend-py` ever touches or needs
reconciling with `backend`'s data.

---

## 6. Relationship to §6 (the real cutover)

This plan only ever runs against `localhost`. It proves the two apps
*can* talk to each other correctly and finds integration bugs cheaply,
but it is not the production cutover — `CUTOVER_AND_OPS_PLAN.md`'s
decisions (real hosting, a real domain, a real maintenance window) still
have to be made and executed separately. Think of this plan as making
§6's own "full-system rehearsal in staging" step (its step 1) far less
risky, by working out most of the kinks against `localhost` first, for
free, before staging infrastructure even exists.
