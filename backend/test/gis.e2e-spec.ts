process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';

describe('GIS endpoints (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let seededParcels: Parcel[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));

    const fixtures: Partial<Parcel>[] = [
      {
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
      },
      {
        canonicalParcelId: 'CAN00002',
        ulpin: null,
        stateCode: 'DL',
        districtCode: 'SDL',
        localBodyCode: 'DLLB002',
        geometry: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[77.2, 28.5], [77.21, 28.5], [77.21, 28.51], [77.2, 28.51], [77.2, 28.5]]],
        }),
        areaSqM: 750,
      },
      {
        canonicalParcelId: 'CAN00003',
        ulpin: 'ULPIN0000000003',
        stateCode: 'KA',
        districtCode: 'BLR',
        localBodyCode: 'KALB001',
        geometry: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[77.6, 12.9], [77.61, 12.9], [77.61, 12.91], [77.6, 12.91], [77.6, 12.9]]],
        }),
        areaSqM: 300,
      },
    ];

    seededParcels = await parcelRepository.save(fixtures);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/gis/parcels', () => {
    it('returns all seeded parcels with a total count', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/gis/parcels').expect(200);
      expect(res.body.total).toBe(3);
      expect(res.body.parcels).toHaveLength(3);
    });

    it('filters by state', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/parcels')
        .query({ state: 'DL' })
        .expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.parcels.every((p: Parcel) => p.stateCode === 'DL')).toBe(true);
    });

    it('filters by state and district together', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/parcels')
        .query({ state: 'DL', district: 'SDL' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].canonicalParcelId).toBe('CAN00002');
    });

    it('respects limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/parcels')
        .query({ limit: 1 })
        .expect(200);
      expect(res.body.parcels).toHaveLength(1);
      expect(res.body.total).toBe(3);
    });

    it('returns valid GeoJSON geometry strings for each parcel', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/gis/parcels').expect(200);
      for (const parcel of res.body.parcels) {
        const geometry = JSON.parse(parcel.geometry);
        expect(geometry.type).toBe('Polygon');
        expect(Array.isArray(geometry.coordinates)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/gis/parcels/:id/geometry', () => {
    it('returns a GeoJSON Feature for a valid parcel id', async () => {
      const target = seededParcels[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/parcels/${target.id}/geometry`)
        .expect(200);

      expect(res.body.type).toBe('Feature');
      expect(res.body.properties.id).toBe(target.id);
      expect(res.body.geometry.type).toBe('Polygon');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/gis/parcels/not-a-uuid/geometry').expect(400);
    });

    it('returns an empty body for a well-formed but unknown UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/parcels/00000000-0000-0000-0000-000000000000/geometry')
        .expect(200);
      expect(res.body).toEqual({});
    });
  });

  describe('GET /api/v1/gis/parcels/:id/restrictions', () => {
    it('returns an array (placeholder) for a valid parcel id', async () => {
      const target = seededParcels[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/parcels/${target.id}/restrictions`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/gis/parcel-at-location', () => {
    it('responds successfully (spatial lookup is a dev-mode placeholder)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gis/parcel-at-location')
        .query({ lat: 28.6, lng: 77.1 })
        .expect(200);
    });
  });
});
