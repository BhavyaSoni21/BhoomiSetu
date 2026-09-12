process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Notification } from '../src/notification-feed/notification.entity';
import { createAuthenticatedUser } from './helpers/auth';

describe('Notification Feed (e2e)', () => {
  let app: INestApplication;
  let notificationRepository: Repository<Notification>;
  let citizenAuth: string;
  let citizenId: string;
  let otherCitizenAuth: string;
  let ownNotification: Notification;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    notificationRepository = moduleFixture.get(getRepositoryToken(Notification));

    const citizen = await createAuthenticatedUser(moduleFixture, 'CITIZEN');
    citizenAuth = citizen.authHeader;
    citizenId = citizen.user.id;
    otherCitizenAuth = (await createAuthenticatedUser(moduleFixture, 'CITIZEN')).authHeader;

    ownNotification = await notificationRepository.save({
      userId: citizenId,
      type: 'WORKFLOW_STEP_APPROVED',
      title: 'Your request was approved',
      message: 'Land Records approved your request.',
      parcelId: 'p1',
      workflowId: 'w1',
      alertId: null,
      read: false,
    });
    // Belongs to a different user - every test below confirms this never
    // leaks into citizenAuth's own feed or read-mark.
    await notificationRepository.save({
      userId: 'someone-else', type: 'WORKFLOW_ASSIGNED', title: 'Not yours', message: 'x', parcelId: null, workflowId: null, alertId: null, read: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/notifications', () => {
    it("returns only the signed-in user's own notifications", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', citizenAuth)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ownNotification.id);
      expect(res.body[0].title).toBe('Your request was approved');
    });

    it('returns an empty array for a user with no notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', otherCitizenAuth)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('marks a notification read', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${ownNotification.id}/read`)
        .set('Authorization', citizenAuth)
        .expect(200);
      expect(res.body.read).toBe(true);
    });

    it("returns 404 for a notification that belongs to a different user (never leaks another user's row)", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${ownNotification.id}/read`)
        .set('Authorization', otherCitizenAuth)
        .expect(404);
    });

    it('returns 404 for an unknown notification', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', citizenAuth)
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).patch(`/api/v1/notifications/${ownNotification.id}/read`).expect(401);
    });
  });
});
