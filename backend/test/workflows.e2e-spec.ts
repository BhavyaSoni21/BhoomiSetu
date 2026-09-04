process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Workflows (service requests) (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let parcel: Parcel;
  let otherParcel: Parcel;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));

    parcel = await parcelRepository.save({
      canonicalParcelId: 'WF-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });
    otherParcel = await parcelRepository.save({
      canonicalParcelId: 'WF-2', stateCode: 'DL', districtCode: 'NEW', localBodyCode: 'DLLB001', areaSqM: 300, geometry: square(77.2, 28.6),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/workflows', () => {
    it('creates a workflow with SUBMITTED status and auto-generates the 3-step review pipeline', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST', createdBy: 'Jane Citizen', requestDetails: 'Need a copy for a loan application' })
        .expect(201);

      expect(res.body.currentStatus).toBe('SUBMITTED');
      expect(res.body.parcelId).toBe(parcel.id);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps.map((s: any) => s.department)).toEqual(['LAND_RECORDS', 'REGISTRATION', 'PLANNING']);
      expect(res.body.steps.every((s: any) => s.status === 'PENDING')).toBe(true);
      expect(res.body.steps.map((s: any) => s.stepOrder)).toEqual([1, 2, 3]);
    });

    it('accepts a workflow with no createdBy/requestDetails (both optional)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: parcel.id, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);
      expect(res.body.createdBy).toBeNull();
      expect(res.body.requestDetails).toBeNull();
    });

    it('rejects a request for a non-existent parcel with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: '00000000-0000-0000-0000-000000000000', workflowType: 'ROR_COPY_REQUEST' })
        .expect(400);
    });

    it('rejects a request missing required fields with 400', async () => {
      await request(app.getHttpServer()).post('/api/v1/workflows').send({ workflowType: 'ROR_COPY_REQUEST' }).expect(400);
      await request(app.getHttpServer()).post('/api/v1/workflows').send({ parcelId: parcel.id }).expect(400);
    });
  });

  describe('GET /api/v1/workflows/:id', () => {
    it('returns a workflow with its steps', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer()).get(`/api/v1/workflows/${created.body.id}`).expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.steps).toHaveLength(3);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/not-a-uuid').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000').expect(404);
    });
  });

  describe('PATCH /api/v1/workflows/:id/status', () => {
    it('updates currentStatus and records remarks', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/status`)
        .send({ status: 'UNDER_REVIEW', remarks: 'Assigned to land records officer' })
        .expect(200);

      expect(res.body.currentStatus).toBe('UNDER_REVIEW');
      expect(res.body.lastRemarks).toBe('Assigned to land records officer');
      expect(res.body.steps).toHaveLength(3); // steps still attached after update
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/status')
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/workflows', () => {
    it('lists only workflows for that specific parcel, newest first', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: otherParcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      // SQLite's CURRENT_TIMESTAMP has second-level resolution, so two
      // requests within the same second would sort as ties - wait past that
      // boundary so the "newest first" ordering is actually meaningful here.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const second = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: otherParcel.id, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${otherParcel.id}/workflows`).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((w: any) => w.parcelId === otherParcel.id)).toBe(true);
      expect(res.body[0].id).toBe(second.body.id); // newest first
      expect(res.body[1].id).toBe(first.body.id);
    });

    it('returns an empty array for a parcel with no service requests', async () => {
      const freshParcel = await parcelRepository.save({
        canonicalParcelId: 'WF-3', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 200, geometry: square(77.5, 12.9),
      });
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${freshParcel.id}/workflows`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/workflows').expect(404);
    });
  });
});
