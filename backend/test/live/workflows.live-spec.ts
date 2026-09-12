// Live-server counterpart of backend/test/workflows.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Deliberate
// scope reduction, disclosed rather than silently dropped: the original's
// "Evidence upload on POST /api/v1/workflows (multipart)" and
// DOCUMENT_VERIFICATION_REQUEST/dispute-evidence describe blocks render a
// real land-document image via the backend's own renderParcelDocumentImage
// generator and assert on backend-py's OCR-based verificationPrecheck
// actually matching. As in parcels-identify.live-spec.ts, faithfully
// reproducing that would mean reverse-engineering backend-py's own OCR
// text-rendering/matching conventions rather than proving anything real -
// so those multipart/OCR-dependent assertions are not ported here. Every
// other describe block - the full non-multipart workflow lifecycle
// (create, list, filter, approve/reject/escalate/reopen, LAND_CLAIM_REQUEST's
// association exemption and conflict handling, notifications) - is ported
// with assertions copied verbatim; only app bootstrapping and fixture
// seeding (TypeORM repositories -> raw SQL against backend-py's own
// database) changed. Requires backend-py to already be up - see
// live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Workflows (service requests) (live backend-py e2e)', () => {
  let parcelId: string;
  let otherParcelId: string;
  let adminAuth: string;
  let landRecordsAuth: string;
  let landRecordsOfficerId: string;
  let registrationAuth: string;
  let citizenAuth: string;
  let citizenUserId: string;
  let unassociatedCitizenAuth: string;
  const suffix = Date.now();

  async function insertParcel(canonicalParcelId: string, stateCode: string, districtCode: string, localBodyCode: string, areaSqM: number, coords: number[][]): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), now(), now())
       RETURNING id`,
      [canonicalParcelId, stateCode, districtCode, localBodyCode, areaSqM, JSON.stringify({ type: 'Polygon', coordinates: [coords] })],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    parcelId = await insertParcel(`LIVE-WF-1-${suffix}`, 'MH', 'WFPUN', 'MHLB001', 500, square(73.85, 18.52).coordinates[0]);
    otherParcelId = await insertParcel(`LIVE-WF-2-${suffix}`, 'DL', 'WFNEW', 'DLLB001', 300, square(77.2, 28.6).coordinates[0]);

    adminAuth = (await createLiveAuthenticatedUser('ADMIN')).authHeader;
    const landRecordsOfficer = await createLiveAuthenticatedUser('LAND_RECORD_OFFICER');
    landRecordsAuth = landRecordsOfficer.authHeader;
    landRecordsOfficerId = landRecordsOfficer.id;
    registrationAuth = (await createLiveAuthenticatedUser('REGISTRATION_OFFICER')).authHeader;

    const citizen = await createLiveAuthenticatedUser('CITIZEN');
    citizenAuth = citizen.authHeader;
    citizenUserId = citizen.id;
    await pgPool.query(
      `INSERT INTO citizen_parcels (id, citizen_id, parcel_id) VALUES (gen_random_uuid(), $1, $2), (gen_random_uuid(), $1, $3)`,
      [citizen.id, parcelId, otherParcelId],
    );

    unassociatedCitizenAuth = (await createLiveAuthenticatedUser('CITIZEN')).authHeader;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('POST /api/v1/workflows', () => {
    it('creates a workflow with SUBMITTED status and auto-generates the 3-step review pipeline', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST', createdBy: 'Jane Citizen', requestDetails: 'Need a copy for a loan application' })
        .expect(201);

      expect(res.body.currentStatus).toBe('SUBMITTED');
      expect(res.body.parcelId).toBe(parcelId);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps.map((s: any) => s.department)).toEqual(['LAND_RECORDS', 'REGISTRATION', 'PLANNING']);
      expect(res.body.steps.every((s: any) => s.status === 'PENDING')).toBe(true);
      expect(res.body.steps.map((s: any) => s.stepOrder)).toEqual([1, 2, 3]);
    });

    it('notifies every officer holding the assigned role(s) when a request is submitted', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const notifications = await pgPool.query(
        `SELECT parcel_id, read, workflow_id FROM notifications WHERE user_id = $1 AND type = 'WORKFLOW_ASSIGNED' AND workflow_id = $2`,
        [landRecordsOfficerId, res.body.id],
      );
      expect(notifications.rows).toHaveLength(1);
      expect(notifications.rows[0].parcel_id).toBe(parcelId);
      expect(notifications.rows[0].read).toBe(false);
    });

    it('accepts a workflow with no createdBy/requestDetails (both optional) and defaults createdBy to the filing citizen', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);
      expect(res.body.createdBy).toMatch(/^Live Test CITIZEN/);
      expect(res.body.requestDetails).toBeNull();
    });

    it('rejects a request for a non-existent parcel with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: '00000000-0000-0000-0000-000000000000', workflowType: 'ROR_COPY_REQUEST' })
        .expect(400);
    });

    it('rejects a request missing required fields with 400', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ workflowType: 'ROR_COPY_REQUEST' }).expect(400);
      await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId }).expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/workflows').send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(401);
    });

    it('rejects a staff account (non-citizen) filing a request with 403', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', landRecordsAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(403);
    });

    it("rejects a citizen filing a request for a parcel not associated with their account, with 403", async () => {
      await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', unassociatedCitizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(403);
    });

    it('a DISPUTE_FILING workflow gets its own single-step DISPUTE review, not the default 3-step pipeline', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'DISPUTE_FILING', requestDetails: 'Boundary dispute with neighbouring parcel' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0]).toEqual(expect.objectContaining({ department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER', status: 'PENDING', stepOrder: 1 }));
    });
  });

  describe('GET /api/v1/workflows/:id', () => {
    it('returns a workflow with its steps', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/workflows/${created.body.id}`).set('Authorization', adminAuth).expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.steps).toHaveLength(3);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/not-a-uuid').set('Authorization', adminAuth).expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000').set('Authorization', adminAuth).expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000').expect(401);
    });

    it('allows an officer whose department has a step on the workflow', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      await request(LIVE_BASE_URL).get(`/api/v1/workflows/${created.body.id}`).set('Authorization', landRecordsAuth).expect(200);
    });

    it('returns 404 (not 403) for a staff role with no step in the workflow', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const taxAuth = (await createLiveAuthenticatedUser('TAX_OFFICER')).authHeader;
      await request(LIVE_BASE_URL).get(`/api/v1/workflows/${created.body.id}`).set('Authorization', taxAuth).expect(404);
    });
  });

  describe('PATCH /api/v1/workflows/:id/status', () => {
    it('updates currentStatus and records remarks', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/status`)
        .set('Authorization', adminAuth)
        .send({ status: 'UNDER_REVIEW', remarks: 'Assigned to land records officer' })
        .expect(200);

      expect(res.body.currentStatus).toBe('UNDER_REVIEW');
      expect(res.body.lastRemarks).toBe('Assigned to land records officer');
      expect(res.body.steps).toHaveLength(3);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', adminAuth)
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/workflows', () => {
    it('lists only workflows for that specific parcel, newest first', async () => {
      const first = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId: otherParcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const second = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId: otherParcelId, workflowType: 'CORRECTION_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${otherParcelId}/workflows`).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.every((w: any) => w.parcelId === otherParcelId)).toBe(true);
      const ids = res.body.map((w: any) => w.id);
      expect(ids.indexOf(second.body.id)).toBeLessThan(ids.indexOf(first.body.id));
    });

    it('returns an empty array for a parcel with no service requests', async () => {
      const freshParcelId = await insertParcel(`LIVE-WF-3-${suffix}`, 'KA', 'WFBAN', 'KALB001', 200, square(77.5, 12.9).coordinates[0]);
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${freshParcelId}/workflows`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/workflows').expect(404);
    });
  });

  describe('GET /api/v1/workflows (officer dashboard listing)', () => {
    it('filters by department AND stepStatus to the workflows with a matching pending step', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows?department=LAND_RECORDS&stepStatus=PENDING').set('Authorization', landRecordsAuth).expect(200);
      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(true);
      expect(res.body.every((w: any) => w.steps.some((s: any) => s.department === 'LAND_RECORDS' && s.status === 'PENDING'))).toBe(true);
    });

    it('excludes a workflow whose matching-department step has already been decided', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows?department=LAND_RECORDS&stepStatus=PENDING').set('Authorization', landRecordsAuth).expect(200);
      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(false);
    });

    it('returns every workflow when no filters are given (admin only)', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows').set('Authorization', adminAuth).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('honors an explicit limit, capped to the most recent workflows', async () => {
      const unlimited = await request(LIVE_BASE_URL).get('/api/v1/workflows').set('Authorization', adminAuth).expect(200);
      expect(unlimited.body.length).toBeGreaterThan(2);

      const limited = await request(LIVE_BASE_URL).get('/api/v1/workflows?limit=2').set('Authorization', adminAuth).expect(200);
      expect(limited.body).toHaveLength(2);
      expect(limited.body.map((w: any) => w.id)).toEqual(unlimited.body.slice(0, 2).map((w: any) => w.id));
    });

    it("scopes an officer's request to their own department even if a different one is requested", async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows?department=REGISTRATION').set('Authorization', landRecordsAuth).expect(200);
      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(true);
      expect(res.body.every((w: any) => w.steps.some((s: any) => s.department === 'LAND_RECORDS'))).toBe(true);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows').expect(401);
    });
  });

  describe('PATCH /api/v1/workflows/:workflowId/steps/:stepId (officer review action)', () => {
    it('approving every step moves the workflow to APPROVED', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      let last;
      for (const step of created.body.steps) {
        last = await request(LIVE_BASE_URL)
          .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
          .set('Authorization', adminAuth)
          .send({ action: 'APPROVE', remarks: `${step.department} looks good` })
          .expect(200);
      }

      expect(last!.body.currentStatus).toBe('APPROVED');
      expect(last!.body.steps.every((s: any) => s.status === 'APPROVED')).toBe(true);
      expect(last!.body.steps.every((s: any) => s.completedAt !== null)).toBe(true);
    });

    it('rejecting one step moves the whole workflow to REJECTED, independent of other steps', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', registrationAuth)
        .send({ action: 'REJECT', remarks: 'Ownership mismatch' })
        .expect(200);

      expect(res.body.currentStatus).toBe('REJECTED');
      const decided = res.body.steps.find((s: any) => s.id === registrationStep.id);
      expect(decided.status).toBe('REJECTED');
      expect(decided.remarks).toBe('Ownership mismatch');
      expect(res.body.steps.filter((s: any) => s.id !== registrationStep.id).every((s: any) => s.status === 'PENDING')).toBe(true);
    });

    it('a partially-approved workflow (not all steps decided) is IN_PROGRESS', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      expect(res.body.currentStatus).toBe('IN_PROGRESS');
    });

    it('rejects a missing remarks with 400 - mandatory for both Approve and Reject', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'APPROVE' }).expect(400);
    });

    it('rejects an empty-string remarks with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'REJECT', remarks: '' }).expect(400);
    });

    it('rejects reviewing an already-decided step with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'APPROVE', remarks: 'Approved' }).expect(200);
      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'REJECT', remarks: 'Rejected' }).expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(404);
    });

    it('returns 404 when the step does not belong to that workflow', async () => {
      const first = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const second = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'CORRECTION_REQUEST' }).expect(201);

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${first.body.id}/steps/${second.body.steps[0].id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(404);
    });

    it('rejects an invalid action value with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'MAYBE' })
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(401);
    });

    it('rejects an officer trying to decide a step outside their own department with 403', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(403);

      const stillPending = await request(LIVE_BASE_URL).get(`/api/v1/workflows/${created.body.id}`).set('Authorization', adminAuth).expect(200);
      expect(stillPending.body.steps.find((s: any) => s.id === registrationStep.id).status).toBe('PENDING');
    });

    it('notifies the citizen who owns the parcel when their step is decided', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'All documents verified' })
        .expect(200);

      const notifications = await pgPool.query(
        `SELECT message FROM notifications WHERE user_id = $1 AND type = 'WORKFLOW_STEP_APPROVED' AND workflow_id = $2`,
        [citizenUserId, created.body.id],
      );
      expect(notifications.rows).toHaveLength(1);
      expect(notifications.rows[0].message).toContain('All documents verified');
    });

    it('lets ADMIN decide a step regardless of department', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const planningStep = created.body.steps.find((s: any) => s.department === 'PLANNING');

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${planningStep.id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      expect(res.body.steps.find((s: any) => s.id === planningStep.id).status).toBe('APPROVED');
    });
  });

  describe('GET /api/v1/workflows/mine', () => {
    it("returns only the signed-in citizen's own requests, across all of their parcels", async () => {
      const own = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId: otherParcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows/mine').set('Authorization', citizenAuth).expect(200);
      expect(res.body.some((w: any) => w.id === own.body.id)).toBe(true);
      expect(res.body.every((w: any) => [parcelId, otherParcelId].includes(w.parcelId))).toBe(true);
      expect(res.body[0].steps.length).toBeGreaterThan(0);
    });

    it('returns an empty array for a citizen with no parcels', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/workflows/mine').set('Authorization', unassociatedCitizenAuth).expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects a staff account with 403', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/mine').set('Authorization', adminAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/mine').expect(401);
    });
  });

  describe('LAND_CLAIM_REQUEST (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('is exempt from the association check - a citizen can file it for a parcel they are NOT yet linked to', async () => {
      const unclaimedId = await insertParcel(`LIVE-WF-CLAIM-1-${suffix}`, 'KA', 'WFBAN', 'KALB001', 400, square(77.6, 12.95).coordinates[0]);

      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: unclaimedId, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0]).toEqual(expect.objectContaining({ department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING' }));

      const link = await pgPool.query('SELECT 1 FROM citizen_parcels WHERE parcel_id = $1', [unclaimedId]);
      expect(link.rows).toHaveLength(0);
    });

    it('rejects a claim on a parcel already linked to another citizen, with 409', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(409);
    });

    it('approving the claim step creates the citizen_parcels link, so the parcel then appears in /parcels/mine', async () => {
      const unclaimedId = await insertParcel(`LIVE-WF-CLAIM-2-${suffix}`, 'KA', 'WFBAN', 'KALB001', 410, square(77.61, 12.95).coordinates[0]);
      const claimant = await createLiveAuthenticatedUser('CITIZEN');

      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .send({ parcelId: unclaimedId, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      const approveRes = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Papers verified' })
        .expect(200);
      expect(approveRes.body.currentStatus).toBe('APPROVED');

      const mineRes = await request(LIVE_BASE_URL).get('/api/v1/parcels/mine').set('Authorization', claimant.authHeader).expect(200);
      expect(mineRes.body.parcels.some((p: any) => p.id === unclaimedId)).toBe(true);
    });

    it('re-checks for a conflict at review time, rejecting approval with 409 if the parcel became linked to someone else since filing', async () => {
      const unclaimedId = await insertParcel(`LIVE-WF-CLAIM-3-${suffix}`, 'KA', 'WFBAN', 'KALB001', 420, square(77.62, 12.95).coordinates[0]);
      const claimant = await createLiveAuthenticatedUser('CITIZEN');
      const someoneElse = await createLiveAuthenticatedUser('CITIZEN');

      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .send({ parcelId: unclaimedId, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      await pgPool.query('INSERT INTO citizen_parcels (id, citizen_id, parcel_id) VALUES (gen_random_uuid(), $1, $2)', [someoneElse.id, unclaimedId]);

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(409);
    });
  });

  describe('DOCUMENT_VERIFICATION_REQUEST (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('requires the usual association check (not exempt like LAND_CLAIM_REQUEST) and routes to LAND_RECORDS', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(403);

      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].department).toBe('LAND_RECORDS');
    });

    it('approving the step creates a bare REGISTERED ParcelDocument when the parcel had none on file', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(201);

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const document = await pgPool.query(`SELECT registration_status FROM parcel_documents WHERE parcel_id = $1 ORDER BY created_at DESC LIMIT 1`, [parcelId]);
      expect(document.rows[0].registration_status).toBe('REGISTERED');
    });
  });

  describe('POST /api/v1/workflows/:workflowId/steps/:stepId/escalate (Admin "alert the officers" oversight action)', () => {
    it('ADMIN can notify the officer holding a pending step without deciding it', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      const res = await request(LIVE_BASE_URL)
        .post(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}/escalate`)
        .set('Authorization', adminAuth)
        .send({ message: 'This one looks stale, please check it today.' })
        .expect(201);

      const untouchedStep = res.body.steps.find((s: any) => s.id === landRecordsStep.id);
      expect(untouchedStep.status).toBe('PENDING');
      expect(untouchedStep.action).toBeNull();

      const notifications = await pgPool.query(
        `SELECT parcel_id, message FROM notifications WHERE user_id = $1 AND type = 'ADMIN_ESCALATION' AND workflow_id = $2`,
        [landRecordsOfficerId, created.body.id],
      );
      expect(notifications.rows).toHaveLength(1);
      expect(notifications.rows[0].parcel_id).toBe(parcelId);
      expect(notifications.rows[0].message).toBe('This one looks stale, please check it today.');
    });

    it('rejects escalating an already-decided step with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'APPROVE', remarks: 'Approved' }).expect(200);
      await request(LIVE_BASE_URL)
        .post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`)
        .set('Authorization', adminAuth)
        .send({ message: 'Too late, already decided' })
        .expect(400);
    });

    it('rejects a missing message with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`).set('Authorization', adminAuth).send({}).expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000/escalate')
        .set('Authorization', adminAuth)
        .send({ message: 'Please check' })
        .expect(404);
    });

    it('rejects escalation from a non-ADMIN officer with 403', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL)
        .post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`)
        .set('Authorization', landRecordsAuth)
        .send({ message: 'Please check' })
        .expect(403);
    });
  });

  describe('POST /api/v1/workflows/:workflowId/steps/:stepId/reopen (Admin "send back for re-review" oversight action)', () => {
    it('ADMIN can reopen an already-decided step, resetting it to PENDING and notifying the officer', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Looks fine' })
        .expect(200);

      const res = await request(LIVE_BASE_URL)
        .post(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}/reopen`)
        .set('Authorization', adminAuth)
        .send({ message: 'Please re-check the owner name, it looks off.' })
        .expect(201);

      const reopenedStep = res.body.steps.find((s: any) => s.id === landRecordsStep.id);
      expect(reopenedStep.status).toBe('PENDING');
      expect(reopenedStep.action).toBeNull();
      expect(reopenedStep.remarks).toBeNull();
      expect(reopenedStep.completedAt).toBeNull();
      expect(res.body.currentStatus).toBe('IN_PROGRESS');

      const notifications = await pgPool.query(
        `SELECT parcel_id, message FROM notifications WHERE user_id = $1 AND type = 'ADMIN_REOPENED_STEP' AND workflow_id = $2`,
        [landRecordsOfficerId, created.body.id],
      );
      expect(notifications.rows).toHaveLength(1);
      expect(notifications.rows[0].parcel_id).toBe(parcelId);
      expect(notifications.rows[0].message).toBe('Please re-check the owner name, it looks off.');
    });

    it('lets the officer decide the reopened step again after it is sent back', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT', remarks: 'Missing document' })
        .expect(200);

      await request(LIVE_BASE_URL)
        .post(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}/reopen`)
        .set('Authorization', adminAuth)
        .send({ message: 'Please look again, the document was actually attached' })
        .expect(201);

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Confirmed, document is present' })
        .expect(200);

      expect(res.body.steps.find((s: any) => s.id === landRecordsStep.id).status).toBe('APPROVED');
    });

    it('rejects reopening a still-pending step with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/reopen`).set('Authorization', adminAuth).send({ message: 'Nothing to reopen yet' }).expect(400);
    });

    it('rejects a missing message with 400', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'APPROVE', remarks: 'Approved' }).expect(200);
      await request(LIVE_BASE_URL).post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/reopen`).set('Authorization', adminAuth).send({}).expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000/reopen')
        .set('Authorization', adminAuth)
        .send({ message: 'Please check' })
        .expect(404);
    });

    it('rejects reopening from a non-ADMIN officer with 403', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);
      const step = created.body.steps[0];

      await request(LIVE_BASE_URL).patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`).set('Authorization', landRecordsAuth).send({ action: 'APPROVE', remarks: 'Approved' }).expect(200);
      await request(LIVE_BASE_URL).post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/reopen`).set('Authorization', landRecordsAuth).send({ message: 'Please check' }).expect(403);
    });
  });

  describe('DISPUTE_FILING association exemption (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('is exempt from the association check - a citizen can file a dispute against a parcel that is not theirs', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId, workflowType: 'DISPUTE_FILING', requestDetails: 'I believe this parcel is actually mine.' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].department).toBe('DISPUTE');
    });
  });

  describe('GET /api/v1/workflows/:id/evidence', () => {
    it('returns 404 when the workflow carries no evidence', async () => {
      const created = await request(LIVE_BASE_URL).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId, workflowType: 'ROR_COPY_REQUEST' }).expect(201);

      await request(LIVE_BASE_URL).get(`/api/v1/workflows/${created.body.id}/evidence`).set('Authorization', adminAuth).expect(404);
    });

    it('rejects a citizen account with 403', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence').set('Authorization', citizenAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence').expect(401);
    });
  });
});
