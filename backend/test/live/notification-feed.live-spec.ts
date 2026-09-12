// Live-server counterpart of backend/test/notification-feed.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping and fixture seeding
// (TypeORM repositories -> raw SQL against backend-py's own database)
// changed. Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Notification Feed (live backend-py e2e)', () => {
  let citizenAuth: string;
  let citizenId: string;
  let otherCitizenAuth: string;
  let ownNotificationId: string;

  beforeAll(async () => {
    const citizen = await createLiveAuthenticatedUser('CITIZEN');
    citizenAuth = citizen.authHeader;
    citizenId = citizen.id;
    otherCitizenAuth = (await createLiveAuthenticatedUser('CITIZEN')).authHeader;

    await pgPool.query('DELETE FROM notifications WHERE user_id IN ($1, $2)', [citizenId, 'live-someone-else']);

    const ownResult = await pgPool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, parcel_id, workflow_id, alert_id, read, created_at)
       VALUES (gen_random_uuid(), $1, 'WORKFLOW_STEP_APPROVED', 'Your request was approved', 'Land Records approved your request.', 'p1', 'w1', NULL, false, now())
       RETURNING id`,
      [citizenId],
    );
    ownNotificationId = ownResult.rows[0].id;

    // Belongs to a different user - every test below confirms this never
    // leaks into citizenAuth's own feed or read-mark.
    await pgPool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
       VALUES (gen_random_uuid(), 'live-someone-else', 'WORKFLOW_ASSIGNED', 'Not yours', 'x', false, now())`,
    );
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/notifications', () => {
    it("returns only the signed-in user's own notifications", async () => {
      const res = await request(LIVE_BASE_URL)
        .get('/api/v1/notifications')
        .set('Authorization', citizenAuth)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ownNotificationId);
      expect(res.body[0].title).toBe('Your request was approved');
    });

    it('returns an empty array for a user with no notifications', async () => {
      const res = await request(LIVE_BASE_URL)
        .get('/api/v1/notifications')
        .set('Authorization', otherCitizenAuth)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/notifications').expect(401);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('marks a notification read', async () => {
      const res = await request(LIVE_BASE_URL)
        .patch(`/api/v1/notifications/${ownNotificationId}/read`)
        .set('Authorization', citizenAuth)
        .expect(200);
      expect(res.body.read).toBe(true);
    });

    it("returns 404 for a notification that belongs to a different user (never leaks another user's row)", async () => {
      await request(LIVE_BASE_URL)
        .patch(`/api/v1/notifications/${ownNotificationId}/read`)
        .set('Authorization', otherCitizenAuth)
        .expect(404);
    });

    it('returns 404 for an unknown notification', async () => {
      await request(LIVE_BASE_URL)
        .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', citizenAuth)
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).patch(`/api/v1/notifications/${ownNotificationId}/read`).expect(401);
    });
  });
});
