"""Ported from backend/test/interoperability.e2e-spec.ts.

The original spec exercises IdentifierResolverService/
ResponseAggregatorService directly (not just via HTTP) alongside the one
HTTP endpoint (GET /parcels/:id/360) - ported the same way here, calling
the service functions directly for the parts that aren't HTTP-facing.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.common.land_record_adapters import adapt_state_a, adapt_state_b
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
from app.services import identifier_resolver_service, response_aggregator_service
from app.services.identifier_resolver_service import ResolveParcelIdQuery
from tests.helpers.auth import create_authenticated_user


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

    # fully wired: identifiers + State A + all 5 department records
    full_mh_parcel = Parcel(
        canonical_parcel_id="INTEROP-MH-1", ulpin="ULPIN0009999999", state_code="MH", district_code="PUN", local_body_code="MHLB009",
        area_sq_m=500, geometry=_square(73.85, 18.52),
    )
    # exists, no identifiers, no department data at all
    bare_tn_parcel = Parcel(canonical_parcel_id="INTEROP-TN-1", state_code="TN", district_code="CHE", local_body_code="TNLB009", area_sq_m=400, geometry=_square(80.27, 13.08))
    db.add_all([full_mh_parcel, bare_tn_parcel])
    db.flush()

    db.add_all([
        ParcelIdentifier(parcel_id=full_mh_parcel.id, identifier_type="SURVEY_NUMBER", identifier_value="55/2", source_state="MH", source_department="Land Records"),
        ParcelIdentifier(parcel_id=full_mh_parcel.id, identifier_type="LOCAL_PARCEL_ID", identifier_value="MH-PUN-0099", source_state="MH", source_department="Land Records"),
    ])
    db.add(StateALandRecord(survey_number="55/2", subdivision_number="3", owner_name="Interop Owner", village_code="VIL555", area_hectares=0.05, record_status="ACTIVE"))
    db.add(RegistrationRecord(parcel_id=full_mh_parcel.id, registration_status="REGISTERED", registration_number="REG-1", registration_date="2020-01-01", last_transaction_type="SALE", last_transaction_date="2020-01-01"))
    db.add(PlanningRecord(parcel_id=full_mh_parcel.id, land_use="RESIDENTIAL", zoning_classification="Residential-1", master_plan_reference="Pune Master Plan 2025", building_permission_status="APPROVED"))
    db.add(TaxRecord(parcel_id=full_mh_parcel.id, assessed_value=100000, annual_tax_amount=500, tax_status="PAID", outstanding_amount=0, last_payment_date="2026-01-01"))
    db.add(RestrictionRecord(parcel_id=full_mh_parcel.id, has_restriction=False))
    db.add(DisputeRecord(parcel_id=full_mh_parcel.id, has_active_dispute=False))
    db.add(EncumbranceRecord(parcel_id=full_mh_parcel.id, has_encumbrance=True, encumbrance_type="MORTGAGE", lender_name="Interop Co-operative Bank", instrument_reference="MORTGAGE-100001", registered_date="2021-01-01"))
    db.flush()

    return {"full_mh_parcel": full_mh_parcel, "bare_tn_parcel": bare_tn_parcel}


class TestLandRecordAdapters:
    def test_adapt_state_a_maps_survey_number_owner_name_area_hectares_to_canonical_fields(self):
        record = StateALandRecord(record_id="x", survey_number="10/1", subdivision_number="2", owner_name="Test Owner", village_code="VIL010", area_hectares=1, record_status="ACTIVE")
        adapted = adapt_state_a(record)
        assert adapted.source_schema == "STATE_A"
        assert adapted.source_identifier == "10/1"
        assert adapted.owner_name == "Test Owner"
        assert adapted.area_sq_m == 10000  # 1 hectare = 10000 sqm exactly
        assert adapted.locality == "VIL010"

    def test_adapt_state_b_maps_plot_id_holder_name_land_extent_sqft_to_canonical_fields(self):
        record = StateBLandRecord(record_id="y", plot_id="P-1", holder_name="Test Holder", locality_id="LOC1", land_extent_sqft=10763.9, record_category="Urban")
        adapted = adapt_state_b(record)
        assert adapted.source_schema == "STATE_B"
        assert adapted.source_identifier == "P-1"
        assert adapted.owner_name == "Test Holder"
        assert round(adapted.area_sq_m) == 1000  # 10763.9 sqft ~= 1000 sqm
        assert adapted.locality == "LOC1"


class TestIdentifierResolverService:
    def test_resolves_a_parcel_uuid_from_its_canonical_parcel_id(self, db):
        p = _seed(db)
        result = identifier_resolver_service.resolve_parcel_id(db, ResolveParcelIdQuery(canonical_parcel_id="INTEROP-MH-1"))
        assert result == str(p["full_mh_parcel"].id)

    def test_resolves_a_parcel_uuid_from_its_ulpin(self, db):
        p = _seed(db)
        result = identifier_resolver_service.resolve_parcel_id(db, ResolveParcelIdQuery(ulpin="ULPIN0009999999"))
        assert result == str(p["full_mh_parcel"].id)

    def test_resolves_a_parcel_uuid_from_a_parcel_identifiers_row(self, db):
        p = _seed(db)
        result = identifier_resolver_service.resolve_parcel_id(db, ResolveParcelIdQuery(survey_number="55/2"))
        assert result == str(p["full_mh_parcel"].id)

    def test_returns_none_when_nothing_matches(self, db):
        _seed(db)
        result = identifier_resolver_service.resolve_parcel_id(db, ResolveParcelIdQuery(survey_number="DOES-NOT-EXIST"))
        assert result is None

    def test_resolves_the_department_identifier_forward_direction(self, db):
        p = _seed(db)
        value = identifier_resolver_service.resolve_department_identifier(db, str(p["full_mh_parcel"].id), "SURVEY_NUMBER")
        assert value == "55/2"


class TestResponseAggregatorBuildParcel360:
    def test_returns_none_for_an_unknown_parcel(self, db):
        _seed(db)
        result = response_aggregator_service.build_parcel_360(db, "00000000-0000-0000-0000-000000000000")
        assert result is None

    def test_aggregates_all_seven_departments_for_a_fully_linked_parcel(self, db):
        p = _seed(db)
        result = response_aggregator_service.build_parcel_360(db, str(p["full_mh_parcel"].id))
        assert result["parcel_id"] == str(p["full_mh_parcel"].id)
        assert result["identifiers"] == {"ulpin": "ULPIN0009999999", "survey_number": "55/2", "plot_number": None, "local_identifier": "MH-PUN-0099"}
        assert result["location"] == {"state": "MH", "district": "PUN", "locality": "VIL555"}
        assert result["spatial"]["area_sq_m"] == 500
        assert result["sources"] == [
            {"department": "LAND_RECORDS", "status": "AVAILABLE"},
            {"department": "REGISTRATION", "status": "AVAILABLE"},
            {"department": "PLANNING", "status": "AVAILABLE"},
            {"department": "TAX", "status": "AVAILABLE"},
            {"department": "RESTRICTION", "status": "AVAILABLE"},
            {"department": "DISPUTE", "status": "AVAILABLE"},
            {"department": "ENCUMBRANCE", "status": "AVAILABLE"},
        ]

        land_records = result["departments"]["land_records"]
        assert land_records.source_schema == "STATE_A"
        assert land_records.source_identifier == "55/2"
        assert land_records.owner_name == "Interop Owner"
        assert land_records.area_sq_m == 500
        assert result["departments"]["registration"].registration_status == "REGISTERED"
        assert result["departments"]["planning"].land_use == "RESIDENTIAL"
        assert result["departments"]["tax"].tax_status == "PAID"
        assert result["departments"]["restriction"].has_restriction is False
        assert result["departments"]["dispute"].has_active_dispute is False
        assert result["departments"]["encumbrance"].has_encumbrance is True

    def test_falls_back_to_local_body_code_for_locality_and_nulls_departments_when_nothing_is_linked(self, db):
        p = _seed(db)
        result = response_aggregator_service.build_parcel_360(db, str(p["bare_tn_parcel"].id))
        assert result["location"]["locality"] == "TNLB009"
        assert result["departments"] == {
            "land_records": None, "registration": None, "planning": None, "tax": None, "restriction": None, "dispute": None, "encumbrance": None,
        }
        assert all(s["status"] == "NOT_AVAILABLE" for s in result["sources"])


class TestGetParcel360EndToEnd:
    def test_serves_the_canonical_envelope_and_land_records_but_withholds_owner_only_departments_for_anonymous(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/parcels/{p['full_mh_parcel'].id}/360")
        assert res.status_code == 200
        body = res.json()
        assert body["parcel_id"] == str(p["full_mh_parcel"].id)
        assert body["departments"]["landRecords"]["ownerName"] == "Interop Owner"
        assert body["departments"]["tax"] is None
        assert body["departments"]["planning"] is None
        assert body["departments"]["restriction"] is None
        assert body["departments"]["dispute"] is None
        assert body["departments"]["encumbrance"] is None
        assert body["restrictedForViewer"] is True

    def test_serves_every_department_for_staff(self, db, client):
        p = _seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get(f"/api/v1/parcels/{p['full_mh_parcel'].id}/360", headers=admin_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["departments"]["tax"]["taxStatus"] == "PAID"
        assert body["restrictedForViewer"] is False

    def test_returns_404_for_an_unknown_parcel(self, db, client):
        _seed(db)
        res = client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/360")
        assert res.status_code == 404
