"""Ported from backend/src/departments/{registration,planning,tax,restriction,
dispute,encumbrance,land-records-lookup}.controller.ts.

Seven independent mock department APIs (Tech.md #16-17), each deliberately
unguarded (no JWT/roles) and independent of the canonical parcel model -
standing in for external systems this app doesn't own. `/land-records`
is distinct from `/state-a|state-b/land-records/:id`
(app/routers/land_records.py's raw schema CRUD) - it takes a *parcel* id
and resolves it to whichever state-specific record applies.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.departments import (
    DisputeRecordOut,
    EncumbranceRecordOut,
    LandRecordsLookupOut,
    PlanningRecordOut,
    RegistrationRecordOut,
    RestrictionRecordOut,
    TaxRecordOut,
)
from app.services import departments_service as service
from app.services import land_records_lookup_service

router = APIRouter(tags=["departments"])


@router.get("/land-records/{parcel_id}", response_model=LandRecordsLookupOut)
def get_land_records(parcel_id: UUID, db: Session = Depends(get_db)):
    result = land_records_lookup_service.find_by_parcel_id(db, str(parcel_id))
    if result == land_records_lookup_service.PARCEL_NOT_FOUND:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Parcel not found: {parcel_id}")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No land record could be resolved for parcel: {parcel_id}")
    return {
        "source": result.source,
        "schema": result.schema_name,
        "identifierUsed": {"type": result.identifier_type, "value": result.identifier_value},
        "data": result.data,
    }


@router.get("/registration/{parcel_id}", response_model=RegistrationRecordOut)
def get_registration(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_registration_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No registration record for parcel: {parcel_id}")
    return record


@router.get("/planning/{parcel_id}", response_model=PlanningRecordOut)
def get_planning(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_planning_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No planning record for parcel: {parcel_id}")
    return record


@router.get("/tax/{parcel_id}", response_model=TaxRecordOut)
def get_tax(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_tax_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No tax record for parcel: {parcel_id}")
    return record


@router.get("/restriction/{parcel_id}", response_model=RestrictionRecordOut)
def get_restriction(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_restriction_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No restriction record for parcel: {parcel_id}")
    return record


@router.get("/dispute/{parcel_id}", response_model=DisputeRecordOut)
def get_dispute(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_dispute_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No dispute record for parcel: {parcel_id}")
    return record


@router.get("/encumbrance/{parcel_id}", response_model=EncumbranceRecordOut)
def get_encumbrance(parcel_id: UUID, db: Session = Depends(get_db)):
    record = service.find_encumbrance_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No encumbrance record for parcel: {parcel_id}")
    return record
