// Live-server counterpart of backend/test/admin-departments.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping and fixture seeding
// (TypeORM repositories -> raw SQL against backend-py's own database)
// changed. Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Admin Departments (live backend-py e2e)', () => {
  let adminAuth: string;
  let officerAuth: string;

  beforeAll(async () => {
    adminAuth = (await createLiveAuthenticatedUser('ADMIN')).authHeader;
    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/admin/departments', () => {
    it('lists departments ordered by name', async () => {
      const suffix = Date.now();
      await pgPool.query(`INSERT INTO departments (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, now(), now())`, [`LIVE_ZZZ_${suffix}`, `Zzz Live Department ${suffix}`]);
      await pgPool.query(`INSERT INTO departments (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, now(), now())`, [`LIVE_AAA_${suffix}`, `Aaa Live Department ${suffix}`]);

      const res = await request(LIVE_BASE_URL).get('/api/v1/admin/departments').set('Authorization', adminAuth).expect(200);
      const names = res.body.map((d: { name: string }) => d.name);
      expect(names.indexOf(`Aaa Live Department ${suffix}`)).toBeLessThan(names.indexOf(`Zzz Live Department ${suffix}`));
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/admin/departments').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/admin/departments').expect(401);
    });
  });

  describe('POST /api/v1/admin/departments', () => {
    it('creates a department and logs a DEPARTMENT_CREATED audit entry', async () => {
      const code = `LIVE_TAX_${Date.now()}`;
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code, name: 'Tax Department', description: 'Property tax assessment and collection', contactEmail: 'tax@bhoomisetu.gov.in' })
        .expect(201);

      expect(res.body.code).toBe(code);
      expect(res.body.name).toBe('Tax Department');

      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['DEPARTMENT_CREATED', res.body.id])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('rejects a duplicate code with 409', async () => {
      const code = `LIVE_DUP_${Date.now()}`;
      await request(LIVE_BASE_URL).post('/api/v1/admin/departments').set('Authorization', adminAuth).send({ code, name: 'First' }).expect(201);
      await request(LIVE_BASE_URL).post('/api/v1/admin/departments').set('Authorization', adminAuth).send({ code, name: 'Duplicate' }).expect(409);
    });

    it('rejects a missing name with 400', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/admin/departments').set('Authorization', adminAuth).send({ code: `LIVE_NO_NAME_${Date.now()}` }).expect(400);
    });

    it('rejects an invalid contact email with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code: `LIVE_BAD_EMAIL_${Date.now()}`, name: 'Bad Email Dept', contactEmail: 'not-an-email' })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/admin/departments')
        .set('Authorization', officerAuth)
        .send({ code: `LIVE_BLOCKED_${Date.now()}`, name: 'Blocked Dept' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/admin/departments/:id', () => {
    it('updates a department and logs a DEPARTMENT_UPDATED audit entry', async () => {
      const result = await pgPool.query(
        `INSERT INTO departments (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), $1, 'Planning Old Name', now(), now()) RETURNING id`,
        [`LIVE_PLANNING_${Date.now()}`],
      );
      const targetId = result.rows[0].id;

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/admin/departments/${targetId}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Planning Department', description: 'Zoning and master plan oversight' })
        .expect(200);

      expect(res.body.name).toBe('Planning Department');
      expect(res.body.description).toBe('Zoning and master plan oversight');

      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['DEPARTMENT_UPDATED', targetId])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('returns 404 for an unknown department', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/admin/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ name: 'Unknown Target' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/admin/departments/:id', () => {
    it('deletes a department and logs a DEPARTMENT_DELETED audit entry', async () => {
      const result = await pgPool.query(
        `INSERT INTO departments (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), $1, 'To Delete', now(), now()) RETURNING id`,
        [`LIVE_TO_DELETE_${Date.now()}`],
      );
      const targetId = result.rows[0].id;

      await request(LIVE_BASE_URL).delete(`/api/v1/admin/departments/${targetId}`).set('Authorization', adminAuth).expect(204);

      const stillThere = (await pgPool.query('SELECT 1 FROM departments WHERE id = $1', [targetId])).rows[0];
      expect(stillThere).toBeUndefined();
      const auditEntry = (await pgPool.query('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['DEPARTMENT_DELETED', targetId])).rows[0];
      expect(auditEntry).toBeTruthy();
    });

    it('returns 404 for an unknown department', async () => {
      await request(LIVE_BASE_URL).delete('/api/v1/admin/departments/00000000-0000-0000-0000-000000000000').set('Authorization', adminAuth).expect(404);
    });
  });
});
