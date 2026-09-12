"""Ported from backend/src/land-records/state-a-land-records.controller.ts +
state-b-land-records.controller.ts.

Two independent mock "external department" APIs (Tech.md #12/#13) -
deliberately unguarded (no JWT/roles), same as the original TS
controllers - standing in for systems this app doesn't own. Query
params use each schema's own field names (survey_number/village_code,
plot_id/locality_id), not the canonical identifiers used elsewhere.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.land_records import (
    CreateStateALandRecord,
    CreateStateBLandRecord,
    StateALandRecordListResponse,
    StateALandRecordOut,
    StateBLandRecordListResponse,
    StateBLandRecordOut,
    UpdateStateALandRecord,
    UpdateStateBLandRecord,
)
from app.services import land_records_service as service

state_a_router = APIRouter(prefix="/state-a/land-records", tags=["land-records"])
state_b_router = APIRouter(prefix="/state-b/land-records", tags=["land-records"])


# --- State A -------------------------------------------------------------


@state_a_router.post("", response_model=StateALandRecordOut, status_code=status.HTTP_201_CREATED)
def create_state_a(dto: CreateStateALandRecord, db: Session = Depends(get_db)):
    return service.create_state_a(db, dto)


@state_a_router.get("", response_model=StateALandRecordListResponse)
def find_all_state_a(
    survey_number: str | None = Query(None),
    village_code: str | None = Query(None),
    limit: int | None = None,
    offset: int | None = None,
    db: Session = Depends(get_db),
):
    records, total = service.find_all_state_a(db, survey_number, village_code, limit, offset)
    return StateALandRecordListResponse(records=records, total=total)


@state_a_router.get("/{id}", response_model=StateALandRecordOut)
def find_one_state_a(id: UUID, db: Session = Depends(get_db)):
    record = service.find_one_state_a(db, id)
    if record is None:
        raise _not_found_a(id)
    return record


@state_a_router.patch("/{id}", response_model=StateALandRecordOut)
def update_state_a(id: UUID, dto: UpdateStateALandRecord, db: Session = Depends(get_db)):
    record = service.update_state_a(db, id, dto)
    if record is None:
        raise _not_found_a(id)
    return record


@state_a_router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_state_a(id: UUID, db: Session = Depends(get_db)):
    if not service.remove_state_a(db, id):
        raise _not_found_a(id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _not_found_a(id: UUID) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"State A land record not found: {id}")


# --- State B -------------------------------------------------------------


@state_b_router.post("", response_model=StateBLandRecordOut, status_code=status.HTTP_201_CREATED)
def create_state_b(dto: CreateStateBLandRecord, db: Session = Depends(get_db)):
    return service.create_state_b(db, dto)


@state_b_router.get("", response_model=StateBLandRecordListResponse)
def find_all_state_b(
    plot_id: str | None = Query(None),
    locality_id: str | None = Query(None),
    limit: int | None = None,
    offset: int | None = None,
    db: Session = Depends(get_db),
):
    records, total = service.find_all_state_b(db, plot_id, locality_id, limit, offset)
    return StateBLandRecordListResponse(records=records, total=total)


@state_b_router.get("/{id}", response_model=StateBLandRecordOut)
def find_one_state_b(id: UUID, db: Session = Depends(get_db)):
    record = service.find_one_state_b(db, id)
    if record is None:
        raise _not_found_b(id)
    return record


@state_b_router.patch("/{id}", response_model=StateBLandRecordOut)
def update_state_b(id: UUID, dto: UpdateStateBLandRecord, db: Session = Depends(get_db)):
    record = service.update_state_b(db, id, dto)
    if record is None:
        raise _not_found_b(id)
    return record


@state_b_router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_state_b(id: UUID, db: Session = Depends(get_db)):
    if not service.remove_state_b(db, id):
        raise _not_found_b(id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _not_found_b(id: UUID) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"State B land record not found: {id}")
