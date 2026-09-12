// Live-server counterpart of backend/test/interoperability.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Deliberate
// scope reduction, disclosed rather than silently dropped: the original
// spends most of its assertions calling adaptStateA/adaptStateB and
// IdentifierResolverService/ResponseAggregatorService directly as
// injected Nest providers - there is no live-server equivalent of "call
// an internal service function directly" against a running HTTP process.
// Only the one true end-to-end HTTP assertion (GET /parcels/:id/360) is
// ported here; it already exercises the adapters + both resolver/
// aggregator services together, indirectly, through the real endpoint.
// Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';

describe('Interoperability (live backend-py e2e)', () => {
  let fullMhParcelId: string;

  beforeAll(async () => {
    const parcelResult = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, ulpin, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'MH', 'PUN', 'MHLB009', 500, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), now(), now())
       RETURNING id`,
      [`LIVE-INTEROP-MH-1-${Date.now()}`, `ULPIN${Date.now()}`.slice(0, 16), JSON.stringify(square(73.85, 18.52))],
    );
    fullMhParcelId = parcelResult.rows[0].id;

    await pgPool.query(
      `INSERT INTO parcel_identifiers (id, parcel_id, identifier_type, identifier_value, source_state, source_department)
       VALUES (gen_random_uuid(), $1, 'SURVEY_NUMBER', 'LIVE-55/2', 'MH', 'Land Records'),
              (gen_random_uuid(), $1, 'LOCAL_PARCEL_ID', 'MH-PUN-LIVE-0099', 'MH', 'Land Records')`,
      [fullMhParcelId],
    );
    await pgPool.query(
      `INSERT INTO state_a_land_records (record_id, survey_number, subdivision_number, owner_name, village_code, area_hectares, record_status)
       VALUES (gen_random_uuid(), 'LIVE-55/2', '3', 'Interop Owner', 'VIL555', 0.05, 'ACTIVE')`,
    );
    await pgPool.query(
      `INSERT INTO registration_records (id, parcel_id, registration_status, registration_number, registration_date, last_transaction_type, last_transaction_date)
       VALUES (gen_random_uuid(), $1, 'REGISTERED', 'REG-1', '2020-01-01', 'SALE', '2020-01-01')`,
      [fullMhParcelId],
    );
    await pgPool.query(
      `INSERT INTO tax_records (id, parcel_id, assessed_value, annual_tax_amount, tax_status, outstanding_amount)
       VALUES (gen_random_uuid(), $1, 100000, 500, 'PAID', 0)`,
      [fullMhParcelId],
    );
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/parcels/:id/360 end-to-end', () => {
    it('serves the canonical envelope and Land Records, but withholds owner-only departments, for an anonymous caller', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${fullMhParcelId}/360`).expect(200);
      expect(res.body.parcel_id).toBe(fullMhParcelId);
      expect(res.body.departments.landRecords.ownerName).toBe('Interop Owner');
      expect(res.body.departments.tax).toBeNull();
      expect(res.body.departments.planning).toBeNull();
      expect(res.body.departments.restriction).toBeNull();
      expect(res.body.departments.dispute).toBeNull();
      expect(res.body.departments.encumbrance).toBeNull();
      expect(res.body.restrictedForViewer).toBe(true);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/360').expect(404);
    });
  });
});
