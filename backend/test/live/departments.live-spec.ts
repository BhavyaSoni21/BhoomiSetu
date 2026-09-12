// Live-server counterpart of backend/test/departments.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping and fixture seeding
// (TypeORM repositories -> raw SQL against backend-py's own database)
// changed. Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';

describe('Mock department APIs (live backend-py e2e)', () => {
  let mhParcelId: string;
  let dlParcelId: string;
  let tnParcelId: string;

  async function insertParcel(canonicalParcelId: string, stateCode: string, districtCode: string, localBodyCode: string, areaSqM: number, geoJson: unknown): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), now(), now())
       RETURNING id`,
      [canonicalParcelId, stateCode, districtCode, localBodyCode, areaSqM, JSON.stringify(geoJson)],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    mhParcelId = await insertParcel('LIVE-DEPT-MH-1', 'MH', 'PUN', 'MHLB001', 500, square(73.85, 18.52));
    dlParcelId = await insertParcel('LIVE-DEPT-DL-1', 'DL', 'NEW', 'DLLB001', 300, square(77.2, 28.6));
    tnParcelId = await insertParcel('LIVE-DEPT-TN-1', 'TN', 'CHE', 'TNLB001', 400, square(80.27, 13.08));

    await pgPool.query(
      `INSERT INTO parcel_identifiers (id, parcel_id, identifier_type, identifier_value, source_state, source_department)
       VALUES (gen_random_uuid(), $1, 'SURVEY_NUMBER', 'LIVE-77/9', 'MH', 'Land Records')`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO parcel_identifiers (id, parcel_id, identifier_type, identifier_value, source_state, source_department)
       VALUES (gen_random_uuid(), $1, 'PLOT_NUMBER', 'LIVE-P-4321', 'DL', 'Land Records')`,
      [dlParcelId],
    );

    await pgPool.query(
      `INSERT INTO state_a_land_records (record_id, survey_number, subdivision_number, owner_name, village_code, area_hectares, record_status)
       VALUES (gen_random_uuid(), 'LIVE-77/9', '2', 'Match Owner A', 'VIL777', 0.05, 'ACTIVE')`,
    );
    await pgPool.query(
      `INSERT INTO state_b_land_records (record_id, plot_id, holder_name, locality_id, land_extent_sqft, record_category)
       VALUES (gen_random_uuid(), 'LIVE-P-4321', 'Match Owner B', 'LOC432', 3229, 'Urban')`,
    );

    await pgPool.query(
      `INSERT INTO registration_records (id, parcel_id, registration_status, registration_number, registration_date, last_transaction_type, last_transaction_date)
       VALUES (gen_random_uuid(), $1, 'REGISTERED', 'REG-MH-1', '2020-01-01', 'SALE', '2020-01-01')`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO planning_records (id, parcel_id, land_use, zoning_classification, master_plan_reference, building_permission_status)
       VALUES (gen_random_uuid(), $1, 'RESIDENTIAL', 'Residential-1', 'Pune Master Plan 2025', 'APPROVED')`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO tax_records (id, parcel_id, assessed_value, annual_tax_amount, tax_status, outstanding_amount)
       VALUES (gen_random_uuid(), $1, 1000000, 5000, 'PENDING', 2500)`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO restriction_records (id, parcel_id, has_restriction, restriction_type, restriction_details, imposing_authority)
       VALUES (gen_random_uuid(), $1, true, 'FLOOD_PRONE', 'Test flood flag', 'MH Env Authority')`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO dispute_records (id, parcel_id, has_active_dispute, dispute_type, case_status, filing_date)
       VALUES (gen_random_uuid(), $1, true, 'BOUNDARY', 'UNDER_REVIEW', '2025-06-01')`,
      [mhParcelId],
    );
    await pgPool.query(
      `INSERT INTO encumbrance_records (id, parcel_id, has_encumbrance, encumbrance_type, lender_name, instrument_reference, registered_date)
       VALUES (gen_random_uuid(), $1, true, 'MORTGAGE', 'Test Co-operative Bank', 'MORTGAGE-500001', '2022-03-01')`,
      [mhParcelId],
    );
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/land-records/:parcelId (Land Records department)', () => {
    it('resolves an MH parcel to its State A record via its SURVEY_NUMBER identifier', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/land-records/${mhParcelId}`).expect(200);
      expect(res.body.source).toBe('STATE_A');
      expect(res.body.identifierUsed).toEqual({ type: 'SURVEY_NUMBER', value: 'LIVE-77/9' });
      expect(res.body.data.ownerName).toBe('Match Owner A');
    });

    it('resolves a DL parcel to its State B record via its PLOT_NUMBER identifier', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/land-records/${dlParcelId}`).expect(200);
      expect(res.body.source).toBe('STATE_B');
      expect(res.body.identifierUsed).toEqual({ type: 'PLOT_NUMBER', value: 'LIVE-P-4321' });
      expect(res.body.data.holderName).toBe('Match Owner B');
    });

    it('returns 404 for a state with no mock schema configured (TN)', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/land-records/${tnParcelId}`).expect(404);
    });

    it('returns 404 for an unknown parcel id', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/land-records/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/land-records/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/v1/registration/:parcelId', () => {
    it('returns registration status and transaction info for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/registration/${mhParcelId}`).expect(200);
      expect(res.body.registrationStatus).toBe('REGISTERED');
      expect(res.body.lastTransactionType).toBe('SALE');
    });

    it('returns 404 when no registration record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/registration/${dlParcelId}`).expect(404);
    });
  });

  describe('GET /api/v1/planning/:parcelId', () => {
    it('returns land use and zoning info for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/planning/${mhParcelId}`).expect(200);
      expect(res.body.landUse).toBe('RESIDENTIAL');
      expect(res.body.buildingPermissionStatus).toBe('APPROVED');
    });

    it('returns 404 when no planning record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/planning/${dlParcelId}`).expect(404);
    });
  });

  describe('GET /api/v1/tax/:parcelId', () => {
    it('returns assessed value, tax status, and outstanding amount for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/tax/${mhParcelId}`).expect(200);
      expect(res.body.taxStatus).toBe('PENDING');
      expect(Number(res.body.outstandingAmount)).toBe(2500);
    });

    it('returns 404 when no tax record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/tax/${dlParcelId}`).expect(404);
    });
  });

  describe('GET /api/v1/restriction/:parcelId', () => {
    it('returns the restriction flag and type for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/restriction/${mhParcelId}`).expect(200);
      expect(res.body.hasRestriction).toBe(true);
      expect(res.body.restrictionType).toBe('FLOOD_PRONE');
    });

    it('returns 404 when no restriction record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/restriction/${dlParcelId}`).expect(404);
    });
  });

  describe('GET /api/v1/dispute/:parcelId', () => {
    it('returns the dispute status for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/dispute/${mhParcelId}`).expect(200);
      expect(res.body.hasActiveDispute).toBe(true);
      expect(res.body.disputeType).toBe('BOUNDARY');
      expect(res.body.caseStatus).toBe('UNDER_REVIEW');
    });

    it('returns 404 when no dispute record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/dispute/${dlParcelId}`).expect(404);
    });
  });

  describe('GET /api/v1/encumbrance/:parcelId', () => {
    it('returns the encumbrance flag and type for a parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/encumbrance/${mhParcelId}`).expect(200);
      expect(res.body.hasEncumbrance).toBe(true);
      expect(res.body.encumbranceType).toBe('MORTGAGE');
      expect(res.body.lenderName).toBe('Test Co-operative Bank');
    });

    it('returns 404 when no encumbrance record exists for the parcel', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/encumbrance/${dlParcelId}`).expect(404);
    });
  });

  describe('the department APIs operate independently', () => {
    it('each department only returns its own data shape - no field leakage between departments', async () => {
      const [registration, planning, tax, restriction, dispute, encumbrance] = await Promise.all([
        request(LIVE_BASE_URL).get(`/api/v1/registration/${mhParcelId}`).expect(200),
        request(LIVE_BASE_URL).get(`/api/v1/planning/${mhParcelId}`).expect(200),
        request(LIVE_BASE_URL).get(`/api/v1/tax/${mhParcelId}`).expect(200),
        request(LIVE_BASE_URL).get(`/api/v1/restriction/${mhParcelId}`).expect(200),
        request(LIVE_BASE_URL).get(`/api/v1/dispute/${mhParcelId}`).expect(200),
        request(LIVE_BASE_URL).get(`/api/v1/encumbrance/${mhParcelId}`).expect(200),
      ]);

      expect(registration.body.landUse).toBeUndefined();
      expect(registration.body.taxStatus).toBeUndefined();
      expect(planning.body.registrationStatus).toBeUndefined();
      expect(planning.body.assessedValue).toBeUndefined();
      expect(tax.body.landUse).toBeUndefined();
      expect(tax.body.hasRestriction).toBeUndefined();
      expect(restriction.body.taxStatus).toBeUndefined();
      expect(restriction.body.landUse).toBeUndefined();
      expect(dispute.body.taxStatus).toBeUndefined();
      expect(dispute.body.hasRestriction).toBeUndefined();
      expect(encumbrance.body.taxStatus).toBeUndefined();
      expect(encumbrance.body.hasRestriction).toBeUndefined();
    });
  });
});
