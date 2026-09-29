"""Shared owner-only department masking logic.

Used by GET /parcels/:id/360 (app/routers/parcels.py) and POST
/ai/parcels/:parcelId/explain (app/services/ai_service.py) - "Explain
with AI" must never be a side channel for data the 360 view itself
hides from a non-owner viewer (same rule, same rationale, in both
places in the original TS source).
"""

from sqlalchemy.orm import Session

from app.models.user import User

_RESTRICTED_DEPARTMENTS = ("planning", "tax", "restriction", "dispute", "encumbrance")
# Conflict `sources` use SCREAMING_SNAKE department names; keep in sync with the tuple above.
_RESTRICTED_CONFLICT_SOURCES = {"PLANNING", "TAX", "RESTRICTION", "DISPUTE", "ENCUMBRANCE"}


def can_view_restricted_departments(db: Session, user: User | None, parcel_id: str) -> bool:
    # Every signed-in user (any role) sees the full cross-department Parcel
    # 360; only unauthenticated guests still get the masked view. `db` and
    # `parcel_id` are kept for the shared call signature (parcels router + the
    # AI-explain side channel in ai_service.py, which must stay in lock-step).
    return user is not None


def mask_restricted_departments(parcel_360_result: dict) -> None:
    for key in _RESTRICTED_DEPARTMENTS:
        parcel_360_result["departments"][key] = None
    # Conflicts embed owner names / tax amounts / dispute state; drop any that
    # draws on a restricted department so masking isn't leaked back via the band.
    conflicts = parcel_360_result.get("conflicts")
    if conflicts:
        parcel_360_result["conflicts"] = [
            c for c in conflicts if not (_RESTRICTED_CONFLICT_SOURCES & set(c.get("sources", [])))
        ]
