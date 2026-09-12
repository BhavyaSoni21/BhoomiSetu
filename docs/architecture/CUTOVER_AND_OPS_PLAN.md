# §6/§7 Cutover & Ops Maturity — Decision Checklist and Runbook

Turns `PYTHON_MIGRATION_PLAN.md` §6 (cutover) and §7 (ops maturity) into
something executable. **Nothing in this document has been provisioned or
run — it's a plan only**, per the user's explicit choice (2026-09-12) to
have the checklist written before any real infrastructure work starts.

Everything else in the plan is done: every module in §4's build order is
ported and validated (both pytest and the live-Jest-spec harness), CI (§5)
runs both suites on every relevant PR, and real rate limiting is wired in.
This document is what's left.

---

## Part 1 — Decisions only you can make

Nothing below can be started until these are answered — not because the
work is hard, but because each one commits to a real cost, a real vendor,
or a real credential, and reversing a wrong choice later is expensive in
a way that asking first isn't.

### 1. Where does `backend-py` actually run (staging + production)?

Needs: Docker (already how it's built/run locally), a way to reach
Postgres+PostGIS, a way to run `alembic upgrade head` before/during
deploy, and — because of decision 2 below — either persistent disk or no
reliance on local disk at all.

| Option | Fit |
|---|---|
| Single VPS (DigitalOcean Droplet, Hetzner, etc.), `docker compose` much like local dev | Cheapest, closest to what's already been developed/tested against; you own OS patching |
| Managed container platform (Railway, Render, Fly.io) | Less ops overhead, built-in TLS/domains; usually pricier at scale, some have less predictable cold-start/region behavior |
| Cloud VM + managed Postgres (AWS EC2/RDS, GCP Compute/Cloud SQL) | Most control and scale headroom; most setup work and moving parts |

**Decision needed:** pick one (or say if you want a recommendation weighed
against your actual budget/team size — that's a fair follow-up question,
not this document's to guess).

### 2. Where does file storage live in production?

`backend-py/app/common/supabase_storage.py` already supports two modes:
real Supabase Storage (when `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are set)
and a local-disk fallback (`uploads/` under the working directory,
currently what local dev and CI both use). **Local disk does not survive
a container redeploy or a multi-instance deployment** — a real production
deployment should set the Supabase env vars and use real storage, not
the fallback.

**Decision needed:** do you already have (or want to create) a Supabase
project for this, or a different object store entirely (the fallback's
existence means an S3-compatible alternative could be wired in later
without much churn, but isn't built today)?

### 3. Where does the database live?

| Option | Fit |
|---|---|
| Self-hosted Postgres+PostGIS on the same host as `backend-py` (what `docker-compose.yml` does today) | Simplest, zero new vendor; you own backups (§7) and patching |
| Managed Postgres with the PostGIS extension enabled (AWS RDS, DigitalOcean Managed Postgres, etc. — confirm PostGIS support before picking one; not every managed Postgres offers it) | Backups/patching handled for you; costs more, one more vendor |

**Decision needed:** pick one. This also answers §7's "backup/restore"
fast-follow almost for free if you pick managed.

### 4. Domain and DNS for the API

The frontend already reads its backend URL from one env var —
`frontend/src/services/apiService.ts`'s `VITE_API_URL` — so cutover is a
single env var flip once `backend-py` has a real URL.

**Decision needed:** what's the production API hostname going to be
(e.g. `api.<yourdomain>`), and do you already control DNS for it, or
does that need to be set up as part of this work?

### 5. Staging environment shape

§6 step 1 requires a full rehearsal in staging before touching
production — this can't be skipped or done against production "carefully
instead."

**Recommendation (not a decision I've made for you — flag if you'd
rather do this differently):** an identical stack to production, on the
same hosting target, at smaller size, with its own domain (e.g.
`staging-api.<yourdomain>`) and its own database. Cheap to run
continuously, and doubles as a place to safely rehearse *any* future
deploy, not just this one cutover.

### 6. Maintenance window

§6 is a single planned-downtime event, not a gradual rollout.

**Decision needed:** what day/time is acceptable for real users to be
down, and who (if anyone) needs advance notice before it happens?

### 7. Secrets management approach (§7 fast-follow, not blocking cutover)

The growing list: `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`GROQ_API_KEY`, `GEMINI_API_KEY`/`OPENROUTER_API_KEY`, `TEXTBEE_*`,
`MAIL_*`.

| Option | Fit |
|---|---|
| Hosting platform's own env var UI (Railway/Render/Fly.io secrets, or a `.env` file only on the VPS, never committed) | Simplest, zero new vendor, fine as a first pass — §7 explicitly says this is fast-follow, not a cutover blocker |
| Dedicated secrets manager (Doppler, 1Password, AWS Secrets Manager) | Worth it once more than one person needs access or rotation needs to be audited; adds a vendor and integration work now |

**Decision needed:** start with the platform's own env vars (recommended
for a first pass) unless you already have a reason to want more.

### 8. Monitoring/alerting and backup/restore tooling (§7 fast-follow)

**Decision needed, but genuinely fast-follow — do not let this block
§6:**
- Monitoring: the hosting platform's own metrics/logs are enough to
  start (all three options in decision 1 have some built-in); a
  dedicated tool (Sentry for errors, UptimeRobot/Better Stack for uptime,
  Grafana Cloud for metrics) can be added later without re-architecting
  anything.
- Backup/restore: if you picked managed Postgres in decision 3, this is
  close to free (enable automated backups, then actually run a restore
  once to prove it works — an untested backup is not a backup). If
  self-hosted, this needs a real `pg_dump` cron job writing to storage
  *off* the same host (e.g. the same Supabase/S3-compatible bucket as
  decision 2), plus the same tested-restore requirement.

---

## Part 2 — §6 Cutover runbook

Ready to execute once every decision in Part 1 is made and staging (from
decision 5) actually exists. Copy this into an issue/checklist at
execution time rather than checking boxes in this file.

### Step 1 — Full rehearsal in staging

- [ ] Staging `backend-py` deployed (decision 1), pointed at staging
      Postgres+PostGIS (decision 3) and staging storage (decision 2)
- [ ] `alembic upgrade head` run against staging DB from empty
- [ ] `python scripts/seed.py` run against staging DB — this is also the
      final proof the ported seed script produces a real, working
      dataset, not just one that satisfies unit tests
- [ ] A staging build of the frontend has `VITE_API_URL` pointed at the
      staging `backend-py` URL (decision 4's staging equivalent)
- [ ] Smoke test against staging, at minimum: login, one workflow
      end-to-end (file a request, have an officer approve/reject a step),
      one map/spatial view, one file upload
- [ ] Any problems found here get fixed in the runbook itself before step
      2 — that's the entire point of rehearsing first

### Step 2 — Maintenance window

- [ ] Communicate the window decided in Part 1 decision 6, if anyone
      needs advance notice
- [ ] Take the live site down for maintenance (mechanism depends on
      decision 1's hosting choice — a static maintenance page, a
      platform-level maintenance mode, or a DNS-level redirect)

### Step 3 — Reseed production

- [ ] `alembic upgrade head` against the real production database
- [ ] `python scripts/seed.py` against the real production database

### Step 4 — Deploy and cutover

- [ ] Deploy `backend-py` to production (decision 1's real target)
- [ ] Set the frontend's `VITE_API_URL` to the production `backend-py`
      URL (decision 4) and redeploy the frontend
- [ ] Full smoke test against the **real production deployment** (not
      staging) — same minimum coverage as step 1: login, one workflow
      end-to-end, one map/spatial view, one file upload

### Step 5 — Bring the site back up

- [ ] Remove the maintenance page/mode from step 2

### Step 6 — Grace period before deleting `backend/`

- [ ] Keep `backend/` (the NestJS app) in the repository and out of the
      deploy path — not deleted — for a short, defined window (recommend
      14 days) as cheap insurance against needing to check exact prior
      behavior if something unexpected surfaces post-cutover
- [ ] Delete `backend/` only after that window closes cleanly, and only
      when you explicitly ask for it

---

## Part 3 — §7 fast-follow (right after cutover, not blocking it)

Per the plan, none of this is required to execute the cutover
successfully, but a government land-records platform shouldn't run
without it for long. Schedule immediately after Part 2 closes, not
indefinitely later.

- [ ] Monitoring/alerting on the production deployment (decision 8)
- [ ] Backup/restore for Postgres, including one actual tested restore —
      not just confirming backups exist (decision 3/8)
- [ ] Secrets management for the full list in decision 7, beyond
      whatever ad-hoc approach got the cutover itself done
