// Live-server counterpart of backend/test/auth.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Deliberate
// scope reduction, disclosed rather than silently dropped: the original
// mocks SmsService/EmailService via Nest's overrideProvider to test the
// registration/OTP flows deterministically. A running backend-py
// instance has no equivalent override seam - its OTP codes are real,
// generated server-side, and (in dev) never actually delivered anywhere
// this harness can read. So the registration/OTP-verification/
// resend-otp/profile-contact-with-OTP describe blocks are NOT ported
// here; this file only covers what's reachable without knowing a
// server-generated OTP: login, /auth/me, and logout - already fully
// exercised end-to-end by every other live spec's createLiveAuthenticatedUser
// helper, but asserted directly and completely here. Requires backend-py
// to already be up - see live-client.ts.
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Auth (live backend-py e2e)', () => {
  let officerEmail: string;
  let officerId: string;

  beforeAll(async () => {
    officerEmail = `live-officer-${Date.now()}@test.gov.in`;
    const result = await pgPool.query(
      `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
       VALUES (gen_random_uuid(), $1, true, false, $2, 0, 'Live Test Officer', 'LAND_RECORD_OFFICER', 0, 0) RETURNING id`,
      [officerEmail, bcrypt.hashSync('CorrectPass1', 10)],
    );
    officerId = result.rows[0].id;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials and returns a token plus the public user shape', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/auth/login')
        .send({ email: officerEmail, password: 'CorrectPass1' })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(10);
      expect(res.body.user).toMatchObject({
        id: officerId,
        email: officerEmail,
        emailVerified: true,
        mobileVerified: false,
        name: 'Live Test Officer',
        role: 'LAND_RECORD_OFFICER',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it('rejects an incorrect password with 401', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email: officerEmail, password: 'WrongPassword' }).expect(401);
    });

    it('rejects an unknown email with 401', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email: 'live-nobody@test.gov.in', password: 'CorrectPass1' }).expect(401);
    });

    it('rejects a malformed email with 400 (DTO validation)', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email: 'not-an-email', password: 'CorrectPass1' }).expect(400);
    });

    it('rejects a missing password with 400 (DTO validation)', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email: officerEmail }).expect(400);
    });

    it('rejects a request with neither email nor mobileNumber, with 400', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ password: 'CorrectPass1' }).expect(400);
    });

    it('logs in a citizen with mobileNumber + password (docs/FRONTEND_UPGRADE_SPEC.md §3)', async () => {
      await pgPool.query(
        `INSERT INTO users (id, email, mobile_number, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, '9000000091', false, true, $2, 0, 'Live Mobile Citizen', 'CITIZEN', 0, 0)`,
        [`live-mobile-citizen-${Date.now()}@test.com`, bcrypt.hashSync('CorrectPass1', 10)],
      );

      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/auth/login')
        .send({ mobileNumber: '9000000091', password: 'CorrectPass1' })
        .expect(200);

      expect(res.body.user).toEqual(
        expect.objectContaining({ mobileNumber: '9000000091', mobileVerified: true, role: 'CITIZEN' }),
      );
    });

    it('rejects a malformed mobileNumber with 400 (DTO validation)', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ mobileNumber: '123', password: 'CorrectPass1' }).expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('rejects a request with no Authorization header', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/auth/me').expect(401);
    });

    it('rejects a garbage token', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-real-token').expect(401);
    });

    it('returns the current user for a valid token', async () => {
      const loginRes = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email: officerEmail, password: 'CorrectPass1' }).expect(200);

      const res = await request(LIVE_BASE_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: officerId, email: officerEmail, name: 'Live Test Officer', role: 'LAND_RECORD_OFFICER' });
    });

    it('rejects a token whose user has since been deleted (looks the user up fresh, not just the token payload)', async () => {
      const email = `live-temp-${Date.now()}@test.gov.in`;
      const result = await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, true, false, $2, 0, 'Temp Officer', 'PLANNING_OFFICER', 0, 0) RETURNING id`,
        [email, bcrypt.hashSync('CorrectPass1', 10)],
      );
      const shortLivedId = result.rows[0].id;

      const loginRes = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password: 'CorrectPass1' }).expect(200);

      await pgPool.query('DELETE FROM users WHERE id = $1', [shortLivedId]);

      await request(LIVE_BASE_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(401);
    });
  });

  // KNOWN_RISKS.md HIGH-2: logout must actually end the session server-side
  // (bump tokenVersion), not just be a client-side localStorage clear the
  // old token survives.
  describe('POST /api/v1/auth/logout', () => {
    it('rejects a request with no Authorization header', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/logout').expect(401);
    });

    it('invalidates the token used to call it, and every other outstanding token for that account', async () => {
      const email = `live-logout-${Date.now()}@test.gov.in`;
      await pgPool.query(
        `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
         VALUES (gen_random_uuid(), $1, true, false, $2, 0, 'Logout Test', 'PLANNING_OFFICER', 0, 0)`,
        [email, bcrypt.hashSync('CorrectPass1', 10)],
      );

      const firstLogin = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password: 'CorrectPass1' }).expect(200);
      const secondLogin = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password: 'CorrectPass1' }).expect(200);

      await request(LIVE_BASE_URL).get('/api/v1/auth/me').set('Authorization', `Bearer ${firstLogin.body.accessToken}`).expect(200);

      await request(LIVE_BASE_URL).post('/api/v1/auth/logout').set('Authorization', `Bearer ${firstLogin.body.accessToken}`).expect(200);

      await request(LIVE_BASE_URL).get('/api/v1/auth/me').set('Authorization', `Bearer ${firstLogin.body.accessToken}`).expect(401);
      await request(LIVE_BASE_URL).get('/api/v1/auth/me').set('Authorization', `Bearer ${secondLogin.body.accessToken}`).expect(401);

      const thirdLogin = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password: 'CorrectPass1' }).expect(200);
      await request(LIVE_BASE_URL).get('/api/v1/auth/me').set('Authorization', `Bearer ${thirdLogin.body.accessToken}`).expect(200);
    });
  });

  describe('POST /api/v1/auth/profile/details', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/auth/profile/details').send({ occupation: 'Farmer' }).expect(401);
    });

    it('allows a staff account to update their own profile details (widened 2026-09-10, docs/ADMIN_PANEL_ISSUES.md Officer #2)', async () => {
      const { authHeader } = await createLiveAuthenticatedUser('LAND_RECORD_OFFICER');

      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/auth/profile/details')
        .set('Authorization', authHeader)
        .send({ occupation: 'Senior Land Record Officer' })
        .expect(201);

      expect(res.body.occupation).toBe('Senior Land Record Officer');
    });

    it('partially updates only the fields sent, leaving the rest untouched', async () => {
      const { authHeader } = await createLiveAuthenticatedUser('LAND_RECORD_OFFICER');
      await request(LIVE_BASE_URL)
        .post('/api/v1/auth/profile/details')
        .set('Authorization', authHeader)
        .send({ occupation: 'Teacher' })
        .expect(201);

      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/auth/profile/details')
        .set('Authorization', authHeader)
        .send({ address: '5 Park Street' })
        .expect(201);

      expect(res.body.occupation).toBe('Teacher');
      expect(res.body.address).toBe('5 Park Street');
    });
  });
});
