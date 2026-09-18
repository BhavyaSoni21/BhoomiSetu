"""Google OAuth 2.0 authentication service.

Handles the complete OAuth authorization -> callback -> user authentication flow.
Validates OAuth callback and returned identity information.
Implements CSRF/state protection.
"""

import secrets
import logging
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import create_access_token
from app.auth.passwords import hash_password
from app.config import get_settings
from app.models.user import User
from app.services import users_service

logger = logging.getLogger(__name__)

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# In-memory state store (for production, use Redis or database)
# Key: state, Value: (redirect_after_login, created_at)
_oauth_states: dict[str, tuple[str, float]] = {}
_STATE_TTL_SECONDS = 600  # 10 minutes


def _generate_state() -> str:
    """Generate a cryptographically secure random state for CSRF protection."""
    return secrets.token_urlsafe(32)


def _store_state(state: str, redirect_after_login: str) -> None:
    """Store OAuth state with timestamp."""
    import time
    _oauth_states[state] = (redirect_after_login, time.time())


def _validate_state(state: str) -> Optional[str]:
    """Validate and consume OAuth state, returning the redirect URL if valid."""
    import time
    if state not in _oauth_states:
        return None
    redirect_after_login, created_at = _oauth_states.pop(state)
    if time.time() - created_at > _STATE_TTL_SECONDS:
        return None
    return redirect_after_login


def _cleanup_expired_states() -> None:
    """Remove expired states from memory."""
    import time
    now = time.time()
    expired = [state for state, (_, created_at) in _oauth_states.items() if now - created_at > _STATE_TTL_SECONDS]
    for state in expired:
        _oauth_states.pop(state, None)


def build_google_auth_url(redirect_after_login: str = "/") -> str:
    """Build the Google OAuth authorization URL with CSRF protection.

    Args:
        redirect_after_login: Where to redirect the user after successful login.
                             Defaults to "/" (home page).

    Returns:
        The Google OAuth authorization URL.
    """
    settings = get_settings()

    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured"
        )

    state = _generate_state()
    _store_state(state, redirect_after_login)
    _cleanup_expired_states()

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    return f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access and ID tokens.

    Args:
        code: The authorization code received from Google callback.

    Returns:
        Token response containing access_token, id_token, etc.

    Raises:
        HTTPException: If token exchange fails.
    """
    settings = get_settings()

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured"
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )

    if response.status_code != 200:
        logger.error(f"Google token exchange failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code for tokens"
        )

    return response.json()


async def fetch_google_userinfo(access_token: str) -> dict:
    """Fetch user information from Google using the access token.

    Args:
        access_token: The OAuth access token.

    Returns:
        User information from Google (sub, email, name, picture, email_verified).

    Raises:
        HTTPException: If fetching user info fails.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )

    if response.status_code != 200:
        logger.error(f"Google userinfo fetch failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch user information from Google"
        )

    return response.json()


def find_or_create_user(
    db: Session,
    google_id: str,
    email: str,
    name: str,
    picture: Optional[str],
    email_verified: bool,
) -> User:
    """Find existing user by Google ID or email, or create a new one.

    Args:
        db: Database session.
        google_id: Google's unique user identifier (sub claim).
        email: User's email from Google.
        name: User's name from Google.
        picture: User's profile picture URL from Google.
        email_verified: Whether Google verified the email.

    Returns:
        The existing or newly created User.
    """
    # First, try to find by Google ID
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        # Update Google info in case it changed
        user.google_picture = picture
        user.google_email_verified = email_verified
        user.name = name  # Update name from Google
        if email and not user.email:
            user.email = email
            user.email_verified = email_verified
        db.flush()
        return user

    # Try to find by email (for linking existing accounts)
    if email:
        user = users_service.find_by_email(db, email)
        if user:
            # Link Google account to existing user
            user.google_id = google_id
            user.google_picture = picture
            user.google_email_verified = email_verified
            if not user.email_verified and email_verified:
                user.email_verified = True
            db.flush()
            return user

    # Create new user - default to CITIZEN role
    # Generate a random password hash since they'll use Google to sign in
    random_password = secrets.token_urlsafe(32)
    user = users_service.create(
        db,
        email=email,
        password_hash=hash_password(random_password),
        name=name,
        role="CITIZEN",
        email_verified=email_verified,
    )
    user.google_id = google_id
    user.google_picture = picture
    user.google_email_verified = email_verified
    db.flush()
    return user


def authenticate_google_user(
    db: Session,
    code: str,
    state: str,
) -> tuple[dict, str]:
    """Complete the Google OAuth flow: exchange code, fetch userinfo, find/create user.

    Args:
        db: Database session.
        code: Authorization code from Google callback.
        state: CSRF state parameter from Google callback.

    Returns:
        Tuple of (login_result, redirect_after_login)

    Raises:
        HTTPException: For various OAuth errors.
    """
    # Validate state (CSRF protection)
    redirect_after_login = _validate_state(state)
    if redirect_after_login is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state. Please try again."
        )

    # Exchange code for tokens
    import asyncio
    try:
        tokens = asyncio.run(exchange_code_for_tokens(code))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token exchange error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again."
        )

    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No access token received from Google"
        )

    # Fetch user info from Google
    try:
        userinfo = asyncio.run(fetch_google_userinfo(access_token))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Userinfo fetch error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user information. Please try again."
        )

    # Validate required fields
    google_id = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name")
    picture = userinfo.get("picture")
    email_verified = userinfo.get("email_verified", False)

    if not google_id or not email or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incomplete user information from Google"
        )

    # Find or create user
    user = find_or_create_user(db, google_id, email, name, picture, email_verified)

    # Create JWT token
    login_result = create_access_token(user)

    return {"access_token": login_result, "user": user}, redirect_after_login