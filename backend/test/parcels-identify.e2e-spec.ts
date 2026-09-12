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
import { renderParcelDocumentImage } from '../src/common/parcel-generation/parcel-document-generator';
import { createAuthenticatedUser } from './helpers/auth';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

// Upload-first Land Claim (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
// POST /parcels/identify-from-document OCRs an uploaded land document and
// matches it against real parcels, so a citizen doesn't need to already
// know their ULPIN/survey number.
describe('POST /api/v1/parcels/identify-from-document (e2e)', () => {
  let app: INestApplication;
  let testingModule: TestingModule;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let citizenAuth: string;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = testingModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    parcelRepository = testingModule.get(getRepositoryToken(Parcel));
    identifierRepository = testingModule.get(getRepositoryToken(ParcelIdentifier));
    citizenAuth = (await createAuthenticatedUser(testingModule, 'CITIZEN')).authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('identifies exactly one parcel when the document mentions its ULPIN', async () => {
    const target = await parcelRepository.save({
      canonicalParcelId: 'ID-1', ulpin: 'ULPIN0009998887', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 600, geometry: square(73.9, 18.6),
    });
    // A decoy parcel with no relation to the uploaded document's identifiers.
    await parcelRepository.save({
      canonicalParcelId: 'ID-2', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 600, geometry: square(73.91, 18.6),
    });
    const image = await renderParcelDocumentImage({
      ownerName: 'Some Owner', surveyNumber: target.ulpin!, areaSqM: 600, stateCode: 'MH', districtCode: 'PUN', registrationStatus: 'UNREGISTERED',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', image, 'document.png')
      .expect(201);

    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].id).toBe(target.id);
    expect(res.body.extractedText).toContain(target.ulpin);
  });

  it('identifies a parcel via a parcel_identifiers row (survey number), not just parcel.ulpin', async () => {
    const target = await parcelRepository.save({
      canonicalParcelId: 'ID-3', stateCode: 'TN', districtCode: 'CHE', localBodyCode: 'TNLB001', areaSqM: 300, geometry: square(80.3, 13.1),
    });
    await identifierRepository.save({
      parcel: target, identifierType: 'SURVEY_NUMBER', identifierValue: '77/9', sourceState: 'TN', sourceDepartment: 'Land Records',
    });
    const image = await renderParcelDocumentImage({
      ownerName: 'Some Owner', surveyNumber: '77/9', areaSqM: 300, stateCode: 'TN', districtCode: 'CHE', registrationStatus: 'UNREGISTERED',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', image, 'document.png')
      .expect(201);

    expect(res.body.candidates.some((p: any) => p.id === target.id)).toBe(true);
  });

  it('returns no candidates when nothing on the document matches any real parcel', async () => {
    const image = await renderParcelDocumentImage({
      ownerName: 'Nobody In Particular', surveyNumber: 'ZZ-NONEXISTENT-999', areaSqM: 1, stateCode: 'XX', districtCode: 'XX', registrationStatus: 'UNREGISTERED',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', image, 'document.png')
      .expect(201);

    expect(res.body.candidates).toEqual([]);
  });

  it('rejects a non-image file with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('rejects a request with no file attached, with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .expect(400);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const image = await renderParcelDocumentImage({
      ownerName: 'X', surveyNumber: 'X', areaSqM: 1, stateCode: 'XX', districtCode: 'XX', registrationStatus: 'UNREGISTERED',
    });
    await request(app.getHttpServer()).post('/api/v1/parcels/identify-from-document').attach('document', image, 'document.png').expect(401);
  });

  it('rejects a staff account (non-citizen) with 403', async () => {
    const officerAuth = (await createAuthenticatedUser(testingModule, 'LAND_RECORD_OFFICER')).authHeader;
    const image = await renderParcelDocumentImage({
      ownerName: 'X', surveyNumber: 'X', areaSqM: 1, stateCode: 'XX', districtCode: 'XX', registrationStatus: 'UNREGISTERED',
    });
    await request(app.getHttpServer())
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', officerAuth)
      .attach('document', image, 'document.png')
      .expect(403);
  });
});
