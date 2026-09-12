// Live-server counterpart of backend/test/health.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate) - assertions
// copied verbatim; only the app bootstrapping changed. Requires
// backend-py to already be up - see live-client.ts.
import request = require('supertest');
import { LIVE_BASE_URL } from './live-client';

describe('GET /health (live backend-py e2e)', () => {
  it('responds ok with no authentication and no /api/v1 prefix', async () => {
    const res = await request(LIVE_BASE_URL).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('is not reachable under the /api/v1 prefix', async () => {
    await request(LIVE_BASE_URL).get('/api/v1/health').expect(404);
  });
});
