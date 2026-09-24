"""Offline-sync endpoint: idempotency + Invariant-1 re-validation (spec §8)."""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.case import Case
from app.models.parcel import CitizenParcel, Parcel
from app.models.processed_sync_operation import ProcessedSyncOperation
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat),
                 (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _seed_citizen_with_parcel(db):
    db.query(Parcel).delete()
    db.flush()
    parcel = Parcel(canonical_parcel_id="SYNC-1", state_code="MH", district_code="PUN",
                    local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.85, 18.52))
    db.add(parcel)
    db.flush()
    citizen, _, headers = create_authenticated_user(db, "CITIZEN")
    db.add(CitizenParcel(citizen_id=citizen.id, parcel_id=parcel.id))
    db.flush()
    return citizen, parcel, headers


def _op(operation_id, parcel_id):
    return {
        "operationId": operation_id,
        "entityType": "case",
        "action": "CREATE",
        "payload": {"parcelId": str(parcel_id), "intent": "MUTATION"},
        "parcelId": str(parcel_id),
        "clientVersion": 0,
    }


def test_sync_is_idempotent_on_operation_id(client, db):
    _, parcel, headers = _seed_citizen_with_parcel(db)
    body = {"operations": [_op("op-fixed-1", parcel.id)]}

    r1 = client.post("/api/v1/sync", json=body, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["results"][0]["status"] == "APPLIED"

    # Replay the same batch — same operationId returns the stored outcome, no
    # second case row.
    r2 = client.post("/api/v1/sync", json=body, headers=headers)
    assert r2.json()["results"][0]["status"] == "DUPLICATE"

    assert db.query(Case).filter(Case.parcel_id == str(parcel.id)).count() == 1
    assert db.query(ProcessedSyncOperation).filter_by(operation_id="op-fixed-1").count() == 1


def test_sync_revalidates_invariant_1(client, db):
    _, parcel, headers = _seed_citizen_with_parcel(db)

    # First op creates the active case.
    client.post("/api/v1/sync", json={"operations": [_op("op-a", parcel.id)]}, headers=headers)
    # Second, distinct op for the same citizen+parcel must hit Invariant-1 —
    # surfaced as CONFLICT, never a duplicate active case.
    r = client.post("/api/v1/sync", json={"operations": [_op("op-b", parcel.id)]}, headers=headers)
    result = r.json()["results"][0]
    assert result["status"] == "CONFLICT"
    assert result["conflict"]["reason"] == "ACTIVE_CASE_EXISTS"

    assert db.query(Case).filter(Case.parcel_id == str(parcel.id)).count() == 1
