"""Ported from backend/src/app.module.ts's ThrottlerModule/APP_GUARD wiring
+ the tighter per-route limits `ai.controller.ts`/`auth.controller.ts`
each apply on top of it.

KNOWN_RISKS.md HIGH-1: a per-IP request cap is the cheap, first layer
against credential-stuffing/scraping - not a full defense (a real
per-account failed-attempt lockout would be that), but exactly what the
original's `@nestjs/throttler` provided and what this had been missing
since Phase 0 (`slowapi` sat unused in requirements.txt the whole time).
In-memory, single-process store - the same characteristic the original's
default in-memory throttler storage has, not a distributed one.

Disabled automatically under pytest: every original Jest spec built its
own fresh `Test.createTestingModule` per file, so each got its own
throttler storage that could never accumulate hits across specs;
backend-py's tests instead all import one shared `app` (tests/conftest.py),
so the same limiter storage would otherwise accumulate hits across all
400+ tests in a single run and trip on unrelated tests, not the
throttling behavior itself - which has its own dedicated, isolated test
(tests/routers/test_rate_limiting.py), matching the original's own
small standalone-module approach. Also overridable via RATE_LIMIT_ENABLED
for other non-production contexts (e.g. a live-Jest-spec run against a
shared dev instance) that don't want the app's real budget consumed.
"""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

_disabled_for_tests = "PYTEST_CURRENT_TEST" in os.environ
_disabled_by_env = os.environ.get("RATE_LIMIT_ENABLED", "true").strip().lower() == "false"

# App-wide default: 200 requests/minute/IP, matching app.module.ts's
# `ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }])` exactly.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"], enabled=not (_disabled_for_tests or _disabled_by_env))
