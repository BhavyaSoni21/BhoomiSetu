"""Ported from backend/test/historical-imagery.e2e-spec.ts."""

import io
import json

import pytest
from geoalchemy2.shape import from_shape
from PIL import Image
from shapely.geometry import Polygon

from app.common.parcel_generation.parcel_category import CURRENT_YEAR
from app.models.department_record import DisputeRecord, RestrictionRecord
from app.models.governance import GovernanceAlert
from app.models.historical_imagery import ClusterHistoricalSnapshot
from app.models.parcel import Parcel, ParcelHistoricalState
from app.services import narrative_service
from tests.helpers.auth import create_authenticated_user


def make_flat_image() -> bytes:
    img = Image.new("RGBA", (64, 64), (143, 174, 134, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def square(min_lng: float, min_lat: float, size: float = 0.0006):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


OLD_YEAR = 2022
# Comparisons that generate governance alerts are restricted to exactly
# CURRENT_YEAR-1 -> CURRENT_YEAR.
PREVIOUS_YEAR = CURRENT_YEAR - 1
CLUSTER_ID = "TEST-CLUSTER-01"
# Kept separate from CLUSTER_ID so these fixture parcels don't leak into
# the compare() tests, which query every parcel in a cluster broadly.
MAP_ONLY_CLUSTER_ID = "TEST-CLUSTER-02"


@pytest.fixture
def snapshots(db, tmp_path):
    flat_image = make_flat_image()
    bounds = json.dumps({"minLng": 73.849, "minLat": 18.519, "maxLng": 73.852, "maxLat": 18.522})
    for year in (OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR):
        image_path = tmp_path / f"{CLUSTER_ID}-{year}.png"
        image_path.write_bytes(flat_image)
        db.add(ClusterHistoricalSnapshot(cluster_id=CLUSTER_ID, year=year, image_path=str(image_path), bounds=bounds))
    db.flush()


class TestListClusters:
    def test_lists_the_seeded_cluster_and_its_available_years(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get("/api/v1/historical-imagery/clusters", headers=headers)
        assert res.status_code == 200
        entry = next(c for c in res.json() if c["clusterId"] == CLUSTER_ID)
        assert entry["years"] == [OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR]

    def test_is_public(self, db, client, snapshots):
        _, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
        assert client.get("/api/v1/historical-imagery/clusters", headers=citizen_headers).status_code == 200
        assert client.get("/api/v1/historical-imagery/clusters").status_code == 200


class TestGetImage:
    def test_serves_the_stored_png(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/years/{OLD_YEAR}/image", headers=headers)
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert len(res.content) > 0

    def test_returns_404_for_a_year_with_no_snapshot(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/years/1999/image", headers=headers)
        assert res.status_code == 404

    def test_rejects_a_citizen_with_403(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "CITIZEN")
        res = client.get(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/years/{OLD_YEAR}/image", headers=headers)
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client, snapshots):
        res = client.get(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/years/{OLD_YEAR}/image")
        assert res.status_code == 401


class TestGetParcelsForYear:
    def test_returns_each_parcel_with_real_geometry_and_category(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        ring_geom = square(73.9, 18.6)
        parcel = Parcel(canonical_parcel_id="HI-MAP-RESTRICTED", cluster_id=MAP_ONLY_CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=ring_geom)
        db.add(parcel)
        db.flush()
        db.add(ParcelHistoricalState(parcel_id=str(parcel.id), year=OLD_YEAR, restriction_status="RESTRICTED"))
        db.flush()

        res = client.get(f"/api/v1/historical-imagery/clusters/{MAP_ONLY_CLUSTER_ID}/years/{OLD_YEAR}/parcels", headers=headers)
        assert res.status_code == 200
        row = next(p for p in res.json() if p["canonicalParcelId"] == "HI-MAP-RESTRICTED")
        assert row["category"] == "RESTRICTED"
        assert row["id"] == str(parcel.id)
        assert json.loads(row["geometry"])["type"] == "Polygon"

    def test_applies_active_dispute_only_for_current_year(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        parcel = Parcel(canonical_parcel_id="HI-MAP-DISPUTE", cluster_id=MAP_ONLY_CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.91, 18.61))
        db.add(parcel)
        db.flush()
        db.add(DisputeRecord(parcel_id=str(parcel.id), has_active_dispute=True, dispute_type="INHERITANCE", case_status="FILED"))
        db.flush()

        current_res = client.get(f"/api/v1/historical-imagery/clusters/{MAP_ONLY_CLUSTER_ID}/years/{CURRENT_YEAR}/parcels", headers=headers)
        assert next(p for p in current_res.json() if p["canonicalParcelId"] == "HI-MAP-DISPUTE")["category"] == "DISPUTE_INHERITANCE"

        old_res = client.get(f"/api/v1/historical-imagery/clusters/{MAP_ONLY_CLUSTER_ID}/years/{OLD_YEAR}/parcels", headers=headers)
        assert next(p for p in old_res.json() if p["canonicalParcelId"] == "HI-MAP-DISPUTE")["category"] == "NONE"

    def test_is_public(self, db, client, snapshots):
        _, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
        assert client.get(f"/api/v1/historical-imagery/clusters/{MAP_ONLY_CLUSTER_ID}/years/{CURRENT_YEAR}/parcels", headers=citizen_headers).status_code == 200
        assert client.get(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/years/{CURRENT_YEAR}/parcels").status_code == 200


class TestCompare:
    def test_detects_real_category_changes_and_creates_correctly_severed_alerts(self, db, client, snapshots, monkeypatch):
        critical = Parcel(canonical_parcel_id="HI-CRITICAL-DISPUTE", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8501, 18.5201))
        high = Parcel(canonical_parcel_id="HI-HIGH-DISPUTE", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8502, 18.5202))
        new_restriction = Parcel(canonical_parcel_id="HI-NEW-RESTRICTION", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8503, 18.5203))
        cleared = Parcel(canonical_parcel_id="HI-CLEARED", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8504, 18.5204))
        unaffected = Parcel(canonical_parcel_id="HI-UNAFFECTED", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8505, 18.5205))
        db.add_all([critical, high, new_restriction, cleared, unaffected])
        db.flush()

        db.add_all([
            DisputeRecord(parcel_id=str(critical.id), has_active_dispute=True, dispute_type="ENCROACHMENT", case_status="FILED", filing_date="2026-03-01"),
            DisputeRecord(parcel_id=str(high.id), has_active_dispute=True, dispute_type="BOUNDARY", case_status="UNDER_REVIEW", filing_date="2026-02-01"),
        ])
        db.add(RestrictionRecord(parcel_id=str(critical.id), has_restriction=True, restriction_type="FLOOD_PRONE"))
        db.add_all([
            ParcelHistoricalState(parcel_id=str(critical.id), year=PREVIOUS_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(critical.id), year=CURRENT_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(high.id), year=PREVIOUS_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(high.id), year=CURRENT_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(new_restriction.id), year=PREVIOUS_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(new_restriction.id), year=CURRENT_YEAR, restriction_status="RESTRICTED"),
            ParcelHistoricalState(parcel_id=str(cleared.id), year=PREVIOUS_YEAR, restriction_status="RESTRICTED"),
            ParcelHistoricalState(parcel_id=str(cleared.id), year=CURRENT_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(unaffected.id), year=PREVIOUS_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(unaffected.id), year=CURRENT_YEAR, restriction_status="UNRESTRICTED"),
        ])
        db.flush()

        captured_calls = []

        def fake_explain(from_year, to_year, parcels):
            captured_calls.append((from_year, to_year, parcels))
            return {
                "HI-CRITICAL-DISPUTE": "This parcel has an active encroachment dispute filed in March 2026, in a flood-restricted zone.",
                "HI-HIGH-DISPUTE": "This parcel has an active boundary dispute filed in February 2026.",
                "HI-NEW-RESTRICTION": "This parcel newly fell under a recorded restriction in 2026.",
                "HI-CLEARED": "The restriction previously on this parcel is no longer active.",
            }

        monkeypatch.setattr(narrative_service, "explain_parcel_changes", fake_explain)

        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": PREVIOUS_YEAR, "toYear": CURRENT_YEAR})
        assert res.status_code == 201
        body = res.json()
        assert body["changeDetected"] is True
        by_id = {p["canonicalParcelId"]: p for p in body["affectedParcels"]}

        assert sorted(by_id.keys()) == ["HI-CLEARED", "HI-CRITICAL-DISPUTE", "HI-HIGH-DISPUTE", "HI-NEW-RESTRICTION"]

        assert by_id["HI-CRITICAL-DISPUTE"]["toCategory"] == "DISPUTE_ENCROACHMENT"
        assert "encroachment dispute" in by_id["HI-CRITICAL-DISPUTE"]["narrative"]
        assert by_id["HI-CRITICAL-DISPUTE"]["alertId"]
        critical_alert = db.get(GovernanceAlert, by_id["HI-CRITICAL-DISPUTE"]["alertId"])
        assert critical_alert.alert_type == "DISPUTE_DETECTED"
        assert critical_alert.severity == "CRITICAL"
        assert critical_alert.source == "HISTORICAL_IMAGERY"
        assert critical_alert.status == "OPEN"

        assert by_id["HI-HIGH-DISPUTE"]["toCategory"] == "DISPUTE_BOUNDARY"
        high_alert = db.get(GovernanceAlert, by_id["HI-HIGH-DISPUTE"]["alertId"])
        assert high_alert.alert_type == "DISPUTE_DETECTED"
        assert high_alert.severity == "HIGH"

        assert by_id["HI-NEW-RESTRICTION"]["fromCategory"] == "NONE"
        assert by_id["HI-NEW-RESTRICTION"]["toCategory"] == "RESTRICTED"
        restriction_alert = db.get(GovernanceAlert, by_id["HI-NEW-RESTRICTION"]["alertId"])
        assert restriction_alert.alert_type == "RESTRICTION_DETECTED"
        assert restriction_alert.severity == "MEDIUM"

        # A parcel whose problem cleared (RESTRICTED -> NONE) is still
        # reported in the list, but must NOT get a fresh alert.
        assert by_id["HI-CLEARED"]["fromCategory"] == "RESTRICTED"
        assert by_id["HI-CLEARED"]["toCategory"] == "NONE"
        assert by_id["HI-CLEARED"]["alertId"] is None

        # A parcel whose category never changed shouldn't appear at all.
        assert "HI-UNAFFECTED" not in by_id

        assert len(captured_calls) == 1
        assert captured_calls[0][0] == PREVIOUS_YEAR
        assert captured_calls[0][1] == CURRENT_YEAR
        assert len(captured_calls[0][2]) == 4

    def test_falls_back_to_real_facts_when_the_narrative_call_fails(self, db, client, snapshots, monkeypatch):
        parcel = Parcel(canonical_parcel_id="HI-FALLBACK", cluster_id=CLUSTER_ID, state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.86, 18.53))
        db.add(parcel)
        db.flush()
        db.add_all([
            ParcelHistoricalState(parcel_id=str(parcel.id), year=PREVIOUS_YEAR, restriction_status="UNRESTRICTED"),
            ParcelHistoricalState(parcel_id=str(parcel.id), year=CURRENT_YEAR, restriction_status="RESTRICTED"),
        ])
        db.flush()

        def fake_explain(*args, **kwargs):
            raise RuntimeError("Narrative AI service is not configured")

        monkeypatch.setattr(narrative_service, "explain_parcel_changes", fake_explain)

        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": PREVIOUS_YEAR, "toYear": CURRENT_YEAR})
        assert res.status_code == 201
        body = res.json()
        assert body["changeDetected"] is True
        row = next(p for p in body["affectedParcels"] if p["canonicalParcelId"] == "HI-FALLBACK")
        assert "RESTRICTED" in row["narrative"]
        assert row["alertId"]

    def test_returns_404_for_a_missing_snapshot_even_when_year_pair_is_valid(self, db, client):
        # MAP_ONLY_CLUSTER_ID has real parcels but no ClusterHistoricalSnapshot
        # rows at all.
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(f"/api/v1/historical-imagery/clusters/{MAP_ONLY_CLUSTER_ID}/compare", headers=headers, json={"fromYear": PREVIOUS_YEAR, "toYear": CURRENT_YEAR})
        assert res.status_code == 404

    def test_rejects_a_citizen_with_403(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "CITIZEN")
        res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": PREVIOUS_YEAR, "toYear": CURRENT_YEAR})
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client, snapshots):
        res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", json={"fromYear": PREVIOUS_YEAR, "toYear": CURRENT_YEAR})
        assert res.status_code == 401

    def test_rejects_a_malformed_body_with_400(self, db, client, snapshots):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": "not-a-year", "toYear": CURRENT_YEAR})
        assert res.status_code == 400

    class TestYearPairRestriction:
        def test_rejects_an_arbitrary_historical_pair_with_400(self, db, client, snapshots):
            _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
            res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": OLD_YEAR, "toYear": PREVIOUS_YEAR})
            assert res.status_code == 400
            assert str(PREVIOUS_YEAR) in res.json()["message"]
            assert str(CURRENT_YEAR) in res.json()["message"]

        def test_rejects_the_reversed_pair_with_400(self, db, client, snapshots):
            _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
            res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": CURRENT_YEAR, "toYear": PREVIOUS_YEAR})
            assert res.status_code == 400

        def test_rejects_a_same_year_comparison_with_400(self, db, client, snapshots):
            _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
            res = client.post(f"/api/v1/historical-imagery/clusters/{CLUSTER_ID}/compare", headers=headers, json={"fromYear": CURRENT_YEAR, "toYear": CURRENT_YEAR})
            assert res.status_code == 400
