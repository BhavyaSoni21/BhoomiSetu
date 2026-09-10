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
import { SmsService } from '../src/notifications/sms.service';
import { EmailService } from '../src/notifications/email.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
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

  describe('POST /api/v1/auth/register', () => {
    it('registers with email, returns a session immediately, and sends an OTP email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'New Citizen', method: 'EMAIL', email: 'newcitizen@example.com', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toEqual(
        expect.objectContaining({ email: 'newcitizen@example.com', emailVerified: false, role: 'CITIZEN' }),
      );
      expect(mockSendOtpEmail).toHaveBeenCalledWith('newcitizen@example.com', expect.any(String));
      expect(mockSendOtp).not.toHaveBeenCalled();
    });

    it('registers with mobile, returns a session immediately, and sends an SMS OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Mobile Citizen', method: 'MOBILE', mobileNumber: '9111111111', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      expect(res.body.user).toEqual(
        expect.objectContaining({ mobileNumber: '9111111111', mobileVerified: false, role: 'CITIZEN' }),
      );
      expect(mockSendOtp).toHaveBeenCalledWith('9111111111');
      expect(mockSendOtpEmail).not.toHaveBeenCalled();
    });

    it('rejects mismatched password/confirmPassword with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', email: 'mismatch@example.com', password: 'Password1', confirmPassword: 'Different1' })
        .expect(400);
    });

    it('rejects a duplicate email with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X', method: 'EMAIL', email: 'officer@test.gov.in', password: 'Password1', confirmPassword: 'Password1' })
        .expect(400);
    });

    it('rejects a duplicate mobile number with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X1', method: 'MOBILE', mobileNumber: '9222222222', password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'X2', method: 'MOBILE', mobileNumber: '9222222222', password: 'Password1', confirmPassword: 'Password1' })
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

  describe('POST /api/v1/auth/verify-otp', () => {
    async function registerCitizen(overrides: Record<string, unknown> = {}) {
      const res = await request(app.getHttpServer())
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
      return { token: res.body.accessToken as string, user: res.body.user };
    }

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

    it('verifies the correct email code and flips emailVerified to true', async () => {
      const { token } = await registerCitizen();
      const sentCode = mockSendOtpEmail.mock.calls[0][1];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: sentCode })
        .expect(201);

      expect(res.body.emailVerified).toBe(true);

      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body.emailVerified).toBe(true);
    });

    it('rejects an incorrect email code with 400 and leaves emailVerified false', async () => {
      const { token } = await registerCitizen();

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: '000000' })
        .expect(400);

      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body.emailVerified).toBe(false);
    });

    it('rejects an expired email code with 400', async () => {
      const { token, user } = await registerCitizen();
      await userRepository.update({ id: user.id }, { emailOtpExpiresAt: new Date(Date.now() - 1000) });
      const sentCode = mockSendOtpEmail.mock.calls[0][1];

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: sentCode })
        .expect(400);
    });

    it('locks out after too many incorrect attempts, with 403', async () => {
      const { token, user } = await registerCitizen();
      await userRepository.update({ id: user.id }, { emailOtpAttempts: 5 });

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: '000000' })
        .expect(403);
    });

    it('verifies mobile OTP via SmsService and flips mobileVerified to true', async () => {
      const { token } = await registerCitizen({ method: 'MOBILE', mobileNumber: '9333333333', email: undefined });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', code: MOCK_SMS_OTP_CODE })
        .expect(201);

      expect(mockVerifyOtp).toHaveBeenCalled();
      expect(res.body.mobileVerified).toBe(true);
    });

    it('rejects when SmsService reports the mobile code as invalid, with 400', async () => {
      const { token } = await registerCitizen({ method: 'MOBILE', mobileNumber: '9444444444', email: undefined });

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', code: '111111' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/resend-otp', () => {
    it('rejects a resend for a method with nothing on file, with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Resend Test', method: 'EMAIL', email: `resend-${Date.now()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-otp')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ method: 'MOBILE' })
        .expect(400);
    });

    it('rejects a resend within the cooldown window, with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Resend Test 2', method: 'EMAIL', email: `resend2-${Date.now()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);

      // Registration itself already sent one email OTP moments ago.
      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-otp')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ method: 'EMAIL' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/profile/contact', () => {
    async function registerCitizen() {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Contact Test', method: 'EMAIL', email: `contact-${Date.now()}-${Math.random()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      return { token: res.body.accessToken as string, user: res.body.user };
    }

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/profile/contact').send({ method: 'MOBILE', mobileNumber: '9555555555' }).expect(401);
    });

    it("adds a missing mobile number directly (the slot is empty - nothing to protect)", async () => {
      const { token } = await registerCitizen();

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
      const { token } = await registerCitizen();
      mockSendOtp.mockRejectedValueOnce(new Error('SMS delivery is not configured'));

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MOBILE', mobileNumber: '9888888888' })
        .expect(201);

      expect(res.body.mobileNumber).toBe('9888888888');
    });

    it('stages a changed, already-verified email as pending rather than overwriting it immediately', async () => {
      const { token, user } = await registerCitizen();
      const firstCode = mockSendOtpEmail.mock.calls[0][1];
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: firstCode })
        .expect(201);
      // Past the resend cooldown from registration's own OTP send moments
      // ago - this test is about the pending-staging behaviour, not timing.
      await userRepository.update({ id: user.id }, { emailOtpSentAt: null });

      const changeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', email: 'changed-address@example.com' })
        .expect(201);

      // The old, already-verified address is still the live one - the new
      // one only takes over once its own OTP is verified.
      expect(changeRes.body.email).toBe(user.email);
      expect(changeRes.body.emailVerified).toBe(true);

      const secondCode = mockSendOtpEmail.mock.calls[1][1];
      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', code: secondCode })
        .expect(201);

      expect(verifyRes.body.email).toBe('changed-address@example.com');
      expect(verifyRes.body.emailVerified).toBe(true);
    });

    it('rejects claiming an email already linked to another account, with 400', async () => {
      const { token } = await registerCitizen();

      await request(app.getHttpServer())
        .post('/api/v1/auth/profile/contact')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'EMAIL', email: 'officer@test.gov.in' })
        .expect(400);
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
    async function registerCitizen() {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Details Test', method: 'EMAIL', email: `details-${Date.now()}-${Math.random()}@example.com`, password: 'Password1', confirmPassword: 'Password1' })
        .expect(201);
      return { token: res.body.accessToken as string, user: res.body.user };
    }

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
      const { token } = await registerCitizen();
      // registerCitizen() itself sends registration's own OTP email - clear
      // that call so the assertions below are about profile/details, not it.
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
      const { token } = await registerCitizen();
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
