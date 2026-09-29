"""Minimal JWT verification substrate - NOT the full AuthModule.

PYTHON_MIGRATION_PLAN.md §2: "backend-py implements its own JWT issuance
and verification from the start... since nothing is shared with a running
NestJS instance before cutover." §4's build order still puts the full
AuthModule (AuthController/AuthService - login, register, OTP flows, 19
files) built and scrutinized *last*, deliberately. The two aren't in
tension: several earlier modules (SpatialModule's admin-only write
routes, first) gate on "is this a valid token for an ADMIN," which needs
to exist as shared infrastructure now - it's the same reasoning that put
app/common/ first, just for auth instead of geometry. This file is only
that verification substrate (ported faithfully from
backend/src/auth/jwt.strategy.ts + roles.guard.ts + current-user.decorator.ts),
not the login/register/OTP endpoints themselves.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User

_ALGORITHM = "HS256"  # @nestjs/jwt's default, matching backend/'s JwtModule.register() (no algorithm override there either)

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user: User) -> str:
    """Signs the auth payload with a configurable `exp` claim
    (settings.access_token_minutes, default 30). Sessions are additionally
    revocable at any time via token_version: logout bumps it server-side,
    invalidating outstanding tokens before they expire.
    """
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user.id), "email": user.email, "role": user.role, "tokenVersion": user.token_version, "exp": expires_at}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def _check_idle_timeout(user: User) -> None:
    """Enforce idle timeout if configured. 0 = disabled."""
    settings = get_settings()
    if settings.idle_timeout_minutes <= 0 or user.last_activity_at is None:
        return
    idle_seconds = (datetime.now(timezone.utc).replace(tzinfo=None) - user.last_activity_at).total_seconds()
    if idle_seconds > settings.idle_timeout_minutes * 60:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired due to inactivity")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Mirrors JwtStrategy.validate(): looks the user up fresh on every
    request (rather than trusting the payload alone) so a deleted/changed
    account stops working immediately instead of only once its token
    happens to expire, and rejects a token whose embedded token_version
    doesn't match the user's current one (KNOWN_RISKS.md HIGH-2 - bumped on
    explicit logout so every outstanding copy of a token stops validating).
    Also enforces idle timeout when configured.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except JWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized") from error

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized") from error

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if payload.get("tokenVersion", 0) != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    # Idle timeout check
    _check_idle_timeout(user)
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Mirrors OptionalJwtAuthGuard: same 'jwt' strategy as get_current_user,
    but never rejects the request - returns the user when a valid bearer
    token is present and None otherwise (missing header, malformed/expired
    token, unknown user, stale token_version), for routes that stay public
    by default but need to know who's asking to decide what to include in
    the response (e.g. Parcel 360's owner-only department fields).
    """
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[_ALGORITHM])
        user = db.get(User, UUID(payload["sub"]))
    except (JWTError, KeyError, ValueError):
        return None
    if user is None or payload.get("tokenVersion", 0) != user.token_version:
        return None

    # Idle timeout check
    try:
        _check_idle_timeout(user)
    except HTTPException:
        return None
    return user


def require_mock_dept_apis_enabled() -> None:
    """Guard for the mock external-department APIs (land_records CRUD +
    departments per-parcel lookups). They're intentionally unauthenticated
    stand-ins for systems this app doesn't own, so they stay open in dev but
    are refused on a production host unless EXPOSE_MOCK_DEPT_APIS is set.
    404 (not 403) so their existence isn't advertised in production.
    """
    settings = get_settings()
    if settings.is_production and not settings.expose_mock_dept_apis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


def require_roles(*roles: str):
    """Mirrors RolesGuard: a route with no roles declared lets any
    authenticated user through; a role mismatch is a 403 (distinct from
    get_current_user's 401 for "not authenticated at all"), matching
    Nest's CanActivate-returns-false-> 403 default.
    """

    def dependency(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
        return user

    return dependency
