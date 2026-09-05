process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { ChangeDetectionEvent } from '../src/spatial/change-detection-event.entity';

const IMAGE_SIZE = 200;

// Builds a raw RGBA buffer (a solid background, optionally with a colored
// rectangle painted into it) and encodes it as a real PNG via sharp - so
// these tests exercise the actual decode/resize/diff pipeline against real
// image bytes, not a mocked stand-in.
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

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

// Image bounds cover exactly this box, so a parcel placed inside it should
// be flagged, and a parcel placed well outside it should not be.
const IMAGE_BOUNDS = { minLng: '73.849', minLat: '18.519', maxLng: '73.852', maxLat: '18.522' };
// A 40x40 painted block centered on pixel (100,100), which is where a
// parcel centered in IMAGE_BOUNDS maps to at a 200x200 analysis grid.
const CHANGED_RECT = { minRow: 80, maxRow: 120, minCol: 80, maxCol: 120, color: [200, 0, 0] as [number, number, number] };

describe('Change Detection (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let alertRepository: Repository<GovernanceAlert>;
  let eventRepository: Repository<ChangeDetectionEvent>;
  let nearParcel: Parcel;
  let farParcel: Parcel;
  let greenImage: Buffer;
  let changedImage: Buffer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));
    eventRepository = moduleFixture.get(getRepositoryToken(ChangeDetectionEvent));

    // Centroid at (73.8505, 18.5205) - the exact center of IMAGE_BOUNDS,
    // which maps to pixel (100,100), inside CHANGED_RECT's painted block.
    nearParcel = await parcelRepository.save({
      canonicalParcelId: 'CD-NEAR', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
      geometry: square(73.8502, 18.5202, 0.0006),
    });
    // Nowhere near IMAGE_BOUNDS.
    farParcel = await parcelRepository.save({
      canonicalParcelId: 'CD-FAR', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
      geometry: square(73.95, 18.60, 0.001),
    });

    greenImage = await makeImage([0, 150, 0]);
    changedImage = await makeImage([0, 150, 0], CHANGED_RECT);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/change-detection/analyze', () => {
    it('detects a real change and creates a governance alert only for the affected parcel', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/change-detection/analyze')
        .field(IMAGE_BOUNDS)
        .field('description', 'Test change')
        .attach('before', greenImage, 'before.png')
        .attach('after', changedImage, 'after.png')
        .expect(201);

      expect(res.body.changeDetected).toBe(true);
      expect(res.body.changedPixelRatio).toBeGreaterThan(0);
      expect(res.body.changeRegion.type).toBe('Polygon');
      expect(res.body.affectedParcelIds).toEqual([nearParcel.id]);
      expect(res.body.affectedParcelIds).not.toContain(farParcel.id);
      expect(res.body.alertsCreated).toBe(1);
      expect(res.body.eventId).toBeTruthy();

      const alerts = await alertRepository.find({ where: { parcelId: nearParcel.id } });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('UNAUTHORIZED_CHANGE_DETECTED');
      expect(alerts[0].source).toBe('CHANGE_DETECTION');
      expect(alerts[0].status).toBe('OPEN');

      const event = await eventRepository.findOneBy({ id: res.body.eventId });
      expect(event?.description).toBe('Test change');
      expect(event?.affectedParcelIds).toEqual([nearParcel.id]);
    });

    it('reports no change and creates nothing when before/after are identical', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/change-detection/analyze')
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
      await request(app.getHttpServer())
        .post('/api/v1/change-detection/analyze')
        .field(IMAGE_BOUNDS)
        .attach('before', greenImage, 'before.png')
        .expect(400);
    });

    it('rejects a non-image file with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/change-detection/analyze')
        .field(IMAGE_BOUNDS)
        .attach('before', Buffer.from('not an image'), { filename: 'before.txt', contentType: 'text/plain' })
        .attach('after', changedImage, 'after.png')
        .expect(400);
    });

    it('rejects out-of-range coordinates with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/change-detection/analyze')
        .field({ minLng: '999', minLat: '18.519', maxLng: '73.852', maxLat: '18.522' })
        .attach('before', greenImage, 'before.png')
        .attach('after', changedImage, 'after.png')
        .expect(400);
    });
  });
});
