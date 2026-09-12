"""Ported from backend/src/historical-imagery/historical-imagery.controller.ts.

`list_clusters`/`get_parcels_for_year` are public - the underlying facts
(dispute/restriction status) are already public via a parcel's own 360
view, so this doesn't expose anything new. `get_image`/`compare` stay
staff-only: compare has a real side effect (creates GovernanceAlert rows,
costs a real LLM call) that only the Officer Portal's comparison workflow
should be able to trigger.
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
from app.models.user import User
from app.schemas.historical_imagery import (
    AffectedParcelOut,
    CategorizedParcelOut,
    ClusterYears,
    CompareYears,
    HistoricalComparisonResultOut,
)
from app.services import historical_comparison_service as service

router = APIRouter(prefix="/historical-imagery", tags=["historical-imagery"])


@router.get("/clusters", response_model=list[ClusterYears])
def list_clusters(db: Session = Depends(get_db)):
    return service.list_clusters(db)


@router.get("/clusters/{cluster_id}/years/{year}/parcels", response_model=list[CategorizedParcelOut])
def get_parcels_for_year(cluster_id: str, year: int, db: Session = Depends(get_db)):
    parcels = service.get_parcels_for_year(db, cluster_id, year)
    return [CategorizedParcelOut.model_validate(p) for p in parcels]


@router.get("/clusters/{cluster_id}/years/{year}/image")
def get_image(cluster_id: str, year: int, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    buffer = service.get_snapshot_image(db, cluster_id, year)
    return Response(content=buffer, media_type="image/png")


@router.post("/clusters/{cluster_id}/compare", response_model=HistoricalComparisonResultOut, status_code=201)
def compare(cluster_id: str, dto: CompareYears, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    result = service.compare(db, cluster_id, dto.from_year, dto.to_year)
    return HistoricalComparisonResultOut(
        cluster_id=result.cluster_id, from_year=result.from_year, to_year=result.to_year, change_detected=result.change_detected,
        affected_parcels=[
            AffectedParcelOut(
                parcel_id=a.parcel_id, canonical_parcel_id=a.canonical_parcel_id, from_category=a.from_category,
                to_category=a.to_category, narrative=a.narrative, alert_id=a.alert_id,
            )
            for a in result.affected_parcels
        ],
    )
