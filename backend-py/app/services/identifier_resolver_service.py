"""Ported from backend/src/interoperability/identifier-resolver.service.ts.

Tech.md #22's "IDENTIFIER RESOLUTION" pipeline stage. Two directions,
both genuinely used elsewhere in the aggregation pipeline:
 - backward: an arbitrary identifier (of unknown provenance - could come
   from a citizen's search box or a department's own record) -> the
   canonical parcel UUID everything else in this API keys on.
 - forward: a canonical parcel -> the identifier value a specific
   external department/state schema would recognise it by (used by the
   Land Records adapter to go find the matching state_a/state_b row).
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.identifier_utils import find_identifier_value
from app.models.parcel import Parcel, ParcelIdentifier


@dataclass
class ResolveParcelIdQuery:
    canonical_parcel_id: str | None = None
    ulpin: str | None = None
    survey_number: str | None = None
    plot_number: str | None = None
    local_identifier: str | None = None


def resolve_parcel_id(db: Session, query: ResolveParcelIdQuery) -> str | None:
    if query.canonical_parcel_id:
        parcel = db.scalars(select(Parcel).where(Parcel.canonical_parcel_id == query.canonical_parcel_id)).first()
        if parcel:
            return str(parcel.id)
    if query.ulpin:
        parcel = db.scalars(select(Parcel).where(Parcel.ulpin == query.ulpin)).first()
        if parcel:
            return str(parcel.id)

    candidates = [
        ("SURVEY_NUMBER", query.survey_number),
        ("PLOT_NUMBER", query.plot_number),
        ("LOCAL_PARCEL_ID", query.local_identifier),
    ]
    for identifier_type, value in candidates:
        if not value:
            continue
        identifier = db.scalars(
            select(ParcelIdentifier).where(ParcelIdentifier.identifier_type == identifier_type, ParcelIdentifier.identifier_value == value)
        ).first()
        if identifier:
            return str(identifier.parcel_id)

    return None


def resolve_department_identifier(db: Session, parcel_id: str, identifier_type: str) -> str | None:
    return find_identifier_value(db, parcel_id, identifier_type)
