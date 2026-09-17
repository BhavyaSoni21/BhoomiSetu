"""Ported from backend/test/departments.e2e-spec.ts.

Fully self-contained (no auth) - a complete, unscoped port of the
original spec.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.department_record import (
    DisputeRecord,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    TaxRecord,
)
from app.models.land_records import StateALandRecord, StateBLandRecord
from app.models.parcel import Parcel, ParcelIdentifier


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _seed(db):
    db.query(Parcel).delete()
    db.query(StateALandRecord).delete()
    db.query(StateBLandRecord).delete()
    for model in (RegistrationRecord, PlanningRecord, TaxRecord, RestrictionRecord, DisputeRecord, EncumbranceRecord):
        db.query(model).delete()
    db.flush()

    mh_parcel = Parcel(canonical_parcel_id="DEPT-MH-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.85, 18.52))
    dl_parcel = Parcel(canonical_parcel_id="DEPT-DL-1", state_code="DL", district_code="NEW", local_body_code="DLLB001", area_sq_m=300, geometry=_square(77.2, 28.6))
    tn_parcel = Parcel(canonical_parcel_id="DEPT-TN-1", state_code="TN", district_code="CHE", local_body_code="TNLB001", area_sq_m=400, geometry=_square(80.27, 13.08))
    db.add_all([mh_parcel, dl_parcel, tn_parcel])
    db.flush()

    db.add(ParcelIdentifier(parcel_id=mh_parcel.id, identifier_type="SURVEY_NUMBER", identifier_value="77/9", source_state="MH", source_department="Land Records"))
    db.add(ParcelIdentifier(parcel_id=dl_parcel.id, identifier_type="PLOT_NUMBER", identifier_value="P-4321", source_state="DL", source_department="Land Records"))

    db.add(StateALandRecord(survey_number="77/9", subdivision_number="2", owner_name="Match Owner A", village_code="VIL777", area_hectares=0.05))
    db.add(StateBLandRecord(plot_id="P-4321", holder_name="Match Owner B", locality_id="LOC432", land_extent_sqft=3229, record_category="Urban"))

    db.add(RegistrationRecord(parcel_id=mh_parcel.id, registration_status="REGISTERED", registration_number="REG-MH-1", registration_date="2020-01-01", last_transaction_type="SALE", last_transaction_date="2020-01-01"))
    db.add(PlanningRecord(parcel_id=mh_parcel.id, land_use="RESIDENTIAL", zoning_classification="Residential-1", master_plan_reference="Pune Master Plan 2025", building_permission_status="APPROVED"))
    db.add(TaxRecord(parcel_id=mh_parcel.id, assessed_value=1000000, annual_tax_amount=5000, tax_status="PENDING", outstanding_amount=2500))
    db.add(RestrictionRecord(parcel_id=mh_parcel.id, has_restriction=True, restriction_type="FLOOD_PRONE", restriction_details="Test flood flag", imposing_authority="MH Env Authority"))
    db.add(DisputeRecord(parcel_id=mh_parcel.id, has_active_dispute=True, dispute_type="BOUNDARY", case_status="UNDER_REVIEW", filing_date="2025-06-01"))
    db.add(EncumbranceRecord(parcel_id=mh_parcel.id, has_encumbrance=True, encumbrance_type="MORTGAGE", lender_name="Test Co-operative Bank", instrument_reference="MORTGAGE-500001", registered_date="2022-03-01"))
    db.flush()

    return {"mh_parcel": mh_parcel, "dl_parcel": dl_parcel, "tn_parcel": tn_parcel}


class TestLandRecordsLookup:
    def test_resolves_an_mh_parcel_to_its_state_a_record_via_survey_number(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/land-records/{p['mh_parcel'].id}")
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "STATE_A"
        assert body["identifierUsed"] == {"type": "SURVEY_NUMBER", "value": "77/9"}
        assert body["data"]["ownerName"] == "Match Owner A"

    def test_resolves_a_dl_parcel_to_its_state_b_record_via_plot_number(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/land-records/{p['dl_parcel'].id}")
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "STATE_B"
        assert body["identifierUsed"] == {"type": "PLOT_NUMBER", "value": "P-4321"}
        assert body["data"]["holderName"] == "Match Owner B"

    def test_returns_404_for_a_state_with_no_mock_schema_configured(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/land-records/{p['tn_parcel'].id}")
        assert res.status_code == 404

    def test_returns_404_for_an_unknown_parcel_id(self, db, client):
        _seed(db)
        res = client.get("/api/v1/land-records/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404

    def test_rejects_a_non_uuid_id_with_400(self, db, client):
        _seed(db)
        res = client.get("/api/v1/land-records/not-a-uuid")
        assert res.status_code == 400


class TestRegistration:
    def test_returns_registration_status_and_transaction_info(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/registration/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["registrationStatus"] == "REGISTERED"
        assert res.json()["lastTransactionType"] == "SALE"

    def test_returns_404_when_no_registration_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/registration/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestPlanning:
    def test_returns_land_use_and_zoning_info(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/planning/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["landUse"] == "RESIDENTIAL"
        assert res.json()["buildingPermissionStatus"] == "APPROVED"

    def test_returns_404_when_no_planning_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/planning/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestTax:
    def test_returns_assessed_value_tax_status_and_outstanding_amount(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/tax/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["taxStatus"] == "PENDING"
        assert float(res.json()["outstandingAmount"]) == 2500

    def test_returns_404_when_no_tax_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/tax/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestRestriction:
    def test_returns_the_restriction_flag_and_type(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/restriction/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["hasRestriction"] is True
        assert res.json()["restrictionType"] == "FLOOD_PRONE"

    def test_returns_404_when_no_restriction_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/restriction/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestDispute:
    def test_returns_the_dispute_status(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/dispute/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["hasActiveDispute"] is True
        assert res.json()["disputeType"] == "BOUNDARY"
        assert res.json()["caseStatus"] == "UNDER_REVIEW"

    def test_returns_404_when_no_dispute_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/dispute/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestEncumbrance:
    def test_returns_the_encumbrance_flag_and_type(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/encumbrance/{p['mh_parcel'].id}")
        assert res.status_code == 200
        assert res.json()["hasEncumbrance"] is True
        assert res.json()["encumbranceType"] == "MORTGAGE"
        assert res.json()["lenderName"] == "Test Co-operative Bank"

    def test_returns_404_when_no_encumbrance_record_exists(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/encumbrance/{p['dl_parcel'].id}")
        assert res.status_code == 404


class TestDepartmentApisOperateIndependently:
    def test_each_department_only_returns_its_own_data_shape(self, db, client):
        p = _seed(db)
        registration = client.get(f"/api/v1/registration/{p['mh_parcel'].id}")
        planning = client.get(f"/api/v1/planning/{p['mh_parcel'].id}")
        tax = client.get(f"/api/v1/tax/{p['mh_parcel'].id}")
        restriction = client.get(f"/api/v1/restriction/{p['mh_parcel'].id}")
        dispute = client.get(f"/api/v1/dispute/{p['mh_parcel'].id}")
        encumbrance = client.get(f"/api/v1/encumbrance/{p['mh_parcel'].id}")
        for res in (registration, planning, tax, restriction, dispute, encumbrance):
            assert res.status_code == 200

        assert "landUse" not in registration.json()
        assert "taxStatus" not in registration.json()
        assert "registrationStatus" not in planning.json()
        assert "assessedValue" not in planning.json()
        assert "landUse" not in tax.json()
        assert "hasRestriction" not in tax.json()
        assert "taxStatus" not in restriction.json()
        assert "landUse" not in restriction.json()
        assert "taxStatus" not in dispute.json()
        assert "hasRestriction" not in dispute.json()
        assert "taxStatus" not in encumbrance.json()
        assert "hasRestriction" not in encumbrance.json()
