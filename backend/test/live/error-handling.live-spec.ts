// Live-server counterpart of backend/test/error-handling.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Three of the
// original's four assertions are ported verbatim. The fourth - "turns an
// unhandled exception into a generic 500 with no stack trace leaked" -
// isn't: the original exercises it via a dedicated ThrowingTestController
// wired only into that spec's own in-process test module, and adding an
// equivalent deliberately-throwing route to the real, running backend-py
// app (even gated) isn't appropriate for a live server. That handler
// (app/middleware.py's generic Exception handler) is still exercised
// indirectly by every other spec's error paths; it just doesn't have a
// dedicated live assertion of its own the way the in-process pytest/Jest
// versions do.
import request = require('supertest');
import { LIVE_BASE_URL } from './live-client';

describe('Global error handling (live backend-py e2e)', () => {
  it('stamps a fresh X-Request-Id on a normal successful response', async () => {
    const res = await request(LIVE_BASE_URL).get('/health').expect(200);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('honors a caller-supplied X-Request-Id instead of minting a new one', async () => {
    const res = await request(LIVE_BASE_URL)
      .get('/health')
      .set('X-Request-Id', 'caller-supplied-id-123')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('caller-supplied-id-123');
  });

  it("preserves a thrown HttpException's status/message and adds requestId", async () => {
    const res = await request(LIVE_BASE_URL)
      .get('/api/v1/workflows/00000000-0000-0000-0000-000000000000')
      .expect(401); // no auth header - the auth dependency rejects before the route body runs

    expect(res.body).toMatchObject({ statusCode: 401 });
    expect(typeof res.body.requestId).toBe('string');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });
});
