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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
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
      status: 'RESOLVED',
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

    it('filters by status=ACTIVE (a pseudo-status meaning "not RESOLVED/DISMISSED")', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/governance-alerts?status=ACTIVE')
        .set('Authorization', officerAuth)
        .expect(200);
      const ids = res.body.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining([floodAlert.id, changeAlert.id]));
      expect(ids).not.toContain(taxAlert.id); // taxAlert is seeded RESOLVED
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

  describe('PATCH /api/v1/governance-alerts/:id/status - 4-stage verification', () => {
    const freshAlert = (parcelId: string, status = 'OPEN') =>
      alertRepository.save({
        parcelId,
        alertType: 'RESTRICTION_ZONE_OVERLAP',
        severity: 'MEDIUM',
        source: 'RESTRICTION_MONITOR',
        status,
        explanation: 'Parcel intersects a restriction zone.',
      });

    it('advances an alert through all 4 stages, notifying the department only on the final RESOLVED transition', async () => {
      const alert = await freshAlert('44444444-4444-4444-4444-444444444444');

      const ack = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: 'Looking into this now.' })
        .expect(200);
      expect(ack.body.status).toBe('ACKNOWLEDGED');
      expect(await notificationRepository.find({ where: { alertId: alert.id } })).toHaveLength(0);

      const verified = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'FIELD_VERIFIED', reason: 'Confirmed on-site - the restriction is real.' })
        .expect(200);
      expect(verified.body.status).toBe('FIELD_VERIFIED');
      expect(await notificationRepository.find({ where: { alertId: alert.id } })).toHaveLength(0);

      const resolved = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'RESOLVED', reason: 'Restriction survey team addressed the overlap.' })
        .expect(200);
      expect(resolved.body.status).toBe('RESOLVED');
      expect(resolved.body.reason).toBe('Restriction survey team addressed the overlap.');

      // RESTRICTION_ZONE_OVERLAP derives to the RESTRICTION department
      // (alertDepartmentFor in governance-alerts.service.ts) - its officer,
      // not the LAND_RECORD_OFFICER who resolved it, gets notified.
      const notifications = await notificationRepository.find({ where: { userId: restrictionOfficerId, type: 'GOVERNANCE_ALERT_RESOLVED' } });
      const forThisAlert = notifications.find((n) => n.alertId === alert.id);
      expect(forThisAlert).toBeTruthy();
      expect(forThisAlert!.message).toContain('Restriction survey team addressed the overlap');
    });

    it('lets DISMISSED short-circuit from a non-terminal stage, and notifies on dismissal', async () => {
      const alert = await freshAlert('55555555-5555-5555-5555-555555555555', 'ACKNOWLEDGED');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: 'Duplicate of an already-resolved alert.' })
        .expect(200);
      expect(res.body.status).toBe('DISMISSED');

      const notifications = await notificationRepository.find({ where: { userId: restrictionOfficerId, type: 'GOVERNANCE_ALERT_DISMISSED' } });
      expect(notifications.find((n) => n.alertId === alert.id)).toBeTruthy();
    });

    it('rejects skipping a stage (OPEN straight to FIELD_VERIFIED) with 400', async () => {
      const alert = await freshAlert('66666666-6666-6666-6666-666666666666');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'FIELD_VERIFIED', reason: 'x' })
        .expect(400);
      expect(res.body.message).toContain('OPEN');
    });

    it('rejects skipping straight from OPEN to RESOLVED with 400', async () => {
      const alert = await freshAlert('77777777-7777-7777-7777-777777777777');
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'RESOLVED', reason: 'x' })
        .expect(400);
    });

    it('rejects any further PATCH on a terminal (RESOLVED) alert with 400', async () => {
      const alert = await freshAlert('88888888-8888-8888-8888-888888888888', 'RESOLVED');
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'DISMISSED', reason: 'x' })
        .expect(400);
    });

    it('rejects an invalid status value with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'NOT_A_REAL_STATUS', reason: 'x' })
        .expect(400);
    });

    it('rejects a missing reason with 400', async () => {
      const alert = await freshAlert('99999999-9999-9999-9999-999999999999');
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED' })
        .expect(400);
    });

    it('rejects an empty-string reason with 400', async () => {
      const alert = await freshAlert('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${alert.id}/status`)
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: '' })
        .expect(400);
    });

    it('returns 404 for an unknown alert', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', officerAuth)
        .send({ status: 'ACKNOWLEDGED', reason: 'x' })
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/governance-alerts/${floodAlert.id}/status`)
        .send({ status: 'ACKNOWLEDGED', reason: 'x' })
        .expect(401);
    });
  });
});
