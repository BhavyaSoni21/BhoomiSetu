"""Ported from backend/src/common/identifier-utils.ts.

Shared by app.services.land_records_lookup_service and (later)
InteroperabilityModule's identifier resolver - a plain function taking
an already-open session sidesteps the module-cycle concern the original
TS docstring calls out (there's no DI graph in backend-py to cycle).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.parcel import ParcelIdentifier


def find_identifier_value(db: Session, parcel_id: str, identifier_type: str) -> str | None:
    identifier = db.scalars(
        select(ParcelIdentifier).where(ParcelIdentifier.parcel_id == parcel_id, ParcelIdentifier.identifier_type == identifier_type)
    ).first()
    return identifier.identifier_value if identifier else None
