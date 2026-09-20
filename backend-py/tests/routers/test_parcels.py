"""Ported from backend/test/parcels.e2e-spec.ts.

The `/360` test block is deliberately NOT ported - that endpoint is
stubbed with 501 in app/routers/parcels.py, pending InteroperabilityModule
(see that router's module docstring). Everything else ParcelsService can
do on its own is ported below.
"""

from datetime import date, datetime
from geoalchemy2.shape import from_shape
from io import BytesIO
from pypdf import PdfReader
from shapely.geometry import Polygon

from app.models.parcel import CitizenParcel, ParcelDocument, ParcelHistoricalState, ParcelIdentifier, ParcelNeighbour
from app.models.parcel import Parcel, OwnershipHistoryRecord, CropRecord
from app.models.department_record import RegistrationRecord, TaxRecord
from app.models.user import User
from app.models.workflow import Workflow, WorkflowStep
from tests.helpers.auth import create_authenticated_user


def square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _pdf_text(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF for content assertions."""
    return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf_bytes)).pages)


def _base_fixtures(db):
    """parcelA/parcelB + a citizen-linked parcel, matching the TS spec's
    module-level beforeAll fixtures. Clears the parcels table first (like
    tests/routers/test_gis.py's fixtures) - the real seeded data from
    scripts/seed.py (220 parcels) would otherwise inflate every unfiltered
    `total` assertion below, which the TS spec's fresh-per-run SQLite never
    had to account for.
    """
    db.query(Parcel).delete()
    citizen_linked = Parcel(canonical_parcel_id="CAN-CITIZEN-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=1000, geometry=square(73.85, 18.52))
    db.add(citizen_linked)
    db.flush()
    citizen, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
    db.add(CitizenParcel(citizen_id=citizen.id, parcel_id=citizen_linked.id))
    _, _, other_citizen_headers = create_authenticated_user(db, "CITIZEN")

    parcel_a = Parcel(canonical_parcel_id="CAN00001", ulpin="ULPIN0000000001", state_code="DL", district_code="NDL", local_body_code="DLLB001", area_sq_m=500, geometry=square(77.1, 28.6, 0.01))
    parcel_b = Parcel(canonical_parcel_id="CAN00002", ulpin=None, state_code="KA", district_code="BLR", local_body_code="KALB001", area_sq_m=300, geometry=square(77.6, 12.9, 0.01))
    db.add_all([parcel_a, parcel_b])
    db.flush()

    db.add_all([
        ParcelIdentifier(parcel=parcel_a, identifier_type="ULPIN", identifier_value="ULPIN0000000001", source_state="DL", source_department="Land Records"),
        ParcelIdentifier(parcel=parcel_a, identifier_type="SURVEY_NUMBER", identifier_value="42/3", source_state="DL", source_department="Land Records"),
        ParcelIdentifier(parcel=parcel_b, identifier_type="PLOT_NUMBER", identifier_value="P-9001", source_state="KA", source_department="Land Records"),
        ParcelIdentifier(parcel=parcel_b, identifier_type="LOCAL_PARCEL_ID", identifier_value="KA-BLR-0007", source_state="KA", source_department="Land Records"),
    ])
    db.flush()

    return {
        "citizen_linked": citizen_linked, "citizen_headers": citizen_headers, "other_citizen_headers": other_citizen_headers,
        "parcel_a": parcel_a, "parcel_b": parcel_b,
    }


class TestSearch:
    def test_returns_all_parcels_with_no_filters(self, db, client):
        _base_fixtures(db)
        res = client.get("/api/v1/parcels")
        assert res.status_code == 200
        # parcel_a + parcel_b + citizen_linked.
        assert res.json()["total"] == 3

    def test_finds_a_parcel_by_ulpin(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"ulpin": "ULPIN0000000001"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_a"].id)

    def test_finds_a_parcel_by_survey_number(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"survey_number": "42/3"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_a"].id)

    def test_finds_a_parcel_by_plot_number(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"plot_number": "P-9001"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_b"].id)

    def test_finds_a_parcel_by_local_identifier(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"local_identifier": "KA-BLR-0007"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_b"].id)

    def test_filters_by_state_and_district(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"state": "KA", "district": "BLR"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_b"].id)

    def test_returns_an_empty_result_set_for_an_unmatched_identifier(self, db, client):
        _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"ulpin": "DOES-NOT-EXIST"})
        assert res.json()["total"] == 0
        assert res.json()["parcels"] == []

    def test_matches_when_combining_two_identifier_type_filters_on_the_same_parcel(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"ulpin": "ULPIN0000000001", "survey_number": "42/3"})
        assert res.json()["total"] == 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_a"].id)

    def test_returns_the_full_identifier_list_even_with_a_single_filter_applied(self, db, client):
        _base_fixtures(db)
        res = client.get("/api/v1/parcels", params={"survey_number": "42/3"})
        identifier_types = sorted(i["identifierType"] for i in res.json()["parcels"][0]["identifiers"])
        assert identifier_types == ["SURVEY_NUMBER", "ULPIN"]

    def test_fuzzy_search_by_address(self, db, client):
        f = _base_fixtures(db)
        # Update parcel_a with address information
        f["parcel_a"].street_address = "123 Mahatma Gandhi Road"
        f["parcel_a"].locality = "Connaught Place"
        f["parcel_a"].landmark = "Near Central Park"
        f["parcel_a"].pincode = "110001"
        db.flush()

        # Exact / substring match via trigram
        res = client.get("/api/v1/parcels", params={"address": "Connaught"})
        assert res.status_code == 200
        assert res.json()["total"] >= 1
        assert res.json()["parcels"][0]["id"] == str(f["parcel_a"].id)
        assert res.json()["parcels"][0]["locality"] == "Connaught Place"

        # Fuzzy / typo match test
        res_fuzzy = client.get("/api/v1/parcels", params={"address": "Conaught"})
        assert res_fuzzy.status_code == 200
        assert res_fuzzy.json()["total"] >= 1
        assert res_fuzzy.json()["parcels"][0]["id"] == str(f["parcel_a"].id)


class TestGetById:
    def test_returns_the_parcel_for_a_valid_id(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['parcel_a'].id}")
        assert res.status_code == 200
        assert res.json()["canonicalParcelId"] == "CAN00001"

    def test_rejects_a_non_uuid_id_with_400(self, client):
        assert client.get("/api/v1/parcels/not-a-uuid").status_code == 400

    def test_returns_404_for_an_unknown_uuid(self, client):
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000").status_code == 404


class TestGetGeometry:
    def test_returns_a_geojson_feature(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['parcel_a'].id}/geometry")
        assert res.status_code == 200
        assert res.json()["type"] == "Feature"
        assert res.json()["properties"]["id"] == str(f["parcel_a"].id)
        assert res.json()["geometry"]["type"] == "Polygon"

    def test_rejects_a_non_uuid_id_with_400(self, client):
        assert client.get("/api/v1/parcels/not-a-uuid/geometry").status_code == 400

    def test_returns_404_for_an_unknown_uuid(self, client):
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/geometry").status_code == 404


class TestGetNeighbours:
    def _seed(self, db):
        base = dict(state_code="RJ", district_code="JAI", local_body_code="RJLB001", area_sq_m=100)
        selected = Parcel(canonical_parcel_id="NBR-SELECTED", geometry=square(10.0, 10.0), **base)
        # Shares the right edge of `selected` exactly -> distance 0 (TOUCHING).
        touching = Parcel(canonical_parcel_id="NBR-TOUCHING", geometry=square(10.001, 10.0), **base)
        # ~55m gap from `selected`'s right edge -> within the 200m default (NEARBY).
        nearby = Parcel(canonical_parcel_id="NBR-NEARBY", geometry=square(10.0015, 10.0), **base)
        # ~5km away -> excluded even at a generous distance.
        far = Parcel(canonical_parcel_id="NBR-FAR", geometry=square(10.05, 10.0), **base)
        db.add_all([selected, touching, nearby, far])
        db.flush()
        return selected, touching, nearby, far

    def test_classifies_an_edge_sharing_parcel_as_touching(self, db, client):
        selected, touching, _, _ = self._seed(db)
        res = client.get(f"/api/v1/parcels/{selected.id}/neighbours")
        assert res.status_code == 200
        assert res.json()["selectedParcel"]["parcelId"] == str(selected.id)
        ids = [p["parcelId"] for p in res.json()["adjacentParcels"]]
        assert str(touching.id) in ids
        entry = next(p for p in res.json()["adjacentParcels"] if p["parcelId"] == str(touching.id))
        assert entry["relationship"] == "TOUCHING"

    def test_classifies_nearby_and_excludes_far_with_default_distance(self, db, client):
        selected, _, nearby, far = self._seed(db)
        res = client.get(f"/api/v1/parcels/{selected.id}/neighbours")
        nearby_ids = [p["parcelId"] for p in res.json()["nearbyParcels"]]
        assert str(nearby.id) in nearby_ids
        assert str(far.id) not in nearby_ids
        all_ids = [p["parcelId"] for p in res.json()["adjacentParcels"] + res.json()["nearbyParcels"]]
        assert str(far.id) not in all_ids

    def test_includes_embedded_geojson_feature_geometry(self, db, client):
        selected, _, _, _ = self._seed(db)
        res = client.get(f"/api/v1/parcels/{selected.id}/neighbours")
        assert res.json()["selectedParcel"]["feature"]["type"] == "Feature"
        assert res.json()["selectedParcel"]["feature"]["geometry"]["type"] == "Polygon"
        assert res.json()["nearbyParcels"][0]["feature"]["type"] == "Feature"

    def test_respects_a_custom_distance_param(self, db, client):
        selected, _, nearby, far = self._seed(db)
        narrow = client.get(f"/api/v1/parcels/{selected.id}/neighbours", params={"distance": 10})
        assert str(nearby.id) not in [p["parcelId"] for p in narrow.json()["nearbyParcels"]]

        wide = client.get(f"/api/v1/parcels/{selected.id}/neighbours", params={"distance": 10000})
        wide_ids = [p["parcelId"] for p in wide.json()["adjacentParcels"] + wide.json()["nearbyParcels"]]
        assert str(far.id) in wide_ids

    def test_rejects_a_non_uuid_id_with_400(self, client):
        assert client.get("/api/v1/parcels/not-a-uuid/neighbours").status_code == 400

    def test_returns_404_for_an_unknown_uuid(self, client):
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/neighbours").status_code == 404


class TestExplicitNeighbourPriority:
    """Two parcels that are geometrically far apart (would never classify
    as TOUCHING/NEARBY by distance) but explicitly linked as TOUCHING,
    plus a geometrically-close third parcel with NO row - proving the
    precomputed relationship, not proximity, drives the result once rows
    exist.
    """

    def test_returns_explicit_far_as_touching_and_ignores_close_unlinked(self, db, client):
        def far_square(offset):
            return square(20 + offset, 20, 0.001)

        base = dict(state_code="GJ", district_code="AHM", local_body_code="GJLB001", area_sq_m=100)
        hub = Parcel(canonical_parcel_id="HUB", geometry=far_square(0), **base)
        explicit_touching = Parcel(canonical_parcel_id="EXPLICIT-FAR", geometry=far_square(5), **base)  # ~500km away
        close_unlinked = Parcel(canonical_parcel_id="CLOSE-UNLINKED", geometry=far_square(0.0011), **base)  # touching distance
        db.add_all([hub, explicit_touching, close_unlinked])
        db.flush()
        db.add(ParcelNeighbour(parcel_id=str(hub.id), neighbour_parcel_id=str(explicit_touching.id), relationship_type="TOUCHING"))
        db.flush()

        res = client.get(f"/api/v1/parcels/{hub.id}/neighbours")
        ids = [p["parcelId"] for p in res.json()["adjacentParcels"]]
        assert ids == [str(explicit_touching.id)]
        all_ids = [p["parcelId"] for p in res.json()["adjacentParcels"] + res.json()["nearbyParcels"]]
        assert str(close_unlinked.id) not in all_ids


class TestGetContext:
    def _seed(self, db):
        base = dict(state_code="RJ", district_code="JAI", local_body_code="RJLB001", area_sq_m=100, cluster_id="RJ-JAIPUR-01")
        hub = Parcel(canonical_parcel_id="CTX-HUB", geometry=square(30.0, 30.0), **base)
        cluster_mate = Parcel(canonical_parcel_id="CTX-MATE", geometry=square(30.05, 30.05), **base)
        touching_neighbour = Parcel(canonical_parcel_id="CTX-TOUCH", geometry=square(30.001, 30.0), **base)
        outside_cluster = Parcel(canonical_parcel_id="CTX-OUTSIDE", geometry=square(30.002, 30.0), state_code="RJ", district_code="JAI", local_body_code="RJLB001", area_sq_m=100, cluster_id="RJ-JAIPUR-02")
        db.add_all([hub, cluster_mate, touching_neighbour, outside_cluster])
        db.flush()
        db.add(ParcelNeighbour(parcel_id=str(hub.id), neighbour_parcel_id=str(touching_neighbour.id), relationship_type="TOUCHING"))
        db.flush()
        return hub, cluster_mate, touching_neighbour, outside_cluster

    def test_returns_every_same_cluster_parcel(self, db, client):
        hub, cluster_mate, touching_neighbour, outside_cluster = self._seed(db)
        res = client.get(f"/api/v1/parcels/{hub.id}/context")
        assert res.json()["cluster"]["clusterId"] == "RJ-JAIPUR-01"
        cluster_ids = [p["parcelId"] for p in res.json()["clusterParcels"]]
        assert {str(hub.id), str(cluster_mate.id), str(touching_neighbour.id)}.issubset(set(cluster_ids))
        assert str(outside_cluster.id) not in cluster_ids

    def test_still_includes_adjacent_and_nearby_from_neighbour_relationships(self, db, client):
        hub, _, touching_neighbour, _ = self._seed(db)
        res = client.get(f"/api/v1/parcels/{hub.id}/context")
        assert str(touching_neighbour.id) in [p["parcelId"] for p in res.json()["adjacentParcels"]]

    def test_embeds_full_geojson_feature_geometry_for_every_cluster_parcel(self, db, client):
        hub, _, _, _ = self._seed(db)
        res = client.get(f"/api/v1/parcels/{hub.id}/context")
        for entry in res.json()["clusterParcels"]:
            assert entry["feature"]["type"] == "Feature"
            assert entry["feature"]["geometry"]["type"] == "Polygon"

    def test_rejects_a_non_uuid_id_with_400(self, client):
        assert client.get("/api/v1/parcels/not-a-uuid/context").status_code == 400

    def test_returns_404_for_an_unknown_uuid(self, client):
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/context").status_code == 404

    def test_falls_back_to_a_single_parcel_cluster_when_cluster_id_is_null(self, db, client):
        no_cluster = Parcel(canonical_parcel_id="CTX-NO-CLUSTER", state_code="RJ", district_code="JAI", local_body_code="RJLB001", area_sq_m=100, geometry=square(31.0, 31.0))
        db.add(no_cluster)
        db.flush()
        res = client.get(f"/api/v1/parcels/{no_cluster.id}/context")
        assert res.json()["cluster"]["clusterId"] is None
        assert res.json()["clusterParcels"] == [
            {"parcelId": str(no_cluster.id), "canonicalParcelId": "CTX-NO-CLUSTER", "feature": res.json()["clusterParcels"][0]["feature"]}
        ]


class TestGetMine:
    def test_returns_only_parcels_linked_to_the_signed_in_citizen(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels/mine", headers=f["citizen_headers"])
        assert res.status_code == 200
        assert res.json()["total"] == 1
        assert len(res.json()["parcels"]) == 1
        assert res.json()["parcels"][0]["id"] == str(f["citizen_linked"].id)

    def test_returns_an_empty_list_for_a_citizen_with_no_linked_parcels(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels/mine", headers=f["other_citizen_headers"])
        assert res.json() == {"parcels": [], "total": 0}

    def test_rejects_an_unauthenticated_request_with_401(self, client):
        assert client.get("/api/v1/parcels/mine").status_code == 401

    def test_rejects_a_non_citizen_with_403(self, db, client):
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        assert client.get("/api/v1/parcels/mine", headers=officer_headers).status_code == 403


class TestGetOwnershipHistory:
    def test_allows_the_associated_citizen(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/ownership-history", headers=f["citizen_headers"])
        assert res.status_code == 200

    def test_rejects_an_unassociated_citizen_with_403(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/ownership-history", headers=f["other_citizen_headers"])
        assert res.status_code == 403

    def test_allows_staff_regardless_of_association(self, db, client):
        f = _base_fixtures(db)
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/ownership-history", headers=officer_headers)
        assert res.status_code == 200

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        f = _base_fixtures(db)
        assert client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/ownership-history").status_code == 401

    def test_returns_404_for_an_unknown_parcel(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/ownership-history", headers=f["citizen_headers"])
        assert res.status_code == 404


class TestGetDocuments:
    def _seed(self, db, tmp_path, citizen_linked):
        file_path = tmp_path / "test-parcel-document.png"
        file_path.write_bytes(b"fake-png-bytes")
        doc = ParcelDocument(
            parcel_id=str(citizen_linked.id), document_type="ROR_COPY", file_name="test-parcel-document.png",
            file_path=str(file_path), mime_type="image/png", extracted_text="Owner Name Test Owner", registration_status="REGISTERED",
        )
        db.add(doc)
        db.flush()
        return doc

    def test_lists_document_metadata_publicly(self, db, client, tmp_path):
        f = _base_fixtures(db)
        doc = self._seed(db, tmp_path, f["citizen_linked"])
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents")
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["id"] == str(doc.id)
        assert res.json()[0]["documentType"] == "ROR_COPY"
        assert res.json()[0]["registrationStatus"] == "REGISTERED"

    def test_returns_an_empty_array_for_a_parcel_with_no_documents(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['parcel_a'].id}/documents")
        assert res.json() == []

    def test_serves_the_file_to_the_linked_citizen(self, db, client, tmp_path):
        f = _base_fixtures(db)
        doc = self._seed(db, tmp_path, f["citizen_linked"])
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/{doc.id}/file", headers=f["citizen_headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"

    def test_serves_the_file_to_staff_regardless_of_association(self, db, client, tmp_path):
        f = _base_fixtures(db)
        doc = self._seed(db, tmp_path, f["citizen_linked"])
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/{doc.id}/file", headers=officer_headers)
        assert res.status_code == 200

    def test_rejects_an_unassociated_citizen_with_403(self, db, client, tmp_path):
        f = _base_fixtures(db)
        doc = self._seed(db, tmp_path, f["citizen_linked"])
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/{doc.id}/file", headers=f["other_citizen_headers"])
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client, tmp_path):
        f = _base_fixtures(db)
        doc = self._seed(db, tmp_path, f["citizen_linked"])
        assert client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/{doc.id}/file").status_code == 401

    def test_returns_404_for_a_bare_row_with_no_real_file(self, db, client):
        f = _base_fixtures(db)
        bare = ParcelDocument(parcel_id=str(f["citizen_linked"].id), document_type="ROR_COPY", file_name="", file_path="", mime_type="image/png", registration_status="REGISTERED")
        db.add(bare)
        db.flush()
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/{bare.id}/file", headers=f["citizen_headers"])
        assert res.status_code == 404


class TestGetOfficialDocumentPdf:
    def _seed_full_parcel(self, db, citizen):
        """Seed a parcel with all related records needed for a populated PDF."""
        parcel = Parcel(
            canonical_parcel_id="MH-PUN-000142",
            cluster_id="PUNE_01",
            district_code="PUN",
            state_code="MH",
            ulpin="ULPIN-MH-PUN-000142",
            area_sq_m=2310.5,
            local_body_code="MHLB001",
            geometry=square(73.85, 18.52),
        )
        db.add(parcel)
        db.flush()

        db.add_all([
            ParcelIdentifier(parcel_id=str(parcel.id), identifier_type="SURVEY_NUMBER", identifier_value="142", source_state="MH", source_department="LAND_RECORDS"),
            ParcelIdentifier(parcel_id=str(parcel.id), identifier_type="PLOT_NUMBER", identifier_value="7-A", source_state="MH", source_department="LAND_RECORDS"),
        ])

        db.add(RegistrationRecord(parcel_id=str(parcel.id), registration_status="REGISTERED"))
        db.add(TaxRecord(parcel_id=str(parcel.id), assessed_value=45000.0, annual_tax_amount=500.0, tax_status="PAID", outstanding_amount=0.0))
        db.add(OwnershipHistoryRecord(
            parcel_id=str(parcel.id),
            owner_name="Asha Rao",
            khata_number="1099",
            transaction_type="ORIGINAL",
            transaction_date=date(2011, 4, 22),
            document_reference="DEED-287245",
        ))
        db.add(CropRecord(
            parcel_id=str(parcel.id),
            agricultural_year="2025-26",
            season="KHARIF",
            crop_type="FOOD_CROP",
            crop_name="Paddy (Rice)",
            irrigated_area_sq_m=1500.0,
            unirrigated_area_sq_m=810.5,
            irrigation_source="WELL",
            uncultivable_area_sq_m=0.0,
            remark="Demo crop record",
        ))

        workflow = Workflow(
            id=parcel.id,
            parcel_id=str(parcel.id),
            workflow_type="ROR_COPY_REQUEST",
            current_status="APPROVED",
            created_by="Asha Rao",
            created_at=datetime(2026, 1, 10),
        )
        db.add(workflow)
        db.flush()

        db.add(WorkflowStep(
            workflow_id=workflow.id,
            step_order=1,
            department="LAND_RECORDS",
            action="APPROVE",
            assigned_role="LAND_RECORD_OFFICER",
            status="APPROVED",
            completed_at=datetime(2026, 1, 15),
        ))

        db.add(CitizenParcel(citizen_id=citizen.id, parcel_id=parcel.id))
        db.flush()

        return parcel

    def test_serves_the_pdf_to_the_linked_citizen(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/official-pdf", headers=f["citizen_headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content[:5] == b"%PDF-"

    def test_serves_populated_pdf_with_real_values(self, db, client):
        """Integration test: route returns PDF with actual parcel/owner/crop data."""
        citizen, _, citizen_headers = create_authenticated_user(db, "CITIZEN")

        parcel = self._seed_full_parcel(db, citizen)

        res = client.get(
            f"/api/v1/parcels/{parcel.id}/documents/official-pdf",
            headers=citizen_headers,
        )

        assert res.status_code == 200
        assert res.headers["content-type"].startswith("application/pdf")
        assert "inline" in res.headers["content-disposition"]
        assert "private" in res.headers["cache-control"]
        assert "no-store" in res.headers["cache-control"]

        text = _pdf_text(res.content)
        assert "Asha Rao" in text
        assert "142" in text
        assert "ULPIN-MH-PUN-000142" in text
        assert "DEED-287245" in text
        assert "Paddy (Rice)" in text
        assert "45,000.00" in text

    def test_serves_the_pdf_to_staff_regardless_of_association(self, db, client):
        f = _base_fixtures(db)
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/official-pdf", headers=officer_headers)
        assert res.status_code == 200

    def test_supports_the_hindi_lang_param(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/official-pdf?lang=hi", headers=f["citizen_headers"])
        assert res.status_code == 200
        assert res.content[:5] == b"%PDF-"

    def test_rejects_an_unassociated_citizen_with_403(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/official-pdf", headers=f["other_citizen_headers"])
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        f = _base_fixtures(db)
        assert client.get(f"/api/v1/parcels/{f['citizen_linked'].id}/documents/official-pdf").status_code == 401

    def test_returns_404_for_an_unknown_parcel(self, db, client):
        f = _base_fixtures(db)
        res = client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/documents/official-pdf", headers=f["citizen_headers"])
        assert res.status_code == 404

    def test_unrelated_citizen_cannot_view_official_pdf(self, db, client):
        """Security test: citizen not linked to parcel gets 403."""
        citizen, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
        parcel = self._seed_full_parcel(db, citizen)

        _, _, other_citizen_headers = create_authenticated_user(db, "CITIZEN")

        res = client.get(
            f"/api/v1/parcels/{parcel.id}/documents/official-pdf",
            headers=other_citizen_headers,
        )
        assert res.status_code == 403


class TestGetHistory:
    def _seed(self, db):
        parcel = Parcel(canonical_parcel_id="CAN-HISTORY-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=square(73.9, 18.6))
        db.add(parcel)
        db.flush()
        db.add_all([
            ParcelHistoricalState(parcel_id=str(parcel.id), year=2022, land_use="AGRICULTURAL", zoning_status="NOT_REQUIRED", restriction_status="UNRESTRICTED", tax_status="PAID"),
            ParcelHistoricalState(parcel_id=str(parcel.id), year=2023, land_use="AGRICULTURAL", zoning_status="NOT_REQUIRED", restriction_status="UNRESTRICTED", tax_status="PAID"),
            ParcelHistoricalState(parcel_id=str(parcel.id), year=2024, land_use="RESIDENTIAL", zoning_status="APPROVED", restriction_status="UNRESTRICTED", tax_status="PAID"),
            ParcelHistoricalState(parcel_id=str(parcel.id), year=2025, land_use="RESIDENTIAL", zoning_status="APPROVED", restriction_status="UNRESTRICTED", tax_status="PENDING"),
        ])
        db.flush()
        return parcel

    def test_is_public(self, db, client):
        parcel = self._seed(db)
        res = client.get(f"/api/v1/parcels/{parcel.id}/history")
        assert res.status_code == 200
        assert len(res.json()) == 4

    def test_returns_every_year_oldest_first(self, db, client):
        parcel = self._seed(db)
        res = client.get(f"/api/v1/parcels/{parcel.id}/history")
        assert [r["year"] for r in res.json()] == [2022, 2023, 2024, 2025]
        assert res.json()[1]["landUse"] == "AGRICULTURAL"
        assert res.json()[2]["landUse"] == "RESIDENTIAL"

    def test_filters_to_a_single_year(self, db, client):
        parcel = self._seed(db)
        res = client.get(f"/api/v1/parcels/{parcel.id}/history", params={"year": 2024})
        assert len(res.json()) == 1
        assert res.json()[0]["landUse"] == "RESIDENTIAL"

    def test_returns_an_empty_array_for_a_parcel_with_no_history(self, db, client):
        f = _base_fixtures(db)
        res = client.get(f"/api/v1/parcels/{f['parcel_a'].id}/history")
        assert res.json() == []

    def test_returns_404_for_an_unknown_parcel(self, client):
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/history").status_code == 404
