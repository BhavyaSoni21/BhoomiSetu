process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { ParcelIdentifier } from '../src/parcels/parcel-identifier.entity';

describe('Parcels endpoints (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let parcelA: Parcel;
  let parcelB: Parcel;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    identifierRepository = moduleFixture.get(getRepositoryToken(ParcelIdentifier));

    parcelA = await parcelRepository.save({
      canonicalParcelId: 'CAN00001',
      ulpin: 'ULPIN0000000001',
      stateCode: 'DL',
      districtCode: 'NDL',
      localBodyCode: 'DLLB001',
      geometry: JSON.stringify({
        type: 'Polygon',
        coordinates: [[[77.1, 28.6], [77.11, 28.6], [77.11, 28.61], [77.1, 28.61], [77.1, 28.6]]],
      }),
      areaSqM: 500,
    });

    parcelB = await parcelRepository.save({
      canonicalParcelId: 'CAN00002',
      ulpin: null,
      stateCode: 'KA',
      districtCode: 'BLR',
      localBodyCode: 'KALB001',
      geometry: JSON.stringify({
        type: 'Polygon',
        coordinates: [[[77.6, 12.9], [77.61, 12.9], [77.61, 12.91], [77.6, 12.91], [77.6, 12.9]]],
      }),
      areaSqM: 300,
    });

    await identifierRepository.save([
      {
        parcel: parcelA,
        identifierType: 'ULPIN',
        identifierValue: 'ULPIN0000000001',
        sourceState: 'DL',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelA,
        identifierType: 'SURVEY_NUMBER',
        identifierValue: '42/3',
        sourceState: 'DL',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelB,
        identifierType: 'PLOT_NUMBER',
        identifierValue: 'P-9001',
        sourceState: 'KA',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelB,
        identifierType: 'LOCAL_PARCEL_ID',
        identifierValue: 'KA-BLR-0007',
        sourceState: 'KA',
        sourceDepartment: 'Land Records',
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/parcels (search)', () => {
    it('returns all parcels with no filters', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/parcels').expect(200);
      expect(res.body.total).toBe(2);
    });

    it('finds a parcel by ULPIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ ulpin: 'ULPIN0000000001' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA.id);
    });

    it('finds a parcel by survey_number', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ survey_number: '42/3' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA.id);
    });

    it('finds a parcel by plot_number', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ plot_number: 'P-9001' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('finds a parcel by local_identifier', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ local_identifier: 'KA-BLR-0007' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('filters by state and district', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ state: 'KA', district: 'BLR' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('returns an empty result set for an unmatched identifier', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ ulpin: 'DOES-NOT-EXIST' })
        .expect(200);
      expect(res.body.total).toBe(0);
      expect(res.body.parcels).toHaveLength(0);
    });
  });

  describe('GET /api/v1/parcels/:id', () => {
    it('returns the parcel for a valid id', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}`).expect(200);
      expect(res.body.canonicalParcelId).toBe('CAN00001');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/v1/parcels/:id/360', () => {
    it('returns the parcel wrapped with a department stub structure', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}/360`).expect(200);
      expect(res.body.parcel.id).toBe(parcelA.id);
      expect(res.body.departments).toEqual({
        landRecords: null,
        registration: null,
        planning: null,
        tax: null,
        restriction: null,
      });
    });
  });
});
