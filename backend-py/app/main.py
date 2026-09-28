import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.middleware import LastActivityMiddleware, RequestIdMiddleware, SecurityHeadersMiddleware, register_exception_handlers
from app.rate_limit import limiter
from app.routers import (
    admin,
    admin_pipeline_config,
    admin_governance_rules,
    admin_terrain,
    ai,
    analytics,
    audit,
    auth,
    cases,
    change_detection,
    departments,
    gis,
    governance,
    health,
    historical_imagery,
    jobs,
    land_records,
    map_tiles,
    multilingual,
    notification_feed,
    parcels,
    predictive_analytics,
    profile_fields,
    public,
    spatial,
    sync,
    users,
    workflows,
)

settings = get_settings()

# Mirrors backend/src/main.ts's two refuse-to-start checks exactly (checked
# against the raw environment, not Settings' own defaulted values, since the
# whole point is catching an unset var that Settings would otherwise quietly
# default away) - a real deployment that forgot to set a real JWT_SECRET or
# real DB credentials fails loudly at boot instead of silently running
# insecure. Local dev/tests never set ENVIRONMENT=production, so this never
# affects that path.
if settings.is_production:
    insecure_jwt_default = "change_this_in_production"
    if not os.environ.get("JWT_SECRET") or os.environ.get("JWT_SECRET") == insecure_jwt_default:
        print(
            f"Refusing to start: JWT_SECRET is unset or still the public placeholder value "
            f"('{insecure_jwt_default}') while ENVIRONMENT=production. "
            "Set a real, random JWT_SECRET in your deployment environment before starting the app.",
            file=sys.stderr,
        )
        sys.exit(1)

    missing = [key for key in ("DB_USERNAME", "DB_PASSWORD", "DB_NAME") if not os.environ.get(key)]
    if missing:
        print(
            f"Refusing to start: {', '.join(missing)} unset while ENVIRONMENT=production - the app "
            "would otherwise silently connect using default credentials. Set these explicitly in your "
            "deployment environment before starting the app.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not settings.cors_origin:
        print(
            "Refusing to start: CORS_ORIGIN is unset while ENVIRONMENT=production - the app would "
            "otherwise accept credentialed cross-origin requests from any website. Set CORS_ORIGIN "
            "to your real deployed frontend URL before starting the app.",
            file=sys.stderr,
        )
        sys.exit(1)

app = FastAPI(
    title="BhoomiSetu API (Python)",
    version="1.0",
    # Mirrors backend/src/main.ts's Swagger gating (KNOWN_RISKS.md MED-2):
    # the full API schema isn't served to anyone who finds the URL once
    # actually deployed.
    docs_url=None if settings.is_production else "/api/docs",
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(LastActivityMiddleware)
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
# SEC-06 / PYSEC-2026-161: validate the Host header so a spoofed one can't
# poison request.url.path and bypass path-based auth. No-op ["*"] until
# TRUSTED_HOSTS is set (see config.trusted_host_list).
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)
register_exception_handlers(app)

# KNOWN_RISKS.md HIGH-1: app-wide 200/min/IP default (app.rate_limit.py),
# matching app.module.ts's ThrottlerModule.forRoot(...). A route decorated
# with @limiter.limit(...) (AiModule, AuthModule's /login) gets its own
# tighter limit instead of this default - SlowAPIMiddleware skips the
# default check for any route already carrying a decorator-applied one.
# Reuses the same {statusCode, message, error, requestId} handler already
# registered for StarletteHTTPException above - RateLimitExceeded is
# itself an HTTPException subclass, but slowapi's middleware looks up
# app.exception_handlers by exact type, not by MRO, so it needs its own
# explicit entry to get that shape instead of slowapi's own default body.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, app.exception_handlers[StarletteHTTPException])
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if isinstance(settings.cors_origins, list) else ["*"],
    # Scoped to this project's Vercel deployments (prod, preview, renamed
    # project) — NOT every *.vercel.app, which with allow_credentials=True
    # would let any attacker-hosted vercel.app read authenticated responses
    # (SEC-02). Tune via CORS_ORIGIN_REGEX.
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health mounted outside the /api/v1 prefix (backend/src/main.ts's
# setGlobalPrefix exclude), everything else goes under it as modules land.
app.include_router(health.router)
app.include_router(gis.router, prefix="/api/v1")
app.include_router(spatial.router, prefix="/api/v1")
app.include_router(change_detection.router, prefix="/api/v1")
app.include_router(historical_imagery.router, prefix="/api/v1")
app.include_router(parcels.router, prefix="/api/v1")
app.include_router(map_tiles.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(profile_fields.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(predictive_analytics.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(land_records.state_a_router, prefix="/api/v1")
app.include_router(land_records.state_b_router, prefix="/api/v1")
app.include_router(departments.router, prefix="/api/v1")
app.include_router(notification_feed.router, prefix="/api/v1")
app.include_router(governance.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(multilingual.router)
app.include_router(admin.router, prefix="/api/v1")
app.include_router(admin_pipeline_config.router, prefix="/api/v1")
app.include_router(admin_governance_rules.router, prefix="/api/v1")
app.include_router(admin_terrain.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
