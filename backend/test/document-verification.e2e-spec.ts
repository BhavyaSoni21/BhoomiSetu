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
import { ParcelIdentifier } from '../src/parcels/parcel-identifier.entity';
import { StateALandRecord } from '../src/land-records/state-a-land-record.entity';

// A real, OCR-able PNG (rasterized from SVG text via sharp) rather than a
// mocked OCR response - these tests exercise the actual tesseract.js
// recognize() call against real image bytes, same "verify the real pipeline"
// standard as change-detection's own e2e tests.
async function documentImage(lines: string[]): Promise<Buffer> {
  const height = 60 + lines.length * 40;
  const text = lines.map((line, i) => `<text x="15" y="${50 + i * 40}" font-size="22" font-family="monospace">${line}</text>`).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="${height}"><rect width="700" height="${height}" fill="white"/>${text}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function blankImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
}

// OCR is real, local work (no external API), but a cold cache (first ever
// tesseract.js run on a machine) can take longer than Jest's 5s default.
const OCR_TEST_TIMEOUT = 20000;

describe('Document Verification (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let stateARepository: Repository<StateALandRecord>;

  let mhParcel: Parcel; // has a matching StateALandRecord -> exercises the OWNER_NAME/area-via-land-record path
  let tnParcel: Parcel; // no state schema in this mock -> exercises the OWNER_NAME NOT_AVAILABLE path
  let correctDoc: Buffer;
  let wrongDoc: Buffer;
  let partialDoc: Buffer;
  let tnCorrectDoc: Buffer;

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
    stateARepository = moduleFixture.get(getRepositoryToken(StateALandRecord));

    mhParcel = await parcelRepository.save({
      canonicalParcelId: 'DV-MH-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 5000,
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[73.85, 18.52], [73.851, 18.52], [73.851, 18.521], [73.85, 18.521], [73.85, 18.52]]] }),
    });
    await identifierRepository.save([
      { parcel: mhParcel, identifierType: 'LOCAL_PARCEL_ID', identifierValue: 'MH-PUN-9001', sourceState: 'MH', sourceDepartment: 'Land Records' },
      { parcel: mhParcel, identifierType: 'SURVEY_NUMBER', identifierValue: '77/3', sourceState: 'MH', sourceDepartment: 'Land Records' },
    ]);
    await stateARepository.save({
      surveyNumber: '77/3', subdivisionNumber: '3', ownerName: 'Test Owner', villageCode: 'VIL001', areaHectares: 0.5, recordStatus: 'ACTIVE',
    });

    tnParcel = await parcelRepository.save({
      canonicalParcelId: 'DV-TN-1', stateCode: 'TN', districtCode: 'CHE', localBodyCode: 'TNLB001', areaSqM: 8000,
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[80.27, 13.08], [80.271, 13.08], [80.271, 13.081], [80.27, 13.081], [80.27, 13.08]]] }),
    });
    await identifierRepository.save([
      { parcel: tnParcel, identifierType: 'LOCAL_PARCEL_ID', identifierValue: 'TN-CHE-4001', sourceState: 'TN', sourceDepartment: 'Land Records' },
    ]);

    correctDoc = await documentImage(['Survey Number: 77/3', 'Local ID: MH-PUN-9001', 'Owner Name: Test Owner', 'Area: 5000 sqm']);
    wrongDoc = await documentImage(['Survey Number: 000/0', 'Owner Name: Nobody Real', 'Area: 1 sqm']);
    partialDoc = await documentImage(['Survey Number: 77/3', 'Owner Name: Someone Else', 'Area: 5000 sqm']);
    tnCorrectDoc = await documentImage(['Local ID: TN-CHE-4001', 'Area: 8000 sqm']);
  }, OCR_TEST_TIMEOUT);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/document-verification/verify', () => {
    it('reports VERIFIED when every checkable field matches, with no auth required', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .attach('document', correctDoc, 'doc.png')
        .expect(201);

      expect(res.body.overallVerdict).toBe('VERIFIED');
      const statuses = Object.fromEntries(res.body.fieldChecks.map((f: any) => [f.field, f.status]));
      expect(statuses['IDENTIFIER (SURVEY_NUMBER)']).toBe('MATCHED');
      expect(statuses['IDENTIFIER (LOCAL_PARCEL_ID)']).toBe('MATCHED');
      expect(statuses.OWNER_NAME).toBe('MATCHED');
      expect(statuses.AREA).toBe('MATCHED');
    }, OCR_TEST_TIMEOUT);

    it('reports MISMATCH when no fields match', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .attach('document', wrongDoc, 'doc.png')
        .expect(201);

      expect(res.body.overallVerdict).toBe('MISMATCH');
      expect(res.body.fieldChecks.every((f: any) => f.status === 'MISMATCH')).toBe(true);
    }, OCR_TEST_TIMEOUT);

    it('reports PARTIAL_MATCH when some fields match and others do not', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .attach('document', partialDoc, 'doc.png')
        .expect(201);

      expect(res.body.overallVerdict).toBe('PARTIAL_MATCH');
      const statuses = Object.fromEntries(res.body.fieldChecks.map((f: any) => [f.field, f.status]));
      expect(statuses['IDENTIFIER (SURVEY_NUMBER)']).toBe('MATCHED');
      expect(statuses.OWNER_NAME).toBe('MISMATCH');
    }, OCR_TEST_TIMEOUT);

    it('reports OWNER_NAME as NOT_AVAILABLE for a state with no land-record schema in this mock, and excludes it from the verdict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', tnParcel.id)
        .attach('document', tnCorrectDoc, 'doc.png')
        .expect(201);

      const statuses = Object.fromEntries(res.body.fieldChecks.map((f: any) => [f.field, f.status]));
      expect(statuses.OWNER_NAME).toBe('NOT_AVAILABLE');
      expect(res.body.overallVerdict).toBe('VERIFIED'); // every *checkable* field matched
    }, OCR_TEST_TIMEOUT);

    it('reports INSUFFICIENT_DATA for a blank/unreadable image instead of a misleading blanket MISMATCH', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .attach('document', await blankImage(), 'blank.png')
        .expect(201);

      expect(res.body.overallVerdict).toBe('INSUFFICIENT_DATA');
      expect(res.body.fieldChecks).toEqual([]);
    }, OCR_TEST_TIMEOUT);

    it('returns 404 for a parcel that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', '00000000-0000-0000-0000-000000000000')
        .attach('document', correctDoc, 'doc.png')
        .expect(404);
    }, OCR_TEST_TIMEOUT);

    it('rejects a request missing the document file with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .expect(400);
    });

    it('rejects a non-image file with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', mhParcel.id)
        .attach('document', Buffer.from('not an image'), { filename: 'doc.txt', contentType: 'text/plain' })
        .expect(400);
    });

    it('rejects an invalid parcelId with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/document-verification/verify')
        .field('parcelId', 'not-a-uuid')
        .attach('document', correctDoc, 'doc.png')
        .expect(400);
    });
  });
});
