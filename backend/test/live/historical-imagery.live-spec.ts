// Live-server counterpart of backend/test/historical-imagery.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Deliberate
// scope reduction, disclosed rather than silently dropped: the original
// overrides NarrativeService via Nest's overrideProvider to script exact
// AI-phrased narrative text. A running backend-py instance has no such
// override seam - its narrative_service.explain_parcel_changes() either
// calls a real configured OpenRouter model (unpredictable exact wording)
// or, with no OPENROUTER_API_KEY set, has its exception swallowed by
// historical_comparison_service.py and falls back to the raw underlying
// facts sentence - either is a valid "real narrative", but this harness
// can't know which is active in a given environment. So compare()'s
// per-parcel narrative text is asserted only as "a non-empty string",
// never as a scripted exact phrase; every other assertion (category
// transitions, alert creation/severity, the cleared-parcel/unaffected-
// parcel rules, and every auth/400/404 guard) is ported verbatim.
// Requires backend-py to already be up - see live-client.ts.
import * as fs from 'fs';
import * as path from 'path';
import request = require('supertest');
import sharp from 'sharp';
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

async function makeFlatImage(): Promise<Buffer> {
  const size = 64;
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 143;
    buf[i * 4 + 1] = 174;
    buf[i * 4 + 2] = 134;
    buf[i * 4 + 3] = 255;
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

const CURRENT_YEAR = 2026;
const PREVIOUS_YEAR = CURRENT_YEAR - 1;
const OLD_YEAR = 2022;
const suffix = Date.now();
const CLUSTER_ID = `LIVE-TEST-CLUSTER-01-${suffix}`;
const MAP_ONLY_CLUSTER_ID = `LIVE-TEST-CLUSTER-02-${suffix}`;

describe('Historical Imagery (live backend-py e2e)', () => {
  let officerAuth: string;
  let citizenAuth: string;
  const hostFilePaths: string[] = [];

  async function insertParcel(canonicalParcelId: string, clusterId: string, coords: number[][]): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, cluster_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'MH', 'PUN', 'MHLB001', 100, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), now(), now())
       RETURNING id`,
      [canonicalParcelId, clusterId, JSON.stringify({ type: 'Polygon', coordinates: [coords] })],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
    citizenAuth = (await createLiveAuthenticatedUser('CITIZEN')).authHeader;

    const bounds = { minLng: 73.849, minLat: 18.519, maxLng: 73.852, maxLat: 18.522 };
    const flatImage = await makeFlatImage();
    for (const year of [OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR]) {
      const fileName = `live-historical-${CLUSTER_ID}-${year}.png`;
      const hostPath = path.join(__dirname, '..', '..', '..', 'backend-py', fileName);
      fs.writeFileSync(hostPath, flatImage);
      hostFilePaths.push(hostPath);
      await pgPool.query(
        `INSERT INTO cluster_historical_snapshots (id, cluster_id, year, image_path, bounds, generated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [CLUSTER_ID, year, `/app/${fileName}`, JSON.stringify(bounds)],
      );
    }
  });

  afterAll(async () => {
    for (const p of hostFilePaths) fs.rmSync(p, { force: true });
    await pgPool.query('DELETE FROM cluster_historical_snapshots WHERE cluster_id = $1', [CLUSTER_ID]);
    await pgPool.query(
      `DELETE FROM governance_alerts WHERE parcel_id IN (SELECT id::text FROM parcels WHERE cluster_id IN ($1, $2))`,
      [CLUSTER_ID, MAP_ONLY_CLUSTER_ID],
    );
    await pgPool.query(
      `DELETE FROM dispute_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE cluster_id IN ($1, $2))`,
      [CLUSTER_ID, MAP_ONLY_CLUSTER_ID],
    );
    await pgPool.query(
      `DELETE FROM restriction_records WHERE parcel_id IN (SELECT id::text FROM parcels WHERE cluster_id IN ($1, $2))`,
      [CLUSTER_ID, MAP_ONLY_CLUSTER_ID],
    );
    await pgPool.query(
      `DELETE FROM parcel_historical_states WHERE parcel_id IN (SELECT id::text FROM parcels WHERE cluster_id IN ($1, $2))`,
      [CLUSTER_ID, MAP_ONLY_CLUSTER_ID],
    );
    await pgPool.query('DELETE FROM parcels WHERE cluster_id IN ($1, $2)', [CLUSTER_ID, MAP_ONLY_CLUSTER_ID]);
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/historical-imagery/clusters', () => {
    it('lists the seeded cluster and its available years', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/historical-imagery/clusters').set('Authorization', officerAuth).expect(200);
      const entry = res.body.find((c: any) => c.clusterId === CLUSTER_ID);
      expect(entry.years).toEqual([OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR]);
    });

    it('is public - a citizen and an unauthenticated request can both list clusters', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/historical-imagery/clusters').set('Authorization', citizenAuth).expect(200);
      await request(LIVE_BASE_URL).get('/api/v1/historical-imagery/clusters').expect(200);
    });
  });

  describe('GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/image', () => {
    it('serves the stored PNG', async () => {
      const res = await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for a year with no snapshot', async () => {
      await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/1999/image`)
        .set('Authorization', officerAuth)
        .expect(404);
    });

    it('rejects a citizen with 403', async () => {
      await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`)
        .set('Authorization', citizenAuth)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`).expect(401);
    });
  });

  describe('GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/parcels', () => {
    it('returns each parcel with its real geometry and a real ParcelCategory for that year', async () => {
      const coords = square(73.9, 18.6, 0.0006).coordinates[0];
      const parcelId = await insertParcel(`LIVE-HI-MAP-RESTRICTED-${suffix}`, MAP_ONLY_CLUSTER_ID, coords);
      await pgPool.query(
        `INSERT INTO parcel_historical_states (id, parcel_id, year, restriction_status) VALUES (gen_random_uuid(), $1, $2, 'RESTRICTED')`,
        [parcelId, OLD_YEAR],
      );

      const res = await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${OLD_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);

      const row = res.body.find((p: any) => p.canonicalParcelId === `LIVE-HI-MAP-RESTRICTED-${suffix}`);
      expect(row.category).toBe('RESTRICTED');
      expect(row.id).toBe(parcelId);
    });

    it('applies real active dispute status only for CURRENT_YEAR, never for a purely historical year', async () => {
      const coords = square(73.91, 18.61, 0.0006).coordinates[0];
      const parcelId = await insertParcel(`LIVE-HI-MAP-DISPUTE-${suffix}`, MAP_ONLY_CLUSTER_ID, coords);
      await pgPool.query(
        `INSERT INTO dispute_records (id, parcel_id, has_active_dispute, dispute_type, case_status) VALUES (gen_random_uuid(), $1, true, 'INHERITANCE', 'FILED')`,
        [parcelId],
      );

      const currentRes = await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(currentRes.body.find((p: any) => p.canonicalParcelId === `LIVE-HI-MAP-DISPUTE-${suffix}`).category).toBe('DISPUTE_INHERITANCE');

      const oldRes = await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${OLD_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(oldRes.body.find((p: any) => p.canonicalParcelId === `LIVE-HI-MAP-DISPUTE-${suffix}`).category).toBe('NONE');
    });

    it("is public - a citizen and an unauthenticated request can both fetch a year's parcels", async () => {
      await request(LIVE_BASE_URL)
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`)
        .set('Authorization', citizenAuth)
        .expect(200);
      await request(LIVE_BASE_URL).get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`).expect(200);
    });
  });

  describe('POST /api/v1/historical-imagery/clusters/:clusterId/compare', () => {
    it('detects real category changes, creates correctly-severed alerts, and leaves unaffected/improved parcels alone', async () => {
      const criticalDisputeId = await insertParcel(`LIVE-HI-CRITICAL-DISPUTE-${suffix}`, CLUSTER_ID, square(73.8501, 18.5201, 0.0006).coordinates[0]);
      const highDisputeId = await insertParcel(`LIVE-HI-HIGH-DISPUTE-${suffix}`, CLUSTER_ID, square(73.8502, 18.5202, 0.0006).coordinates[0]);
      const newRestrictionId = await insertParcel(`LIVE-HI-NEW-RESTRICTION-${suffix}`, CLUSTER_ID, square(73.8503, 18.5203, 0.0006).coordinates[0]);
      const clearedId = await insertParcel(`LIVE-HI-CLEARED-${suffix}`, CLUSTER_ID, square(73.8504, 18.5204, 0.0006).coordinates[0]);
      const unaffectedId = await insertParcel(`LIVE-HI-UNAFFECTED-${suffix}`, CLUSTER_ID, square(73.8505, 18.5205, 0.0006).coordinates[0]);

      await pgPool.query(
        `INSERT INTO dispute_records (id, parcel_id, has_active_dispute, dispute_type, case_status, filing_date)
         VALUES (gen_random_uuid(), $1, true, 'ENCROACHMENT', 'FILED', '2026-03-01'),
                (gen_random_uuid(), $2, true, 'BOUNDARY', 'UNDER_REVIEW', '2026-02-01')`,
        [criticalDisputeId, highDisputeId],
      );
      await pgPool.query(
        `INSERT INTO restriction_records (id, parcel_id, has_restriction, restriction_type) VALUES (gen_random_uuid(), $1, true, 'FLOOD_PRONE')`,
        [criticalDisputeId],
      );
      await pgPool.query(
        `INSERT INTO parcel_historical_states (id, parcel_id, year, restriction_status) VALUES
         (gen_random_uuid(), $1, $2, 'UNRESTRICTED'), (gen_random_uuid(), $1, $3, 'UNRESTRICTED'),
         (gen_random_uuid(), $4, $2, 'UNRESTRICTED'), (gen_random_uuid(), $4, $3, 'UNRESTRICTED'),
         (gen_random_uuid(), $5, $2, 'UNRESTRICTED'), (gen_random_uuid(), $5, $3, 'RESTRICTED'),
         (gen_random_uuid(), $6, $2, 'RESTRICTED'), (gen_random_uuid(), $6, $3, 'UNRESTRICTED'),
         (gen_random_uuid(), $7, $2, 'UNRESTRICTED'), (gen_random_uuid(), $7, $3, 'UNRESTRICTED')`,
        [criticalDisputeId, PREVIOUS_YEAR, CURRENT_YEAR, highDisputeId, newRestrictionId, clearedId, unaffectedId],
      );

      const res = await request(LIVE_BASE_URL)
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(201);

      expect(res.body.changeDetected).toBe(true);
      const byId = Object.fromEntries(res.body.affectedParcels.map((p: any) => [p.canonicalParcelId, p]));

      expect(Object.keys(byId).sort()).toEqual(
        [`LIVE-HI-CLEARED-${suffix}`, `LIVE-HI-CRITICAL-DISPUTE-${suffix}`, `LIVE-HI-HIGH-DISPUTE-${suffix}`, `LIVE-HI-NEW-RESTRICTION-${suffix}`].sort(),
      );

      const critical = byId[`LIVE-HI-CRITICAL-DISPUTE-${suffix}`];
      expect(critical.toCategory).toBe('DISPUTE_ENCROACHMENT');
      expect(typeof critical.narrative).toBe('string');
      expect(critical.narrative.length).toBeGreaterThan(0);
      expect(critical.alertId).toBeTruthy();
      const criticalAlert = await pgPool.query('SELECT alert_type, severity, source, status FROM governance_alerts WHERE id = $1', [critical.alertId]);
      expect(criticalAlert.rows[0]).toMatchObject({ alert_type: 'DISPUTE_DETECTED', severity: 'CRITICAL', source: 'HISTORICAL_IMAGERY', status: 'OPEN' });

      const high = byId[`LIVE-HI-HIGH-DISPUTE-${suffix}`];
      expect(high.toCategory).toBe('DISPUTE_BOUNDARY');
      const highAlert = await pgPool.query('SELECT severity FROM governance_alerts WHERE id = $1', [high.alertId]);
      expect(highAlert.rows[0].severity).toBe('HIGH');

      const newRestriction = byId[`LIVE-HI-NEW-RESTRICTION-${suffix}`];
      expect(newRestriction.fromCategory).toBe('NONE');
      expect(newRestriction.toCategory).toBe('RESTRICTED');
      const restrictionAlert = await pgPool.query('SELECT alert_type, severity FROM governance_alerts WHERE id = $1', [newRestriction.alertId]);
      expect(restrictionAlert.rows[0]).toMatchObject({ alert_type: 'RESTRICTION_DETECTED', severity: 'MEDIUM' });

      const cleared = byId[`LIVE-HI-CLEARED-${suffix}`];
      expect(cleared.fromCategory).toBe('RESTRICTED');
      expect(cleared.toCategory).toBe('NONE');
      expect(cleared.alertId).toBeNull();

      expect(byId[`LIVE-HI-UNAFFECTED-${suffix}`]).toBeUndefined();
    });

    it('returns 404 for a missing snapshot even when the year pair is otherwise valid', async () => {
      await request(LIVE_BASE_URL)
        .post(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(404);
    });

    it('rejects a citizen with 403', async () => {
      await request(LIVE_BASE_URL)
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', citizenAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL)
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(401);
    });

    it('rejects a malformed body with 400', async () => {
      await request(LIVE_BASE_URL)
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: 'not-a-year', toYear: CURRENT_YEAR })
        .expect(400);
    });

    describe('year-pair restriction (only PREVIOUS_YEAR -> CURRENT_YEAR generates alerts)', () => {
      it('rejects an arbitrary historical pair with 400', async () => {
        const res = await request(LIVE_BASE_URL)
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: OLD_YEAR, toYear: PREVIOUS_YEAR })
          .expect(400);
        expect(res.body.message).toContain(`${PREVIOUS_YEAR}`);
        expect(res.body.message).toContain(`${CURRENT_YEAR}`);
      });

      it('rejects the reversed pair (CURRENT_YEAR -> PREVIOUS_YEAR) with 400', async () => {
        await request(LIVE_BASE_URL)
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: CURRENT_YEAR, toYear: PREVIOUS_YEAR })
          .expect(400);
      });

      it('rejects a same-year comparison with 400', async () => {
        await request(LIVE_BASE_URL)
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: CURRENT_YEAR, toYear: CURRENT_YEAR })
          .expect(400);
      });
    });
  });
});
