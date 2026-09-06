process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { AuditLog } from '../src/audit/audit-log.entity';
import { createAuthenticatedUser } from './helpers/auth';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditRepository: Repository<AuditLog>;
  let adminUser: { user: User; authHeader: string };
  let officerAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    auditRepository = moduleFixture.get(getRepositoryToken(AuditLog));

    adminUser = await createAuthenticatedUser(moduleFixture, 'ADMIN');
    ({ authHeader: officerAuth } = await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/users', () => {
    it('lists users without ever including a password hash', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users').set('Authorization', adminUser.authHeader).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('excludes citizen sign-in accounts - this list is for officer/admin account management', async () => {
      const citizen = await userRepository.save({
        email: 'excluded-citizen@test.com', passwordHash: 'x', name: 'A Citizen', role: 'CITIZEN',
      });

      const res = await request(app.getHttpServer()).get('/api/v1/users').set('Authorization', adminUser.authHeader).expect(200);
      expect(res.body.some((u: { id: string }) => u.id === citizen.id)).toBe(false);
    });
  });

  describe('POST /api/v1/users', () => {
    it('creates a new officer account and logs a USER_CREATED audit entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', adminUser.authHeader)
        .send({ email: 'new.officer@test.gov.in', password: 'SecurePass123', name: 'New Officer', role: 'PLANNING_OFFICER' })
        .expect(201);

      expect(res.body.role).toBe('PLANNING_OFFICER');
      expect(res.body).not.toHaveProperty('passwordHash');

      const createdUser = await userRepository.findOneBy({ email: 'new.officer@test.gov.in' });
      expect(createdUser).toBeTruthy();
      expect(createdUser!.passwordHash).not.toBe('SecurePass123'); // actually hashed, not stored raw

      const auditEntry = await auditRepository.findOneBy({ action: 'USER_CREATED', entityId: res.body.id });
      expect(auditEntry).toBeTruthy();
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', adminUser.authHeader)
        .send({ email: 'new.officer@test.gov.in', password: 'AnotherPass123', name: 'Duplicate', role: 'PLANNING_OFFICER' })
        .expect(409);
    });

    it('rejects a password shorter than 8 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', adminUser.authHeader)
        .send({ email: 'short.pass@test.gov.in', password: 'short', name: 'X', role: 'PLANNING_OFFICER' })
        .expect(400);
    });

    it('rejects an invalid role with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', adminUser.authHeader)
        .send({ email: 'bad.role@test.gov.in', password: 'SecurePass123', name: 'X', role: 'SUPER_ADMIN' })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', officerAuth)
        .send({ email: 'blocked@test.gov.in', password: 'SecurePass123', name: 'X', role: 'PLANNING_OFFICER' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/users/:id/role', () => {
    it("changes a user's role and logs a USER_ROLE_CHANGED audit entry", async () => {
      const target = await userRepository.save({
        email: 'role-change@test.gov.in', passwordHash: 'x', name: 'Role Target', role: 'PLANNING_OFFICER',
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${target.id}/role`)
        .set('Authorization', adminUser.authHeader)
        .send({ role: 'DISPUTE_OFFICER' })
        .expect(200);
      expect(res.body.role).toBe('DISPUTE_OFFICER');

      const auditEntry = await auditRepository.findOneBy({ action: 'USER_ROLE_CHANGED', entityId: target.id });
      expect(auditEntry).toBeTruthy();
    });

    it('rejects an admin changing their own role with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${adminUser.user.id}/role`)
        .set('Authorization', adminUser.authHeader)
        .send({ role: 'PLANNING_OFFICER' })
        .expect(400);
    });

    it('returns 404 for an unknown user', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000/role')
        .set('Authorization', adminUser.authHeader)
        .send({ role: 'PLANNING_OFFICER' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('deletes a user account and logs a USER_DELETED audit entry', async () => {
      const target = await userRepository.save({
        email: 'to-delete@test.gov.in', passwordHash: 'x', name: 'Delete Target', role: 'PLANNING_OFFICER',
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${target.id}`)
        .set('Authorization', adminUser.authHeader)
        .expect(204);

      expect(await userRepository.findOneBy({ id: target.id })).toBeNull();
      const auditEntry = await auditRepository.findOneBy({ action: 'USER_DELETED', entityId: target.id });
      expect(auditEntry).toBeTruthy();
    });

    it('rejects an admin deleting their own account with 400', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${adminUser.user.id}`)
        .set('Authorization', adminUser.authHeader)
        .expect(400);
    });

    it('returns 404 for an unknown user', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminUser.authHeader)
        .expect(404);
    });
  });
});
