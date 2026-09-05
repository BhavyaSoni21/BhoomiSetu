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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let officerUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    });
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
        name: 'Test Officer',
        role: 'LAND_RECORD_OFFICER',
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
        name: 'Test Officer',
        role: 'LAND_RECORD_OFFICER',
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
});
