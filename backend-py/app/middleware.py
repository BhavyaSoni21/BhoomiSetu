import logging
import uuid
from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth.deps import get_current_user
from app.database import SessionLocal
from app.models.user import User

logger = logging.getLogger("exceptions_handler")

REQUEST_ID_HEADER = "X-Request-Id"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Mirrors backend/src/common/request-id.middleware.ts: honors a
    caller-supplied X-Request-Id rather than always minting a fresh one, so
    a trace stays correlated across hops, and stamps it on the response too.
    """

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER, "").strip()
        request_id = incoming or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


class LastActivityMiddleware(BaseHTTPMiddleware):
    """Updates User.last_activity_at on each authenticated request for idle timeout tracking."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Update last_activity_at for authenticated users
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                user = get_current_user(token)
                if user:
                    db = SessionLocal()
                    try:
                        db_user = db.scalars(select(User).where(User.id == user.id)).first()
                        if db_user:
                            db_user.last_activity_at = datetime.now(timezone.utc).replace(tzinfo=None)
                            db.commit()
                    finally:
                        db.close()
            except Exception:
                # Ignore errors - this is best-effort tracking
                pass

        return response


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def register_exception_handlers(app: FastAPI) -> None:
    """Mirrors backend/src/common/all-exceptions.filter.ts's response shape
    - {statusCode, message, error, requestId} - rather than FastAPI's own
    default {"detail": ...} body, so backend-py's error contract matches
    NestJS's exactly (PYTHON_MIGRATION_PLAN.md §2). A well-formed 4xx isn't
    noise-logged the way a genuine 5xx is, same as the NestJS filter.
    """

    # Registered against Starlette's base HTTPException, not fastapi's
    # subclass of it - routing-level errors (404 on an unmatched path, 405
    # on a wrong method) are raised as the Starlette base type directly, so
    # a handler registered only for the fastapi subclass never catches them
    # (Starlette dispatches by the exception's own MRO, not the reverse).
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        request_id = _request_id(request)
        try:
            reason = HTTPStatus(exc.status_code).phrase
        except ValueError:
            reason = "Error"
        body = {
            "statusCode": exc.status_code,
            "message": exc.detail,
            "error": reason,
            "requestId": request_id,
        }
        if exc.status_code >= 500:
            logger.error("[%s] %s %s -> %s", request_id, request.method, request.url.path, exc.status_code)
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Nest's ValidationPipe (whitelist+transform, main.ts) rejects a bad
        # body with 400, not FastAPI's default 422 - matched here for
        # contract parity rather than left at the framework default.
        request_id = _request_id(request)
        messages = [error["msg"] for error in exc.errors()]
        body = {
            "statusCode": status.HTTP_400_BAD_REQUEST,
            "message": messages,
            "error": "Bad Request",
            "requestId": request_id,
        }
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.error(
            "[%s] %s %s -> 500", request_id, request.method, request.url.path, exc_info=exc
        )
        body = {
            "statusCode": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal server error",
            "error": "Internal Server Error",
            "requestId": request_id,
        }
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body)