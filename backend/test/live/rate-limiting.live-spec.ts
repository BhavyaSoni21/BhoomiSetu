// Live-server counterpart of backend/test/rate-limiting.e2e-spec.ts
// (PYTHON_MIGRATION_PLAN.md §4's second validation gate). Only the "real
// app, generous default limit" half ports meaningfully live: the
// original's other half builds its own tiny isolated ThrottlerModule
// specifically to trip a low deterministic limit in a handful of
// requests - app/rate_limit.py's real limiter is deliberately disabled
// under backend-py's own pytest run (see that module's docstring), so
// its equivalent mechanism-level test lives there instead
// (tests/routers/test_rate_limiting.py), against an isolated app the
// same way. This spec instead proves the real, enabled, deployed
// limiter's generous default doesn't get in normal usage's way -
// something the pytest suite structurally can't check for itself.
import request = require('supertest');
import { LIVE_BASE_URL } from './live-client';

describe('Rate limiting (live backend-py e2e)', () => {
  describe('the real app (generous default limit)', () => {
    it('does not block normal usage - 10 rapid requests all succeed', async () => {
      for (let i = 0; i < 10; i++) {
        await request(LIVE_BASE_URL).get('/api/v1/parcels?state=MH').expect(200);
      }
    });
  });
});
