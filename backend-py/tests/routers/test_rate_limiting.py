"""Ported from backend/test/rate-limiting.e2e-spec.ts.

Only the throttling *mechanism* is exercised here, via a tiny standalone
app with its own limiter (mirroring the original's own
`ThrottleMechanismModule` - a low limit deterministic in a handful of
requests, rather than needing 200+ real ones) - not the real app's shared
`client`/`db` fixtures, since app/rate_limit.py's limiter is deliberately
disabled while running under pytest (see that module's own docstring for
why: one shared `app` across 400+ tests would otherwise accumulate hits
across unrelated tests). The real app's actual rate-limiting behavior -
that normal usage isn't blocked, and that /login and /ai/* carry their
own tighter limits - is verified live instead (tests/routers/test_rate_limiting
can't exercise a real, enabled limiter against the shared TestClient app).
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address


def _build_throttled_app() -> FastAPI:
    limiter = Limiter(key_func=get_remote_address, default_limits=["3/minute"], enabled=True)
    app = FastAPI()
    app.state.limiter = limiter

    def _rate_limit_handler(request, exc):
        return JSONResponse(status_code=429, content={"statusCode": 429, "message": str(exc), "error": "Too Many Requests"})

    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


def test_allows_requests_up_to_the_limit_and_rejects_the_one_that_exceeds_it():
    client = TestClient(_build_throttled_app())
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 429
