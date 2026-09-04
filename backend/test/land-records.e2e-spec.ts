process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { StateALandRecord } from '../src/land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../src/land-records/state-b-land-record.entity';

describe('Mock state land record schemas (e2e)', () => {
  let app: INestApplication;
  let stateARepository: Repository<StateALandRecord>;
  let stateBRepository: Repository<StateBLandRecord>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    stateARepository = moduleFixture.get(getRepositoryToken(StateALandRecord));
    stateBRepository = moduleFixture.get(getRepositoryToken(StateBLandRecord));

    await stateARepository.save({
      surveyNumber: '42/3',
      subdivisionNumber: '1',
      ownerName: 'Sample Citizen',
      villageCode: 'VIL001',
      areaHectares: 0.85,
    });
    await stateBRepository.save({
      plotId: 'P-9087',
      holderName: 'Sample Citizen',
      localityId: 'LOC900',
      landExtentSqft: 9150,
      recordCategory: 'Urban',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('State A land records (rural/village schema)', () => {
    it('creates a record, defaulting recordStatus to ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '10/2', subdivisionNumber: '4', ownerName: 'Test Owner', villageCode: 'VIL010', areaHectares: 1.2 })
        .expect(201);
      expect(res.body.recordStatus).toBe('ACTIVE');
      expect(res.body.recordId).toBeDefined();
    });

    it('rejects a create request missing required fields with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '10/2' })
        .expect(400);
    });

    it('lists all records and supports the schema-specific survey_number/village_code filters', async () => {
      const all = await request(app.getHttpServer()).get('/api/v1/state-a/land-records').expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(1);

      const filtered = await request(app.getHttpServer())
        .get('/api/v1/state-a/land-records')
        .query({ survey_number: '42/3' })
        .expect(200);
      expect(filtered.body.total).toBe(1);
      expect(filtered.body.records[0].villageCode).toBe('VIL001');
    });

    it('reads, updates, and deletes a single record', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/state-a/land-records')
        .send({ surveyNumber: '55/1', subdivisionNumber: '2', ownerName: 'Lifecycle Owner', villageCode: 'VIL055', areaHectares: 2 })
        .expect(201);
      const id = created.body.recordId;

      const fetched = await request(app.getHttpServer()).get(`/api/v1/state-a/land-records/${id}`).expect(200);
      expect(fetched.body.ownerName).toBe('Lifecycle Owner');

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/state-a/land-records/${id}`)
        .send({ ownerName: 'Renamed Owner' })
        .expect(200);
      expect(updated.body.ownerName).toBe('Renamed Owner');
      expect(updated.body.surveyNumber).toBe('55/1'); // untouched fields survive a partial update

      await request(app.getHttpServer()).delete(`/api/v1/state-a/land-records/${id}`).expect(204);
      await request(app.getHttpServer()).get(`/api/v1/state-a/land-records/${id}`).expect(404);
    });

    it('returns 404 for an unknown id on get/update/delete', async () => {
      const missing = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer()).get(`/api/v1/state-a/land-records/${missing}`).expect(404);
      await request(app.getHttpServer()).patch(`/api/v1/state-a/land-records/${missing}`).send({ ownerName: 'X' }).expect(404);
      await request(app.getHttpServer()).delete(`/api/v1/state-a/land-records/${missing}`).expect(404);
    });
  });

  describe('State B land records (urban plot schema)', () => {
    it('creates and reads back a record using its own field names', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-1234', holderName: 'Urban Owner', localityId: 'LOC010', landExtentSqft: 5000, recordCategory: 'Commercial' })
        .expect(201);
      expect(created.body.recordId).toBeDefined();

      const fetched = await request(app.getHttpServer()).get(`/api/v1/state-b/land-records/${created.body.recordId}`).expect(200);
      expect(fetched.body.plotId).toBe('P-1234');
      expect(fetched.body.recordCategory).toBe('Commercial');
    });

    it('rejects a create request missing required fields with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-0000' })
        .expect(400);
    });

    it('filters by plot_id/locality_id independently of State A data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/state-b/land-records')
        .query({ plot_id: 'P-9087' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.records[0].holderName).toBe('Sample Citizen');
      // State B response shape must never leak State A's field names.
      expect(res.body.records[0].surveyNumber).toBeUndefined();
      expect(res.body.records[0].villageCode).toBeUndefined();
    });

    it('updates and deletes a record', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/state-b/land-records')
        .send({ plotId: 'P-5555', holderName: 'Delete Me', localityId: 'LOC055', landExtentSqft: 1000, recordCategory: 'Residential' })
        .expect(201);
      const id = created.body.recordId;

      await request(app.getHttpServer())
        .patch(`/api/v1/state-b/land-records/${id}`)
        .send({ recordCategory: 'Mixed-Use' })
        .expect(200);

      await request(app.getHttpServer()).delete(`/api/v1/state-b/land-records/${id}`).expect(204);
      await request(app.getHttpServer()).get(`/api/v1/state-b/land-records/${id}`).expect(404);
    });
  });

  describe('the two state APIs operate independently', () => {
    it('State A and State B counts do not interfere with each other', async () => {
      const stateACount = await stateARepository.count();
      const stateBCount = await stateBRepository.count();

      const stateARes = await request(app.getHttpServer()).get('/api/v1/state-a/land-records').expect(200);
      const stateBRes = await request(app.getHttpServer()).get('/api/v1/state-b/land-records').expect(200);

      expect(stateARes.body.total).toBe(stateACount);
      expect(stateBRes.body.total).toBe(stateBCount);
    });
  });
});
