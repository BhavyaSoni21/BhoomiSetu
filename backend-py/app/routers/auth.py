"""Ported from backend/src/auth/auth.controller.ts.

KNOWN_RISKS.md HIGH-1: POST /login gets a tighter per-route limit
(20/min/IP vs the app default 200/min, see app/rate_limit.py) - the
single most common account-takeover vector when left at the generic
default, matching the original's @Throttle({ default: { limit: 20,
ttl: 60000 } }).
"""

import httpx
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.deps import create_access_token, get_current_user, require_roles
from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE
from app.auth import login_guard
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import (
    AuthPublicUserOut,
    ContactRequest,
    GoogleOAuthCallbackRequest,
    LoginRequest,
    LoginResultOut,
    MessageOut,
    OAuthLoginResponse,
    PendingRegistrationResultOut,
    ProfileDetailsRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResendRegistrationOtpRequest,
    VerifyOtpRequest,
    VerifyRegistrationOtpRequest,
)
from app.schemas.profile_field import DynamicProfileData, ProfileFormConfig
from app.services import audit_service
from app.services import auth_service as service
from app.services import oauth_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Every endpoint below that needs "any signed-in account, citizen or
# staff" reuses this - both current-user-decorator-style endpoints in
# the original TS controller and its explicit @Roles(CITIZEN_ROLE,
# ...ALL_STAFF_ROLES) ones, since those two role sets together are
# literally every role this app defines.
_require_any_role = require_roles(CITIZEN_ROLE, *ALL_STAFF_ROLES)


@router.post("/login", response_model=LoginResultOut)
@limiter.limit("20/minute")
def login(request: Request, dto: LoginRequest, db: Session = Depends(get_db)):
    identifier = (dto.email or dto.mobile_number or "").strip().lower()
    if login_guard.is_locked(identifier):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Account temporarily locked due to repeated failed logins. Try again later.")
    user = service.validate_user(db, email=dto.email, mobile_number=dto.mobile_number, password=dto.password)
    if user is None:
        login_guard.record_failure(identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    login_guard.record_success(identifier)
    result = service.login(user)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_LOGIN", entity_type="USER", entity_id=str(user.id))
    return result


# Citizen self-registration only - Officer/Admin accounts stay
# admin-created via POST /users. No account exists yet after this call -
# it only stages a PendingRegistration and returns enough for the
# frontend to drive the OTP step.
@router.post("/register", response_model=PendingRegistrationResultOut, status_code=status.HTTP_201_CREATED)
def register(dto: RegisterRequest, db: Session = Depends(get_db)):
    return service.register(db, dto)


# Public (no account/JWT exists yet) - the only step that actually
# creates the User row.
@router.post("/register/verify-otp", response_model=LoginResultOut, status_code=status.HTTP_201_CREATED)
def verify_registration_otp(dto: VerifyRegistrationOtpRequest, db: Session = Depends(get_db)):
    result = service.verify_registration_otp(db, dto.registration_id, dto.code)
    user: User = result["user"]
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="AUTH_REGISTERED", entity_type="USER",
        entity_id=str(user.id), metadata={"method": "EMAIL" if user.email_verified else "MOBILE"},
    )
    return result


@router.post("/register/resend-otp", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def resend_registration_otp(dto: ResendRegistrationOtpRequest, db: Session = Depends(get_db)):
    service.resend_registration_otp(db, dto.registration_id)
    return {"message": "OTP sent"}


# Also serves Profile's "verify the contact method I just added/changed"
# step - role-agnostic (citizen or any staff role), since Officer Profile
# reuses the same flow as the Citizen Portal's Profile page.
@router.post("/verify-otp", response_model=AuthPublicUserOut, status_code=status.HTTP_201_CREATED)
def verify_otp(dto: VerifyOtpRequest, db: Session = Depends(get_db), user: User = Depends(_require_any_role)):
    updated = service.verify_otp(db, user, dto.method, dto.code)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_CONTACT_VERIFIED", entity_type="USER", entity_id=str(user.id), metadata={"method": dto.method})
    return updated


@router.post("/resend-otp", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def resend_otp(dto: ResendOtpRequest, db: Session = Depends(get_db), user: User = Depends(_require_any_role)):
    service.resend_otp(db, user, dto.method)
    return {"message": "OTP sent"}


# Profile "add or change contact method" - auth_service decides
# add-vs-change from the user's current state, not a flag this endpoint's
# caller sends.
@router.post("/profile/contact", response_model=AuthPublicUserOut, status_code=status.HTTP_201_CREATED)
def update_contact(dto: ContactRequest, db: Session = Depends(get_db), user: User = Depends(_require_any_role)):
    updated = service.add_or_change_contact(db, user, dto)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_CONTACT_UPDATE_REQUESTED", entity_type="USER", entity_id=str(user.id), metadata={"method": dto.method})
    return updated


# Profile "more info, editable" - no OTP step, unlike update_contact above.
# Uses dynamic validation based on profile_fields table
@router.post("/profile/details", response_model=AuthPublicUserOut, status_code=status.HTTP_201_CREATED)
def update_profile_details(dto: DynamicProfileData, db: Session = Depends(get_db), user: User = Depends(_require_any_role)):
    # Validate against dynamic field config
    from app.services.profile_field_service import validate_profile_data
    is_valid, errors = validate_profile_data(db, user.role, dto.model_dump(exclude_unset=True))
    if not is_valid:
        raise HTTPException(status_code=400, detail={"message": "Validation failed", "errors": errors})
    updated = service.update_profile_details(db, user, dto)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_PROFILE_DETAILS_UPDATED", entity_type="USER", entity_id=str(user.id))
    return updated


# Get profile form config for current user's role
@router.get("/profile/config", response_model=ProfileFormConfig)
def get_profile_config(db: Session = Depends(get_db), user: User = Depends(_require_any_role)):
    """Get dynamic profile form configuration for the current user's role."""
    from app.services.profile_field_service import get_profile_form_config
    return get_profile_form_config(db, user.role)


# Marks first-login onboarding done for the CURRENT authenticated user only
# (spec §17: the account comes from the token, never a client-supplied id).
# Idempotent - safe to retry after a failed completion (spec §11).
@router.post("/onboarding/complete", response_model=AuthPublicUserOut)
def complete_onboarding(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    updated = service.complete_onboarding(db, user)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_ONBOARDING_COMPLETED", entity_type="USER", entity_id=str(user.id))
    return updated


# Lets the frontend rehydrate a session from a stored token on page load
# (or reject an expired/invalid one) without re-sending credentials.
@router.get("/me", response_model=AuthPublicUserOut)
def me(user: User = Depends(get_current_user)):
    return user


# KNOWN_RISKS.md HIGH-2: the only thing that actually revokes a session
# server-side - bumps token_version so every previously-issued token for
# this account is rejected from this point on.
@router.post("/logout", response_model=MessageOut)
def logout(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    service.logout(db, user)
    audit_service.log(db, user_id=str(user.id), user_role=user.role, action="AUTH_LOGOUT", entity_type="USER", entity_id=str(user.id))
    return {"message": "Logged out"}


# Google OAuth 2.0 endpoints
# These are public (no authentication required) - they initiate and complete
# the OAuth flow. The callback endpoint validates the state parameter for
# CSRF protection and exchanges the authorization code for user identity.

@router.get("/google/login", response_model=OAuthLoginResponse)
def google_login(redirect_after_login: str = "/", db: Session = Depends(get_db)):
    """Initiate Google OAuth 2.0 authorization flow.

    Returns the Google authorization URL that the frontend should redirect to.
    The redirect_after_login parameter is stored in the OAuth state and used
    to redirect the user after successful authentication.
    """
    try:
        auth_url = oauth_service.build_google_auth_url(redirect_after_login)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate Google OAuth. Please try again."
        )
    return {"auth_url": auth_url}


@router.get("/google/callback", response_model=LoginResultOut)
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Handle Google OAuth 2.0 callback.

    Exchanges the authorization code for tokens, fetches user info from Google,
    finds or creates the user, and returns a JWT access token.
    """
    try:
        login_result, redirect_after_login = oauth_service.authenticate_google_user(db, code, state)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again."
        )

    user: User = login_result["user"]
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="AUTH_GOOGLE_LOGIN",
        entity_type="USER", entity_id=str(user.id),
        metadata={"is_new_user": user.created_at is not None}
    )
    return login_result