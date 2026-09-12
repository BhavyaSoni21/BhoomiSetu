// Live-server counterpart of backend/test/parcels-identify.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Deliberate
// scope reduction, disclosed rather than silently dropped: the original
// renders a real land-document image via the backend's own
// renderParcelDocumentImage generator and asserts on backend-py's OCR
// extraction actually matching a real parcel by the text embedded in it.
// Faithfully reproducing that here would mean re-implementing (or
// importing, which isn't possible across a TS/Python boundary) backend-py's
// own OCR text-rendering conventions closely enough for its Tesseract
// pipeline to extract matching text - not a meaningful proof of anything
// beyond "this harness can render text Tesseract likes." This file only
// covers what's reachable without that: input validation (400s) and auth
// (401/403), which happen before OCR ever runs. Requires backend-py to
// already be up - see live-client.ts.
import request = require('supertest');
import sharp from 'sharp';
import { LIVE_BASE_URL, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

async function makeBlankImage(): Promise<Buffer> {
  const size = 64;
  return sharp(Buffer.alloc(size * size * 4, 255), { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

describe('POST /api/v1/parcels/identify-from-document (live backend-py e2e)', () => {
  let citizenAuth: string;
  let blankImage: Buffer;

  beforeAll(async () => {
    citizenAuth = (await createLiveAuthenticatedUser('CITIZEN')).authHeader;
    blankImage = await makeBlankImage();
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  it('returns no candidates when nothing on the document matches any real parcel', async () => {
    const res = await request(LIVE_BASE_URL)
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', blankImage, 'document.png')
      .expect(200);

    expect(res.body.candidates).toEqual([]);
  });

  it('rejects a non-image file with 400', async () => {
    await request(LIVE_BASE_URL)
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', citizenAuth)
      .attach('document', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('rejects a request with no file attached, with 400', async () => {
    await request(LIVE_BASE_URL).post('/api/v1/parcels/identify-from-document').set('Authorization', citizenAuth).expect(400);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(LIVE_BASE_URL).post('/api/v1/parcels/identify-from-document').attach('document', blankImage, 'document.png').expect(401);
  });

  it('rejects a staff account (non-citizen) with 403', async () => {
    const officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
    await request(LIVE_BASE_URL)
      .post('/api/v1/parcels/identify-from-document')
      .set('Authorization', officerAuth)
      .attach('document', blankImage, 'document.png')
      .expect(403);
  });
});
