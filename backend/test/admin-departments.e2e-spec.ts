process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Department } from '../src/admin/department.entity';
import { AuditLog } from '../src/audit/audit-log.entity';
import { createAuthenticatedUser } from './helpers/auth';

describe('Admin Departments (e2e)', () => {
  let app: INestApplication;
  let departmentRepository: Repository<Department>;
  let auditRepository: Repository<AuditLog>;
  let adminAuth: string;
  let officerAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    departmentRepository = moduleFixture.get(getRepositoryToken(Department));
    auditRepository = moduleFixture.get(getRepositoryToken(AuditLog));

    ({ authHeader: adminAuth } = await createAuthenticatedUser(moduleFixture, 'ADMIN'));
    ({ authHeader: officerAuth } = await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/admin/departments', () => {
    it('lists departments ordered by name', async () => {
      await departmentRepository.save([
        { code: 'ZZZ_LAST', name: 'Zzz Department' },
        { code: 'AAA_FIRST', name: 'Aaa Department' },
      ]);

      const res = await request(app.getHttpServer()).get('/api/v1/admin/departments').set('Authorization', adminAuth).expect(200);
      const names = res.body.map((d: { name: string }) => d.name);
      expect(names.indexOf('Aaa Department')).toBeLessThan(names.indexOf('Zzz Department'));
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/departments').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/departments').expect(401);
    });
  });

  describe('POST /api/v1/admin/departments', () => {
    it('creates a department and logs a DEPARTMENT_CREATED audit entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code: 'TAX', name: 'Tax Department', description: 'Property tax assessment and collection', contactEmail: 'tax@bhoomisetu.gov.in' })
        .expect(201);

      expect(res.body.code).toBe('TAX');
      expect(res.body.name).toBe('Tax Department');

      const auditEntry = await auditRepository.findOneBy({ action: 'DEPARTMENT_CREATED', entityId: res.body.id });
      expect(auditEntry).toBeTruthy();
    });

    it('rejects a duplicate code with 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code: 'TAX', name: 'Duplicate Tax' })
        .expect(409);
    });

    it('rejects a missing name with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code: 'NO_NAME' })
        .expect(400);
    });

    it('rejects an invalid contact email with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set('Authorization', adminAuth)
        .send({ code: 'BAD_EMAIL', name: 'Bad Email Dept', contactEmail: 'not-an-email' })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set('Authorization', officerAuth)
        .send({ code: 'BLOCKED', name: 'Blocked Dept' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/admin/departments/:id', () => {
    it('updates a department and logs a DEPARTMENT_UPDATED audit entry', async () => {
      const target = await departmentRepository.save({ code: 'PLANNING_T', name: 'Planning Old Name' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/departments/${target.id}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Planning Department', description: 'Zoning and master plan oversight' })
        .expect(200);

      expect(res.body.name).toBe('Planning Department');
      expect(res.body.description).toBe('Zoning and master plan oversight');
      expect(res.body.code).toBe('PLANNING_T'); // code is not editable

      const auditEntry = await auditRepository.findOneBy({ action: 'DEPARTMENT_UPDATED', entityId: target.id });
      expect(auditEntry).toBeTruthy();
    });

    it('returns 404 for an unknown department', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admin/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ name: 'Unknown Target' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/admin/departments/:id', () => {
    it('deletes a department and logs a DEPARTMENT_DELETED audit entry', async () => {
      const target = await departmentRepository.save({ code: 'TO_DELETE', name: 'To Delete' });

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/departments/${target.id}`)
        .set('Authorization', adminAuth)
        .expect(204);

      expect(await departmentRepository.findOneBy({ id: target.id })).toBeNull();
      const auditEntry = await auditRepository.findOneBy({ action: 'DEPARTMENT_DELETED', entityId: target.id });
      expect(auditEntry).toBeTruthy();
    });

    it('returns 404 for an unknown department', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admin/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .expect(404);
    });
  });
});
