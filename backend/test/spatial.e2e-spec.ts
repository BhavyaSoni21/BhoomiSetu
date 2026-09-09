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
import { createAuthenticatedUser } from './helpers/auth';

describe('Spatial demo layers (e2e)', () => {
  let app: INestApplication;
  // Write endpoints are admin-only (docs/FEATURE_AUDIT.md §8 item 13).
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

    adminAuth = (await createAuthenticatedUser(moduleFixture, 'ADMIN')).authHeader;
    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
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

  const validPolygon = {
    type: 'Polygon',
    coordinates: [[[73.9, 18.6], [73.91, 18.6], [73.91, 18.61], [73.9, 18.61], [73.9, 18.6]]],
  };

  describe('POST /api/v1/gis/zoning-overlays', () => {
    it('creates a zoning overlay as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon, parcelIds: ['p9'] })
        .expect(201);

      expect(res.body.zoneType).toBe('AGRICULTURAL');
      expect(res.body.id).toBeTruthy();

      const listed = await request(app.getHttpServer()).get('/api/v1/gis/zoning-overlays').query({ district: 'Pune' }).expect(200);
      expect(listed.body.features.some((f: any) => f.properties.id === res.body.id)).toBe(true);
    });

    it('rejects a geometry that is not a Polygon with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Zone', zoneType: 'RESIDENTIAL', stateCode: 'MH', district: 'Pune', geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(400);
    });

    it('rejects an invalid zoneType with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Zone', zoneType: 'INDUSTRIAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', officerAuth)
        .send({ name: 'New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .send({ name: 'New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(401);
    });
  });

  describe('PATCH and DELETE /api/v1/gis/zoning-overlays/:id', () => {
    it('updates and then deletes a zoning overlay as admin', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Temp Zone', zoneType: 'RESIDENTIAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/gis/zoning-overlays/${created.body.id}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Renamed Zone' })
        .expect(200);
      expect(updated.body.name).toBe('Renamed Zone');
      expect(updated.body.zoneType).toBe('RESIDENTIAL'); // untouched fields survive a partial update

      await request(app.getHttpServer())
        .delete(`/api/v1/gis/zoning-overlays/${created.body.id}`)
        .set('Authorization', adminAuth)
        .expect(204);

      const listed = await request(app.getHttpServer()).get('/api/v1/gis/zoning-overlays').query({ district: 'Pune' }).expect(200);
      expect(listed.body.features.some((f: any) => f.properties.id === created.body.id)).toBe(false);
    });

    it('returns 404 deleting an unknown zoning overlay', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/gis/zoning-overlays/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .expect(404);
    });
  });

  describe('POST /api/v1/gis/restriction-zones', () => {
    it('creates a restriction zone as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'New Restriction', restrictionType: 'ENVIRONMENTAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(201);
      expect(res.body.restrictionType).toBe('ENVIRONMENTAL');
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', officerAuth)
        .send({ name: 'New Restriction', restrictionType: 'ENVIRONMENTAL', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(403);
    });
  });

  describe('POST /api/v1/gis/infrastructure', () => {
    it('creates an infrastructure feature (LineString) as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'New Road', featureType: 'ROAD', stateCode: 'MH', district: 'Pune', geometry: { type: 'LineString', coordinates: [[73.9, 18.6], [73.91, 18.61]] } })
        .expect(201);
      expect(res.body.featureType).toBe('ROAD');
    });

    it('creates an infrastructure feature (Point) as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'Substation', featureType: 'ELECTRICITY', stateCode: 'MH', district: 'Pune', geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(201);
      expect(res.body.featureType).toBe('ELECTRICITY');
    });

    it('rejects a Polygon geometry with 400 (only Point/LineString allowed)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Feature', featureType: 'ROAD', stateCode: 'MH', district: 'Pune', geometry: validPolygon })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', officerAuth)
        .send({ name: 'New Road', featureType: 'ROAD', stateCode: 'MH', district: 'Pune', geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(403);
    });
  });

  // Admin-only layer (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3 follow-up) -
  // unlike zoning/restriction/infrastructure above, GET is ADMIN-gated too:
  // an officer session must never see this layer, not just be blocked from
  // writing to it.
  describe('/api/v1/gis/admin-notes (admin-only layer - read AND write both gated)', () => {
    it('creates, lists, updates, and deletes an admin note as ADMIN', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .send({ name: 'Suspicious parcel cluster', notes: 'Flagged for internal review', stateCode: 'MH', district: 'Pune', geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(201);
      expect(created.body.notes).toBe('Flagged for internal review');
      expect(created.body.createdByUserId).toBeTruthy();

      const listed = await request(app.getHttpServer())
        .get('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .query({ district: 'Pune' })
        .expect(200);
      const feature = listed.body.features.find((f: any) => f.properties.id === created.body.id);
      expect(feature).toBeTruthy();
      expect(feature.properties.notes).toBe('Flagged for internal review');
      expect(feature.geometry.type).toBe('Point');

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/gis/admin-notes/${created.body.id}`)
        .set('Authorization', adminAuth)
        .send({ notes: 'Reviewed, no issue found' })
        .expect(200);
      expect(updated.body.notes).toBe('Reviewed, no issue found');
      expect(updated.body.name).toBe('Suspicious parcel cluster'); // untouched field survives a partial update

      await request(app.getHttpServer())
        .delete(`/api/v1/gis/admin-notes/${created.body.id}`)
        .set('Authorization', adminAuth)
        .expect(204);

      const afterDelete = await request(app.getHttpServer())
        .get('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .query({ district: 'Pune' })
        .expect(200);
      expect(afterDelete.body.features.some((f: any) => f.properties.id === created.body.id)).toBe(false);
    });

    it('rejects any geometry type other than Point/LineString/Polygon with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Note', stateCode: 'MH', district: 'Pune', geometry: { type: 'MultiPoint', coordinates: [[73.9, 18.6]] } })
        .expect(400);
    });

    it('rejects a GET from a non-admin officer with 403 - not just writes', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gis/admin-notes')
        .set('Authorization', officerAuth)
        .expect(403);
    });

    it('rejects a POST from a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', officerAuth)
        .send({ name: 'New Note', stateCode: 'MH', district: 'Pune', geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(403);
    });

    it('rejects an unauthenticated GET with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/gis/admin-notes').expect(401);
    });

    it('returns 404 updating/deleting an unknown admin note', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ name: 'x' })
        .expect(404);

      await request(app.getHttpServer())
        .delete('/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .expect(404);
    });
  });
});
