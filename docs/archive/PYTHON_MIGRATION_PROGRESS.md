# Python Migration — Progress

Tracks execution of [`PYTHON_MIGRATION_PLAN.md`](PYTHON_MIGRATION_PLAN.md) phase by phase, updated as work lands — the plan document itself stays fixed (it records the committed *how*); this one records *how far*. Re-verify against the running codebase if this is consulted much later.

**Started:** 2026-09-11 (frontend branch merge). **Status: every module in §4's build order is ported (as of AuthModule, 2026-09-12); CI (§5) is in place, including the live-spec suite as a second job; real rate limiting is wired in; the live-Jest-spec validation gate (§4's second gate) is complete (all 22 HTTP-behavior specs converted, 332 tests passing together, both locally and in CI). Remaining: §6/§7's cutover/ops work — a decision checklist and ready-to-execute runbook now exist (`docs/architecture/CUTOVER_AND_OPS_PLAN.md`), waiting on real infrastructure decisions only the user can make — see "Up next" below.**

---

## §0 — Prerequisites

| Item | Status |
|---|---|
| Merge the outstanding `Auth` frontend branch into `main` | Done — reconciled against 21 commits of intervening work, zero new test regressions, merged 2026-09-11 |
| Re-check the plan against the merged frontend for new scope | Done — no new routes, request/response shapes, or backend surface introduced by the merge; §2's contract-parity target is unaffected |
| Cut `nestjs-legacy` reference branch from post-merge `main` | Done — frozen, no further commits |
| Create `python-migration` branch for the actual build | Done |
| Decide backend-py's local dev environment (GDAL is painful outside Docker/apt) | Decided: Docker from day one, not native Windows |

## Phase 0 — `backend-py` skeleton

FastAPI + SQLAlchemy + GeoAlchemy2 + Alembic + pytest + uvicorn, running as its own `docker-compose.yml` service (`backend-py`, port 8000) against its own database (`bhoomisetu_py`, same `postgis` instance) — not integrated with `backend`/`frontend` before cutover, per plan §2.

- `app/main.py` — mirrors `backend/src/main.ts`'s refuse-to-start checks (placeholder `JWT_SECRET`, missing DB credentials in production), CORS, and Swagger-gating (`/api/docs` disabled in production).
- `app/middleware.py` — request-ID stamping + a global exception handler reproducing `all-exceptions.filter.ts`'s `{statusCode, message, error, requestId}` response shape (not FastAPI's own `{"detail": ...}` default), registered against Starlette's base `HTTPException` so routing-level 404s are caught too, not just app-raised ones (a real bug caught and fixed during verification — see below).
- `app/routers/health.py` — mirrors `health.controller.ts`, mounted outside the `/api/v1` prefix.
- Alembic wired to `app.config`/`app.database`, same DB settings the app itself reads. Fresh migration history, no models yet.

**Verified:** `docker compose up` → health check responds correctly; 404 error contract matches NestJS's shape; request-ID is honored/stamped on every response; `pytest` passes; `alembic upgrade head` connects cleanly against the real `bhoomisetu_py`/PostGIS database.

**Bug found and fixed during verification:** the exception handler was initially registered against `fastapi.HTTPException` (a subclass) rather than Starlette's base `HTTPException`, so routing-level errors (404 on an unmatched path) bypassed it and fell through to FastAPI's default `{"detail": ...}` body instead of the NestJS-matching shape.

**Commit:** `Phase 0: scaffold backend-py (FastAPI + SQLAlchemy + Alembic + pytest)` on `python-migration`.

## §3 — Shared/cross-cutting code

Ported so far (`app/common/`), all with unit tests, no entity dependencies:

- `pagination.py` ← `pagination.ts` (KNOWN_RISKS.md HIGH-6 ceiling/default).
- `parcel_generation/parcel_category.py` ← `parcel-category.ts`.
- `parcel_generation/geometry.py` ← `geometry.ts` (pure polygon math: convex hull, half-plane clipping, corner nibbling, ring validation).
- `parcel_generation/cluster_generator.py` ← `cluster-generator.ts` (the 5-cluster irregular-subdivision parcel generator).
- `parcel_generation/cluster_snapshot_generator.py` ← `cluster-snapshot-generator.ts` (SVG→PNG cluster rendering; `sharp` → `cairosvg`).
- `parcel_generation/parcel_document_generator.py` ← `parcel-document-generator.ts` (SVG→PNG synthetic document rendering; `sharp` → `cairosvg`).
- `supabase_storage.py` ← `supabase-storage.ts` (local-disk fallback / Supabase Storage, path-traversal guard preserved).

**Deliberately NOT ported** — `postgis.ts` and `geo-utils.ts` are artifacts of `backend/`'s dual-driver design (SQLite fallback with hand-rolled planar geometry vs. real PostGIS). `backend-py` has no SQLite driver at all (Postgres+PostGIS only, per plan §2's single-database constraint and the fact GeoPandas/GDAL need real PostGIS anyway) — any equivalent spatial operation is just GeoAlchemy2/PostGIS SQL or Shapely directly, not a ported fallback path.

**Found but not yet ported** — the plan's own §3 table missed four real, wired-in `backend/src/common/` files during its audit:
- `all-exceptions.filter.ts` / `request-id.middleware.ts` — already covered, folded into Phase 0's `app/middleware.py` above rather than kept as a separate "common" port.
- `identifier-utils.ts` — depends on the `ParcelIdentifier` entity (doesn't exist yet); deferred to whichever of `DepartmentsModule`/`InteroperabilityModule` builds it first.
- (pagination/exceptions/request-id already accounted for above.)

## Core entity/model definitions

`seed.ts` turned out to need entities from nearly every module (22 entities across Parcels/Spatial/LandRecords/Departments/HistoricalImagery/Governance/Users/Admin), not a small subset — ported all 22 as SQLAlchemy models (`app/models/`), one Alembic migration, applied and verified against the real `bhoomisetu_py`/PostGIS database (upgrade, downgrade, re-upgrade all clean; `alembic check` reports no drift).

**Deliberate deviations from a literal port** (both directly serve plan §1's actual point — real spatial analysis instead of hand-rolled query strings/SQLite-portability hacks):
- `geometry: text` (raw GeoJSON string) columns → real PostGIS `Geometry` columns via GeoAlchemy2, SRID 4326. `Parcel`/`ZoningOverlay`/`RestrictionZone`/`ChangeDetectionEvent` are typed `POLYGON`; `InfrastructureFeature` stays generic `GEOMETRY` (mixed LineString/Point per the original comment).
- TypeORM's `simple-array` (comma-joined text, a SQLite-portability hack) → Postgres's native `ARRAY` type, for the `*_parcel_ids` columns.

**Bugs found and fixed during verification** (none would have surfaced without actually running migrations against real Postgres+PostGIS, not just `alembic check`):
1. Alembic's autogenerate proposed `DROP TABLE spatial_ref_sys` (PostGIS's own internal system table, not one of ours) — fixed with an `include_object` filter in `alembic/env.py`.
2. The generated migration referenced `geoalchemy2.types.Geometry` without importing `geoalchemy2` — a known Alembic/GeoAlchemy2 autogenerate gap. Fixed the one migration by hand and added `import geoalchemy2` unconditionally to `alembic/script.py.mako` so every future migration gets it automatically.
3. GeoAlchemy2 auto-creates a GIST spatial index on every `Geometry` column via its own DDL event (at `CREATE TABLE` time) - autogenerate also proposed explicit `create_index`/`drop_index` calls for those same columns, which fails with "already exists" on upgrade. Removed the redundant explicit index operations from the migration; GeoAlchemy2 manages them.
4. `docker-compose.yml`'s `backend-py` service had no volume mount - files the container generates itself (Alembic migrations, above all) were being lost in the container's throwaway writable layer on every rebuild, never reaching the host to commit. Added a full bind mount (`./backend-py:/app`); safe since pip installs to site-packages, not into `/app`.

Also added `tests/models/test_models.py` - real insert/query/relationship/constraint checks against the live database (geometry roundtrip, cascade delete, unique constraints, the deliberate no-FK `parcel_id` pattern the six department-record models share), plus a `tests/conftest.py` transaction-per-test fixture. 49/49 tests pass.

**Not yet ported:** `identifier-utils.ts` (needs `DepartmentsModule`/`InteroperabilityModule` context, not just the entity - deferred, as before).

## `seed.ts`

Ported to `scripts/seed.py`, runnable inside the container as `python -m scripts.seed`. Same 5-cluster dataset, same phases (generate geometry → build parcel entities + per-parcel department records → bulk-save cross-cutting tables → Pune spatial layers → demo accounts/citizens → parcel documents → departments).

**One more file found and partially ported that the plan's §3 table also missed:** `geo_utils.ts`'s `pointInRing`/`polygonDistanceMeters` — earlier progress notes said geo-utils.ts was purely a SQLite-fallback artifact with no reason to port. That's true for the *live API* callers, but `seed.ts` itself calls these two functions directly (flood-zone membership, TOUCHING/NEARBY neighbour classification) regardless of database driver. Ported just those two functions to `app/common/geo_utils.py` — not the rest of the file (`ringsOverlap` etc.), which really is SQLite-fallback-only.

**Deliberate scope-limiting decision:** real OCR (`document-verification/ocr.ts`) is NOT ported yet — the plan schedules it "with ParcelsModule," not now. Seeded parcel documents get `extracted_text=None` instead of a real Tesseract pass; `scripts/seed.py` has a module docstring flagging this and will be updated once ParcelsModule ports OCR for real. (The document *images* are still fully generated and uploaded, same as the TS version — only the text-extraction step is deferred.)

**Bug found and fixed during verification:** an automated find/replace (routing every `identifiers_to_save.append(...)` through a new `add_identifier()` helper, to fix a separate SQLAlchemy cascade-timing warning) also rewrote the helper's own body, since the replacement pattern matched inside the function it was defining — `add_identifier()` called itself instead of `identifiers_to_save.append()`, causing infinite recursion (`RecursionError`) on the very first identifier. Caught immediately by actually running the script, not just review.

**Verified:** ran `python -m scripts.seed` against the real `bhoomisetu_py` database end to end — 220 parcels (matches `sum(c.parcel_count for c in CLUSTER_CONFIGS)`), 20 citizens, real PostGIS geometry confirmed queryable via `ST_AsText`, all 45 generated images (25 cluster snapshots + ~20 parcel documents) present on the local-disk storage fallback. Full test suite still green afterward (49/49) after fixing one test whose hardcoded department code (`LAND_RECORDS`) collided with the now-real seeded row of the same code — switched it to a random code, since the test's job is proving the *uniqueness constraint*, not reusing a specific production code.

---

## `GisModule` (first real API module)

Ported `gis.controller.ts` + `gis.service.ts` (`GET /gis/parcels`, `/gis/parcels/:id/geometry`, `/gis/parcels/:id/restrictions`) to `app/routers/gis.py`, wired into `app/main.py` under `/api/v1`.

**Real PostGIS from day one:** the TS service's `isPostgisAvailable()` branch (bbox filtering silently skipped under SQLite, with a `console.warn`) has no equivalent here - `ST_Intersects`/`ST_MakeEnvelope` always run, exactly the point of §1. Added a bbox-filtering test the original suite never had (SQLite never exercised that code path at all).

**New shared infrastructure this module needed, reusable by every module after it:**
- `app/schemas/base.py` - a `CamelModel` Pydantic base (`alias_generator=to_camel`) so every response schema matches the frontend's existing camelCase contract without solving that per-schema. Every `backend/src/*.entity.ts` field is camelCase (TypeORM's default); the Python/SQLAlchemy side is idiomatically snake_case, and §2's contract-parity target means the JSON wire shape has to stay camelCase regardless.
- `app/common/geometry_json.py` - converts a GeoAlchemy2 `WKBElement` to a GeoJSON dict at the API boundary.
- `tests/conftest.py` gained a `client` fixture: a `TestClient` whose requests are dependency-injected to use the *same* transactional `db` session as the test itself, so a test's fixture rows are visible to the API call and everything rolls back together.

**A real, deliberate contract quirk preserved, not "fixed":** TypeORM stored `Parcel.geometry` as a raw GeoJSON *string* column, so the list endpoint returns it to the frontend as an opaque, double-JSON-encoded string (`JSON.parse()` needed client-side) - only the single-parcel `/geometry` endpoint parses it into a nested object. backend-py's `geometry` is a real PostGIS column, not text, but `ParcelOut`'s schema converts it back to that same string-typed shape for the list endpoint (documented in the schema's own docstring) rather than silently "improving" the contract mid-migration - a genuine cleanup candidate for later, once it's confirmed nothing on the frontend still depends on the string form.

**Verified:** ported test suite (10/10, `tests/routers/test_gis.py`) passes against a `db`-fixture-isolated dataset; full suite 59/59. Also manually curl-smoke-tested every endpoint against the *real* seeded 220-parcel database (genuine DB round-trip, not test-fixture shortcuts) - list/filter/bbox/geometry-Feature/restrictions/400-on-bad-UUID/empty-body-on-unknown-UUID all match the original contract.

**Known gap, not module-specific:** §4's second validation gate ("run the *original* Jest spec directly against a running backend-py instance via `request('http://localhost:8000')`") wasn't set up this pass - it needs Node/Jest tooling wired to hit an external URL instead of an in-process Nest app, which is an infrastructure task (closely related to §5's CI setup), not something specific to GisModule. Tracked as a TODO to set up alongside CI, not skipped indefinitely.

---

## `SpatialModule`

Ported `spatial.controller.ts` + `spatial.service.ts` (zoning overlays, restriction zones, infrastructure features, change-detection-event reads, admin map notes) to `app/routers/spatial.py` + `app/services/spatial_service.py`, sharing the `/gis` prefix with GisModule (same as the TS side, where both controllers are `@Controller('gis')`).

**A real, critical bug found and fixed during this module's verification - not specific to Spatial, it affected every write endpoint in the app:** `app/database.py`'s `get_db()` dependency never called `db.commit()`. Every write endpoint (Phase 0 onward, including everything in this module) was returning a normal-looking 200/201 response with a real-looking generated id, while silently never persisting anything - the row only existed within that one request's session, discarded the moment the connection closed. Caught by a manual curl smoke-test-then-verify-via-psql after this module's automated tests all passed; **the automated tests did not catch it**, because they share one long-lived, never-committed session between test fixtures and API calls (`tests/conftest.py`), so a `flush()`-only write was already visible to a same-session follow-up query regardless of whether a real commit ever happened.

Fixed `get_db()` to commit on success / rollback on exception, and hardened `tests/conftest.py`'s `db`/`client` fixtures with the standard SQLAlchemy nested-SAVEPOINT testing pattern (`session.begin_nested()` + an `after_transaction_end` listener that restarts the savepoint) so the test `client` fixture now calls the *real* `db.commit()` after every request - exercising the actual commit path - while the outer test transaction still rolls back everything at teardown. Re-verified live: a POST through curl now genuinely survives a fresh `psql` query afterward.

**New shared infrastructure - the JWT verification substrate, not the full AuthModule:** `app/auth/deps.py` (`get_current_user`, `require_roles(*roles)`, `create_access_token`) - ported faithfully from `jwt.strategy.ts`/`roles.guard.ts`/`current-user.decorator.ts`. §2 already commits to "JWT issuance and verification from the start"; §4 still builds the *full* AuthModule (login/register/OTP endpoints, 19 files) last, deliberately - this is only the shared guard/dependency substrate several early modules' admin-only routes need, not that controller. `tests/helpers/auth.py` mints real tokens the same way for tests, matching `test/helpers/auth.ts`.

**Real PostGIS upgrades over the TS version's hand-rolled math** (§1's actual point): `rejectIfOverlapping` used `geo-utils.ts`'s `ringsOverlap` (application-code vertex/edge checks) → `ST_Intersects`. `computeAffectedParcelIds` fetched *every* parcel row and tested each centroid in Python → a single `ST_Within(ST_Centroid(...))` query, computed by PostGIS itself.

**New entity found, not in `seed.ts`'s imports (so missed during the earlier entity-porting pass):** `AdminMapNote` - added to `app/models/spatial.py`, migrated.

**Verified:** ported test suite (29/29, `tests/routers/test_spatial.py` - restructured from the TS spec's order-dependent shared `beforeAll` state into self-contained per-test fixtures, since the per-test transaction-rollback model requires it; every behavioral assertion preserved) passes; full suite 88/88. Manually curl-verified real end-to-end auth (minted a real JWT for a real seeded admin account, hit `/admin-notes` read/write, confirmed 401 with no token and a genuine persisted row via direct `psql` afterward).

---

## `ChangeDetectionModule`

Ported `change-detection.controller.ts` + `change-detection.service.ts` + `image-diff.ts` to `app/routers/change_detection.py` + `app/services/change_detection_service.py` + `app/services/image_diff.py`. `sharp` → Pillow for image decode/resize; the spatial-intersection step is real PostGIS (`ST_Contains`/`ST_Centroid`) unconditionally now, not the TS version's `isPostgisAvailable()`-gated choice between that and a Python point-in-polygon scan over every parcel.

Also ported `roles.constants.ts` → `app/auth/roles.py` (`OFFICER_ROLES`, `ALL_STAFF_ROLES`, `CITIZEN_ROLE`, `ROLE_DEPARTMENT`, `DEPARTMENT_ROLE`) - this module's controller is the first to need `ALL_STAFF_ROLES` for its role gate.

**Bug found and fixed during verification:** the multipart form fields (`minLng`/`minLat`/`maxLng`/`maxLat`) weren't being read at all - FastAPI's `Form()` parameters match the incoming field name against the *Python parameter name* by default (`min_lng`), not an alias, unlike the Pydantic `CamelModel` schemas used everywhere else in this codebase (which do carry a camelCase `alias_generator`). Every request failed with "Field required" x4. Fixed by adding explicit `Form(alias="minLng", ...)` to each parameter - a reminder that the camelCase-contract convention has to be applied by hand at every *new* kind of FastAPI parameter source (path/query/form/body), not just assumed to carry over from the schema layer.

**Verified:** ported test suite (6/6, real PNG images built and pixel-diffed through the actual decode/resize/diff pipeline, not mocked) passes; full suite 94/94.

---

## `HistoricalImageryModule`

Ported `historical-imagery.controller.ts` + `historical-comparison.service.ts` + `narrative.service.ts` to `app/routers/historical_imagery.py` + `app/services/historical_comparison_service.py` + `app/services/narrative_service.py`. Pure real-data comparison (each parcel's `ParcelCategory` computed for both years via `parcel_category.category_for`, already ported; a parcel is "affected" if its category differs) - no pixel math to port here, that lives in ChangeDetectionModule. `narrative_service.explain_parcel_changes` is a plain module-level function (not a class/DI-injected service) so tests can `monkeypatch.setattr` it directly, mirroring the TS spec's `overrideProvider(NarrativeService)`.

New settings: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` (added to `app/config.py` and `.env.example`) - independent of `GROQ_API_KEY`, same as the TS side. Degrades gracefully (503, caught and swallowed by the comparison flow, which falls back to the real underlying facts) when unset.

**Verified:** ported test suite (18/18) passes; full suite 112/112. Live-smoke-tested `/historical-imagery/clusters` against the real seeded data - all 5 clusters × 5 years (2022-2026) list correctly.

**Unrelated gap found and fixed while touching `.env.example` for the `OPENROUTER_*` additions:** `backend-py/.env.example` had never actually been committed since Phase 0 - the root `.gitignore`'s blanket `.env.*` rule matches it (`backend/.env.example` survives the same rule only because it was force-added at some point in this repo's history, before this migration started). Every prior commit's `git add backend-py` silently skipped it with no error. Force-added it now and added a `!backend-py/.env.example` negation to `.gitignore` so this can't silently regress again.

---

## `ParcelsModule`

**Real dependency conflict hit here, resolved by scoping down rather than jumping the queue:** `ParcelsController` directly injects and calls `ResponseAggregatorService` (InteroperabilityModule), `WorkflowsService` (WorkflowsModule), `PredictiveAnalyticsService` (PredictiveAnalyticsModule), and `AuditService` (AuditModule) - none of which exist in backend-py yet, and `WorkflowsModule` especially is explicitly scheduled *last* in plan §4, alongside AuthModule, as part of the security-sensitive core. Building all four now just to unblock one module would mean jumping far ahead of the plan's own sequencing. Instead: ported everything `ParcelsService` can do standing on its own (search, get-by-id, geometry, neighbours, context, documents, ownership-history, historical states, identify-from-document/OCR), and stubbed the four cross-module endpoints (`/360`, `/workflows`, `/risk-score`, `/audit`) with `501 Not Implemented`, each naming exactly which module it's waiting on. They'll be wired for real once those modules land - this isn't a shortcut, it's following the real dependency graph honestly instead of pretending modules exist.

Also ported `document-verification/ocr.ts` + `field-matcher.ts` (the plan's §3 table scheduled these "with ParcelsModule (built first of its two consumers)") to `app/document_verification/ocr.py` + `field_matcher.py`. `tesseract.js` → `pytesseract` + the `tesseract-ocr` system binary (another Phase-0-style apt-get dependency, added to the Dockerfile).

**Real PostGIS upgrade:** `get_neighbours`'s live fallback path (no precomputed `ParcelNeighbour` row) now always uses `ST_Distance`/`ST_DWithin` (geography cast) - the TS version's `isPostgisAvailable()` branch has no SQLite counterpart to keep. Went further than the TS version even for the *explicit-neighbour-row* branch: TS always computed the displayed distance via the JS planar approximation (`polygonDistanceMeters`) even when PostGIS was available; backend-py uses real `ST_Distance` there too, in one batched query for every neighbour instead of N round trips.

**Bug found and fixed during verification:** `cast(selected.geometry, Geography)` - binding an already-fetched Python `WKBElement` as a literal into a `Geography` cast - mis-routed through `ST_GeogFromText` with raw WKB hex instead of WKT text (`"01" <-- parse error`), intermittently (only one of several structurally-identical queries actually hit it, suggesting a SQLAlchemy compiled-statement-cache interaction, not a deterministic per-call failure). Fixed by replacing the literal with a correlated scalar subquery on `Parcel.geometry` itself (`select(Parcel.geometry).where(Parcel.id == selected.id).scalar_subquery()`), so both sides of every distance comparison are genuine SQL expressions off the mapped column, never a Python-side value needing ad hoc binding.

Also found: `CitizenParcel` has no `relationship()` to `Parcel` (plain `citizen_id`/`parcel_id` FK columns only, by earlier design) - `find_mine` referenced a nonexistent `.parcel` attribute; fixed to look up parcels by id explicitly.

**New schema pattern:** `ParcelWithIdentifiersOut` (in `app/schemas/parcels_extra.py`) extends `ParcelOut` with an `identifiers` list, used only by `search`/`mine` (which eager-load identifiers, matching the TS service's `leftJoinAndSelect`/`relations: [...]`) - kept separate from the shared `ParcelOut` deliberately, since adding `identifiers` there would have silently changed GisModule's already-shipped response shape too (SQLAlchemy's lazy-load would populate it even for callers that never asked for it).

**Verified:** ported test suite (49/49, the `/360` block deliberately not ported since that endpoint is a 501 stub) passes; full suite 161/161. Live-smoke-tested search/neighbours against the real 220-parcel seeded database (with real `ParcelNeighbour` rows) and confirmed the `/360` stub returns 501.

---

## `AuditModule`

Ported `audit-log.entity.ts` + `audit.service.ts` + `audit.controller.ts` to `app/models/audit.py` + `app/services/audit_service.py` + `app/routers/audit.py`. `metadata` is stored as `metadata_json` on the model (`metadata` is reserved on SQLAlchemy's declarative `Base`) and mapped back to a `metadata` field in `AuditLogOut` via an explicit `Field(validation_alias="metadata_json")` plus a `field_validator` that JSON-parses it — same pattern as `ParcelOut.geometry`'s string round-trip, applied here to get the field name back rather than the type. `GET /audit` stays admin-only (`require_roles("ADMIN")`), with `entityType`/`userId` query params aliased explicitly (`Query(alias="entityType")`) since FastAPI query params, like `Form()` params (see `ChangeDetectionModule` above), match the Python parameter name by default, not a camelCase alias.

**This is also the module `ParcelsModule` was stubbing around:** `ParcelsModule`'s `GET /parcels/:id/audit` 501 stub is now a real call to `audit_service.find_by_parcel`, exactly as planned when that stub was written — the one AuditService-dependent endpoint ParcelsController has, now wired for real.

**Test coverage note:** the original `audit.e2e-spec.ts` triggers most of its audit entries by calling live `/auth/login`, `/workflows`, and `/governance-alerts/:id/status` — none of which exist in backend-py yet (AuthModule and WorkflowsModule are both deferred to last per §4; GovernanceModule hasn't been built either). Rather than skip audit coverage until those land, `tests/routers/test_audit.py` ports the parts of the spec that are actually AuditModule's own responsibility (RBAC on `GET /audit`, `entityType` filtering, pagination default/cap, `GET /parcels/:id/audit` RBAC + 404) with fixture rows seeded directly via `audit_service.log()` instead of produced as a side effect of those unbuilt endpoints. The login/workflow/governance-alert-triggered assertions (exact `action`/`metadata` shape per trigger) are left for those modules' own test suites once they exist — flagged here rather than silently dropped.

**Verified:** new test suite (10/10) passes; full suite 171/171. Live-smoke-tested via a real committed session: `AuditLog` row round-trips through `GET /api/v1/audit` with `metadata` coming back as a parsed object (not a string) and full camelCase field names; unauthenticated request correctly gets 401.

---

## `PredictiveAnalyticsModule`

Ported `predictive-analytics.service.ts` + `predictive-analytics.controller.ts` to `app/services/predictive_analytics_service.py` + `app/routers/predictive_analytics.py`. No new entities needed — it's pure computation over four already-ported tables (`Parcel`, `TaxRecord`, `DisputeRecord`, `RestrictionRecord`, `GovernanceAlert`), so this was a clean, self-contained port: the hand-weighted risk-scoring heuristic (tax 0.4 / dispute 0.3 / alerts 0.2 / restriction 0.1, missing records excluded from the weighted average rather than scored 0) translated over to plain Python dataclasses + functions with no structural changes.

**This is also one of the two modules `ParcelsModule` was stubbing around:** `GET /parcels/:id/risk-score` (previously a 501 stub) now calls `predictive_analytics_service.get_risk_score` for real and returns its own 404 when the service returns `None` — matching the original controller's shape (it never called `ParcelsService.findOne` separately; the risk-score lookup's own not-found *is* the parcel not-found). `GET /predictive-analytics/top-risk-parcels` stays admin-only.

**Test coverage:** `backend/test/predictive-analytics.e2e-spec.ts` has no cross-module dependencies at all, so `tests/routers/test_predictive_analytics.py` is a complete, unscoped port — every assertion, including the exact expected scores worked out in the original spec's comments (parcel A → 67/HIGH, B → 54/HIGH, C → 46/MEDIUM, D → 0/LOW) reproduced exactly on the first run, confirming the weighting/rounding logic carried over faithfully.

**Verified:** new test suite (9/9) passes; full suite 180/180. Live-smoke-tested both endpoints against the real seeded database — `top-risk-parcels` ranks real parcels by score, single-parcel `risk-score` returns real factor breakdowns with correct rationale strings, unauthenticated `top-risk-parcels` returns 401, unknown-parcel `risk-score` returns 404.

---

## `LandRecordsModule`

Ported `state-a-land-records.{service,controller}.ts` + `state-b-land-records.{service,controller}.ts` to `app/services/land_records_service.py` + `app/routers/land_records.py` (two independent `APIRouter`s, `state_a_router`/`state_b_router`, both mounted in `main.py`). Both entities were already ported in Phase 0's initial migration, so this was service+router only, no schema changes. Built as the first step toward `InteroperabilityModule` (its `land-record-adapters.ts` reads `StateALandRecord`/`StateBLandRecord`, so those mock department APIs needed to exist and be seedable/queryable first).

**Deliberately unguarded, matching the original:** these two routers simulate external department systems this app doesn't own, not part of the app's own RBAC surface — no `require_roles()` anywhere, same as `StateALandRecordsController`/`StateBLandRecordsController` in the TS source.

**Deliberately no pagination ceiling, matching the original:** unlike `AuditModule`/`PredictiveAnalyticsModule` (which call `resolve_pagination` for a default/max cap per `KNOWN_RISKS.md` HIGH-6), neither original TS service called `resolvePagination` either — `if (filters.limit) options.take = ...` with no default. Ported as-is rather than silently tightening it, since these aren't the app's own oversight views HIGH-6 was scoped to.

**Verified:** ported test suite (10/10, a complete unscoped port of `land-records.e2e-spec.ts` — no cross-module dependencies) passes; full suite 190/190. Live-smoke-tested create/list-filtered/delete against the real database for both state schemas, confirmed real commits persist.

---

## `DepartmentsModule`

Ported all seven mock department APIs to `app/services/departments_service.py` (six identically-shaped `find_*_by_parcel` lookups over already-ported entities) + `app/services/land_records_lookup_service.py` (the one non-trivial service — resolves a parcel to its State A/B land record via its `SURVEY_NUMBER`/`PLOT_NUMBER` identifier, MH→State A / DL→State B / everything else → no match) + `app/routers/departments.py` (all seven routes, single router). Also ported `common/identifier-utils.ts` → `app/common/identifier_utils.py` (`find_identifier_value`), shared by the lookup service and (next) `InteroperabilityModule`'s identifier resolver.

**Schema shape note:** `LandRecordsLookupOut.data` is a `StateALandRecordOut | StateBLandRecordOut` union (Pydantic's "smart" union picks the right one — the two schemas share no field names besides `record_id`, so there's no ambiguity), and the `schema` JSON key (a Python keyword-adjacent name) is handled with `Field(alias="schema")` on a `schema_` attribute, matching the TS response's literal `{ source, schema, identifierUsed, data }` shape exactly.

**Deliberately unguarded, matching the original:** all seven routes simulate external department systems, same as `LandRecordsModule` above — no `require_roles()`.

**Verified:** ported test suite (18/18, a complete unscoped port of `departments.e2e-spec.ts` — no cross-module dependencies) passes; full suite 208/208. Live-smoke-tested `/tax`, `/registration`, and `/land-records` against the real seeded database — confirmed a real MH parcel's `SURVEY_NUMBER` identifier correctly resolves to its matching `StateALandRecord` row.

---

## `InteroperabilityModule`

Ported `canonical-transformer.ts` → `app/common/canonical_transformer.py`, `land-record-adapters.ts` → `app/common/land_record_adapters.py`, `identifier-resolver.service.ts` → `app/services/identifier_resolver_service.py`, and `response-aggregator.service.ts` → `app/services/response_aggregator_service.py`. This is the module `ParcelsModule`'s `/360` stub was waiting on — now wired for real in `app/routers/parcels.py`, the last of ParcelsModule's four original 501 stubs to fall (only `/workflows` remains, and stays 501 until `WorkflowsModule` is eventually built).

**The one genuinely mixed-contract response in this codebase:** `Parcel360Response`'s canonical envelope fields (`parcel_id`, `identifiers`, `location`, `spatial`, `sources`) are a deliberately fixed **snake_case** external contract (Tech.md #15, verbatim), while `clusterId` and `departments` were added on top of that envelope by the TS interface and follow the API's normal **camelCase** convention. Rather than force this through one `CamelModel`, `app/schemas/interoperability.py`'s `parcel_360_to_json` builds the final dict by hand — the envelope passed through untouched, `departments.*` run through the existing per-department `*Out` schemas (`.model_dump(mode="json", by_alias=True)`) for camelCase. Confirmed correct by both the ported unit tests and a live smoke test against real seeded data.

**`GET /parcels/:id/360`'s owner-only field masking, ported to `app/routers/parcels.py`:** needed a new `get_current_user_optional` dependency in `app/auth/deps.py` (mirrors `OptionalJwtAuthGuard` — returns `None` instead of raising 401 for a missing/invalid token, so the route stays public but still knows who's asking). Planning/Tax/Restriction/Dispute/Encumbrance are nulled out and `restrictedForViewer: true` is set unless the caller is staff or the citizen actually linked to this parcel (reusing `parcels_service.is_citizen_associated_with_parcel`, already built for the ownership-history endpoint) — Land Records/Registration/the canonical envelope stay visible to everyone, same as the original.

**Verified:** ported test suite (13/13 — land-record adapters, `IdentifierResolverService`'s both directions, `ResponseAggregatorService.build_parcel_360` exercised directly plus the full `/360` HTTP path for anonymous/staff/unknown-parcel) passes; full suite 221/221. Live-smoke-tested `/360` against the real seeded database — confirmed real PostGIS geometry serializes correctly inside `spatial.geometry`, department masking behaves correctly for an anonymous caller, and 404 on an unknown parcel.

---

## `NotificationFeedModule`

New entity (`app/models/notification.py`, migration `044323afddea`) plus a straightforward port of `notification-feed.service.ts` + `.controller.ts` to `app/services/notification_feed_service.py` + `app/routers/notification_feed.py`. Deliberately a pure leaf with no role gate beyond "signed in" (`get_current_user`, not `require_roles`) — citizen and staff both have their own feed, mirroring `GET /auth/me`'s bare-JwtAuthGuard shape. Built now specifically to unblock `GovernanceModule`, which calls `notify_users`.

**Verified:** ported test suite (7/7, complete unscoped port of `notification-feed.e2e-spec.ts`) passes; full suite 228/228 at that point.

## `GovernanceModule`

Ported `governance-alerts.service.ts` + `.controller.ts` to `app/services/governance_alerts_service.py` + `app/routers/governance.py` (model already existed from Phase 0). The 4-stage verification state machine (`OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED`, with `DISMISSED` reachable from any non-terminal stage) ported as a plain `VALID_TRANSITIONS` dict + an `InvalidTransitionError` the router turns into the exact original 400 message (`"Cannot move a "X" alert directly to "Y" - the next stage(s) from here are: ..."`). `CLOSED_ALERT_STATUSES` is exported for `AnalyticsModule`'s future "Open Alerts" total, matching the original's own re-use. On final closure (`RESOLVED`/`DISMISSED` only, not the intermediate stages), notifies the owning department's officers via `NotificationFeedModule` and logs a `GOVERNANCE_ALERT_STATUS_CHANGED` entry via `AuditModule` — both already-built modules doing exactly the job they were built for.

**Verified:** ported test suite (19/19, complete unscoped port of `governance-alerts.e2e-spec.ts` — the original's SQLite-second-resolution sleep-1.1s-between-inserts workaround was dropped in favor of explicit `created_at` timestamps, since Postgres has microsecond resolution) passes; full suite 247/247. Live-smoke-tested the full 4-stage transition against a real alert row: `ACKNOWLEDGED` → rejected skip straight to `RESOLVED` (exact reachable-stages message confirmed) → `FIELD_VERIFIED` → `RESOLVED`, confirmed a real `Notification` row landed for the correct department officer and a real `AuditLog` row was written.

---

## `AiModule`

Ported `groq.service.ts` + `gemini.service.ts` + `ai.service.ts` + `ai.controller.ts` + both Zod response schemas to `app/services/groq_service.py` + `app/services/gemini_service.py` + `app/services/ai_service.py` + `app/routers/ai.py` + `app/schemas/ai.py`. New dependency: `google-generativeai` (Gemini's official SDK), added to `requirements.txt` and rebuilt into the image.

**Mockable-by-function, not by-SDK:** `groq_service.complete_json` is a plain module-level function (matching `narrative_service`'s established convention in this codebase), so `tests/routers/test_ai.py` monkeypatches it directly instead of reproducing the original spec's `jest.mock('openai')` SDK-level mock — simpler, and consistent with how `HistoricalImageryModule`'s tests already substitute the AI call.

**Fallback chain ported faithfully:** Groq (primary, `openai` SDK pointed at Groq's base URL) → Gemini (fallback, on a 429 or any other Groq failure) → a real 503 naming both env vars when neither is configured. Verified live: with no `GROQ_API_KEY`/`GEMINI_API_KEY` set, `POST /ai/query` returns the real "AI service is not available (...)" 503 end-to-end, not a mock.

**Shared masking logic extracted, not duplicated:** `GET /parcels/:id/360`'s owner-only department masking (`ParcelsModule`, built during `InteroperabilityModule`) and `POST /ai/parcels/:id/explain`'s identical rule ("Explain with AI must never leak what the 360 view itself hides") were pulled into one `app/services/parcel_access.py` (`can_view_restricted_departments` + `mask_restricted_departments`), and `app/routers/parcels.py`'s `/360` handler was refactored to use it too — not a new module, just deduplicating logic that was about to be written twice from the same source rule.

**Response-shape split, same pattern as the canonical envelope:** `POST /ai/query`'s outer response (`intent`/`reply`/`totalMatches`/`results`) is normal camelCase, but `filters`' own keys (`tax_status`, `land_use`, ...) are deliberately the AI's own vocabulary, passed through verbatim — a plain `dict[str, Any]` field inside an otherwise-`CamelModel` response, with `response_model_exclude_none=True` so a HELP-shaped answer omits `filters`/`totalMatches`/`results` entirely rather than sending them as `null`. The two `/explain` endpoints return the AI's own schema vocabulary as-is (`summary`/`risk_level`/`findings`/`recommended_action`, snake_case) via a plain `BaseModel` with no alias generator at all — matching the original TS response exactly, which returns the validated Zod object with no transformation.

**Gap closed:** the original's tighter per-route rate limit (30/min vs the app default 200/min, via `@Throttle`) is now ported — see "Real rate limiting (`slowapi`)" below.

**Verified:** ported test suite (20/20, complete port of `ai.e2e-spec.ts`'s DB-backed assertions) passes; full suite 267/267. Live-smoke-tested the real unconfigured-provider path (`POST /ai/query` → genuine 503 naming both missing env vars, not mocked), empty-query 400, unknown-parcel 404 (confirmed no AI call attempted), and unauthenticated alert-explain 401.

---

## `AdminModule`

Ported `departments-admin.service.ts` + `.controller.ts` to `app/services/departments_admin_service.py` + `app/routers/admin.py` (model already existed from Phase 0). A small admin-editable department directory (name/description/contact info) — distinct from the six mock department domain modules (`DepartmentsModule`) and unrelated to them at the database level, exactly as the original entity's docstring calls out. Every mutation (`create`/`update`/`remove`) logs an audit entry via `AuditModule`. New dependency: `email-validator` (backs Pydantic's `EmailStr`, used for `contactEmail` validation), added to `requirements.txt` and rebuilt into the image.

This closes out the plan's entire "peripheral, non-spatial" group from §4.

**Verified:** ported test suite (12/12, complete unscoped port of `admin-departments.e2e-spec.ts`) passes; full suite 279/279. Live-smoke-tested create/list/delete against the real seeded department directory (7 real departments from `scripts/seed.py`) with a real admin JWT; unauthenticated request correctly 401s.

---

## `UsersModule`

Ported `users.service.ts` + `users.controller.ts` to `app/services/users_service.py` + `app/routers/users.py` (model already existed from Phase 0). Admin-only CRUD over staff accounts (`find_all` filters to `ALL_STAFF_ROLES` so citizen sign-in accounts never leak into the Admin Portal's user list), every mutation audit-logged, and an admin blocked from changing their own role or deleting their own account (self-lockout prevention, checked before the service call).

**Bug found and fixed during verification:** `requirements.txt` had pinned `passlib[bcrypt]==1.7.4` since Phase 0 (added preemptively, before any code actually called it) — the first real password-hashing call in this module crashed at import time inside passlib's own bcrypt-backend self-test (`ValueError: password cannot be longer than 72 bytes`), a known compatibility break between passlib 1.7.4 and `bcrypt>=4.1` (passlib was never updated for a signature change in the underlying library). Fixed by dropping passlib entirely and calling the `bcrypt` package directly (`app/auth/passwords.py`'s `hash_password`/`verify_password`) — simpler than working around passlib's abstraction layer for a single scheme anyway, and this project's use is the plain "hash this password" case passlib's own extra flexibility was never buying anything for.

**Verified:** ported test suite (16/16, complete unscoped port of `users.e2e-spec.ts`) passes; full suite 295/295. Live-smoke-tested list/create/delete against the real seeded staff directory with a real admin JWT — confirmed no `passwordHash` field ever appears in a response, and the created account's stored hash round-trips as a real bcrypt hash, not the plaintext password.

---

## `WorkflowsModule`

Ported `workflow.entity.ts` + `workflow-step.entity.ts` (new `app/models/workflow.py`), `request-routing.service.ts` (`app/services/request_routing_service.py` — AI-based department routing with the deterministic `pipeline_for()` fallback, same swallow-to-fallback discipline as `narrative_service`), `workflows.service.ts` (`app/services/workflows_service.py` — the citizen service-request pipeline: creation with evidence upload + OCR pre-check, officer review/approve/reject with department RBAC, admin escalate/reopen oversight actions, LAND_CLAIM_REQUEST/DISPUTE_FILING/DOCUMENT_VERIFICATION_REQUEST special-casing), and `workflows.controller.ts` (`app/routers/workflows.py`, including the dual JSON/multipart request-body handling `create()` needs). This also wires the last remaining `ParcelsModule` stub, `GET /parcels/:id/workflows`, for real — every one of ParcelsModule's original four 501 stubs is now live.

**Three real bugs found and fixed, all confirmed live against the running container (not just caught by tests):**

1. **Evidence file uploads were silently dropped.** `request.form()` returns Starlette's own `UploadFile`, not `fastapi.UploadFile` (a subclass never actually instantiated by that code path) — the router's `isinstance(value, UploadFile)` check against the FastAPI class was always `False`, so a citizen's uploaded document was never recognized, `evidenceFileName` stayed `null`, and no OCR pre-check ever ran. Fixed by checking against `starlette.datastructures.UploadFile` instead. Verified live with a real multipart upload: `evidenceFileName`/`evidenceFilePath`/`evidenceMimeType` populate correctly and real OCR text comes back in `evidenceExtractedText`.
2. **`GET /workflows?stepStatus=PENDING` silently ignored the filter.** The route parameter was named `step_status` with no alias, so FastAPI bound it to a query key literally named `step_status`, not the camelCase `stepStatus` the frontend/tests send — same class of bug as `ChangeDetectionModule`'s `Form()` fields and `AuditModule`'s query params earlier in this migration. Fixed with `Query(alias="stepStatus")`. Verified live: an already-approved step's workflow now correctly drops out of the pending-filtered list.
3. **Test-only:** two workflows created back-to-back within one test's shared transaction got an identical `created_at`, because Postgres's `now()` is fixed per-transaction, not per-statement — the SAVEPOINT-based test fixture never commits the outer transaction. Fixed in the test by explicitly bumping the second row's timestamp rather than sleeping.

**Verified:** ported test suite (71/71, complete unscoped port of `workflows.e2e-spec.ts` — the largest single spec ported so far) passes; full suite 366/366. Live-smoke-tested workflow creation, the department/stepStatus dashboard filter, a real multipart evidence upload with OCR, and evidence-file retrieval, all against the running container.

---

## `AnalyticsModule`

Ported `analytics.service.ts` + `.controller.ts` to `app/services/analytics_service.py` + `app/routers/analytics.py` — the module that had been deliberately blocked since it queries `Workflow`/`WorkflowStep` directly, which now exist. Real SQL-level `GROUP BY` aggregation (`_group_count` helper) across every department/workflow/alert table, plus the officer-monitoring view that joins pending `WorkflowStep` counts (grouped by role) with per-officer `AuditLog` decision history (JSON-parsed `metadata_json`, correlated against `Workflow.created_at` in Python — same small-dataset convention used elsewhere in this codebase, since the metadata is a text column, not portably query-able).

**Bug found and fixed before it ever hit a test:** Pydantic's `to_camel()` title-cases `"24h"` into `"24H"` (a digit counts as a word boundary for `str.title()`), so the auto-generated alias for `recent_logins_24h` came out as `recentLogins24H` instead of the original TS field's literal `recentLogins24h`. Caught by comparing against the real JSON contract, not by a passing-but-wrong test; fixed with an explicit `Field(alias="recentLogins24h")`.

**Test coverage note:** the original `analytics.e2e-spec.ts` has one test — "increments recentLogins24h after a real POST /auth/login" — that depends on `/auth/login`, which doesn't exist yet (`AuthModule` is still the one deferred module). Ported instead as a direct `AuditLog` seed with `action=AUTH_LOGIN`, exercising the same `recent_logins_24h` counting logic without the unbuilt endpoint; also added a same-shaped test confirming a 25-hour-old login is correctly excluded. `AuthModule`'s own future test suite will cover the real login-triggered path.

**Verified:** ported test suite (15/15) passes; full suite 381/381. Live-smoke-tested both endpoints against the real 220-parcel seeded database — confirmed real distributions (tax status, registration status, land use, dispute case status) and officer-monitoring entries, and that `recentLogins24h` really does serialize as written (not `24H`).

---

## `NotificationsModule`

Ported `sms.service.ts` + `email.service.ts` to `app/services/sms_service.py` + `app/services/email_service.py` — the SMS/email OTP-delivery infra `AuthModule` needed, previously deferred alongside it. Both are module-level functions (matching `groq_service`/`gemini_service`'s established convention), each with the original's "unset config → 503 at call time, not at boot" degrade-gracefully behavior. `sms_service` calls the real TextBee HTTP API via `httpx` (already a dependency); `email_service` uses Python's stdlib `smtplib`/`email.mime` against any SMTP relay (Zoho by default) — no new dependency needed, unlike the original's `nodemailer`.

---

## `AuthModule`

The last module in the plan (login/register/OTP/sessions, deliberately saved for very last per §4 as the most-scrutinized module: `KNOWN_RISKS.md`'s closed HIGH/MED findings all live in this code). Ported `pending-registration.entity.ts` (new `app/models/pending_registration.py`), `auth.service.ts` (`app/services/auth_service.py` — login/logout, citizen self-registration via a two-step pending-registration + OTP flow that creates no `User` row until the code is verified, email/mobile OTP verify+resend for both first-time add and later change-of-contact, profile updates), and `auth.controller.ts` (`app/routers/auth.py`).

**Bcrypt hashes are portable across the port, verified live:** logged in against the real seeded admin account (`scripts/seed.py`'s `DEMO_PASSWORD_HASH`, originally computed via `bcrypt.js`) with the real demo password and got a real token back — confirms `UsersModule`'s earlier bcrypt-library switch produces hashes the existing seeded data (and, by the same logic, any pre-cutover NestJS-created account) verifies against correctly.

**Session revocation confirmed live, not just by test:** `POST /auth/logout` bumped the real admin's `token_version`; the same token that had just worked against `GET /auth/me` 401'd immediately after. (Reset back to 0 afterward so this session's own smoke-testing token stays valid for any later use.)

**Graceful degradation confirmed live:** `POST /auth/register` with no `MAIL_HOST` configured still returns 201 with a real `registrationId` (the OTP-send failure is swallowed, matching the original's explicit "the citizen lands on the OTP step and can Resend once delivery is actually working" design) — and the follow-up `verify-otp` call correctly 400s, since no real code was ever sent to check against.

**Gap closed:** the original's tighter per-route rate limit on `POST /login` (20/min vs the app default 200/min, `KNOWN_RISKS.md` HIGH-1) is now ported — see "Real rate limiting (`slowapi`)" below.

**Verified:** ported test suite (50/50, covering login/`me`/logout/register/verify-registration-otp/resend-registration-otp/verify-otp/resend-otp/profile-contact/profile-details) passes; full suite 431/431. `sms_service.send_otp`/`verify_otp` and `email_service.send_otp_email` are monkeypatched directly in tests (matching `AiModule`'s substitution for `groq_service`), rather than reproducing the original spec's Nest `overrideProvider` mocks.

**This closes out every module in PYTHON_MIGRATION_PLAN.md §4's build order.**

---

## §5 — CI

Added `.github/workflows/backend-py-ci.yml` — the first CI in this repository (confirmed zero `.github/workflows` existed before this). Triggers on any PR or push to `python-migration`/`main` touching `backend-py/**`. Runs against a real `postgis/postgis:15-3.3` service container (not SQLite — PostGIS-specific behavior is exactly what a rewrite risks getting subtly wrong, same reasoning §5 itself gives): builds `backend-py`'s own Dockerfile fresh (so CI exercises the real GDAL/tesseract/cairo system dependencies, not a lighter stand-in), runs `alembic upgrade head` against a brand-new empty database, then runs the full `pytest` suite. Either step failing fails the job.

**Verified locally before trusting it in CI**, since a workflow file can't be dry-run any other way: built a genuinely fresh image from current source, stood up a throwaway `postgis/postgis` container with an empty database (mirroring a first-time CI run, not reusing this session's already-migrated dev database), and ran the exact same `docker build` → `alembic upgrade head` → `pytest` sequence the workflow file runs. All 6 migrations applied cleanly from empty, and all 431 tests passed. Cleaned up the throwaway container/image afterward; the real dev `docker compose` environment was untouched throughout.

**Deliberately scoped to `backend-py/` only** — the original NestJS `backend/` has no test suite of its own to run (confirmed at the start of this migration), and `frontend/` CI is out of scope for this plan.

---

## Real rate limiting (`slowapi`)

`slowapi` had been in `requirements.txt` since Phase 0 but was unused. Wired up in `app/rate_limit.py`: `Limiter(key_func=get_remote_address, default_limits=["200/minute"])` (matching `app.module.ts`'s old app-wide default), plus `SlowAPIMiddleware` and an explicit `RateLimitExceeded` exception handler in `main.py`. `AiModule`'s 3 endpoints get `30/minute` and `AuthModule`'s `POST /login` gets `20/minute`, matching the TS originals' per-route limits exactly.

Two things needed handling that the original Jest-per-file-fresh-app model never had to:
- **`RateLimitExceeded` bypassed the app's own error shape** — `SlowAPIMiddleware` looks up `app.exception_handlers` by *exact type*, not MRO, so the handler already registered for `StarletteHTTPException` (its real superclass) was silently never used for it. Fixed with `app.add_exception_handler(RateLimitExceeded, app.exception_handlers[StarletteHTTPException])`.
- **The pytest suite shares one `FastAPI` app instance across all 430+ tests** (imported once in `tests/conftest.py`), unlike the original where every Jest spec file builds a fresh app with fresh throttler storage — a real limiter would accumulate hits across unrelated tests. Fixed by auto-disabling the limiter whenever `PYTEST_CURRENT_TEST` is in the environment (which pytest sets automatically) or `RATE_LIMIT_ENABLED=false` is set explicitly.

New `tests/routers/test_rate_limiting.py` exercises the actual throttling mechanism in isolation (a standalone `3/minute` app, 4 requests → 200,200,200,429). Full suite verified at 432/432 (431 existing + 1 new) after wiring in the real limiter.

---

## §4's second validation gate — live-Jest-spec harness (complete: all 22 specs converted)

Converted every one of the 22 Jest e2e specs with true HTTP behavior to the live-harness pattern (`land-records`/`predictive-analytics` first, to prove the pattern; then the remaining 20 in batches). **1 spec intentionally not converted**: `supabase-storage.e2e-spec.ts` tests a pure local-disk-fallback function directly, not any HTTP endpoint — there's no live-server behavior to additionally prove beyond what the existing pytest port (`tests/common/test_supabase_storage.py`) already covers, so forcing a "live" version of it would test nothing new.

**New files under `backend/test/live/`** (kept alongside, not replacing, the existing in-process `*.e2e-spec.ts` files):
- `live-client.ts` — `LIVE_BASE_URL` (defaults `http://localhost:8000`), a `pg.Pool` (`pgPool`) connected directly to backend-py's own `bhoomisetu_py` database for fixture setup a spec can't reach through the HTTP API alone, and `cleanupLiveFixtures()` — a single shared, FK-safe `DELETE` cascade across every table a spec might have written to, keyed off a `LIVE-`/`live-` fixture-naming convention every spec follows, so no spec needs bespoke teardown logic. Needed a new `@types/pg` devDependency (plain `pg` ships no bundled types, and `tsconfig.json` has `strict: true`).
- `live-auth.ts` — `createLiveAuthenticatedUser(role)` inserts a real, verified staff user directly via SQL, then logs in through the **real, live `POST /auth/login`** rather than fabricating a JWT independently — this is what actually proves backend-py's own bcrypt-verification + JWT-issuance path works, and doubles as a live cross-language bcrypt check (`bcryptjs` hashes here, Python's `bcrypt` verifies there).
- One `*.live-spec.ts` per converted original: `land-records`, `predictive-analytics`, `health`, `error-handling`, `rate-limiting`, `notification-feed`, `users`, `admin-departments`, `departments`, `audit`, `governance-alerts`, `analytics`, `auth`, `ai`, `interoperability`, `gis`, `parcels`, `parcels-identify`, `spatial`, `change-detection`, `historical-imagery`, `workflows`.
- New npm script: `npm run test:e2e-live` (`--runInBand --testRegex "test/live/.*\.live-spec\.ts$"`) — serialized deliberately (see the rate-limit discovery below), scoped so it never collides with the existing `npm test`.

**Deliberate, disclosed scope reductions** where a live server has no equivalent of the original's test seam:
- `auth.live-spec.ts` — the original mocks `SmsService`/`EmailService` via Nest's `overrideProvider` to drive the registration/OTP flows with a known code. A running server has no such override, and its real OTP codes are never delivered anywhere this harness can read — so registration/OTP/resend describe blocks aren't ported; login, `/auth/me`, and logout are, in full.
- `ai.live-spec.ts` — the original mocks the `openai` SDK to script the model's JSON reply. A running server's Groq/Gemini call is real and unscriptable — only the pre-AI-call paths (400 validation, 404 not-found, 401 auth) are ported.
- `interoperability.live-spec.ts` — the original spends most of its assertions calling `IdentifierResolverService`/`ResponseAggregatorService`/adapter functions directly as injected providers, which has no live-HTTP equivalent; only the one true end-to-end assertion (`GET /parcels/:id/360`) is ported, since it already exercises all of that indirectly.
- `historical-imagery.live-spec.ts` — the original scripts exact AI-narrative text via `overrideProvider(NarrativeService)`. A live server either calls a real configured OpenRouter model (unpredictable wording) or, with no key set, falls back to the raw underlying-facts sentence (`historical_comparison_service.py` swallows the exception) — both are valid "real" outcomes this harness can't distinguish in advance, so narrative text is asserted only as "a non-empty string"; every category/alert/severity/guard assertion is otherwise verbatim.
- `parcels-identify.live-spec.ts` / `workflows.live-spec.ts` (its evidence-upload/OCR-precheck describe blocks only) — the originals render real land-document images via the TS backend's own `renderParcelDocumentImage` and assert on backend-py's OCR text-extraction actually matching a real parcel. Faithfully reproducing that would mean reverse-engineering backend-py's own OCR conventions well enough for Tesseract to agree, which proves nothing beyond "this harness can render text Tesseract likes" — so those OCR-dependent assertions aren't ported; every other workflow-lifecycle assertion (create/list/filter/approve/reject/escalate/reopen, `LAND_CLAIM_REQUEST`'s association exemption and re-check-at-review-time conflict handling, notifications) is ported in full.

**Real discoveries from running against a real server + real, persistent data, not a fresh throwaway app-per-file:**
- **`POST /auth/login` and `POST /auth/logout` return `200`, not `201`** — the TS originals defaulted to Nest's implicit 201-for-POST; the Python routes never set an explicit `status_code`, so FastAPI's own default (200) applies. Not a bug, a real and correctly-ported behavioral difference — `live-auth.ts` already asserted `200` from the start, it was only the newly-written `auth.live-spec.ts` that had to be corrected to match.
- **The Docker-container filesystem boundary**: a document/image file written by Jest (running on the host) to the host's own temp directory is invisible to backend-py, which runs in its own container. Fixed by writing such files under the bind-mounted `backend-py/` directory instead (`docker-compose.yml` mounts it at `/app`) and storing the container-side `/app/...` path in the DB row — visible from both sides. Affects `parcels.live-spec.ts` (document serving) and `historical-imagery.live-spec.ts` (snapshot images).
- **`predictive-analytics.e2e-spec.ts`'s `top-risk-parcels` ranking** assumed a fresh, empty database — against backend-py's real, ~220-parcel seeded database, a low-scoring fixture parcel can legitimately fall outside the endpoint's own top-100 cap. Adapted to check relative order among whichever fixtures *do* appear, rather than fixed identities/positions (documented in the spec file itself).
- **`analytics.live-spec.ts`'s summary/distribution totals** — same root cause, adapted to lower-bound/delta assertions rather than exact counts.
- **Cross-file real-rate-limit accumulation**: with real rate limiting wired in (previous section), Jest's default *parallel* worker execution ran enough concurrent `POST /login` calls (via `createLiveAuthenticatedUser`, once per spec file) to trip the real 20/min limit, producing spurious 401s. Fixed by adding `--runInBand` to `npm run test:e2e-live` (now the default); a full from-scratch run additionally used a temporary `RATE_LIMIT_ENABLED=false` restart of `backend-py` as extra headroom (`docker-compose.yml` now accepts this as a normal environment variable, defaulting to `true`).
- **`audit_logs.metadata_json`, not `metadata`; `state_a_land_records.record_id`, not `id`** — column-name mismatches only surfaced by actually inserting against the real schema rather than assuming TypeORM-style naming.

**Verified:** all 22 files (332 tests total) pass together in one `npm run test:e2e-live` run against the real `backend-py` container, `--runInBand`. Required a temporary TCP proxy (`alpine/socat`, `host:5432 → postgis:5432`) since `docker-compose.yml`'s `postgis` service deliberately has no published port by default — stopped afterward; no lasting change to `docker-compose.yml` itself (the new `RATE_LIMIT_ENABLED` passthrough is the only durable change). All fixture rows this run created were deleted afterward via `cleanupLiveFixtures()`.

---

## §4's second validation gate, wired into CI

Added a second job, `live-e2e`, to `.github/workflows/backend-py-ci.yml`, alongside the existing `test` job (independent — no `needs:` between them, so both report as separate, equally-required checks). Same `postgis` service container as `test`; additionally builds the same `backend-py` image, runs Alembic migrations, starts backend-py itself as a detached `docker run` container, waits for `GET /health` to succeed, then runs `npm ci` + `npm run test:e2e-live` in `backend/` against it. `live-e2e`'s `RATE_LIMIT_ENABLED: "false"` mirrors the same headroom a local full run needs (see the live-spec section above) — a slower CI runner doesn't change the real 20/min-limit math. Workflow trigger paths widened to include `backend/test/live/**` and `backend/package*.json`, so a live-spec-only change still runs CI.

**A second real discovery, this time about the CI job itself rather than backend-py:** the "write on the Jest host, read from inside the container" fix documented above for `parcels.live-spec.ts`/`historical-imagery.live-spec.ts` only worked against the *local dev* `backend-py` container because `docker-compose.yml` bind-mounts `./backend-py:/app`. A CI job's `docker run` has no such mount by default — its `/app` is whatever `COPY . .` baked into the image at build time, completely disconnected from the runner's checked-out files. Confirmed this exact failure mode (2 specs, 3 tests, 404/500) by building a genuinely fresh, non-bind-mounted image and running the full suite against it before fixing anything. Fixed by adding `-v "${{ github.workspace }}/backend-py:/app"` to the `live-e2e` job's `docker run`, replicating docker-compose's own mount. Re-verified 332/332 against that same fresh image, now correctly mounted — this is what real CI will actually run, not an approximation of it.

---

## Frontend connected to `backend-py`, `backend` removed from the local stack

Done 2026-09-12, per `docs/architecture/FRONTEND_BACKEND_PY_CONNECTION_PLAN.md`'s plan (kept as the record of how, plus the smoke-test checklist for exercising it further). `docker-compose.yml`'s `frontend` now builds with `VITE_API_URL=http://localhost:8000/api/v1` (`backend-py`) and depends on `backend-py`, not `backend`. Verified past the config level, not just assumed: a `--no-cache` rebuild (a plain rebuild came back fully cached and would *not* have picked up the change — a real Docker gotcha, worth remembering) confirmed via `grep` that the built JS bundle actually contains `localhost:8000/api/v1`, and a real cross-origin login call from the frontend's own origin against `backend-py` returned a genuine JWT for the seeded admin account.

The `backend` service has been removed from `docker-compose.yml` entirely, and its `bhoomisetu` database dropped — confirmed first that it held no real data (zero rows worth preserving, zero active connections), so this was a retirement, not a merge; `bhoomisetu_py` was already the complete dataset. `postgis`'s `POSTGRES_DB` is now `bhoomisetu_py` and its init script only creates the PostGIS extension, not the database, for a correctly-behaved fresh-volume setup going forward. `backend/`'s source stays in the repo, out of the deploy path, for the grace period `CUTOVER_AND_OPS_PLAN.md` §6 describes — not deleted outright, per the user's own explicit choice when asked.

Real API keys (Groq/Gemini/OpenRouter/Supabase/TextBee/Mail) are copied into `backend-py`'s `docker-compose.yml` wiring from `backend/.env` (root `.env`, gitignored, never committed). A live Groq call has been sanity-checked end to end; TextBee/Mail OTP delivery has deliberately not been triggered yet, since doing so sends a real message.

---

## Schema ownership finalized against a real hosted database (2026-09-13)

`backend-py`'s dev database was moved from local `docker-compose.yml` Postgres (`bhoomisetu_py`) to a real hosted Supabase Postgres+PostGIS instance, to exercise PostGIS end-to-end against real managed-Postgres conditions (`docs/archive/FEATURE_AUDIT.md` §8 item 14) — see `docs/reference/ENV_CONFIGURATION.md` for exactly which `.env` values changed and how docker-compose's own path is unaffected. That Supabase instance's `public` schema, however, still physically held the *original TypeORM-created tables* (camelCase columns, e.g. `passwordHash`/`mobileNumber`) from before this migration ever started — `alembic_version` didn't exist there, meaning `backend-py`'s own (already-committed, already-correct, snake_case) Alembic migrations had genuinely never been applied to it. `app/database.py` had grown a runtime `align_model_columns_with_database()` workaround that renamed each SQLAlchemy column to its camelCase equivalent, whenever present, to paper over exactly that mismatch at query time.

With no real data on that instance worth preserving (28 users / 220 seeded parcels — demo data, confirmed with the user before proceeding) the fix was to stop working around it and let `backend-py` genuinely own its schema, per `PYTHON_MIGRATION_PLAN.md` §2: backed up the 29 application tables (CSV + schema dump), dropped them (PostGIS system tables — `spatial_ref_sys`/`geometry_columns`/`geography_columns` — left untouched), ran `alembic upgrade head` from empty (all 5 existing migrations applied cleanly, confirming they'd been correct all along), reseeded via `scripts/seed.py`, and deleted `align_model_columns_with_database()` and its one caller (`scripts/seed.py`) entirely. A pre-existing `legacy_backup_20260913` schema in the same Supabase project (from earlier same-day work) still holds the original camelCase tables as a live rollback point, independent of the CSV backup.

**Verified live, not just by migration success:** started `backend-py` for real (`uvicorn app.main:app`), logged in via `POST /auth/login` against a seeded demo account, and read back a real `GET /api/v1/parcels` list (220 rows, correct GeoJSON geometry, joined `parcel_identifiers`) — confirming the running app actually reads/writes the new schema, not only that Alembic could apply it.

## Vite dev-server maplibre-gl worker caching bug, found while running the smoke-test checklist (2026-09-13)

The first real pass at "Up next"'s browser smoke-test checklist (below) surfaced a real, separate bug: every map on the site (Parcel 360's cluster/adjacent/nearby/selected layers, zoning/restriction overlays, all of it) rendered the base OpenStreetMap raster tiles correctly but silently drew zero vector data — no parcel polygons, no highlight outlines — even though every API call underneath returned correct data (confirmed directly with curl and with `queryRenderedFeatures`/`isSourceLoaded` instrumentation in a real Playwright-driven Chromium session, not simulated).

**Root cause:** MapLibre GL JS processes every GeoJSON source through a Web Worker; Vite's dev-server dependency optimizer had pre-bundled `maplibre-gl`'s main module into `node_modules/.vite/deps/` but never successfully produced the separate worker chunk that main module needs to request at runtime (`maplibre-gl-worker.mjs` 504'd) — a stale/incomplete dependency-optimization cache, not a code or config bug. With the worker never available, every source's `setData()` call succeeded at the JS level but the tile/feature processing that actually feeds the renderer never completed, so nothing vector-based ever painted, while the raster basemap (plain image tile requests, no worker involved) rendered normally regardless.

**Fix:** stopped the dev server, deleted `frontend/node_modules/.vite`, and restarted — Vite re-discovered and correctly bundled the worker (as a `blob:` URL this time) on the very next run. No source or config change was needed or made (`vite.config.ts`/`MapComponent.tsx` are byte-identical to before investigating — confirmed via `git diff`). If this resurfaces, the fix is the same: stop the dev server, delete `frontend/node_modules/.vite`, restart.

## Google Earth Engine added to Change Detection, and a Street/Satellite basemap toggle (2026-09-14)

Two independent, unrelated additions that happened to land together - don't conflate them:

**Real satellite imagery for Change Detection.** New `app/services/earth_engine_service.py` wraps the `earthengine-api` Python client: `get_ndvi_visual_png(bounds, date)` fetches the least-cloudy Sentinel-2 composite (`COPERNICUS/S2_SR_HARMONIZED`, filtered by `CLOUDY_PIXEL_PERCENTAGE`) covering a 30-day window ending at `date`, visualized as an NDVI false-color PNG (red=stressed/bare, green=healthy vegetation). New `POST /change-detection/analyze-satellite` (`app/routers/change_detection.py`, staff-only, JSON body: `bounds`/`beforeDate`/`afterDate`/`description`) calls it twice and hands the two PNGs to the *existing* `change_detection_service.analyze()` unchanged - no changes to the detection/spatial-intersection/governance-alert pipeline itself were needed, since it already just takes two arbitrary image byte blobs. The original manual-upload `/analyze` endpoint is untouched and still works independently.

Auth is a Google Cloud service account (`GEE_SERVICE_ACCOUNT_EMAIL`/`GEE_SERVICE_ACCOUNT_KEY_PATH` in `.env`, key file gitignored - see `.gitignore`'s `*service-account*.json`/`backend-py/bhoomisetu-*.json` patterns), granted the **Earth Engine Resource Viewer** role (read-only; this integration never writes Earth Engine assets) on a Cloud project separately registered for Earth Engine access. Same "unset config → 503 at call time, not at boot" degrade-gracefully pattern as `groq_service.py`/`gemini_service.py` - Earth Engine isn't required for the rest of Change Detection to keep working.

**A real credential-hygiene incident during setup, worth recording:** while working through service-account creation, a private key JSON and an OAuth client secret were pasted directly into the chat session - both treated as compromised on the spot (revoke/regenerate advised immediately, not just noted for later) rather than used as-is. Separately, the first downloaded key landed in `backend-py/` under Cloud Console's own default naming (`<project-id>-<key-id>.json`), which didn't match the `.gitignore` pattern written for a manually-chosen name (`*service-account*.json`) - caught before it was ever staged (`git status`/`git check-ignore` showed it as untracked-but-not-ignored), fixed by adding a project-specific pattern (`backend-py/bhoomisetu-*.json`) rather than assuming a suggested filename will always be followed.

**Known limits:** the Earth Engine tier here has an hourly EECU quota (Community tier, no billing account required). `getThumbURL` calls (a small, single-bounding-box thumbnail render) are compute-light and fine for on-demand officer use - what would burn through it is batch-regenerating imagery in a loop (e.g. wiring this into `scripts/seed.py` for every cluster/year) without caching, which is exactly why that idea (the old `ClusterHistoricalSnapshot` PNG cache) was removed rather than upgraded to real imagery (`docs/architecture/FEATURES.md` feature 26). **Update 2026-09-16:** `/analyze-satellite` is now reachable from the app, not just direct API call - `ChangeDetectionPanel.tsx`'s Upload/Satellite toggle, mounted at `/officer/change-detection` - and was live-verified end-to-end against real Earth Engine (`docs/architecture/FEATURES.md` feature 18).

**Street/Satellite basemap toggle (unrelated to Earth Engine).** `MapComponent.tsx`'s `BASE_STYLE` gained a second raster source, Esri World Imagery (`server.arcgisonline.com/.../World_Imagery/...`) - free, no API key, no Google Cloud project, nothing shared with the Earth Engine work above beyond both being "satellite imagery." A `basemap` state toggle (new buttons, top-left of the map, shown wherever the layer legend is) flips which of the two background raster layers is visible; both always exist in the style, so toggling is a layout-visibility change, not adding/removing sources. New i18n keys `map.basemap.street`/`.satellite` in both `en.json`/`hi.json`. Live-verified in a real browser (Playwright): zero Esri tile requests before clicking "Satellite", 15 immediately after, correct imagery rendered under the existing parcel/cluster overlays.

**Pre-existing test gap noticed, not caused by this change:** `MapComponent.test.tsx`'s 12 tests fail on this branch both before and after this edit (confirmed via `git stash`) - a maplibre-gl mock setup issue ("No 'Map' export is defined on the maplibre-gl mock"), unrelated to the basemap toggle. Not fixed here; flagged so it isn't mistaken for a regression this change introduced.

## Up next

- **§6 cutover and §7 staging/ops maturity** — every other section of the plan is now done, including a working local rehearsal of the frontend/backend connection itself. Turning §6/§7 into a real production deployment still needs real infrastructure decisions (hosting target, database hosting, file storage, domain/DNS, maintenance window, secrets/monitoring/backup approach) that only the user can make — see `docs/architecture/CUTOVER_AND_OPS_PLAN.md` for the full decision checklist and the ready-to-execute runbook once those decisions land.
- **Running the full smoke-test checklist** in `FRONTEND_BACKEND_PY_CONNECTION_PLAN.md` §3 by hand in a browser — one real bug already found and fixed this way (above); what's been verified so far still doesn't cover every page/feature, including the registration/OTP and document-OCR paths the live-Jest-spec harness explicitly couldn't reach.
