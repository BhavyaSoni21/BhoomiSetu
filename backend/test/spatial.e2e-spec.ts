process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { ZoningOverlay } from '../src/spatial/zoning-overlay.entity';
import { RestrictionZone } from '../src/spatial/restriction-zone.entity';
import { InfrastructureFeature } from '../src/spatial/infrastructure-feature.entity';
import { ChangeDetectionEvent } from '../src/spatial/change-detection-event.entity';

describe('Spatial demo layers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const zoningRepo: Repository<ZoningOverlay> = moduleFixture.get(getRepositoryToken(ZoningOverlay));
    const restrictionRepo: Repository<RestrictionZone> = moduleFixture.get(getRepositoryToken(RestrictionZone));
    const infraRepo: Repository<InfrastructureFeature> = moduleFixture.get(getRepositoryToken(InfrastructureFeature));
    const changeRepo: Repository<ChangeDetectionEvent> = moduleFixture.get(getRepositoryToken(ChangeDetectionEvent));

    const squareGeoJSON = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[73.85, 18.52], [73.86, 18.52], [73.86, 18.53], [73.85, 18.53], [73.85, 18.52]]],
    });
    const lineGeoJSON = JSON.stringify({ type: 'LineString', coordinates: [[73.85, 18.52], [73.86, 18.53]] });

    await zoningRepo.save({
      name: 'Test Residential Zone',
      zoneType: 'RESIDENTIAL',
      stateCode: 'MH',
      district: 'Pune',
      geometry: squareGeoJSON,
      parcelIds: ['p1', 'p2'],
    });
    await zoningRepo.save({
      name: 'Other State Zone',
      zoneType: 'COMMERCIAL',
      stateCode: 'KA',
      district: 'Bangalore',
      geometry: squareGeoJSON,
      parcelIds: [],
    });
    await restrictionRepo.save({
      name: 'Test Flood Zone',
      restrictionType: 'FLOOD',
      stateCode: 'MH',
      district: 'Pune',
      geometry: squareGeoJSON,
      affectedParcelIds: ['p1'],
    });
    await infraRepo.save({
      name: 'Test Road',
      featureType: 'ROAD',
      stateCode: 'MH',
      district: 'Pune',
      geometry: lineGeoJSON,
    });
    await changeRepo.save({
      description: 'Test change event',
      stateCode: 'MH',
      district: 'Pune',
      geometry: squareGeoJSON,
      affectedParcelIds: ['p1', 'p2'],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/gis/zoning-overlays returns a FeatureCollection filtered by state+district', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gis/zoning-overlays')
      .query({ state: 'MH', district: 'Pune' })
      .expect(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.zoneType).toBe('RESIDENTIAL');
    expect(res.body.features[0].geometry.type).toBe('Polygon');
  });

  it('GET /api/v1/gis/zoning-overlays with no filter returns all overlays', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/zoning-overlays').expect(200);
    expect(res.body.features).toHaveLength(2);
  });

  it('GET /api/v1/gis/restriction-zones returns affected parcel ids', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gis/restriction-zones')
      .query({ district: 'Pune' })
      .expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.affectedParcelIds).toEqual(['p1']);
  });

  it('GET /api/v1/gis/infrastructure returns LineString features', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/infrastructure').query({ district: 'Pune' }).expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].geometry.type).toBe('LineString');
    expect(res.body.features[0].properties.featureType).toBe('ROAD');
  });

  it('GET /api/v1/gis/change-detection-events returns simulated change events', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/change-detection-events').query({ district: 'Pune' }).expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.affectedParcelIds).toEqual(['p1', 'p2']);
  });
});
