# BhoomiSetu — Python Backend Migration Plan

**Status: planned, not started.** This document records a committed decision, not an open option: the backend is moving from NestJS/TypeScript to Python/FastAPI. **The end state is zero NestJS in this codebase.** It exists so the *how* survives past this conversation — re-derive it from scratch later and you'll re-argue decisions (build order, schema/seed ownership, test-reuse mechanism, cutover runbook) that are already settled here.

**Confirmed constraints this plan is built around (2026-09-11):**
- Single database — one Postgres+PostGIS instance, same as today. No split across multiple database technologies.
- No live production data to preserve — the database can be wiped and reseeded from scratch as part of the cutover.
- Planned downtime during cutover is acceptable. This is **not** a zero-downtime live migration.
- API contracts stay exactly as they are today — this is a language migration, not an API redesign. The frontend needs no changes, and the test-reuse mechanism in §4 depends on this holding.
- CI (§5) and a staging environment (§6) are in scope for this same push, not deferred work — they're load-bearing parts of this plan, not separate initiatives (see §7).

The first three of those facts rule out the classic Strangler Fig machinery (a live NestJS-proxy layer routing traffic module-by-module, dual-ORM schema coexistence, incremental production burn-in). None of that exists to protect live data or avoid downtime — without those constraints it's pure overhead. This plan is simpler: **build `backend-py` completely and independently alongside the untouched, still-live NestJS backend, validate it exhaustively, then cut over once, during a planned maintenance window.**

---

## 0. Prerequisites before any build work starts

Frontend work is in progress in parallel, on its own branch, not yet merged. That has to resolve *before* `backend-py` work begins, not alongside it:

- **Merge the outstanding frontend branch(es) into `main` first.** The plan's contract-parity assumption (§2 — `backend-py` reproduces NestJS's existing REST contracts exactly) is only meaningful against the *actual, final* frontend. Starting Python work against a frontend snapshot that's still changing risks building `backend-py` against contracts that shift underneath it mid-build.
- **Re-check this plan against the merged result before starting Phase 0.** If the merged frontend work added new routes, changed a request/response shape, or introduced a new feature needing new backend surface, that's new scope for §2's contract-parity target — fold it in deliberately, don't discover it mid-port. If nothing changed, this is a quick confirmation, not a re-plan.
- **Cut a reference branch of the current (post-merge) NestJS codebase before writing any Python code** — e.g. `nestjs-legacy`, branched from `main` immediately after the merge above. This is the known-good baseline: what §4's ported tests are proven against, what §6's cutover can fall back to, and a stable reference for "what did the old behavior actually do here" questions mid-build, without it drifting while `backend-py` work is underway.
- Do the actual `backend-py` build on its own branch (e.g. `python-migration`), not directly on `main` — keep the two efforts from stepping on each other in git history, and merge to `main` only at the cutover in §6.

---

## 1. Why, and what "done" means

BhoomiSetu has moved past its SIH 2026 demo phase and is being taken toward a real, India-scale production deployment. That changes the calculus on the backend's language: Python's GIS ecosystem (GeoPandas, Shapely, GDAL/rasterio) and ML/CV ecosystem are materially deeper than anything available in the Node world, and several features this platform will need at production scale — real spatial analysis instead of hand-rolled PostGIS query strings, real document/image models instead of calling out to Groq/Gemini for everything — are better built on that ecosystem than kept on Node's.

This is **not** a performance argument. NestJS runs at real production scale elsewhere; Node's event loop is not the bottleneck a government-scale deployment would actually hit (that bottleneck is Postgres/PostGIS tuning and infra, not the API runtime). The only real driver is library access, and it applies unevenly across the codebase — heavily to the GIS-heavy modules, not at all to the RBAC/session/workflow-state machinery.

**Done means:** a single Python/FastAPI backend. `backend/` deleted in full. `docker-compose.yml`'s NestJS service gone. The frontend's `VITE_API_URL` pointed at `backend-py`.

**Why build module-by-module instead of all at once, given there's no live traffic to protect:** the risk that remains even without live data is **correctness regression** — silently reintroducing bugs this project already found and fixed. The 409 existing tests aren't just coverage; several encode real bugs discovered empirically this session (the department-scoping gap in `KNOWN_RISKS.md` HIGH-9, the workflow N+1 pattern, the `tokenVersion` session-revocation logic, PostGIS column-casing bugs that only surfaced against real Postgres, never SQLite). Building and validating one module at a time — rather than writing all 150 files and only discovering problems at the very end, across the whole system at once — catches these while they're still small and attributable, the same reason it was worth doing even under the old live-coexistence plan. What changes is *what* validation means (§4), not *whether* to do it incrementally.

---

## 2. Architecture

- **`backend-py/` is built as a complete, independent FastAPI application from day one** — FastAPI + SQLAlchemy + Pydantic + Alembic + pytest + uvicorn. It owns its own schema from the start (a fresh Alembic migration history, not inherited from TypeORM) and its own seed data (ported from `backend/seed.ts`, see §3). It is not integrated with `backend/` at any point before cutover — no proxying, no shared traffic, no dual-schema period. The two exist side by side, `backend/` serving 100% of real traffic unmodified, until the single cutover event in §6.
- **Contract parity is confirmed, not just assumed.** `backend-py` reproduces NestJS's existing REST contracts (routes, request/response shapes, status codes, error formats including `requestId`) exactly, so the frontend needs no changes and the existing test specs remain meaningful without rewriting their assertions (§4). This is a language migration, not an API redesign — the two are deliberately kept as separate concerns; bundling them would turn this into two concurrent migrations with a materially different, larger risk profile than this plan is scoped for.
- **Auth:** `backend-py` implements its own JWT issuance and verification from the start (unlike the earlier live-coexistence draft, there's no "verify-only until Phase 4" period, since nothing is shared with a running NestJS instance before cutover). Same `JWT_SECRET`-compatible design, same payload shape (`sub`, `email`, `role`, `tokenVersion`), same "look the user up fresh, reject on `tokenVersion` mismatch" logic as `backend/src/auth/jwt.strategy.ts`'s `JwtStrategy.validate()` — reproduced faithfully, not reinvented, since that logic backs this session's HIGH-2 session-revocation fix.

---

## 3. Shared and cross-cutting code, and the seed script

Not every file in `backend/src` belongs to a domain module — several are plain utility code imported by multiple modules, and the seed script is its own substantial porting task. Confirmed by direct inspection (2026-09-11):

| Code | Files | Used by | Port when |
|---|---|---|---|
| `common/postgis.ts`, `common/geo-utils.ts`, `common/parcel-generation/*.ts` | 6 files | `GisModule`, `SpatialModule`, `ChangeDetectionModule`, `HistoricalImageryModule`, `ParcelsModule` | First, as part of standing up `backend-py`'s shared package — every GIS-heavy module needs it immediately. |
| `common/supabase-storage.ts` | 1 file | `WorkflowsModule`, `HistoricalImageryModule`, `ParcelsModule` | Alongside the batch above — needed as soon as `HistoricalImageryModule` is built. |
| `document-verification/ocr.ts`, `document-verification/field-matcher.ts` | 2 files | `ParcelsModule`, `WorkflowsModule` | With `ParcelsModule` (built first of its two consumers) — `WorkflowsModule` reuses the already-ported version. |
| `notifications/` (`NotificationsModule`: `sms.service.ts` via TextBee, `email.service.ts` via Zoho SMTP) | 3 files | `AuthModule` only | With `AuthModule`, since it has no other purpose. This is a real registered module, not a utility file — easy to miss since it's small. |
| **`backend/seed.ts`** | ~1,000 lines | Everything — this is what generates every parcel, department record, user account, and demo dataset the whole system runs on | Ported early, right after the shared spatial package (above) and the core entity/model definitions exist — `backend-py` has no data to test *anything* against until this exists. Treat it as its own tracked task, not an afterthought once the "real" modules are done. |

**Confirmed dead code, no porting needed:** `adapters/` and `common/dto`, `common/interfaces`, `common/utils` are all empty directories (verified 2026-09-11) — not wired into `AppModule`, nothing imports them.

---

## 4. Build order and the per-module validation gate

### Build order

Same dependency-informed ordering as before — low-coupling, high-Python-value modules first, core security last — except this is now purely a **build/validation sequence** (what gets written and proven correct first), not a live traffic cutover order, since nothing takes real traffic until §6.

| Group | Modules | Why this position |
|---|---|---|
| Low-coupling, real PostGIS work | `GisModule` (3 files), `SpatialModule` (12, heaviest PostGIS user), `ChangeDetectionModule` (5), `HistoricalImageryModule` (6) | Own their own entities, minimal inbound dependencies, and are exactly where GeoPandas/Shapely/GDAL earn their keep. `ChangeDetectionModule`/`SpatialModule` were originally specified as Python+OpenCV in `Tech.md` §33 (see `docs/archive/FEATURE_AUDIT.md`) before the team substituted Node/TS — this is a return to that original intent. |
| Medium coupling | `ParcelsModule` (10 files) | Geometry-heavy, imports `InteroperabilityModule`/`WorkflowsModule`/`PredictiveAnalyticsModule`/`AuditModule` — first module whose own tests need those modules to already exist in `backend-py`. |
| Peripheral, non-spatial | `LandRecordsModule`, `AnalyticsModule`, `PredictiveAnalyticsModule`, `NotificationFeedModule`, `DepartmentsModule` (21 files, heaviest entity fan-out), `InteroperabilityModule`, `AiModule`, `GovernanceModule`, `AdminModule` | No GIS/ML upside individually, but lower-stakes than the security core — clearing these first means core security is the last, most-scrutinized thing built. |
| Core security/RBAC/workflow-state | `AuditModule` (leaf, but depended on by nearly everything else — build first within this group), `UsersModule`, `NotificationsModule` (§3), `WorkflowsModule`, `AuthModule` (19 files, largest module in the codebase) | Highest inbound dependency fan-in, and the exact code this project just finished a full security audit and hardening pass on (`KNOWN_RISKS.md` HIGH-1/2/3/6/7/9, MED-1–4/7/8/9/10 — all closed 2026-09-11). Built and scrutinized last, deliberately. |

**Known Phase-0 gotcha:** GDAL (needed by GeoPandas/rasterio) is a system-level C library, not a clean `pip install` — `backend-py`'s `Dockerfile` needs `apt-get install gdal-bin libgdal-dev` (or a base image that bundles it) before `pip install` succeeds. Confirm this before writing any spatial code, not partway through.

### Per-module validation gate

Two checks, both required, for every module before it's considered done:

1. **Port the tests.** Each module's existing `backend/test/<module>.e2e-spec.ts` (Jest + Supertest) is the source of truth for behavior — port every test into `backend-py/tests/test_<module>.py` using `pytest` + FastAPI's `TestClient`. This is where the RBAC/validation/ownership edge cases this project already paid to discover get preserved.
2. **Run the original, unmodified Jest spec directly against `backend-py`.** Because contract parity is the default (§2), this works with almost no changes: Supertest's `request(...)` accepts a base URL, not just an in-process app — point it at a running `backend-py` instance (`request('http://localhost:8000')` instead of `request(app.getHttpServer())`) and the *original* test file, assertions untouched, becomes a language-agnostic contract check. This is strictly better than trusting the pytest port alone: it proves `backend-py`'s actual HTTP behavior matches what NestJS's did, not just what the person porting the test *thought* it did.

A module passes its gate only when both suites pass. Keep both indefinitely until final cutover (§6) — they're cheap to keep running and they're the only thing standing between "looks done" and "is done."

---

## 5. CI enforcement

There is no CI in this repository today (confirmed 2026-09-11 — no `.github/workflows`). Introduce one as soon as `backend-py` exists, before the second module is built:

- On every PR touching `backend-py/`: run its pytest suite *and* every ported-and-still-relevant original Jest spec (pointed at a `backend-py` instance per §4) against a real Postgres+PostGIS service container — not SQLite, since PostGIS-specific behavior is exactly what a rewrite risks getting subtly wrong.
- Block merge on either suite failing.

---

## 6. Cutover

A single, planned event, not a gradual one — this is the part that costs the accepted downtime.

1. **Full-system rehearsal in staging first.** Before doing this against whatever environment matters, run the entire runbook below once in a staging environment: fresh reseed, full `backend-py` deploy, frontend pointed at it, full smoke test. Find problems with the runbook itself here, not during the real window.
2. **Maintenance window:** take the site down.
3. Run the ported `seed.ts` (§3) against a fresh database — this is the reseed, and it's also the final proof the Python seed script actually produces a working dataset, not just one that satisfies unit tests.
4. Deploy `backend-py`, point the frontend's `VITE_API_URL` at it, run a full smoke test against the real deployment (not staging) covering at minimum: login, one workflow end-to-end, one map/spatial view, one file upload.
5. Bring the site back up.
6. **Don't delete `backend/` the same day.** Keep it out of the deploy path but present in the repo/history for a short, defined grace period (days, not months) — cheap insurance against needing to reference exact prior behavior if something unexpected surfaces post-cutover. Delete it once that window closes cleanly.

---

## 7. Ops maturity — what's in scope now vs. fast-follow

None of this is caused by the migration, but "real India-scale production" needs it regardless of backend language. Split by whether the migration itself depends on it:

- **In scope for this same push — the plan doesn't work without them:** a **staging environment** (§6's cutover rehearsal has nowhere to run without one) and **CI** (§5 — without it, §4's dual-test gate is only as reliable as someone remembering to run both suites by hand, which is exactly the gap CI closes). These aren't separate initiatives riding along with the migration; they're what makes the migration's own safety mechanisms real instead of aspirational.
- **Fast-follow, immediately after cutover, not blocking it:** monitoring/alerting on the production deployment, a backup/restore story for Postgres, and secrets management for the growing list of API keys (`JWT_SECRET`, `SUPABASE_*`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `TEXTBEE_*`, `MAIL_*`). None of these are required to execute the cutover successfully, but launching a government land-records platform without them for long is its own risk — schedule this right after §6, not indefinitely later.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rewriting core security introduces a subtle RBAC/ownership bug a rewrite-from-memory would miss | `AuditModule`/`UsersModule`/`NotificationsModule`/`WorkflowsModule`/`AuthModule` built and scrutinized last, using the same dual-test gate as everything else — not exempted because it's "just a port" |
| Ported `seed.ts` produces subtly different data than the original (wrong distributions, missing edge cases like the flood-zone-restriction demo data or the pre-linked citizen-parcel accounts) | The cutover rehearsal in §6 step 1 is specifically where this gets caught — a full staging reseed-and-smoke-test, not just unit tests on the seed logic in isolation |
| Spatial query behavior (`ST_Contains`/`ST_Intersects` coordinate order, quoted-column casing) drifts between TypeORM's queries and GeoAlchemy2's | CI runs against real Postgres+PostGIS (§5), never SQLite — this exact category of bug only surfaced against real Postgres last time too |
| API contract drift between `backend-py` and what the frontend actually expects | The original-Jest-spec-against-a-URL trick in §4 catches this directly, for every module, automatically — not just for the ones someone remembers to manually check |
| Cutover day itself goes wrong (bad deploy, missed step, runbook gap) | Full rehearsal in staging first (§6 step 1); `backend/` kept available, undeleted, for a grace period after cutover (§6 step 6) |
| Shared utility code (§3) ported inconsistently or duplicated per-module | Ported once, at the point of its first consumer, into `backend-py`'s own shared package — never re-ported later |

---

*Source: this plan was scoped in conversation 2026-09-11, immediately after the `KNOWN_RISKS.md` audit was fully closed out (all Critical/High findings and the reachable Medium/Low findings fixed in the same session). Revised three times the same day: first after confirming single database / no live data to preserve / planned downtime acceptable (which replaced an earlier live-coexistence Strangler Fig proxy draft with the single-cutover model above), then after confirming API contracts stay identical and that CI/staging are in-scope rather than deferred (§7), then again to add the branch/merge prerequisites in §0 once a concurrent in-progress frontend branch came up. Module file counts and dependency edges were read directly from `backend/src/app.module.ts` and each module's own `*.module.ts` imports; re-verify against the running codebase if this document is consulted much later.*
