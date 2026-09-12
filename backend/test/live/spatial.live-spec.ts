// Live-server counterpart of backend/test/spatial.e2e-spec.ts (PYTHON_MIGRATION_PLAN.md
// §4's second validation gate). Assertions copied verbatim; only app
// bootstrapping and fixture seeding (TypeORM repositories -> raw SQL
// against backend-py's own database) changed, and every fixture/test
// polygon moved to a coordinate box unique to this run (suffix-tagged
// district codes) so repeated runs never collide with leftover data or
// each other's no-overlap validation. Requires backend-py to already be
// up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('Spatial demo layers (live backend-py e2e)', () => {
  let adminAuth: string;
  let officerAuth: string;
  let alertTestParcelId: string;
  let updateTestParcelAId: string;
  let updateTestParcelBId: string;
  const suffix = Date.now();
  const district = `SPLIVE${suffix}`.slice(0, 30);

  const squareGeoJSON = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[73.85, 18.52], [73.86, 18.52], [73.86, 18.53], [73.85, 18.53], [73.85, 18.52]]],
  });
  const lineGeoJSON = JSON.stringify({ type: 'LineString', coordinates: [[73.85, 18.52], [73.86, 18.53]] });

  async function insertParcel(coords: number[][]): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MH', $2, 'TEST', 400, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), now(), now())
       RETURNING id`,
      [`LIVE-SP-${suffix}-${Math.random().toString(36).slice(2, 8)}`, district, JSON.stringify({ type: 'Polygon', coordinates: [coords] })],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    await pgPool.query(
      `INSERT INTO zoning_overlays (id, name, zone_type, state_code, district, geometry, parcel_ids, created_at)
       VALUES (gen_random_uuid(), 'Live Test Residential Zone', 'RESIDENTIAL', 'MH', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, now())`,
      [district, squareGeoJSON, ['p1', 'p2']],
    );
    await pgPool.query(
      `INSERT INTO restriction_zones (id, name, restriction_type, state_code, district, geometry, affected_parcel_ids, created_at)
       VALUES (gen_random_uuid(), 'Live Test Flood Zone', 'FLOOD', 'MH', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, now())`,
      [district, squareGeoJSON, ['p1']],
    );
    await pgPool.query(
      `INSERT INTO infrastructure_features (id, name, feature_type, state_code, district, geometry, created_at)
       VALUES (gen_random_uuid(), 'Live Test Road', 'ROAD', 'MH', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), now())`,
      [district, lineGeoJSON],
    );
    await pgPool.query(
      `INSERT INTO change_detection_events (id, description, state_code, district, geometry, affected_parcel_ids, detected_at)
       VALUES (gen_random_uuid(), 'Live test change event', 'MH', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, now())`,
      [district, squareGeoJSON, ['p1', 'p2']],
    );

    alertTestParcelId = await insertParcel([[74.005, 19.005], [74.015, 19.005], [74.015, 19.015], [74.005, 19.015], [74.005, 19.005]]);
    updateTestParcelAId = await insertParcel([[74.304, 19.304], [74.306, 19.304], [74.306, 19.306], [74.304, 19.306], [74.304, 19.304]]);
    updateTestParcelBId = await insertParcel([[74.349, 19.349], [74.351, 19.349], [74.351, 19.351], [74.349, 19.351], [74.349, 19.349]]);

    adminAuth = (await createLiveAuthenticatedUser('ADMIN')).authHeader;
    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM zoning_overlays WHERE district = $1', [district]);
    await pgPool.query('DELETE FROM restriction_zones WHERE district = $1', [district]);
    await pgPool.query('DELETE FROM infrastructure_features WHERE district = $1', [district]);
    await pgPool.query('DELETE FROM change_detection_events WHERE district = $1', [district]);
    await pgPool.query('DELETE FROM admin_map_notes WHERE district = $1', [district]);
    await pgPool.query(`DELETE FROM governance_alerts WHERE parcel_id IN (SELECT id::text FROM parcels WHERE district_code = $1)`, [district]);
    await pgPool.query('DELETE FROM parcels WHERE district_code = $1', [district]);
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  it('GET /api/v1/gis/zoning-overlays returns a FeatureCollection filtered by state+district', async () => {
    const res = await request(LIVE_BASE_URL).get('/api/v1/gis/zoning-overlays').query({ state: 'MH', district }).expect(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.zoneType).toBe('RESIDENTIAL');
    expect(res.body.features[0].geometry.type).toBe('Polygon');
  });

  it('GET /api/v1/gis/restriction-zones returns affected parcel ids', async () => {
    const res = await request(LIVE_BASE_URL).get('/api/v1/gis/restriction-zones').query({ district }).expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.affectedParcelIds).toEqual(['p1']);
  });

  it('GET /api/v1/gis/infrastructure returns LineString features', async () => {
    const res = await request(LIVE_BASE_URL).get('/api/v1/gis/infrastructure').query({ district }).expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].geometry.type).toBe('LineString');
    expect(res.body.features[0].properties.featureType).toBe('ROAD');
  });

  it('GET /api/v1/gis/change-detection-events returns simulated change events', async () => {
    const res = await request(LIVE_BASE_URL).get('/api/v1/gis/change-detection-events').query({ district }).expect(200);
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0].properties.affectedParcelIds).toEqual(['p1', 'p2']);
  });

  const validPolygon = {
    type: 'Polygon',
    coordinates: [[[73.9, 18.6], [73.91, 18.6], [73.91, 18.61], [73.9, 18.61], [73.9, 18.6]]],
  };

  describe('POST /api/v1/gis/zoning-overlays', () => {
    it('creates a zoning overlay as admin', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Live New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district, geometry: validPolygon, parcelIds: ['p9'] })
        .expect(201);

      expect(res.body.zoneType).toBe('AGRICULTURAL');
      expect(res.body.id).toBeTruthy();

      const listed = await request(LIVE_BASE_URL).get('/api/v1/gis/zoning-overlays').query({ district }).expect(200);
      expect(listed.body.features.some((f: any) => f.properties.id === res.body.id)).toBe(true);
    });

    it('rejects a geometry that is not a Polygon with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Zone', zoneType: 'RESIDENTIAL', stateCode: 'MH', district, geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(400);
    });

    it('rejects an invalid zoneType with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Zone', zoneType: 'INDUSTRIAL', stateCode: 'MH', district, geometry: validPolygon })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', officerAuth)
        .send({ name: 'New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district, geometry: validPolygon })
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .send({ name: 'New Zone', zoneType: 'AGRICULTURAL', stateCode: 'MH', district, geometry: validPolygon })
        .expect(401);
    });
  });

  describe('PATCH and DELETE /api/v1/gis/zoning-overlays/:id', () => {
    it('updates and then deletes a zoning overlay as admin', async () => {
      const tempZonePolygon = { type: 'Polygon', coordinates: [[[73.7, 18.3], [73.71, 18.3], [73.71, 18.31], [73.7, 18.31], [73.7, 18.3]]] };
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Temp Zone', zoneType: 'RESIDENTIAL', stateCode: 'MH', district, geometry: tempZonePolygon })
        .expect(201);

      const updated = await request(LIVE_BASE_URL)
        .patch(`/api/v1/gis/zoning-overlays/${created.body.id}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Renamed Zone' })
        .expect(200);
      expect(updated.body.name).toBe('Renamed Zone');
      expect(updated.body.zoneType).toBe('RESIDENTIAL');

      await request(LIVE_BASE_URL).delete(`/api/v1/gis/zoning-overlays/${created.body.id}`).set('Authorization', adminAuth).expect(204);

      const listed = await request(LIVE_BASE_URL).get('/api/v1/gis/zoning-overlays').query({ district }).expect(200);
      expect(listed.body.features.some((f: any) => f.properties.id === created.body.id)).toBe(false);
    });

    it('returns 404 deleting an unknown zoning overlay', async () => {
      await request(LIVE_BASE_URL).delete('/api/v1/gis/zoning-overlays/00000000-0000-0000-0000-000000000000').set('Authorization', adminAuth).expect(404);
    });
  });

  describe('POST /api/v1/gis/restriction-zones', () => {
    it('creates a restriction zone as admin', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'Live New Restriction', restrictionType: 'ENVIRONMENTAL', stateCode: 'MH', district, geometry: validPolygon })
        .expect(201);
      expect(res.body.restrictionType).toBe('ENVIRONMENTAL');
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', officerAuth)
        .send({ name: 'New Restriction', restrictionType: 'ENVIRONMENTAL', stateCode: 'MH', district, geometry: validPolygon })
        .expect(403);
    });
  });

  describe('POST /api/v1/gis/infrastructure', () => {
    it('creates an infrastructure feature (LineString) as admin', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'Live New Road', featureType: 'ROAD', stateCode: 'MH', district, geometry: { type: 'LineString', coordinates: [[73.9, 18.6], [73.91, 18.61]] } })
        .expect(201);
      expect(res.body.featureType).toBe('ROAD');
    });

    it('creates an infrastructure feature (Point) as admin', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'Live Substation', featureType: 'ELECTRICITY', stateCode: 'MH', district, geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(201);
      expect(res.body.featureType).toBe('ELECTRICITY');
    });

    it('rejects a Polygon geometry with 400 (only Point/LineString allowed)', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Feature', featureType: 'ROAD', stateCode: 'MH', district, geometry: validPolygon })
        .expect(400);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/infrastructure')
        .set('Authorization', officerAuth)
        .send({ name: 'New Road', featureType: 'ROAD', stateCode: 'MH', district, geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(403);
    });
  });

  describe('/api/v1/gis/admin-notes (admin-only layer - read AND write both gated)', () => {
    it('creates, lists, updates, and deletes an admin note as ADMIN', async () => {
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .send({ name: 'Live Suspicious parcel cluster', notes: 'Flagged for internal review', stateCode: 'MH', district, geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(201);
      expect(created.body.notes).toBe('Flagged for internal review');
      expect(created.body.createdByUserId).toBeTruthy();

      const listed = await request(LIVE_BASE_URL).get('/api/v1/gis/admin-notes').set('Authorization', adminAuth).query({ district }).expect(200);
      const feature = listed.body.features.find((f: any) => f.properties.id === created.body.id);
      expect(feature).toBeTruthy();
      expect(feature.properties.notes).toBe('Flagged for internal review');
      expect(feature.geometry.type).toBe('Point');

      const updated = await request(LIVE_BASE_URL)
        .patch(`/api/v1/gis/admin-notes/${created.body.id}`)
        .set('Authorization', adminAuth)
        .send({ notes: 'Reviewed, no issue found' })
        .expect(200);
      expect(updated.body.notes).toBe('Reviewed, no issue found');
      expect(updated.body.name).toBe('Live Suspicious parcel cluster');

      await request(LIVE_BASE_URL).delete(`/api/v1/gis/admin-notes/${created.body.id}`).set('Authorization', adminAuth).expect(204);

      const afterDelete = await request(LIVE_BASE_URL).get('/api/v1/gis/admin-notes').set('Authorization', adminAuth).query({ district }).expect(200);
      expect(afterDelete.body.features.some((f: any) => f.properties.id === created.body.id)).toBe(false);
    });

    it('rejects any geometry type other than Point/LineString/Polygon with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', adminAuth)
        .send({ name: 'Bad Note', stateCode: 'MH', district, geometry: { type: 'MultiPoint', coordinates: [[73.9, 18.6]] } })
        .expect(400);
    });

    it('rejects a GET from a non-admin officer with 403 - not just writes', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/gis/admin-notes').set('Authorization', officerAuth).expect(403);
    });

    it('rejects a POST from a non-admin officer with 403', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/admin-notes')
        .set('Authorization', officerAuth)
        .send({ name: 'New Note', stateCode: 'MH', district, geometry: { type: 'Point', coordinates: [73.9, 18.6] } })
        .expect(403);
    });

    it('rejects an unauthenticated GET with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/gis/admin-notes').expect(401);
    });

    it('returns 404 updating/deleting an unknown admin note', async () => {
      await request(LIVE_BASE_URL).patch('/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000').set('Authorization', adminAuth).send({ name: 'x' }).expect(404);
      await request(LIVE_BASE_URL).delete('/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000').set('Authorization', adminAuth).expect(404);
    });
  });

  describe('RestrictionZone spatial overlap -> real GovernanceAlert, and no-overlap validation', () => {
    it('creates a RestrictionZone overlapping a real parcel, computes affectedParcelIds server-side, and creates a matching GovernanceAlert', async () => {
      const zonePolygon = { type: 'Polygon', coordinates: [[[74.0, 19.0], [74.02, 19.0], [74.02, 19.02], [74.0, 19.02], [74.0, 19.0]]] };
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'Alert Test Zone', restrictionType: 'ENVIRONMENTAL', stateCode: 'MH', district, geometry: zonePolygon, affectedParcelIds: ['not-a-real-parcel'] })
        .expect(201);

      expect(res.body.affectedParcelIds).toEqual([alertTestParcelId]);

      const alerts = await pgPool.query(
        `SELECT source, severity, status FROM governance_alerts WHERE parcel_id = $1 AND alert_type = 'RESTRICTION_ZONE_OVERLAP'`,
        [alertTestParcelId],
      );
      expect(alerts.rows).toHaveLength(1);
      expect(alerts.rows[0].source).toBe('RESTRICTION_MONITOR');
      expect(alerts.rows[0].severity).toBe('MEDIUM');
      expect(alerts.rows[0].status).toBe('OPEN');
    });

    it('rejects a second RestrictionZone overlapping the first with 400', async () => {
      const overlappingPolygon = { type: 'Polygon', coordinates: [[[74.005, 19.005], [74.025, 19.005], [74.025, 19.025], [74.005, 19.025], [74.005, 19.005]]] };
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'Overlapping Zone', restrictionType: 'FLOOD', stateCode: 'MH', district, geometry: overlappingPolygon })
        .expect(400);
      expect(res.body.message).toContain('Alert Test Zone');
    });

    it('rejects a second overlapping ZoningOverlay with 400 (same layer type)', async () => {
      const zonePolygon = { type: 'Polygon', coordinates: [[[74.1, 19.1], [74.12, 19.1], [74.12, 19.12], [74.1, 19.12], [74.1, 19.1]]] };
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'First Overlap-Test Zoning', zoneType: 'RESIDENTIAL', stateCode: 'MH', district, geometry: zonePolygon })
        .expect(201);

      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Second Overlap-Test Zoning', zoneType: 'COMMERCIAL', stateCode: 'MH', district, geometry: zonePolygon })
        .expect(400);
    });

    it('does NOT reject a ZoningOverlay and a RestrictionZone covering the same area (different layer types)', async () => {
      const sharedPolygon = { type: 'Polygon', coordinates: [[[74.2, 19.2], [74.22, 19.2], [74.22, 19.22], [74.2, 19.22], [74.2, 19.2]]] };
      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/zoning-overlays')
        .set('Authorization', adminAuth)
        .send({ name: 'Cross-Type Zoning', zoneType: 'AGRICULTURAL', stateCode: 'MH', district, geometry: sharedPolygon })
        .expect(201);

      await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'Cross-Type Restriction', restrictionType: 'PROTECTED_AREA', stateCode: 'MH', district, geometry: sharedPolygon })
        .expect(201);
    });

    it('updating a RestrictionZone to newly cover a second parcel creates exactly one new alert, and none for the already-covered parcel', async () => {
      const smallZone = { type: 'Polygon', coordinates: [[[74.3, 19.3], [74.31, 19.3], [74.31, 19.31], [74.3, 19.31], [74.3, 19.3]]] };
      const created = await request(LIVE_BASE_URL)
        .post('/api/v1/gis/restriction-zones')
        .set('Authorization', adminAuth)
        .send({ name: 'Update Test Zone', restrictionType: 'FLOOD', stateCode: 'MH', district, geometry: smallZone })
        .expect(201);
      expect(created.body.affectedParcelIds).toEqual([updateTestParcelAId]);

      const alertsForAAfterCreate = await pgPool.query(
        `SELECT 1 FROM governance_alerts WHERE parcel_id = $1 AND alert_type = 'RESTRICTION_ZONE_OVERLAP'`,
        [updateTestParcelAId],
      );
      expect(alertsForAAfterCreate.rows).toHaveLength(1);

      const bigZone = { type: 'Polygon', coordinates: [[[74.3, 19.3], [74.4, 19.3], [74.4, 19.4], [74.3, 19.4], [74.3, 19.3]]] };
      const updated = await request(LIVE_BASE_URL)
        .patch(`/api/v1/gis/restriction-zones/${created.body.id}`)
        .set('Authorization', adminAuth)
        .send({ geometry: bigZone })
        .expect(200);
      expect(updated.body.affectedParcelIds.sort()).toEqual([updateTestParcelAId, updateTestParcelBId].sort());

      const alertsForAAfterUpdate = await pgPool.query(
        `SELECT 1 FROM governance_alerts WHERE parcel_id = $1 AND alert_type = 'RESTRICTION_ZONE_OVERLAP'`,
        [updateTestParcelAId],
      );
      expect(alertsForAAfterUpdate.rows).toHaveLength(1);

      const alertsForB = await pgPool.query(
        `SELECT 1 FROM governance_alerts WHERE parcel_id = $1 AND alert_type = 'RESTRICTION_ZONE_OVERLAP'`,
        [updateTestParcelBId],
      );
      expect(alertsForB.rows).toHaveLength(1);
    });
  });
});
