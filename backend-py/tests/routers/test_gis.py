"""Ported from backend/test/gis.e2e-spec.ts.

The original spec seeds 3 fixtures into a fresh, empty in-memory SQLite
per run. backend-py's dev database has real data from scripts/seed.py, so
each test here clears the parcels table first, within the rolled-back
test transaction (tests/conftest.py's `db` fixture) - nothing persists
after the test, same isolation the original got for free from a
throwaway SQLite instance.
"""

import json

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.parcel import Parcel


def _poly(coords):
    return from_shape(Polygon(coords), srid=4326)


def _seed_fixture_parcels(db):
    db.query(Parcel).delete()
    fixtures = [
        Parcel(
            canonical_parcel_id="CAN00001", ulpin="ULPIN0000000001", state_code="DL", district_code="NDL", local_body_code="DLLB001",
            geometry=_poly([(77.1, 28.6), (77.11, 28.6), (77.11, 28.61), (77.1, 28.61), (77.1, 28.6)]), area_sq_m=500,
        ),
        Parcel(
            canonical_parcel_id="CAN00002", ulpin=None, state_code="DL", district_code="SDL", local_body_code="DLLB002",
            geometry=_poly([(77.2, 28.5), (77.21, 28.5), (77.21, 28.51), (77.2, 28.51), (77.2, 28.5)]), area_sq_m=750,
        ),
        Parcel(
            canonical_parcel_id="CAN00003", ulpin="ULPIN0000000003", state_code="KA", district_code="BLR", local_body_code="KALB001",
            geometry=_poly([(77.6, 12.9), (77.61, 12.9), (77.61, 12.91), (77.6, 12.91), (77.6, 12.9)]), area_sq_m=300,
        ),
    ]
    db.add_all(fixtures)
    db.flush()
    return fixtures


class TestGetParcels:
    def test_returns_all_seeded_parcels_with_a_total_count(self, db, client):
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels")
        assert res.status_code == 200
        assert res.json()["total"] == 3
        assert len(res.json()["parcels"]) == 3

    def test_filters_by_state(self, db, client):
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels", params={"state": "DL"})
        assert res.status_code == 200
        assert res.json()["total"] == 2
        assert all(p["stateCode"] == "DL" for p in res.json()["parcels"])

    def test_filters_by_state_and_district_together(self, db, client):
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels", params={"state": "DL", "district": "SDL"})
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["canonicalParcelId"] == "CAN00002"

    def test_respects_limit(self, db, client):
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels", params={"limit": 1})
        assert res.status_code == 200
        assert len(res.json()["parcels"]) == 1
        assert res.json()["total"] == 3

    def test_returns_valid_geojson_geometry_strings_for_each_parcel(self, db, client):
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels")
        for parcel in res.json()["parcels"]:
            geometry = json.loads(parcel["geometry"])
            assert geometry["type"] == "Polygon"
            assert isinstance(geometry["coordinates"], list)

    def test_bbox_filters_to_intersecting_parcels_only(self, db, client):
        # Not present in the original e2e spec (SQLite skipped this whole
        # code path with a console.warn) - backend-py has no SQLite
        # fallback, ST_Intersects always runs, so this is real behavior
        # worth covering that the ported spec alone wouldn't catch.
        _seed_fixture_parcels(db)
        res = client.get("/api/v1/gis/parcels", params={"bbox": "77.0,28.55,77.15,28.65"})
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["canonicalParcelId"] == "CAN00001"


class TestGetParcelGeometry:
    def test_returns_a_geojson_feature_for_a_valid_parcel_id(self, db, client):
        fixtures = _seed_fixture_parcels(db)
        target = fixtures[0]
        res = client.get(f"/api/v1/gis/parcels/{target.id}/geometry")
        assert res.status_code == 200
        body = res.json()
        assert body["type"] == "Feature"
        assert body["properties"]["id"] == str(target.id)
        assert body["geometry"]["type"] == "Polygon"

    def test_rejects_a_non_uuid_id_with_400(self, client):
        res = client.get("/api/v1/gis/parcels/not-a-uuid/geometry")
        assert res.status_code == 400

    def test_returns_an_empty_body_for_a_well_formed_but_unknown_uuid(self, client):
        res = client.get("/api/v1/gis/parcels/00000000-0000-0000-0000-000000000000/geometry")
        assert res.status_code == 200
        assert res.json() == {}


class TestGetParcelRestrictions:
    def test_returns_an_array_placeholder_for_a_valid_parcel_id(self, db, client):
        fixtures = _seed_fixture_parcels(db)
        target = fixtures[0]
        res = client.get(f"/api/v1/gis/parcels/{target.id}/restrictions")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
