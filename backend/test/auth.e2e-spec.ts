process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { PendingRegistration } from '../src/auth/pending-registration.entity';
import { SmsService } from '../src/notifications/sms.service';
import { EmailService } from '../src/notifications/email.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let pendingRegistrationRepository: Repository<PendingRegistration>;
  let officerUser: User;

  // SmsService/EmailService are real external-API wrappers with nothing
  // configured in the test env (no TEXTBEE_API_KEY/MAIL_HOST) - overridden
  // here with mocks so registration/OTP flows are testable without a live
  // TextBee device or SMTP server, same purpose as ai.e2e-spec.ts's
  // `jest.mock('openai')` for GroqService, just via Nest's own
  // overrideProvider since these are plain injectable classes.
  //
  // TextBee is send-only, so the real SmsService generates+hashes the code
  // itself and hands AuthService {codeHash, expiresAt, sentAt} to persist,
  // then verifies later via a pure local bcrypt compare (no network call) -
  // mockSendOtp/mockVerifyOtp mirror that exact contract (real bcrypt
  // against a fixed known code) rather than the old "provider verifies its
  // own code" shape, so this exercises the same hash-then-compare path a
  // real SmsService would.
  const MOCK_SMS_OTP_CODE = '654321';
  const mockSendOtp = jest.fn().mockImplementation(async () => ({
    codeHash: bcrypt.hashSync(MOCK_SMS_OTP_CODE, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    sentAt: new Date(),
  }));
  const mockVerifyOtp = jest
    .fn()
    .mockImplementation((storedHash: string | null, storedExpiresAt: Date | null, attempts: number, code: string) => {
      if (attempts >= 5) return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
      if (!storedHash || !storedExpiresAt || storedExpiresAt.getTime() < Date.now()) return { valid: false, reason: 'EXPIRED' };
      if (!bcrypt.compareSync(code, storedHash)) return { valid: false, reason: 'WRONG_CODE' };
      return { valid: true };
    });
  const mockSendOtpEmail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SmsService)
      .useValue({ sendOtp: mockSendOtp, verifyOtp: mockVerifyOtp, isConfigured: true, resendCooldownSeconds: 30 })
      .overrideProvider(EmailService)
      .useValue({ sendOtpEmail: mockSendOtpEmail, isConfigured: true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    pendingRegistrationRepository = moduleFixture.get(getRepositoryToken(PendingRegistration));

    officerUser = await userRepository.save({
      email: 'officer@test.gov.in',
      passwordHash: bcrypt.hashSync('CorrectPass1', 10),
      name: 'Test Officer',
      role: 'LAND_RECORD_OFFICER',
      emailVerified: true,
    });
  });

  afterEach(() => {
    // mockClear() only resets call history, not the mockImplementation set
    // above - both keep their real bcrypt-based behavior across tests.
    mockSendOtp.mockClear();
    mockVerifyOtp.mockClear();
    mockSendOtpEmail.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  // The only way to get a real, already-verified citizen account now (per
  // the user's explicit "the account should not be created until the number
  // or the email is verified") - stages a PendingRegistration via
  // POST /auth/register, then completes it via POST /auth/register/verify-otp
  // with whichever code the mock actually captured/generated.
  async function registerAndVerifyCitizen(overrides: Record<string, unknown> = {}) {
    const method = (overrides.method as string) ?? 'EMAIL';
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Verify Test',
        method: 'EMAIL',
        email: `verify-${Date.now()}-${Math.random()}@example.com`,
        password: 'Password1',
        confirmPassword: 'Password1',
        ...overrides,
      })
      .expect(201);

    const registrationId = registerRes.body.registrationId as string;
    const code =
      method === 'MOBILE' ? MOCK_SMS_OTP_CODE : mockSendOtpEmail.mock.calls[mockSendOtpEmail.mock.calls.length - 1][1];

    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register/verify-otp')
      .send({ registrationId, code })
      .expect(201);

    return { token: verifyRes.body.accessToken as string, user: verifyRes.body.user, registrationId };
  }

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials and returns a token plus the public user shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(10);
      expect(res.body.user).toEqual({
        id: officerUser.id,
        email: 'officer@test.gov.in',
        mobileNumber: null,
        emailVerified: true,
        mobileVerified: false,
        pendingEmail: null,
        pendingMobileNumber: null,
        name: 'Test Officer',
        role: 'LAND_RECORD_OFFICER',
        address: null,
        governmentIdNumber: null,
        occupation: null,
        createdAt: officerUser.createdAt.toISOString(),
      });
      // The password hash must never leave the server in any response.
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
      expect(JSON.stringify(res.body)).not.toContain(bcrypt.hashSync('CorrectPass1', 10).substring(0, 10));
    });

    it('rejects an incorrect password with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'WrongPassword' })
        .expect(401);
    });

    it('rejects an unknown email with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.gov.in', password: 'CorrectPass1' })
        .expect(401);
    });

    it('rejects a malformed email with 400 (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'CorrectPass1' })
        .expect(400);
    });

    it('rejects a missing password with 400 (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in' })
        .expect(400);
    });

    it('rejects a request with neither email nor mobileNumber, with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: 'CorrectPass1' })
        .expect(400);
    });

    it('logs in a citizen with mobileNumber + password (docs/FRONTEND_UPGRADE_SPEC.md §3)', async () => {
      await userRepository.save({
        mobileNumber: '9000000001',
        passwordHash: bcrypt.hashSync('CorrectPass1', 10),
        name: 'Mobile Citizen',
        role: 'CITIZEN',
        mobileVerified: true,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ mobileNumber: '9000000001', password: 'CorrectPass1' })
        .expect(201);

      expect(res.body.user).toEqual(
        expect.objectContaining({ mobileNumber: '9000000001', mobileVerified: true, role: 'CITIZEN' }),
      );
    });

    it('rejects a malformed mobileNumber with 400 (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ mobileNumber: '123', password: 'CorrectPass1' })
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('rejects a request with no Authorization header', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('rejects a garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns the current user for a valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: officerUser.id,
        email: 'officer@test.gov.in',
        mobileNumber: null,
        emailVerified: true,
        mobileVerified: false,
        pendingEmail: null,
        pendingMobileNumber: null,
        name: 'Test Officer',
        role: 'LAND_RECORD_OFFICER',
        address: null,
        governmentIdNumber: null,
        occupation: null,
        createdAt: officerUser.createdAt.toISOString(),
      });
    });

    it('rejects a token whose user has since been deleted (looks the user up fresh, not just the token payload)', async () => {
      const shortLived = await userRepository.save({
        email: 'temp@test.gov.in',
        passwordHash: bcrypt.hashSync('CorrectPass1', 10),
        name: 'Temp Officer',
        role: 'PLANNING_OFFICER',
      });
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'temp@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      await userRepository.delete({ id: shortLived.id });

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(401);
    });
  });

  // Per the user's explicit "the account should not be created until the
  // number or the email is verified" - this only stages a
  // PendingRegistration and sends its first OTP. No User row, no
  // accessToken, until POST /auth/register/verify-otp succeeds (below).
  describe('POST /api/v1/auth/register', () => {
    it('stages a pending registration for email, sends an OTP email, and creates no account yet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'New Citizen', method: 'EMAIL', email: 'newcitizen@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      expect(typeof res.body.registrationId).toBe('string');
      expect(res.body).toEqual({ registrationId: res.body.registrationId, method: 'EMAIL', target: 'newcitizen@example.com' });
      expect(res.body.accessToken).toBeUndefined();
      expect(mockSendOtpEmail).toHaveBeenCalledWith('newcitizen@example.com', expect.any(String));
      expect(mockSendOtp).not.toHaveBeenCalled();

      expect(await userRepository.findOneBy({ email: 'newcitizen@example.com' })).toBeNull();
      expect(await pendingRegistrationRepository.findOneBy({ email: 'newcitizen@example.com' })).not.toBeNull();
    });

    it('stages a pending registration for mobile and sends an SMS OTP, creating no account yet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Mobile Citizen', method: 'MOBILE', mobileNumber: '9111111111', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      expect(res.body).toEqual({ registrationId: res.body.registrationId, method: 'MOBILE', target: '9111111111' });
      expect(mockSendOtp).toHaveBeenCalledWith('9111111111');
      expect(mockSendOtpEmail).not.toHaveBeenCalled();
      expect(await userRepository.findOneBy({ mobileNumber: '9111111111' })).toBeNull();
    });

    it('rejects mismatched password/confirmPassword with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', email: 'mismatch@example.com', password: 'Password1', confirmPassword: 'Different1' })
        .expect(400);
    });

    it('rejects a duplicate email with 409 (a real conflict, not a malformed request)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', email: 'officer@test.gov.in', password: 'Password1', confirmPassword: 'Password1' })
        .expect(409);
    });

    it('rejects registering a mobile number that already belongs to a real, verified account, with 409', async () => {
      await registerAndVerifyCitizen({ method: 'MOBILE', mobileNumber: '9222222222', email: undefined });

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X2', method: 'MOBILE', mobileNumber: '9222222222', password: 'Password1', confirmPassword: 'Password1' })
        .expect(409);
    });

    // No account exists yet for either attempt, so a second unfinished
    // attempt for the same contact isn't a conflict - it replaces the first
    // (AuthService.register), covering "typo'd the email, never got the
    // code, tried again" without a dead-end 409.
    it('replaces an unfinished pending registration for the same email rather than rejecting it as a conflict', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'First Attempt', method: 'EMAIL', email: 'retry@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Second Attempt', method: 'EMAIL', email: 'retry@example.com', password: 'Password2', confirmPassword: 'Password2' })
        .expect(201);

      expect(second.body.registrationId).not.toBe(first.body.registrationId);
      // The first attempt's code no longer resolves to anything.
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId: first.body.registrationId, code: '123456' })
        .expect(400);
    });

    it('rejects method=EMAIL with no email field, with 400 (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', password: 'Password1', confirmPassword: 'Password1' })
        .expect(400);
    });

    it('rejects a password shorter than 8 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', email: 'short@example.com', password: 'Short1', confirmPassword: 'Short1' })
        .expect(400);
    });
  });

  // The only endpoint that actually creates a self-registered citizen's User
  // row - public (no account/JWT exists at this point), keyed by
  // registrationId rather than a signed-in user + method.
  describe('POST /api/v1/auth/register/verify-otp', () => {
    it('rejects an unknown registrationId with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId: '00000000-0000-0000-0000-000000000000', code: '123456' })
        .expect(400);
    });

    it('creates the account and a real session on the correct email code, and deletes the pending registration', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Email Verify', method: 'EMAIL', email: 'emailverify@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      const registrationId = registerRes.body.registrationId as string;
      const code = mockSendOtpEmail.mock.calls[0][1];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId, code })
        .expect(201);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toEqual(
        expect.objectContaining({ email: 'emailverify@example.com', emailVerified: true, mobileVerified: false, role: 'CITIZEN' }),
      );

      const createdUser = await userRepository.findOneBy({ email: 'emailverify@example.com' });
      expect(createdUser).not.toBeNull();
      expect(await pendingRegistrationRepository.findOneBy({ id: registrationId })).toBeNull();

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe('emailverify@example.com');
    });

    it('creates the account via SMS OTP for method=MOBILE', async () => {
      const { user } = await registerAndVerifyCitizen({ method: 'MOBILE', mobileNumber: '9333333333', email: undefined });

      expect(mockVerifyOtp).toHaveBeenCalled();
      expect(user.mobileNumber).toBe('9333333333');
      expect(user.mobileVerified).toBe(true);
      expect(user.emailVerified).toBe(false);
    });

    it('rejects an incorrect email code with 400, and creates no account', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Wrong Code', method: 'EMAIL', email: 'wrongcode@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId: registerRes.body.registrationId, code: '000000' })
        .expect(400);

      expect(await userRepository.findOneBy({ email: 'wrongcode@example.com' })).toBeNull();
    });

    it('rejects an expired email code with 400', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Expired Code', method: 'EMAIL', email: 'expiredcode@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      const registrationId = registerRes.body.registrationId as string;
      const code = mockSendOtpEmail.mock.calls[0][1];
      await pendingRegistrationRepository.update({ id: registrationId }, { otpExpiresAt: new Date(Date.now() - 1000) });

      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId, code })
        .expect(400);
    });

    it('locks out after too many incorrect attempts, with 403', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Lockout', method: 'EMAIL', email: 'lockout@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      const registrationId = registerRes.body.registrationId as string;
      await pendingRegistrationRepository.update({ id: registrationId }, { otpAttempts: 5 });

      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId, code: '000000' })
        .expect(403);
    });

    it('rejects when SmsService reports the mobile code as invalid, with 400', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Bad Mobile', method: 'MOBILE', mobileNumber: '9444444444', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId: registerRes.body.registrationId, code: '111111' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/register/resend-otp', () => {
    it('rejects an unknown registrationId with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/resend-otp')
        .send({ registrationId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });

    it('rejects a resend within the cooldown window, with 400', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Resend Test', method: 'EMAIL', email: `resend-${Date.now()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      // Registration itself already sent one email OTP moments ago.
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/resend-otp')
        .send({ registrationId: registerRes.body.registrationId })
        .expect(400);
    });

    it('sends a fresh code past the cooldown, which then verifies successfully', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Resend Test 2', method: 'EMAIL', email: `resend2-${Date.now()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      const registrationId = registerRes.body.registrationId as string;
      await pendingRegistrationRepository.update({ id: registrationId }, { otpSentAt: null });

      await request(app.getHttpServer())
        .post('/api/v1/auth/register/resend-otp')
        .send({ registrationId })
        .expect(201);

      const freshCode = mockSendOtpEmail.mock.calls[mockSendOtpEmail.mock.calls.length - 1][1];
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/verify-otp')
        .send({ registrationId, code: freshCode })
        .expect(201);
    });
  });

  // The signed-in-only verify/resend pair from here on - now exercised only
  // by an already-verified account adding/changing a contact method
  // (Profile), since self-registration's own first verification moved to
  // POST /auth/register/verify-otp above.
  describe('POST /api/v1/auth/verify-otp', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/verify-otp').send({ method: 'EMAIL', code: '123456' }).expect(401);
    });

    it('allows a staff account too (widened 2026-09-10, docs/ADMIN_PANEL_ISSUES.md Officer #2 - Officer Profile reuses this endpoint)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      // The role gate passes (not 403) and falls through to AuthService -
      // officerUser's email is already verified with no OTP ever issued, so
      // a bogus code correctly 400s as "no code to check against", proving
      // this reached real verification logic rather than being blocked.
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ method: 'EMAIL', code: '123456' })
        .expect(400);
    });

    it("verifies a citizen's newly-added second contact method (mobile, added after an email-verified signup)", async () => {
      const { token } = await registerAndVerifyCitizen();

      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9666600001' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', code: MOCK_SMS_OTP_CODE })
        .expect(201);

      expect(mockVerifyOtp).toHaveBeenCalled();
      expect(res.body.mobileVerified).toBe(true);
    });

    it('rejects an incorrect code for the added method with 400, leaving it unverified', async () => {
      const { token } = await registerAndVerifyCitizen();
      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9666600002' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', code: '000000' })
        .expect(400);

      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body.mobileVerified).toBe(false);
    });

    it('locks out after too many incorrect attempts, with 403', async () => {
      const { token, user } = await registerAndVerifyCitizen();
      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9666600003' })
        .expect(201);
      await userRepository.update({ id: user.id }, { smsOtpAttempts: 5 });

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', code: '000000' })
        .expect(403);
    });
  });

  describe('POST /api/v1/auth/resend-otp', () => {
    it('rejects a resend for a method with nothing on file, with 400', async () => {
      const { token } = await registerAndVerifyCitizen();

      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE' })
        .expect(400);
    });

    it('rejects a resend within the cooldown window, with 400', async () => {
      const { token } = await registerAndVerifyCitizen();
      // Adding a mobile number sends its own first OTP moments ago.
      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9666600004' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/profile/contact', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/profile/contact').send({ method: 'MOBILE', mobileNumber: '9555555555' }).expect(401);
    });

    it("adds a missing mobile number directly (the slot is empty - nothing to protect)", async () => {
      const { token } = await registerAndVerifyCitizen();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9666666666' })
        .expect(201);

      expect(res.body.mobileNumber).toBe('9666666666');
      expect(res.body.mobileVerified).toBe(false);
      expect(mockSendOtp).toHaveBeenCalledWith('9666666666');
    });

    it('still saves the contact value and returns 201 even when the OTP send itself fails (e.g. SMS/email gateway not configured)', async () => {
      const { token } = await registerAndVerifyCitizen();
      mockSendOtp.mockRejectedValueOnce(new Error('SMS delivery is not configured'));

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9888888888' })
        .expect(201);

      expect(res.body.mobileNumber).toBe('9888888888');
    });

    it('stages a changed, already-verified email as pending rather than overwriting it immediately', async () => {
      const { token, user } = await registerAndVerifyCitizen();

      const changeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', email: 'changed-address@example.com' })
        .expect(201);

      // The old, already-verified address is still the live one - the new
      // one only takes over once its own OTP is verified.
      expect(changeRes.body.email).toBe(user.email);
      expect(changeRes.body.emailVerified).toBe(true);

      const stagedCode = mockSendOtpEmail.mock.calls[mockSendOtpEmail.mock.calls.length - 1][1];
      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: stagedCode })
        .expect(201);

      expect(verifyRes.body.email).toBe('changed-address@example.com');
      expect(verifyRes.body.emailVerified).toBe(true);
    });

    it('rejects claiming an email already linked to another account, with 409 (a real conflict, not a malformed request)', async () => {
      const { token } = await registerAndVerifyCitizen();

      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', email: 'officer@test.gov.in' })
        .expect(409);
    });

    it('allows a staff account to add their own missing mobile number too (widened 2026-09-10, docs/ADMIN_PANEL_ISSUES.md Officer #2)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ method: 'MOBILE', mobileNumber: '9777777777' })
        .expect(201);

      expect(res.body.mobileNumber).toBe('9777777777');
    });
  });

  describe('POST /api/v1/auth/profile/details', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/profile/details').send({ occupation: 'Farmer' }).expect(401);
    });

    it('allows a staff account to update their own profile details too (widened 2026-09-10, docs/ADMIN_PANEL_ISSUES.md Officer #2 - richer Officer Profile reuses this endpoint)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'officer@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/details')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ occupation: 'Senior Land Record Officer' })
        .expect(201);

      expect(res.body.occupation).toBe('Senior Land Record Officer');
    });

    it('updates name/address/governmentIdNumber/occupation with no OTP step', async () => {
      const { token } = await registerAndVerifyCitizen();
      mockSendOtp.mockClear();
      mockSendOtpEmail.mockClear();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/details')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', address: '12 MG Road, Pune', governmentIdNumber: 'ABCD1234E', occupation: 'Farmer' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Updated Name',
        address: '12 MG Road, Pune',
        governmentIdNumber: 'ABCD1234E',
        occupation: 'Farmer',
      });
      expect(mockSendOtp).not.toHaveBeenCalled();
      expect(mockSendOtpEmail).not.toHaveBeenCalled();
    });

    it('partially updates only the fields sent, leaving the rest untouched', async () => {
      const { token } = await registerAndVerifyCitizen();
      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/details')
        .set('Authorization', `Bearer ${token}`)
        .send({ occupation: 'Teacher' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/details')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: '5 Park Street' })
        .expect(201);

      expect(res.body.occupation).toBe('Teacher');
      expect(res.body.address).toBe('5 Park Street');
    });
  });
});
