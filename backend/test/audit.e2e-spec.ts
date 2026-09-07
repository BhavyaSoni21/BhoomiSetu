process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { User } from '../src/users/user.entity';
import { createAuthenticatedUser } from './helpers/auth';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Audit logging (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let alertRepository: Repository<GovernanceAlert>;
  let userRepository: Repository<User>;
  let parcel: Parcel;
  let adminAuth: string;
  let landRecordsAuth: string;
  let citizenAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));
    userRepository = moduleFixture.get(getRepositoryToken(User));

    parcel = await parcelRepository.save({
      canonicalParcelId: 'AUDIT-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });

    ({ authHeader: adminAuth } = await createAuthenticatedUser(moduleFixture, 'ADMIN'));
    ({ authHeader: landRecordsAuth } = await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER'));
    ({ authHeader: citizenAuth } = await createAuthenticatedUser(moduleFixture, 'CITIZEN'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('records an AUTH_LOGIN entry', async () => {
      const loginUser = await userRepository.save({
        email: 'audit-login-test@test.gov.in',
        passwordHash: bcrypt.hashSync('CorrectPass1', 10),
        name: 'Audit Login Test',
        role: 'PLANNING_OFFICER',
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'audit-login-test@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/audit?entityType=USER')
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.entityId === loginUser.id);
      expect(entry).toBeTruthy();
      expect(entry.action).toBe('AUTH_LOGIN');
      expect(entry.userRole).toBe('PLANNING_OFFICER');
    });
  });

  describe('Workflow step review', () => {
    it('records WORKFLOW_STEP_APPROVED with the department and remarks in metadata', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Looks correct' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.entityId === landRecordsStep.id);
      expect(entry).toBeTruthy();
      expect(entry.action).toBe('WORKFLOW_STEP_APPROVED');
      expect(entry.entityType).toBe('WORKFLOW_STEP');
      expect(entry.parcelId).toBe(parcel.id);
      expect(entry.metadata).toEqual({ workflowId: created.body.id, department: 'LAND_RECORDS', remarks: 'Looks correct' });
    });

    it('records WORKFLOW_STEP_REJECTED for a reject action', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.entityId === landRecordsStep.id);
      expect(entry.action).toBe('WORKFLOW_STEP_REJECTED');
    });

    it('does not record anything for a request rejected by RBAC (wrong department)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(403);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.body.find((e: any) => e.entityId === registrationStep.id)).toBeUndefined();
    });
  });

  describe('Workflow creation', () => {
    it('records WORKFLOW_CREATED against the filing citizen', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.entityId === created.body.id && e.action === 'WORKFLOW_CREATED');
      expect(entry).toBeTruthy();
      expect(entry.userRole).toBe('CITIZEN');
      expect(entry.entityType).toBe('WORKFLOW');
      expect(entry.metadata).toEqual({ workflowType: 'ROR_COPY_REQUEST' });
    });
  });

  describe('Governance alert status change', () => {
    it('records GOVERNANCE_ALERT_STATUS_CHANGED', async () => {
      const alert = await alertRepository.save({
        parcelId: parcel.id, alertType: 'TAX_OVERDUE', severity: 'LOW', source: 'TAX_MONITOR', status: 'OPEN', explanation: 'x',
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', landRecordsAuth)
        .send({ status: 'DISMISSED' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.entityId === alert.id);
      expect(entry.action).toBe('GOVERNANCE_ALERT_STATUS_CHANGED');
      expect(entry.entityType).toBe('GOVERNANCE_ALERT');
      expect(entry.metadata).toEqual({ status: 'DISMISSED' });
    });
  });

  describe('GET /api/v1/audit', () => {
    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/audit').set('Authorization', landRecordsAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/audit').expect(401);
    });

    it('filters by entityType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit?entityType=GOVERNANCE_ALERT')
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((e: any) => e.entityType === 'GOVERNANCE_ALERT')).toBe(true);
    });
  });

  describe('GET /api/v1/parcels/:id/audit', () => {
    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get(`/api/v1/parcels/${parcel.id}/audit`).expect(401);
    });

    it('allows any staff role (not just admin)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcel.id}/audit`)
        .set('Authorization', landRecordsAuth)
        .expect(200);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/audit')
        .set('Authorization', adminAuth)
        .expect(404);
    });
  });
});
