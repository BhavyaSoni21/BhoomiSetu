"""Tests for Legal Status Layer (Severity Calculation & MVT Tile Attribute)."""

from geoalchemy2.shape import from_shape
import pytest
from shapely.geometry import Polygon

from app.models.department_record import DisputeRecord, EncumbranceRecord
from app.models.parcel import Parcel
from app.tasks.legal_status_tasks import _compute_severity_for_parcel


def _square(min_lng: float = 73.85, min_lat: float = 18.52, size: float = 0.001):
    return from_shape(
        Polygon([
            (min_lng, min_lat),
            (min_lng + size, min_lat),
            (min_lng + size, min_lat + size),
            (min_lng, min_lat + size),
            (min_lng, min_lat),
        ]),
        srid=4326,
    )


def _make_parcel(db, canonical_id: str) -> Parcel:
    parcel = Parcel(
        canonical_parcel_id=canonical_id,
        state_code="MH",
        district_code="PUN",
        local_body_code="MHLB001",
        area_sq_m=500.0,
        geometry=_square(),
        legal_status_severity=0,
    )
    db.add(parcel)
    db.flush()
    return parcel


def test_severity_calculation_clear(db):
    """A parcel with no disputes or encumbrances must evaluate to severity 0 (Clear)."""
    parcel = _make_parcel(db, "TEST-CLEAR-001")
    severity = _compute_severity_for_parcel(db, parcel.id)
    assert severity == 0


def test_severity_calculation_encumbered(db):
    """A parcel with an active encumbrance must evaluate to severity 1 (Encumbered)."""
    parcel = _make_parcel(db, "TEST-ENC-001")

    db.add(EncumbranceRecord(
        parcel_id=parcel.id,
        has_encumbrance=True,
        encumbrance_type="MORTGAGE",
        discharge_date=None,
    ))
    db.flush()

    severity = _compute_severity_for_parcel(db, parcel.id)
    assert severity == 1


def test_severity_calculation_disputed_low(db):
    """A parcel with a BOUNDARY dispute must evaluate to severity 2 (Disputed Low)."""
    parcel = _make_parcel(db, "TEST-DISP-001")

    db.add(DisputeRecord(
        parcel_id=parcel.id,
        has_active_dispute=True,
        dispute_type="BOUNDARY",
        case_status="PENDING",
    ))
    db.flush()

    severity = _compute_severity_for_parcel(db, parcel.id)
    assert severity == 2


def test_severity_calculation_disputed_high(db):
    """A parcel with OWNERSHIP dispute must evaluate to severity 3 (Disputed High)."""
    parcel = _make_parcel(db, "TEST-HIGH-001")

    db.add(DisputeRecord(
        parcel_id=parcel.id,
        has_active_dispute=True,
        dispute_type="OWNERSHIP",
        case_status="IN_COURT",
    ))
    db.flush()

    severity = _compute_severity_for_parcel(db, parcel.id)
    assert severity == 3


def test_highest_severity_wins(db):
    """When a parcel has both an active encumbrance and an ownership dispute, severity 3 wins."""
    parcel = _make_parcel(db, "TEST-COMBO-001")

    db.add(EncumbranceRecord(
        parcel_id=parcel.id,
        has_encumbrance=True,
        encumbrance_type="MORTGAGE",
        discharge_date=None,
    ))
    db.add(DisputeRecord(
        parcel_id=parcel.id,
        has_active_dispute=True,
        dispute_type="ENCROACHMENT",
        case_status="PENDING",
    ))
    db.flush()

    severity = _compute_severity_for_parcel(db, parcel.id)
    assert severity == 3


def test_mvt_tile_endpoint_returns_tile(client):
    """The /api/v1/tiles/{z}/{x}/{y}.pbf endpoint succeeds with 200 (or 204 if empty bounds)."""
    response = client.get("/api/v1/tiles/0/0/0.pbf")
    assert response.status_code in (200, 204)
