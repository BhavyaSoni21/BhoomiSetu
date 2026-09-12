// Live-server counterpart of backend/test/users.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping and fixture seeding
// (TypeORM repositories -> raw SQL against backend-py's own database)
// changed. Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Users (live backend-py e2e)', () => {
  let adminId: string;
  let adminAuth: string;
  let officerAuth: string;

  beforeAll(async () => {
    const admin = await createLiveAuthenticatedUser('ADMIN');
    adminId = admin.id;
    adminAuth = admin.authHeader;
    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/users', () => {
    it('lists users without ever including a password hash', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/users').set('Authorization', adminAuth).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/users').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/users').expect(401);
    });

    it('excludes citizen sign-in accounts - this list is for officer/admin account management', async () => {
      const email = `live-excluded-citizen-${Date.now()}@test.com`;
      const result = await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, false, false, 'x', 0, 'A Citizen', 'CITIZEN', 0, 0) RETURNING id`,
        [email],
      );
      const citizenId = result.rows[0].id;

      const res = await request(LIVE_BASE_URL).get('/api/v1/users').set('Authorization', adminAuth).expect(200);
      expect(res.body.some((u: { id: string }) => u.id === citizenId)).toBe(false);
    });
  });

  describe('POST /api/v1/users', () => {
    it('creates a new officer account and logs a USER_CREATED audit entry', async () => {
      const email = `live-new.officer-${Date.now()}@test.gov.in`;
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', adminAuth)
        .send({ email, password: 'SecurePass123', name: 'New Officer', role: 'PLANNING_OFFICER' })
        .expect(201);

      expect(res.body.role).toBe('PLANNING_OFFICER');
      expect(res.body).not.toHaveProperty('passwordHash');

      const createdUser = (await pgPool.query('SELECT password_hash FROM users WHERE email = $1', [email])).rows[0];
      expect(createdUser).toBeTruthy();
      expect(createdUser.password_hash).not.toBe('SecurePass123');

      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['USER_CREATED', res.body.id])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('rejects a duplicate email with 409', async () => {
      const email = `live-dup-${Date.now()}@test.gov.in`;
      await request(LIVE_BASE_URL).post('/api/v1/users').set('Authorization', adminAuth).send({ email, password: 'SecurePass123', name: 'First', role: 'PLANNING_OFFICER' });
      await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', adminAuth)
        .send({ email, password: 'AnotherPass123', name: 'Duplicate', role: 'PLANNING_OFFICER' })
        .expect(409);
    });

    it('rejects a password shorter than 8 characters with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', adminAuth)
        .send({ email: `live-short-${Date.now()}@test.gov.in`, password: 'short', name: 'X', role: 'PLANNING_OFFICER' })
        .expect(400);
    });

    it('rejects a long-enough password with no uppercase/digit complexity, with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', adminAuth)
        .send({ email: `live-weak-${Date.now()}@test.gov.in`, password: 'alllowercase', name: 'X', role: 'PLANNING_OFFICER' })
        .expect(400);
    });

    it('rejects an invalid role with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', adminAuth)
        .send({ email: `live-badrole-${Date.now()}@test.gov.in`, password: 'SecurePass123', name: 'X', role: 'SUPER_ADMIN' })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/users')
        .set('Authorization', officerAuth)
        .send({ email: `live-blocked-${Date.now()}@test.gov.in`, password: 'SecurePass123', name: 'X', role: 'PLANNING_OFFICER' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/users/:id/role', () => {
    it("changes a user's role and logs a USER_ROLE_CHANGED audit entry", async () => {
      const result = await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, true, false, 'x', 0, 'Role Target', 'PLANNING_OFFICER', 0, 0) RETURNING id`,
        [`live-role-change-${Date.now()}@test.gov.in`],
      );
      const targetId = result.rows[0].id;

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/users/${targetId}/role`)
        .set('Authorization', adminAuth)
        .send({ role: 'DISPUTE_OFFICER' })
        .expect(200);
      expect(res.body.role).toBe('DISPUTE_OFFICER');

      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['USER_ROLE_CHANGED', targetId])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('rejects an admin changing their own role with 400', async () => {
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/users/${adminId}/role`)
        .set('Authorization', adminAuth)
        .send({ role: 'PLANNING_OFFICER' })
        .expect(400);
    });

    it('returns 404 for an unknown user', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000/role')
        .set('Authorization', adminAuth)
        .send({ role: 'PLANNING_OFFICER' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('deletes a user account and logs a USER_DELETED audit entry', async () => {
      const result = await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, true, false, 'x', 0, 'Delete Target', 'PLANNING_OFFICER', 0, 0) RETURNING id`,
        [`live-to-delete-${Date.now()}@test.gov.in`],
      );
      const targetId = result.rows[0].id;

      await request(LIVE_BASE_URL).delete(`/api/v1/users/${targetId}`).set('Authorization', adminAuth).expect(204);

      const stillThere = (await pgPool.query('SELECT 1 FROM users WHERE id = $1', [targetId])).rows[0];
      expect(stillThere).toBeUndefined();
      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['USER_DELETED', targetId])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('rejects an admin deleting their own account with 400', async () => {
      await request(LIVE_BASE_URL).delete(`/api/v1/users/${adminId}`).set('Authorization', adminAuth).expect(400);
    });

    it('returns 404 for an unknown user', async () => {
      await request(LIVE_BASE_URL)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .expect(404);
    });
  });
});
