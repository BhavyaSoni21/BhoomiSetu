// Live-server counterpart of backend/test/audit.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Unlike this
// spec's own pytest port (tests/routers/test_audit.py in backend-py,
// which had to seed AuditLog rows directly since AuthModule/
// WorkflowsModule/GovernanceModule didn't exist yet at the time), every
// module this spec actually exercises now exists - so this ports the
// full original verbatim, triggering every audit entry through the real
// /auth/login, /workflows, and /governance-alerts/:id/status endpoints,
// exactly like the original did. Requires backend-py to already be up -
// see live-client.ts.
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Audit logging (live backend-py e2e)', () => {
  let parcelId: string;
  let adminAuth: string;
  let landRecordsAuth: string;
  let citizenAuth: string;

  beforeAll(async () => {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MH', 'PUN', 'MHLB001', 500, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), now(), now())
       RETURNING id`,
      [`LIVE-AUDIT-${Date.now()}`, JSON.stringify(square(73.85, 18.52))],
    );
    parcelId = result.rows[0].id;

    adminAuth = (await createLiveAuthenticatedUser('ADMIN')).authHeader;
    landRecordsAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
    const citizen = await createLiveAuthenticatedUser('CITIZEN');
    citizenAuth = citizen.authHeader;
    await pgPool.query('INSERT INTO citizen_parcels (id, citizen_id, parcel_id) VALUES (gen_random_uuid(), $1, $2)', [citizen.id, parcelId]);
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('POST /api/v1/auth/login', () => {
    it('records an AUTH_LOGIN entry', async () => {
      const email = `live-audit-login-${Date.now()}@test.gov.in`;
      const passwordHash = bcrypt.hashSync('CorrectPass1', 10);
      const userResult = await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, true, false, $2, 0, 'Audit Login Test', 'PLANNING_OFFICER', 0, 0) RETURNING id`,
        [email, passwordHash],
      );
      const loginUserId = userResult.rows[0].id;

      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password: 'CorrectPass1' }).expect(200);

      const res = await request(LIVE_BASE_URL).get('/api/v1/audit?entityType=USER').set('Authorization', adminAuth).expect(200);

      const entry = res.body.find((e: any) => e.entityId === loginUserId);
      expect(entry).toBeTruthy();
      expect(entry.action).toBe('AUTH_LOGIN');
      expect(entry.userRole).toBe('PLANNING_OFFICER');
    });
  });

  describe('Workflow step review', () => {
    it('records WORKFLOW_STEP_APPROVED with the department and remarks in metadata', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Looks correct' })
        .expect(200);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', adminAuth).expect(200);

      const entry = res.body.find((e: any) => e.entityId === landRecordsStep.id);
      expect(entry).toBeTruthy();
      expect(entry.action).toBe('WORKFLOW_STEP_APPROVED');
      expect(entry.entityType).toBe('WORKFLOW_STEP');
      expect(entry.parcelId).toBe(parcelId);
      expect(entry.metadata).toEqual({ workflowId: created.body.id, department: 'LAND_RECORDS', remarks: 'Looks correct' });
    });

    it('records WORKFLOW_STEP_REJECTED for a reject action', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT', remarks: 'Rejected' })
        .expect(200);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', adminAuth).expect(200);

      const entry = res.body.find((e: any) => e.entityId === landRecordsStep.id);
      expect(entry.action).toBe('WORKFLOW_STEP_REJECTED');
    });

    it('does not record anything for a request rejected by RBAC (wrong department)', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(403);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', adminAuth).expect(200);
      expect(res.body.find((e: any) => e.entityId === registrationStep.id)).toBeUndefined();
    });
  });

  describe('Workflow creation', () => {
    it('records WORKFLOW_CREATED against the filing citizen', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', adminAuth).expect(200);

      const entry = res.body.find((e: any) => e.entityId === created.body.id && e.action === 'WORKFLOW_CREATED');
      expect(entry).toBeTruthy();
      expect(entry.userRole).toBe('CITIZEN');
      expect(entry.entityType).toBe('WORKFLOW');
      expect(entry.metadata).toEqual({ workflowType: 'ROR_COPY_REQUEST' });
    });
  });

  describe('Governance alert status change', () => {
    it('records GOVERNANCE_ALERT_STATUS_CHANGED', async () => {
      const alertResult = await pgPool.query(
        `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
         VALUES (gen_random_uuid(), $1, 'TAX_OVERDUE', 'LOW', 'TAX_MONITOR', 'OPEN', 'x', now()) RETURNING id`,
        [parcelId],
      );
      const alertId = alertResult.rows[0].id;

      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', landRecordsAuth)
        .send({ status: 'DISMISSED', reason: 'Not a real issue.' })
        .expect(200);

      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', adminAuth).expect(200);

      const entry = res.body.find((e: any) => e.entityId === alertId);
      expect(entry.action).toBe('GOVERNANCE_ALERT_STATUS_CHANGED');
      expect(entry.entityType).toBe('GOVERNANCE_ALERT');
      expect(entry.metadata).toEqual({ status: 'DISMISSED', reason: 'Not a real issue.' });
    });
  });

  describe('GET /api/v1/audit', () => {
    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/audit').set('Authorization', landRecordsAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/audit').expect(401);
    });

    it('filters by entityType', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/audit?entityType=GOVERNANCE_ALERT').set('Authorization', adminAuth).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((e: any) => e.entityType === 'GOVERNANCE_ALERT')).toBe(true);
    });

    // KNOWN_RISKS.md HIGH-6: this endpoint used to return every row with no
    // ceiling - a real deployment running for months would see its payload
    // and query time grow without bound.
    it('honors an explicit limit, capped to the most recent entries', async () => {
      const unlimited = await request(LIVE_BASE_URL).get('/api/v1/audit').set('Authorization', adminAuth).expect(200);
      expect(unlimited.body.length).toBeGreaterThan(2);

      const limited = await request(LIVE_BASE_URL).get('/api/v1/audit?limit=2').set('Authorization', adminAuth).expect(200);
      expect(limited.body).toHaveLength(2);
      expect(limited.body).toEqual(unlimited.body.slice(0, 2));
    });

    it('ignores an out-of-range limit and falls back to the default cap rather than erroring', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/audit?limit=99999').set('Authorization', adminAuth).expect(200);
    });
  });

  describe('GET /api/v1/parcels/:id/audit', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).expect(401);
    });

    it('allows any staff role (not just admin)', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelId}/audit`).set('Authorization', landRecordsAuth).expect(200);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/audit').set('Authorization', adminAuth).expect(404);
    });
  });
});
