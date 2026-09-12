// Live-server counterpart of backend/test/ai.e2e-spec.ts (PYTHON_MIGRATION_PLAN.md
// §4's second validation gate). Deliberate scope reduction, disclosed
// rather than silently dropped: the original mocks the `openai` SDK
// (`jest.mock('openai')`) to script the model's JSON response and assert
// on AiService's own filtering/validation logic against a controllable
// fake reply. A running backend-py instance has no such override seam -
// its Groq/Gemini call is real, whatever key (if any) is actually
// configured for this environment - so every assertion that depends on a
// *specific* scripted AI reply (DATA_QUERY filter parsing, the
// owner-only-department withholding checks that inspect what was sent to
// the AI, the 502-on-malformed-AI-response cases) is NOT ported here.
// This file only covers what's reachable without scripting the model:
// input validation (400s), auth (401/403), and not-found (404s), which
// happen before any AI call is made. Requires backend-py to already be
// up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures, square } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

describe('AI (live backend-py e2e)', () => {
  let parcelId: string;
  let alertId: string;
  let officerAuth: string;

  beforeAll(async () => {
    const parcelResult = await pgPool.query(
      `INSERT INTO parcels (id, canonical_parcel_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'MH', 'PUN', 'MHLB001', 500, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), now(), now())
       RETURNING id`,
      [`LIVE-AI-1-${Date.now()}`, JSON.stringify(square(73.85, 18.52))],
    );
    parcelId = parcelResult.rows[0].id;

    const alertResult = await pgPool.query(
      `INSERT INTO governance_alerts (id, parcel_id, alert_type, severity, source, status, explanation, created_at)
       VALUES (gen_random_uuid(), $1, 'TAX_OVERDUE', 'LOW', 'TAX_MONITOR', 'OPEN', 'Outstanding property tax is overdue.', now())
       RETURNING id`,
      [parcelId],
    );
    alertId = alertResult.rows[0].id;

    officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('POST /api/v1/ai/query', () => {
    it('rejects a request with an empty query with 400', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/ai/query').send({ query: '' }).expect(400);
      await request(LIVE_BASE_URL).post('/api/v1/ai/query').send({}).expect(400);
    });
  });

  describe('POST /api/v1/ai/parcels/:parcelId/explain', () => {
    it('returns 404 for an unknown parcel (without calling the AI at all)', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/ai/parcels/00000000-0000-0000-0000-000000000000/explain').expect(404);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).post('/api/v1/ai/parcels/not-a-uuid/explain').expect(400);
    });
  });

  describe('POST /api/v1/ai/alerts/:alertId/explain', () => {
    it('returns 404 for an unknown alert (without calling the AI at all)', async () => {
      await request(LIVE_BASE_URL)
        .post('/api/v1/ai/alerts/00000000-0000-0000-0000-000000000000/explain')
        .set('Authorization', officerAuth)
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).post(`/api/v1/ai/alerts/${alertId}/explain`).expect(401);
    });
  });
});
