import { Pool } from 'pg';

// PYTHON_MIGRATION_PLAN.md §4's second validation gate: the original,
// unmodified Jest spec's assertions run as-is against a *running*
// backend-py instance instead of an in-process NestJS app - proving
// backend-py's actual HTTP behavior, not just what the person porting a
// pytest copy of it thought it did.
//
// backend-py must already be up (`docker compose up -d backend-py`) and
// migrated (`alembic upgrade head`) before running a `*.live-spec.ts`
// file - these tests don't start or seed the app themselves the way the
// in-process `*.e2e-spec.ts` files' `Test.createTestingModule` does.
//
// Real rate limiting (app/rate_limit.py) is genuinely enabled on this
// running instance, unlike backend-py's own pytest suite - a handful of
// specs run together is fine, but `npm run test:e2e-live`'s full run
// (already `--runInBand`) can still add up across enough spec files'
// `createLiveAuthenticatedUser` calls (each a real POST /login) to trip
// the real 20/min limit, exactly as discovered running this harness
// against itself. Restart backend-py with `RATE_LIMIT_ENABLED=false` set
// first for a full run if that happens; individual spec files are fine
// against the normal, fully-enabled dev instance.
export const LIVE_BASE_URL = process.env.BACKEND_PY_URL || 'http://localhost:8000';

// backend-py's own database (bhoomisetu_py), used only for direct fixture
// setup a spec can't reach through the HTTP API alone (mirroring what the
// original spec did via `moduleFixture.get(getRepositoryToken(...))`).
// docker-compose.yml's postgis service deliberately has no `ports:`
// mapping by default (see that file's own comment on why) - export
// BACKEND_PY_DB_* to point at wherever it's actually reachable, or add a
// temporary `ports: ["5432:5432"]` back to run these locally.
export const pgPool = new Pool({
  host: process.env.BACKEND_PY_DB_HOST || 'localhost',
  port: Number(process.env.BACKEND_PY_DB_PORT || 5432),
  user: process.env.BACKEND_PY_DB_USER || 'postgres',
  password: process.env.BACKEND_PY_DB_PASSWORD || 'postgres',
  database: process.env.BACKEND_PY_DB_NAME || 'bhoomisetu_py',
});

export async function closeLiveClient(): Promise<void> {
  await pgPool.end();
}

// Every spec's fixtures use a `LIVE-`/`live-` prefix on whatever
// human-readable identifier its table exposes (canonical_parcel_id,
// code, email, ...) specifically so this one shared cleanup can find
// and remove them all afterward, in FK-safe order, without each spec
// needing its own bespoke teardown - unlike the original's per-file
// in-memory SQLite (thrown away wholesale after each spec file), this
// harness's fixtures land in the same real, persistent database every
// other spec (and real dev traffic) also uses.
export async function cleanupLiveFixtures(): Promise<void> {
  await pgPool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id::text FROM users WHERE email LIKE 'live-%') OR user_id = 'live-someone-else'`);
  await pgPool.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id::text FROM users WHERE email LIKE 'live-%')`);
  await pgPool.query(`DELETE FROM audit_logs WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM workflow_steps WHERE workflow_id IN (SELECT id FROM workflows WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%'))`);
  await pgPool.query(`DELETE FROM workflows WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  // governance-alerts.live-spec.ts's fixtures use fixed placeholder UUIDs
  // (repeating-digit, e.g. '11111111-...') rather than real parcels rows -
  // matched by an explicit list, not a join, since no parcels row exists
  // for them (Postgres's `~` is POSIX ERE, which has no backreferences,
  // so a "same digit repeated" pattern can't be expressed as one regex).
  const placeholderParcelIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'a'].map((d) => `${d.repeat(8)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(12)}`);
  await pgPool.query(
    `DELETE FROM governance_alerts WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%') OR parcel_id = ANY($1)`,
    [placeholderParcelIds],
  );
  await pgPool.query(`DELETE FROM registration_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM planning_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM tax_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM restriction_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM dispute_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM encumbrance_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM parcel_documents WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM parcel_historical_states WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(
    `DELETE FROM parcel_neighbours WHERE parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')
       OR neighbour_parcel_id IN (SELECT id::text FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`,
  );
  await pgPool.query(`DELETE FROM parcel_identifiers WHERE parcel_id IN (SELECT id FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM citizen_parcels WHERE parcel_id IN (SELECT id FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%')`);
  await pgPool.query(`DELETE FROM parcels WHERE canonical_parcel_id LIKE 'LIVE-%'`);
  await pgPool.query(`DELETE FROM state_a_land_records WHERE survey_number LIKE 'LIVE-%'`);
  await pgPool.query(`DELETE FROM state_b_land_records WHERE plot_id LIKE 'LIVE-%'`);
  await pgPool.query(`DELETE FROM departments WHERE code LIKE 'LIVE_%'`);
  await pgPool.query(`DELETE FROM users WHERE email LIKE 'live-%'`);
}

export const square = (minLng: number, minLat: number, size = 0.001) => ({
  type: 'Polygon',
  coordinates: [[
    [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
  ]],
});
