"""Ported from backend/test/spatial.e2e-spec.ts.

The TS spec seeds its fixtures once in `beforeAll` and lets later `it`s
build on state earlier ones left behind (shared, order-dependent mutable
state across the whole file). tests/conftest.py's per-test `db`/`client`
fixtures roll back after every test instead, so each test here is
self-contained: it seeds exactly what it needs, including clearing the
spatial tables first so real data from scripts/seed.py (which also
seeds MH/Pune zoning/restriction/infrastructure layers) can't change a
`state=MH, district=Pune`-filtered count. Every behavioral assertion from
the original is preserved; only the sequencing mechanics changed.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Polygon

from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.models.spatial import ChangeDetectionEvent, InfrastructureFeature, RestrictionZone, ZoningOverlay
from tests.helpers.auth import create_authenticated_user

VALID_POLYGON = {"type": "Polygon", "coordinates": [[[73.9, 18.6], [73.91, 18.6], [73.91, 18.61], [73.9, 18.61], [73.9, 18.6]]]}


def _poly(coords):
    return from_shape(Polygon(coords), srid=4326)


def _clear_spatial(db):
    for model in (ZoningOverlay, RestrictionZone, InfrastructureFeature, ChangeDetectionEvent, GovernanceAlert):
        db.query(model).delete()


SQUARE = [(73.85, 18.52), (73.86, 18.52), (73.86, 18.53), (73.85, 18.53), (73.85, 18.52)]
LINE = [(73.85, 18.52), (73.86, 18.53)]


class TestReads:
    def test_zoning_overlays_returns_a_feature_collection_filtered_by_state_and_district(self, db, client):
        _clear_spatial(db)
        db.add(ZoningOverlay(name="Test Residential Zone", zone_type="RESIDENTIAL", state_code="MH", district="Pune", geometry=_poly(SQUARE), parcel_ids=["p1", "p2"]))
        db.add(ZoningOverlay(name="Other State Zone", zone_type="COMMERCIAL", state_code="KA", district="Bangalore", geometry=_poly(SQUARE), parcel_ids=[]))
        db.flush()

        res = client.get("/api/v1/gis/zoning-overlays", params={"state": "MH", "district": "Pune"})
        assert res.status_code == 200
        body = res.json()
        assert len(body["features"]) == 1
        assert body["features"][0]["properties"]["zoneType"] == "RESIDENTIAL"
        assert body["features"][0]["geometry"]["type"] == "Polygon"

    def test_zoning_overlays_with_no_filter_returns_all_overlays(self, db, client):
        _clear_spatial(db)
        db.add(ZoningOverlay(name="A", zone_type="RESIDENTIAL", state_code="MH", district="Pune", geometry=_poly(SQUARE), parcel_ids=[]))
        db.add(ZoningOverlay(name="B", zone_type="COMMERCIAL", state_code="KA", district="Bangalore", geometry=_poly(SQUARE), parcel_ids=[]))
        db.flush()

        res = client.get("/api/v1/gis/zoning-overlays")
        assert res.status_code == 200
        assert len(res.json()["features"]) == 2

    def test_restriction_zones_returns_affected_parcel_ids(self, db, client):
        _clear_spatial(db)
        db.add(RestrictionZone(name="Test Flood Zone", restriction_type="FLOOD", state_code="MH", district="Pune", geometry=_poly(SQUARE), affected_parcel_ids=["p1"]))
        db.flush()

        res = client.get("/api/v1/gis/restriction-zones", params={"district": "Pune"})
        assert res.status_code == 200
        body = res.json()
        assert len(body["features"]) == 1
        assert body["features"][0]["properties"]["affectedParcelIds"] == ["p1"]

    def test_infrastructure_returns_linestring_features(self, db, client):
        _clear_spatial(db)
        db.add(InfrastructureFeature(name="Test Road", feature_type="ROAD", state_code="MH", district="Pune", geometry=from_shape(LineString(LINE), srid=4326)))
        db.flush()

        res = client.get("/api/v1/gis/infrastructure", params={"district": "Pune"})
        assert res.status_code == 200
        body = res.json()
        assert len(body["features"]) == 1
        assert body["features"][0]["geometry"]["type"] == "LineString"
        assert body["features"][0]["properties"]["featureType"] == "ROAD"

    def test_change_detection_events_returns_simulated_change_events(self, db, client):
        _clear_spatial(db)
        db.add(ChangeDetectionEvent(description="Test change event", state_code="MH", district="Pune", geometry=_poly(SQUARE), affected_parcel_ids=["p1", "p2"]))
        db.flush()

        res = client.get("/api/v1/gis/change-detection-events", params={"district": "Pune"})
        assert res.status_code == 200
        body = res.json()
        assert len(body["features"]) == 1
        assert body["features"][0]["properties"]["affectedParcelIds"] == ["p1", "p2"]


class TestCreateZoningOverlay:
    def test_creates_a_zoning_overlay_as_admin(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "New Zone", "zoneType": "AGRICULTURAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON, "parcelIds": ["p9"]},
        )
        assert res.status_code == 201
        assert res.json()["zoneType"] == "AGRICULTURAL"
        assert res.json()["id"]

        listed = client.get("/api/v1/gis/zoning-overlays", params={"district": "Pune"})
        assert any(f["properties"]["id"] == res.json()["id"] for f in listed.json()["features"])

    def test_rejects_a_geometry_that_is_not_a_polygon_with_400(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "Bad Zone", "zoneType": "RESIDENTIAL", "stateCode": "MH", "district": "Pune", "geometry": {"type": "Point", "coordinates": [73.9, 18.6]}},
        )
        assert res.status_code == 400

    def test_rejects_an_invalid_zone_type_with_400(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "Bad Zone", "zoneType": "INDUSTRIAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 400

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "New Zone", "zoneType": "AGRICULTURAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _clear_spatial(db)
        res = client.post(
            "/api/v1/gis/zoning-overlays",
            json={"name": "New Zone", "zoneType": "AGRICULTURAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 401


class TestUpdateAndDeleteZoningOverlay:
    def test_updates_and_then_deletes_a_zoning_overlay_as_admin(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        created = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "Temp Zone", "zoneType": "RESIDENTIAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert created.status_code == 201

        updated = client.patch(f"/api/v1/gis/zoning-overlays/{created.json()['id']}", headers=headers, json={"name": "Renamed Zone"})
        assert updated.status_code == 200
        assert updated.json()["name"] == "Renamed Zone"
        assert updated.json()["zoneType"] == "RESIDENTIAL"  # untouched fields survive a partial update

        deleted = client.delete(f"/api/v1/gis/zoning-overlays/{created.json()['id']}", headers=headers)
        assert deleted.status_code == 200
        # Delete now reports its blast radius so the UI can confirm (B6).
        assert deleted.json()["affectedParcelCount"] == len(deleted.json()["affectedParcelIds"])

        listed = client.get("/api/v1/gis/zoning-overlays", params={"district": "Pune"})
        assert not any(f["properties"]["id"] == created.json()["id"] for f in listed.json()["features"])

    def test_returns_404_deleting_an_unknown_zoning_overlay(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.delete("/api/v1/gis/zoning-overlays/00000000-0000-0000-0000-000000000000", headers=headers)
        assert res.status_code == 404


class TestCreateRestrictionZone:
    def test_creates_a_restriction_zone_as_admin(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "New Restriction", "restrictionType": "ENVIRONMENTAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 201
        assert res.json()["restrictionType"] == "ENVIRONMENTAL"

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "New Restriction", "restrictionType": "ENVIRONMENTAL", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 403


class TestCreateInfrastructure:
    def test_creates_a_linestring_feature_as_admin(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/infrastructure", headers=headers,
            json={"name": "New Road", "featureType": "ROAD", "stateCode": "MH", "district": "Pune", "geometry": {"type": "LineString", "coordinates": [[73.9, 18.6], [73.91, 18.61]]}},
        )
        assert res.status_code == 201
        assert res.json()["featureType"] == "ROAD"

    def test_creates_a_point_feature_as_admin(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/infrastructure", headers=headers,
            json={"name": "Substation", "featureType": "ELECTRICITY", "stateCode": "MH", "district": "Pune", "geometry": {"type": "Point", "coordinates": [73.9, 18.6]}},
        )
        assert res.status_code == 201
        assert res.json()["featureType"] == "ELECTRICITY"

    def test_rejects_a_polygon_geometry_with_400(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/infrastructure", headers=headers,
            json={"name": "Bad Feature", "featureType": "ROAD", "stateCode": "MH", "district": "Pune", "geometry": VALID_POLYGON},
        )
        assert res.status_code == 400

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        _clear_spatial(db)
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(
            "/api/v1/gis/infrastructure", headers=headers,
            json={"name": "New Road", "featureType": "ROAD", "stateCode": "MH", "district": "Pune", "geometry": {"type": "Point", "coordinates": [73.9, 18.6]}},
        )
        assert res.status_code == 403


class TestAdminNotes:
    """Admin-only layer - unlike zoning/restriction/infrastructure above,
    GET is ADMIN-gated too: an officer session must never see this layer,
    not just be blocked from writing to it.
    """

    def test_creates_lists_updates_and_deletes_a_note_as_admin(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        created = client.post(
            "/api/v1/gis/admin-notes", headers=headers,
            json={"name": "Suspicious parcel cluster", "notes": "Flagged for internal review", "stateCode": "MH", "district": "Pune", "geometry": {"type": "Point", "coordinates": [73.9, 18.6]}},
        )
        assert created.status_code == 201
        assert created.json()["notes"] == "Flagged for internal review"
        assert created.json()["createdByUserId"]

        listed = client.get("/api/v1/gis/admin-notes", headers=headers, params={"district": "Pune"})
        assert listed.status_code == 200
        feature = next((f for f in listed.json()["features"] if f["properties"]["id"] == created.json()["id"]), None)
        assert feature is not None
        assert feature["properties"]["notes"] == "Flagged for internal review"
        assert feature["geometry"]["type"] == "Point"

        updated = client.patch(f"/api/v1/gis/admin-notes/{created.json()['id']}", headers=headers, json={"notes": "Reviewed, no issue found"})
        assert updated.status_code == 200
        assert updated.json()["notes"] == "Reviewed, no issue found"
        assert updated.json()["name"] == "Suspicious parcel cluster"  # untouched field survives a partial update

        deleted = client.delete(f"/api/v1/gis/admin-notes/{created.json()['id']}", headers=headers)
        assert deleted.status_code == 204

        after_delete = client.get("/api/v1/gis/admin-notes", headers=headers, params={"district": "Pune"})
        assert not any(f["properties"]["id"] == created.json()["id"] for f in after_delete.json()["features"])

    def test_rejects_any_geometry_type_other_than_point_linestring_polygon_with_400(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.post(
            "/api/v1/gis/admin-notes", headers=headers,
            json={"name": "Bad Note", "stateCode": "MH", "district": "Pune", "geometry": {"type": "MultiPoint", "coordinates": [[73.9, 18.6]]}},
        )
        assert res.status_code == 400

    def test_rejects_a_get_from_a_non_admin_officer_with_403(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get("/api/v1/gis/admin-notes", headers=headers)
        assert res.status_code == 403

    def test_rejects_a_post_from_a_non_admin_officer_with_403(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(
            "/api/v1/gis/admin-notes", headers=headers,
            json={"name": "New Note", "stateCode": "MH", "district": "Pune", "geometry": {"type": "Point", "coordinates": [73.9, 18.6]}},
        )
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_get_with_401(self, client):
        res = client.get("/api/v1/gis/admin-notes")
        assert res.status_code == 401

    def test_returns_404_updating_or_deleting_an_unknown_note(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        res = client.patch("/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000", headers=headers, json={"name": "x"})
        assert res.status_code == 404
        res = client.delete("/api/v1/gis/admin-notes/00000000-0000-0000-0000-000000000000", headers=headers)
        assert res.status_code == 404


class TestRestrictionZoneOverlapAndAlerts:
    """Real spatial overlap -> real GovernanceAlert, and no-overlap
    validation. Coordinates here are far from any real seed.py cluster
    (all 5 cluster centers sit within ~1km of their own center point,
    these test zones are tens of km away) so no clearing is needed - they
    can't intersect real parcel/zone data by construction.
    """

    def test_creates_a_restriction_zone_overlapping_a_real_parcel_and_creates_a_matching_alert(self, db, client):
        parcel = Parcel(
            state_code="MH", district_code="Pune", local_body_code="TEST", area_sq_m=500,
            geometry=_poly([(74.005, 19.005), (74.015, 19.005), (74.015, 19.015), (74.005, 19.015), (74.005, 19.005)]),
        )
        db.add(parcel)
        db.flush()
        _, _, headers = create_authenticated_user(db, "ADMIN")

        zone_polygon = {"type": "Polygon", "coordinates": [[[74.0, 19.0], [74.02, 19.0], [74.02, 19.02], [74.0, 19.02], [74.0, 19.0]]]}
        res = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            # affected_parcel_ids is client-supplied here on purpose (a
            # stale/lying value) to prove the server ignores it and
            # computes its own.
            json={"name": "Alert Test Zone", "restrictionType": "ENVIRONMENTAL", "stateCode": "MH", "district": "Pune", "geometry": zone_polygon, "affectedParcelIds": ["not-a-real-parcel"]},
        )
        assert res.status_code == 201
        assert res.json()["affectedParcelIds"] == [str(parcel.id)]

        alerts = db.query(GovernanceAlert).filter_by(parcel_id=str(parcel.id), alert_type="RESTRICTION_ZONE_OVERLAP").all()
        assert len(alerts) == 1
        assert alerts[0].source == "RESTRICTION_MONITOR"
        assert alerts[0].severity == "MEDIUM"
        assert alerts[0].status == "OPEN"

    def test_rejects_a_second_restriction_zone_overlapping_the_first_with_400(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        first = {"type": "Polygon", "coordinates": [[[74.1, 19.4], [74.12, 19.4], [74.12, 19.42], [74.1, 19.42], [74.1, 19.4]]]}
        overlapping = {"type": "Polygon", "coordinates": [[[74.105, 19.405], [74.125, 19.405], [74.125, 19.425], [74.105, 19.425], [74.105, 19.405]]]}

        created = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "First Zone", "restrictionType": "FLOOD", "stateCode": "MH", "district": "Pune", "geometry": first},
        )
        assert created.status_code == 201

        res = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "Overlapping Zone", "restrictionType": "FLOOD", "stateCode": "MH", "district": "Pune", "geometry": overlapping},
        )
        assert res.status_code == 400
        assert "First Zone" in res.json()["message"]

    def test_rejects_a_second_overlapping_zoning_overlay_with_400_same_layer_type(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        zone_polygon = {"type": "Polygon", "coordinates": [[[74.2, 19.5], [74.22, 19.5], [74.22, 19.52], [74.2, 19.52], [74.2, 19.5]]]}

        first = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "First Overlap-Test Zoning", "zoneType": "RESIDENTIAL", "stateCode": "MH", "district": "Pune", "geometry": zone_polygon},
        )
        assert first.status_code == 201

        second = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "Second Overlap-Test Zoning", "zoneType": "COMMERCIAL", "stateCode": "MH", "district": "Pune", "geometry": zone_polygon},
        )
        assert second.status_code == 400

    def test_does_not_reject_a_zoning_overlay_and_a_restriction_zone_covering_the_same_area(self, db, client):
        _, _, headers = create_authenticated_user(db, "ADMIN")
        shared_polygon = {"type": "Polygon", "coordinates": [[[74.3, 19.6], [74.32, 19.6], [74.32, 19.62], [74.3, 19.62], [74.3, 19.6]]]}

        zoning = client.post(
            "/api/v1/gis/zoning-overlays", headers=headers,
            json={"name": "Cross-Type Zoning", "zoneType": "AGRICULTURAL", "stateCode": "MH", "district": "Pune", "geometry": shared_polygon},
        )
        assert zoning.status_code == 201

        restriction = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "Cross-Type Restriction", "restrictionType": "PROTECTED_AREA", "stateCode": "MH", "district": "Pune", "geometry": shared_polygon},
        )
        assert restriction.status_code == 201

    def test_updating_a_restriction_zone_to_newly_cover_a_second_parcel_creates_exactly_one_new_alert(self, db, client):
        parcel_a = Parcel(
            state_code="MH", district_code="Pune", local_body_code="TEST", area_sq_m=400,
            geometry=_poly([(74.304, 19.304), (74.306, 19.304), (74.306, 19.306), (74.304, 19.306), (74.304, 19.304)]),
        )
        parcel_b = Parcel(
            state_code="MH", district_code="Pune", local_body_code="TEST", area_sq_m=400,
            geometry=_poly([(74.349, 19.349), (74.351, 19.349), (74.351, 19.351), (74.349, 19.351), (74.349, 19.349)]),
        )
        db.add_all([parcel_a, parcel_b])
        db.flush()
        _, _, headers = create_authenticated_user(db, "ADMIN")

        small_zone = {"type": "Polygon", "coordinates": [[[74.3, 19.3], [74.31, 19.3], [74.31, 19.31], [74.3, 19.31], [74.3, 19.3]]]}
        created = client.post(
            "/api/v1/gis/restriction-zones", headers=headers,
            json={"name": "Update Test Zone", "restrictionType": "FLOOD", "stateCode": "MH", "district": "Pune", "geometry": small_zone},
        )
        assert created.status_code == 201
        assert created.json()["affectedParcelIds"] == [str(parcel_a.id)]

        alerts_for_a_after_create = db.query(GovernanceAlert).filter_by(parcel_id=str(parcel_a.id), alert_type="RESTRICTION_ZONE_OVERLAP").all()
        assert len(alerts_for_a_after_create) == 1

        big_zone = {"type": "Polygon", "coordinates": [[[74.3, 19.3], [74.4, 19.3], [74.4, 19.4], [74.3, 19.4], [74.3, 19.3]]]}
        updated = client.patch(f"/api/v1/gis/restriction-zones/{created.json()['id']}", headers=headers, json={"geometry": big_zone})
        assert updated.status_code == 200
        assert sorted(updated.json()["affectedParcelIds"]) == sorted([str(parcel_a.id), str(parcel_b.id)])

        alerts_for_a_after_update = db.query(GovernanceAlert).filter_by(parcel_id=str(parcel_a.id), alert_type="RESTRICTION_ZONE_OVERLAP").all()
        assert len(alerts_for_a_after_update) == 1  # unchanged - no duplicate

        alerts_for_b = db.query(GovernanceAlert).filter_by(parcel_id=str(parcel_b.id), alert_type="RESTRICTION_ZONE_OVERLAP").all()
        assert len(alerts_for_b) == 1  # exactly one new alert
