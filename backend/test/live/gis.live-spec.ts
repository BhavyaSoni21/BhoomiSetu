// Live-server counterpart of backend/test/gis.e2e-spec.ts (PYTHON_MIGRATION_PLAN.md
// §4's second validation gate). Assertions copied verbatim; only app
// bootstrapping and fixture seeding (TypeORM repositories -> raw SQL
// against backend-py's own database) changed. Requires backend-py to
// already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';

describe('GIS endpoints (live backend-py e2e)', () => {
  let parcelIds: string[];
  const suffix = Date.now();

  const geometry = (coords: number[][]) => JSON.stringify({ type: 'Polygon', coordinates: [coords] });

  async function insertParcel(canonicalParcelId: string, ulpin: string | null, stateCode: string, districtCode: string, localBodyCode: string, areaSqM: number, coords: number[][]): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, ulpin, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), now(), now())
       RETURNING id`,
      [canonicalParcelId, ulpin, stateCode, districtCode, localBodyCode, areaSqM, geometry(coords)],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    parcelIds = [
      await insertParcel(`LIVE-GIS-1-${suffix}`, `ULPIN-LIVE-GIS-1-${suffix}`, 'DL', 'GISNDL', 'DLLB001', 500, [
        [77.1, 28.6], [77.11, 28.6], [77.11, 28.61], [77.1, 28.61], [77.1, 28.6],
      ]),
      await insertParcel(`LIVE-GIS-2-${suffix}`, null, 'DL', 'GISSDL', 'DLLB002', 750, [
        [77.2, 28.5], [77.21, 28.5], [77.21, 28.51], [77.2, 28.51], [77.2, 28.5],
      ]),
      await insertParcel(`LIVE-GIS-3-${suffix}`, `ULPIN-LIVE-GIS-3-${suffix}`, 'KA', 'GISBLR', 'KALB001', 300, [
        [77.6, 12.9], [77.61, 12.9], [77.61, 12.91], [77.6, 12.91], [77.6, 12.9],
      ]),
    ];
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/gis/parcels', () => {
    it('filters by state and district together', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/gis/parcels').query({ state: 'DL', district: 'GISSDL' }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].canonicalParcelId).toBe(`LIVE-GIS-2-${suffix}`);
    });

    it('filters by state', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/gis/parcels').query({ state: 'DL', district: 'GISNDL' }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels.every((p: any) => p.stateCode === 'DL')).toBe(true);
    });

    it('returns valid GeoJSON geometry strings for each parcel', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/gis/parcels').query({ district: 'GISBLR' }).expect(200);
      for (const parcel of res.body.parcels) {
        const geom = JSON.parse(parcel.geometry);
        expect(geom.type).toBe('Polygon');
        expect(Array.isArray(geom.coordinates)).toBe(true);
      }
    });

    it('respects limit', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/gis/parcels').query({ limit: 1 }).expect(200);
      expect(res.body.parcels).toHaveLength(1);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/v1/gis/parcels/:id/geometry', () => {
    it('returns a GeoJSON Feature for a valid parcel id', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/gis/parcels/${parcelIds[0]}/geometry`).expect(200);
      expect(res.body.type).toBe('Feature');
      expect(res.body.properties.id).toBe(parcelIds[0]);
      expect(res.body.geometry.type).toBe('Polygon');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/gis/parcels/not-a-uuid/geometry').expect(400);
    });

    it('returns an empty body for a well-formed but unknown UUID', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/gis/parcels/00000000-0000-0000-0000-000000000000/geometry').expect(200);
      expect(res.body).toEqual({});
    });
  });

  describe('GET /api/v1/gis/parcels/:id/restrictions', () => {
    it('returns an array (placeholder) for a valid parcel id', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/gis/parcels/${parcelIds[0]}/restrictions`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
