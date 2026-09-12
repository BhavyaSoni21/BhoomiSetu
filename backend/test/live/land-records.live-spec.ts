// Live-server counterpart of backend/test/land-records.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - every
// assertion below is copied verbatim from that file; only the app
// bootstrapping (an in-process Nest app -> a running backend-py
// instance) and fixture seeding (TypeORM repositories -> raw SQL against
// backend-py's own database) changed. Requires backend-py to already be
// up and migrated - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient } from './live-client';

describe('Mock state land record schemas (live backend-py e2e)', () => {
  beforeAll(async () => {
    await pgPool.query('DELETE FROM state_a_land_records');
    await pgPool.query('DELETE FROM state_b_land_records');

    await pgPool.query(
      `INSERT INTO state_a_land_records (record_id, survey_number, subdivision_number, owner_name, village_code, area_hectares, record_status)
       VALUES (gen_random_uuid(), '42/3', '1', 'Sample Citizen', 'VIL001', 0.85, 'ACTIVE')`,
    );
    await pgPool.query(
      `INSERT INTO state_b_land_records (record_id, plot_id, holder_name, locality_id, land_extent_sqft, record_category)
       VALUES (gen_random_uuid(), 'P-9087', 'Sample Citizen', 'LOC900', 9150, 'Urban')`,
    );
  });

  afterAll(async () => {
    await closeLiveClient();
  });

  describe('State A land records (rural/village schema)', () => {
    it('creates a record, defaulting recordStatus to ACTIVE', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '10/2', subdivisionNumber: '4', ownerName: 'Test Owner', villageCode: 'VIL010', areaHectares: 1.2 })
        .expect(201);
      expect(res.body.recordStatus).toBe('ACTIVE');
      expect(res.body.recordId).toBeDefined();
    });

    it('rejects a create request missing required fields with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '10/2' })
        .expect(400);
    });

    it('lists all records and supports the schema-specific survey_number/village_code filters', async () => {
      const all = await request(LIVE_BASE_URL).get('/api/v1/state-a/land-records').expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(1);

      const filtered = await request(LIVE_BASE_URL)
        .get('/api/v1/state-a/land-records')
        .query({ survey_number: '42/3' })
        .expect(200);
      expect(filtered.body.total).toBe(1);
      expect(filtered.body.records[0].villageCode).toBe('VIL001');
    });

    it('reads, updates, and deletes a single record', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '55/1', subdivisionNumber: '2', ownerName: 'Lifecycle Owner', villageCode: 'VIL055', areaHectares: 2 })
        .expect(201);
      const id = created.body.recordId;

      const fetched = await request(LIVE_BASE_URL).get(`/api/v1/state-a/land-records/${id}`).expect(200);
      expect(fetched.body.ownerName).toBe('Lifecycle Owner');

      const updated = await request(LIVE_BASE_URL)
        .patch(`/api/v1/state-a/land-records/${id}`)
        .send({ ownerName: 'Renamed Owner' })
        .expect(200);
      expect(updated.body.ownerName).toBe('Renamed Owner');
      expect(updated.body.surveyNumber).toBe('55/1'); // untouched fields survive a partial update

      await request(LIVE_BASE_URL).delete(`/api/v1/state-a/land-records/${id}`).expect(204);
      await request(LIVE_BASE_URL).get(`/api/v1/state-a/land-records/${id}`).expect(404);
    });

    it('returns 404 for an unknown id on get/update/delete', async () => {
      const missing = '00000000-0000-0000-0000-000000000000';
      await request(LIVE_BASE_URL).get(`/api/v1/state-a/land-records/${missing}`).expect(404);
      await request(LIVE_BASE_URL).patch(`/api/v1/state-a/land-records/${missing}`).send({ ownerName: 'X' }).expect(404);
      await request(LIVE_BASE_URL).delete(`/api/v1/state-a/land-records/${missing}`).expect(404);
    });
  });

  describe('State B land records (urban plot schema)', () => {
    it('creates and reads back a record using its own field names', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-1234', holderName: 'Urban Owner', localityId: 'LOC010', landExtentSqft: 5000, recordCategory: 'Commercial' })
        .expect(201);
      expect(created.body.recordId).toBeDefined();

      const fetched = await request(LIVE_BASE_URL).get(`/api/v1/state-b/land-records/${created.body.recordId}`).expect(200);
      expect(fetched.body.plotId).toBe('P-1234');
      expect(fetched.body.recordCategory).toBe('Commercial');
    });

    it('rejects a create request missing required fields with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-0000' })
        .expect(400);
    });

    it('filters by plot_id/locality_id independently of State A data', async () => {
      const res = await request(LIVE_BASE_URL)
        .get('/api/v1/state-b/land-records')
        .query({ plot_id: 'P-9087' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.records[0].holderName).toBe('Sample Citizen');
      // State B response shape must never leak State A's field names.
      expect(res.body.records[0].surveyNumber).toBeUndefined();
      expect(res.body.records[0].villageCode).toBeUndefined();
    });

    it('updates and deletes a record', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-5555', holderName: 'Delete Me', localityId: 'LOC055', landExtentSqft: 1000, recordCategory: 'Residential' })
        .expect(201);
      const id = created.body.recordId;

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/state-b/land-records/${id}`)
        .send({ recordCategory: 'Mixed-Use' })
        .expect(200);

      await request(LIVE_BASE_URL).delete(`/api/v1/state-b/land-records/${id}`).expect(204);
      await request(LIVE_BASE_URL).get(`/api/v1/state-b/land-records/${id}`).expect(404);
    });
  });

  describe('the two state APIs operate independently', () => {
    it('State A and State B counts do not interfere with each other', async () => {
      const stateACount = Number((await pgPool.query('SELECT COUNT(*) FROM state_a_land_records')).rows[0].count);
      const stateBCount = Number((await pgPool.query('SELECT COUNT(*) FROM state_b_land_records')).rows[0].count);

      const stateARes = await request(LIVE_BASE_URL).get('/api/v1/state-a/land-records').expect(200);
      const stateBRes = await request(LIVE_BASE_URL).get('/api/v1/state-b/land-records').expect(200);

      expect(stateARes.body.total).toBe(stateACount);
      expect(stateBRes.body.total).toBe(stateBCount);
    });
  });
});
