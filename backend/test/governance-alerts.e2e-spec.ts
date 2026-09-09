process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { Notification } from '../src/notification-feed/notification.entity';
import { createAuthenticatedUser } from './helpers/auth';

describe('Governance Alerts (e2e)', () => {
  let app: INestApplication;
  let alertRepository: Repository<GovernanceAlert>;
  let notificationRepository: Repository<Notification>;
  let floodAlert: GovernanceAlert;
  let changeAlert: GovernanceAlert;
  let taxAlert: GovernanceAlert;
  // Every route on this controller is officer/admin-only (docs/FEATURE_AUDIT.md
  // §8 item 5) - there's no citizen-facing use of governance alerts anywhere.
  let officerAuth: string;
  let restrictionOfficerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));
    notificationRepository = moduleFixture.get(getRepositoryToken(Notification));

    // SQLite's CURRENT_TIMESTAMP has second-level resolution, so creating
    // these back-to-back would tie and make "newest first" ordering
    // unverifiable (see the same issue/fix in workflows.e2e-spec.ts).
    const wait = () => new Promise((resolve) => setTimeout(resolve, 1100));

    floodAlert = await alertRepository.save({
      parcelId: '11111111-1111-1111-1111-111111111111',
      alertType: 'RESTRICTION_ZONE_OVERLAP',
      severity: 'MEDIUM',
      source: 'RESTRICTION_MONITOR',
      status: 'OPEN',
      explanation: 'Parcel intersects the flood restriction zone.',
    });
    await wait();
    changeAlert = await alertRepository.save({
      parcelId: '22222222-2222-2222-2222-222222222222',
      alertType: 'UNAUTHORIZED_CHANGE_DETECTED',
      severity: 'HIGH',
      source: 'CHANGE_DETECTION',
      status: 'OPEN',
      explanation: 'New construction footprint detected.',
    });
    await wait();
    taxAlert = await alertRepository.save({
      parcelId: '33333333-3333-3333-3333-333333333333',
      alertType: 'TAX_OVERDUE',
      severity: 'LOW',
      source: 'TAX_MONITOR',
      status: 'REVIEWED',
      explanation: 'Outstanding property tax of 500 is overdue.',
    });

    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
    const restrictionOfficer = await createAuthenticatedUser(moduleFixture, 'RESTRICTION_OFFICER');
    restrictionOfficerId = restrictionOfficer.user.id;
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/governance-alerts', () => {
    it('lists every alert, newest first', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/governance-alerts')
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body[0].id).toBe(taxAlert.id); // most recently created
    });

    it('filters by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/governance-alerts?status=OPEN')
        .set('Authorization', officerAuth)
        .expect(200);
      const ids = res.body.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining([floodAlert.id, changeAlert.id]));
      expect(ids).not.toContain(taxAlert.id);
    });

    it('filters by severity', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/governance-alerts?severity=HIGH')
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.body.map((a: any) => a.id)).toEqual([changeAlert.id]);
    });

    it('combines status and severity filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/governance-alerts?status=OPEN&severity=LOW')
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/governance-alerts').expect(401);
    });
  });

  describe('GET /api/v1/governance-alerts/:id', () => {
    it('returns a single alert', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/governance-alerts/${floodAlert.id}`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.body.alertType).toBe('RESTRICTION_ZONE_OVERLAP');
      expect(res.body.explanation).toContain('flood');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/governance-alerts/not-a-uuid')
        .set('Authorization', officerAuth)
        .expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', officerAuth)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/governance-alerts/:id/status', () => {
    it('updates status (e.g. an officer dismissing an alert)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${changeAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: 'Duplicate of an already-resolved alert.' })
        .expect(200);
      expect(res.body.status).toBe('DISMISSED');

      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/governance-alerts/${changeAlert.id}`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(refetched.body.status).toBe('DISMISSED');
    });

    it('records the reason and notifies the relevant department officer(s)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'REVIEWED', reason: 'Confirmed with the restriction survey team - overlap is legitimate.' })
        .expect(200);
      expect(res.body.status).toBe('REVIEWED');
      expect(res.body.reason).toBe('Confirmed with the restriction survey team - overlap is legitimate.');

      // RESTRICTION_ZONE_OVERLAP derives to the RESTRICTION department
      // (alertDepartmentFor in governance-alerts.service.ts) - its officer,
      // not the LAND_RECORD_OFFICER who reviewed it, gets notified.
      const notifications = await notificationRepository.find({ where: { userId: restrictionOfficerId, type: 'GOVERNANCE_ALERT_REVIEWED' } });
      const forThisAlert = notifications.find((n) => n.alertId === floodAlert.id);
      expect(forThisAlert).toBeTruthy();
      expect(forThisAlert!.message).toContain('Confirmed with the restriction survey team');
    });

    it('rejects an invalid status value with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'NOT_A_REAL_STATUS', reason: 'x' })
        .expect(400);
    });

    it('rejects a missing reason with 400 - mandatory for both Mark Reviewed and Dismiss', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'REVIEWED' })
        .expect(400);
    });

    it('rejects an empty-string reason with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: '' })
        .expect(400);
    });

    it('returns 404 for an unknown alert', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', officerAuth)
        .send({ status: 'REVIEWED', reason: 'x' })
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .send({ status: 'REVIEWED', reason: 'x' })
        .expect(401);
    });
  });
});
