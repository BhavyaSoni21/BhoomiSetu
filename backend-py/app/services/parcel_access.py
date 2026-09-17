"""Shared owner-only department masking logic.

Used by GET /parcels/:id/360 (app/routers/parcels.py) and POST
/ai/parcels/:parcelId/explain (app/services/ai_service.py) - "Explain
with AI" must never be a side channel for data the 360 view itself
hides from a non-owner viewer (same rule, same rationale, in both
places in the original TS source).
"""

from sqlalchemy.orm import Session

from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE
from app.models.user import User
from app.services import parcels_service

_RESTRICTED_DEPARTMENTS = ("planning", "tax", "restriction", "dispute", "encumbrance")


def can_view_restricted_departments(db: Session, user: User | None, parcel_id: str) -> bool:
    if user is not None and user.role in ALL_STAFF_ROLES:
        return True
    if user is not None and user.role == CITIZEN_ROLE:
        return parcels_service.is_citizen_associated_with_parcel(db, str(user.id), parcel_id)
    return False


def mask_restricted_departments(parcel_360_result: dict) -> None:
    for key in _RESTRICTED_DEPARTMENTS:
        parcel_360_result["departments"][key] = None
