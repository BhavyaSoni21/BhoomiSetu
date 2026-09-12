// Live-server counterpart of backend/test/governance-alerts.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping and fixture seeding
// (TypeORM repositories -> raw SQL against backend-py's own database)
// changed. The original's SQLite-second-resolution sleep-1.1s-between-
// inserts workaround is dropped - Postgres has microsecond resolution,
// so distinct explicit created_at timestamps give the same deterministic
// ordering. Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Governance Alerts (live backend-py e2e)', () => {
  let floodAlertId: string;
  let changeAlertId: string;
  let taxAlertId: string;
  let officerAuth: string;
  let restrictionOfficerId: string;

  async function freshAlert(parcelId: string, status = 'OPEN'): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
       VALUES (gen_random_uuid(), $1, 'RESTRICTION_ZONE_OVERLAP', 'MEDIUM', 'RESTRICTION_MONITOR', $2, 'Parcel intersects a restriction zone.', now())
       RETURNING id`,
      [parcelId, status],
    );
    return result.rows[0].id;
  }

  beforeAll(async () => {
    const now = Date.now();
    const floodResult = await pgPool.query(
      `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
       VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'RESTRICTION_ZONE_OVERLAP', 'MEDIUM', 'RESTRICTION_MONITOR', 'OPEN', 'Parcel intersects the flood restriction zone.', to_timestamp($1))
       RETURNING id`,
      [(now - 2000) / 1000],
    );
    floodAlertId = floodResult.rows[0].id;
    const changeResult = await pgPool.query(
      `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
       VALUES (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'UNAUTHORIZED_CHANGE_DETECTED', 'HIGH', 'CHANGE_DETECTION', 'OPEN', 'New construction footprint detected.', to_timestamp($1))
       RETURNING id`,
      [(now - 1000) / 1000],
    );
    changeAlertId = changeResult.rows[0].id;
    const taxResult = await pgPool.query(
      `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
       VALUES (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'TAX_OVERDUE', 'LOW', 'TAX_MONITOR', 'RESOLVED', 'Outstanding property tax of 500 is overdue.', now())
       RETURNING id`,
    );
    taxAlertId = taxResult.rows[0].id;

    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
    restrictionOfficerId = (await createLiveAuthenticatedUser('RESTRICTION_OFFICER')).id;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/governance-alerts', () => {
    it('lists every alert, newest first', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/governance-alerts').set('Authorization', officerAuth).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body[0].id).toBe(taxAlertId); // most recently created
    });

    it('filters by status', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/governance-alerts?status=OPEN').set('Authorization', officerAuth).expect(200);
      const ids = res.body.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining([floodAlertId, changeAlertId]));
      expect(ids).not.toContain(taxAlertId);
    });

    it('filters by status=ACTIVE (a pseudo-status meaning "not RESOLVED/DISMISSED")', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/governance-alerts?status=ACTIVE').set('Authorization', officerAuth).expect(200);
      const ids = res.body.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining([floodAlertId, changeAlertId]));
      expect(ids).not.toContain(taxAlertId);
    });

    it('filters by severity', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/governance-alerts?severity=HIGH').set('Authorization', officerAuth).expect(200);
      // The live database can hold other real HIGH-severity alerts (from
      // scripts/seed.py) alongside this spec's own fixture - assert
      // presence and shape, not an exact singleton list, unlike the
      // original's fresh-per-run empty database.
      expect(res.body.some((a: any) => a.id === changeAlertId)).toBe(true);
      expect(res.body.every((a: any) => a.severity === 'HIGH')).toBe(true);
    });

    it('combines status and severity filters', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/governance-alerts?status=OPEN&severity=LOW').set('Authorization', officerAuth).expect(200);
      expect(res.body.some((a: any) => [floodAlertId, changeAlertId, taxAlertId].includes(a.id))).toBe(false);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/governance-alerts').expect(401);
    });
  });

  describe('GET /api/v1/governance-alerts/:id', () => {
    it('returns a single alert', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/governance-alerts/${floodAlertId}`).set('Authorization', officerAuth).expect(200);
      expect(res.body.alertType).toBe('RESTRICTION_ZONE_OVERLAP');
      expect(res.body.explanation).toContain('flood');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/governance-alerts/not-a-uuid').set('Authorization', officerAuth).expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000').set('Authorization', officerAuth).expect(404);
    });
  });

  describe('PATCH /api/v1/governance-alerts/:id/status - 4-stage verification', () => {
    it('advances an alert through all 4 stages, notifying the department only on the final RESOLVED transition', async () => {
      const alertId = await freshAlert('44444444-4444-4444-4444-444444444444');

      const ack = await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: 'Looking into this now.' })
        .expect(200);
      expect(ack.body.status).toBe('ACKNOWLEDGED');
      expect((await pgPool.query('SELECT 1 FROM notifications WHERE alert_id = $1', [alertId])).rows).toHaveLength(0);

      const verified = await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'FIELD_VERIFIED', reason: 'Confirmed on-site - the restriction is real.' })
        .expect(200);
      expect(verified.body.status).toBe('FIELD_VERIFIED');
      expect((await pgPool.query('SELECT 1 FROM notifications WHERE alert_id = $1', [alertId])).rows).toHaveLength(0);

      const resolved = await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'RESOLVED', reason: 'Restriction survey team addressed the overlap.' })
        .expect(200);
      expect(resolved.body.status).toBe('RESOLVED');
      expect(resolved.body.reason).toBe('Restriction survey team addressed the overlap.');

      // RESTRICTION_ZONE_OVERLAP derives to the RESTRICTION department -
      // its officer, not the LAND_RECORD_OFFICER who resolved it, gets notified.
      const notification = (
        await pgPool.query('SELECT message FROM notifications WHERE user_id = $1 AND type = $2 AND alert_id = $3', [restrictionOfficerId, 'GOVERNANCE_ALERT_RESOLVED', alertId])
      ).rows[0];
      expect(notification).toBeTruthy();
      expect(notification.message).toContain('Restriction survey team addressed the overlap');
    });

    it('lets DISMISSED short-circuit from a non-terminal stage, and notifies on dismissal', async () => {
      const alertId = await freshAlert('55555555-5555-5555-5555-555555555555', 'ACKNOWLEDGED');

      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: 'Duplicate of an already-resolved alert.' })
        .expect(200);
      expect(res.body.status).toBe('DISMISSED');

      const notification = (
        await pgPool.query('SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 AND alert_id = $3', [restrictionOfficerId, 'GOVERNANCE_ALERT_DISMISSED', alertId])
      ).rows[0];
      expect(notification).toBeTruthy();
    });

    it('rejects skipping a stage (OPEN straight to FIELD_VERIFIED) with 400', async () => {
      const alertId = await freshAlert('66666666-6666-6666-6666-666666666666');
      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'FIELD_VERIFIED', reason: 'x' })
        .expect(400);
      expect(res.body.message).toContain('OPEN');
    });

    it('rejects skipping straight from OPEN to RESOLVED with 400', async () => {
      const alertId = await freshAlert('77777777-7777-7777-7777-777777777777');
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'RESOLVED', reason: 'x' })
        .expect(400);
    });

    it('rejects any further PATCH on a terminal (RESOLVED) alert with 400', async () => {
      const alertId = await freshAlert('88888888-8888-8888-8888-888888888888', 'RESOLVED');
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: 'x' })
        .expect(400);
    });

    it('rejects an invalid status value with 400', async () => {
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${floodAlertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'NOT_A_REAL_STATUS', reason: 'x' })
        .expect(400);
    });

    it('rejects a missing reason with 400', async () => {
      const alertId = await freshAlert('99999999-9999-9999-9999-999999999999');
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED' })
        .expect(400);
    });

    it('rejects an empty-string reason with 400', async () => {
      const alertId = await freshAlert('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${alertId}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: '' })
        .expect(400);
    });

    it('returns 404 for an unknown alert', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: 'x' })
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/governance-alerts/${floodAlertId}/status`)
        .send({ status: 'ACKNOWLEDGED', reason: 'x' })
        .expect(401);
    });
  });
});
