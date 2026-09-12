// Live-server counterpart of backend/test/change-detection.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Assertions
// copied verbatim; only app bootstrapping and fixture seeding (TypeORM
// repositories -> raw SQL against backend-py's own database) changed.
// Requires backend-py to already be up - see live-client.ts.
import request = require('supertest');
import sharp from 'sharp';
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

const IMAGE_SIZE = 200;

async function makeImage(
  fillColor: [number, number, number],
  rect?: { minRow: number; maxRow: number; minCol: number; maxCol: number; color: [number, number, number] },
): Promise<Buffer> {
  const channels = 4;
  const buf = Buffer.alloc(IMAGE_SIZE * IMAGE_SIZE * channels);
  for (let i = 0; i < IMAGE_SIZE * IMAGE_SIZE; i++) {
    buf[i * 4] = fillColor[0];
    buf[i * 4 + 1] = fillColor[1];
    buf[i * 4 + 2] = fillColor[2];
    buf[i * 4 + 3] = 255;
  }
  if (rect) {
    for (let row = rect.minRow; row <= rect.maxRow; row++) {
      for (let col = rect.minCol; col <= rect.maxCol; col++) {
        const idx = (row * IMAGE_SIZE + col) * 4;
        buf[idx] = rect.color[0];
        buf[idx + 1] = rect.color[1];
        buf[idx + 2] = rect.color[2];
        buf[idx + 3] = 255;
      }
    }
  }
  return sharp(buf, { raw: { width: IMAGE_SIZE, height: IMAGE_SIZE, channels: 4 } }).png().toBuffer();
}

// Image bounds cover exactly this box, so a parcel placed inside it should
// be flagged, and a parcel placed well outside it should not be.
const IMAGE_BOUNDS = { minLng: '73.849', minLat: '18.519', maxLng: '73.852', maxLat: '18.522' };
// A 40x40 painted block centered on pixel (100,100), which is where a
// parcel centered in IMAGE_BOUNDS maps to at a 200x200 analysis grid.
const CHANGED_RECT = { minRow: 80, maxRow: 120, minCol: 80, maxCol: 120, color: [200, 0, 0] as [number, number, number] };

describe('Change Detection (live backend-py e2e)', () => {
  let nearParcelId: string;
  let farParcelId: string;
  let greenImage: Buffer;
  let changedImage: Buffer;
  let officerAuth: string;
  const suffix = Date.now();

  async function insertParcel(canonicalParcelId: string, geoJson: unknown): Promise<string> {
    const result = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MH', 'PUN', 'MHLB001', 100, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), now(), now())
       RETURNING id`,
      [canonicalParcelId, JSON.stringify(geoJson)],
    );
    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    // Centroid at (73.8505, 18.5205) - the exact center of IMAGE_BOUNDS,
    // which maps to pixel (100,100), inside CHANGED_RECT's painted block.
    nearParcelId = await insertParcel(`LIVE-CD-NEAR-${suffix}`, square(73.8502, 18.5202, 0.0006));
    // Nowhere near IMAGE_BOUNDS.
    farParcelId = await insertParcel(`LIVE-CD-FAR-${suffix}`, square(73.95, 18.60, 0.001));

    greenImage = await makeImage([0, 150, 0]);
    changedImage = await makeImage([0, 150, 0], CHANGED_RECT);

    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('POST /api/v1/change-detection/analyze', () => {
    it('detects a real change and creates a governance alert only for the affected parcel', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .set('Authorization', officerAuth)
        .field(IMAGE_BOUNDS)
        .field('description', 'Live test change')
        .attach('before', greenImage, 'before.png')
        .attach('after', changedImage, 'after.png')
        .expect(201);

      expect(res.body.changeDetected).toBe(true);
      expect(res.body.changedPixelRatio).toBeGreaterThan(0);
      expect(res.body.changeRegion.type).toBe('Polygon');
      expect(res.body.affectedParcelIds).toEqual([nearParcelId]);
      expect(res.body.affectedParcelIds).not.toContain(farParcelId);
      expect(res.body.alertsCreated).toBe(1);
      expect(res.body.eventId).toBeTruthy();

      const alerts = await pgPool.query(
        `SELECT alert_type, source, status FROM governance_alerts WHERE parcel_id = $1`,
        [nearParcelId],
      );
      expect(alerts.rows).toHaveLength(1);
      expect(alerts.rows[0].alert_type).toBe('UNAUTHORIZED_CHANGE_DETECTED');
      expect(alerts.rows[0].source).toBe('CHANGE_DETECTION');
      expect(alerts.rows[0].status).toBe('OPEN');

      const event = await pgPool.query(
        `SELECT description, affected_parcel_ids FROM change_detection_events WHERE id = $1`,
        [res.body.eventId],
      );
      expect(event.rows[0].description).toBe('Live test change');
      expect(event.rows[0].affected_parcel_ids).toEqual([nearParcelId]);
    });

    it('reports no change and creates nothing when before/after are identical', async () => {
      const res = await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .set('Authorization', officerAuth)
        .field(IMAGE_BOUNDS)
        .attach('before', greenImage, 'before.png')
        .attach('after', greenImage, 'after.png')
        .expect(201);

      expect(res.body.changeDetected).toBe(false);
      expect(res.body.changeRegion).toBeNull();
      expect(res.body.affectedParcelIds).toEqual([]);
      expect(res.body.alertsCreated).toBe(0);
    });

    it('rejects a request missing the "after" image with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .set('Authorization', officerAuth)
        .field(IMAGE_BOUNDS)
        .attach('before', greenImage, 'before.png')
        .expect(400);
    });

    it('rejects a non-image file with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .set('Authorization', officerAuth)
        .field(IMAGE_BOUNDS)
        .attach('before', Buffer.from('not an image'), { filename: 'before.txt', contentType: 'text/plain' })
        .attach('after', changedImage, 'after.png')
        .expect(400);
    });

    it('rejects out-of-range coordinates with 400', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .set('Authorization', officerAuth)
        .field({ minLng: '999', minLat: '18.519', maxLng: '73.852', maxLat: '18.522' })
        .attach('before', greenImage, 'before.png')
        .attach('after', changedImage, 'after.png')
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/change-detection/analyze')
        .field(IMAGE_BOUNDS)
        .attach('before', greenImage, 'before.png')
        .attach('after', changedImage, 'after.png')
        .expect(401);
    });
  });
});
