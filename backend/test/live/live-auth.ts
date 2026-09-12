import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { LIVE_BASE_URL, pgPool } from './live-client';

let counter = 0;

// Mints a real, already-verified staff account directly in backend-py's
// own database (officer/admin accounts are always admin-provisioned in
// both the original and here, never self-registered) and logs in through
// the real, live POST /auth/login - never fabricates a token
// independently, so this exercises backend-py's actual bcrypt
// verification + JWT issuance, not just this harness's idea of what a
// valid token looks like. Doubles as a live cross-language bcrypt check:
// bcryptjs hashes the password here, Python's bcrypt verifies it there.
export async function createLiveAuthenticatedUser(role: string): Promise<{ id: string; email: string; authHeader: string }> {
  const n = ++counter;
  const email = `live-test-${role.toLowerCase()}-${Date.now()}-${n}@test.gov.in`;
  const password = 'LiveTestPass1';
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = await pgPool.query(
    `INSERT INTO users (id, email, email_verified, mobile_verified, password_hash, token_version, name, role, email_otp_attempts, sms_otp_attempts)
     VALUES (gen_random_uuid(), $1, true, false, $2, 0, $3, $4, 0, 0)
     RETURNING id`,
    [email, passwordHash, `Live Test ${role}`, role],
  );
  const id = result.rows[0].id as string;

  const loginRes = await request(LIVE_BASE_URL).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return { id, email, authHeader: `Bearer ${loginRes.body.accessToken}` };
}
