"""Public stats endpoint - unauthenticated headline counts for the About page."""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.parcel import Parcel
from app.models.workflow import Workflow


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _seed(db):
    db.query(Workflow).delete()
    db.query(Parcel).delete()
    db.flush()
    p1 = Parcel(canonical_parcel_id="PUB-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.85, 18.52))
    p2 = Parcel(canonical_parcel_id="PUB-2", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.86, 18.53))
    db.add_all([p1, p2])
    db.flush()
    db.add_all([
        Workflow(parcel_id=p1.id, workflow_type="ROR_COPY_REQUEST", current_status="SUBMITTED"),
        Workflow(parcel_id=p1.id, workflow_type="CORRECTION_REQUEST", current_status="APPROVED"),
        Workflow(parcel_id=p2.id, workflow_type="ROR_COPY_REQUEST", current_status="SUBMITTED"),
    ])
    db.flush()


class TestPublicStats:
    def test_returns_real_counts_without_auth(self, db, client):
        _seed(db)
        # No auth headers - the About page is public.
        res = client.get("/api/v1/public/stats")
        assert res.status_code == 200
        body = res.json()
        assert body["parcels"] == 2
        assert body["serviceRequests"] == 3

    def test_returns_zeros_on_empty_db(self, db, client):
        db.query(Workflow).delete()
        db.query(Parcel).delete()
        db.flush()
        res = client.get("/api/v1/public/stats")
        assert res.status_code == 200
        assert res.json() == {"parcels": 0, "serviceRequests": 0}
