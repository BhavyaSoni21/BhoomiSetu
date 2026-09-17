"""Ported from backend/test/predictive-analytics.e2e-spec.ts.

Fully self-contained - no cross-module dependencies - so this is a
straight, complete port of the original spec.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.department_record import DisputeRecord, RestrictionRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _seed(db):
    db.query(Parcel).delete()
    db.query(TaxRecord).delete()
    db.query(DisputeRecord).delete()
    db.query(RestrictionRecord).delete()
    db.query(GovernanceAlert).delete()
    db.flush()

    # Parcel A: only a tax record (OVERDUE, 50% of assessed value outstanding).
    #   tax factor = clamp(60 + clamp(0.5*400,0,40), 0, 100) = 100, weight 0.4
    #   alerts factor = 0 (no open alerts, but always "available"), weight 0.2
    #   overall = round((100*0.4 + 0*0.2) / 0.6) = round(66.67) = 67 -> HIGH
    parcel_a = Parcel(canonical_parcel_id="PA-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.85, 18.52))
    # Parcel B: only an active OWNERSHIP dispute.
    #   dispute factor = 90, weight 0.3; alerts factor = 0, weight 0.2
    #   overall = round((90*0.3 + 0*0.2) / 0.5) = round(54) = 54 -> HIGH
    parcel_b = Parcel(canonical_parcel_id="PA-2", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.86, 18.53))
    # Parcel C: all four factors present (tax PAID, active BOUNDARY dispute,
    # FLOOD_PRONE restriction, one open CRITICAL alert).
    #   overall = round(0*0.4 + 65*0.3 + 100*0.2 + 60*0.1) = round(45.5) = 46 -> MEDIUM
    parcel_c = Parcel(canonical_parcel_id="PA-3", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.87, 18.54))
    # Parcel D: no department records at all.
    #   only the alerts factor is available (score 0, weight 0.2)
    #   overall = round(0 / 0.2) = 0 -> LOW, dataCompleteness = 0.2
    parcel_d = Parcel(canonical_parcel_id="PA-4", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.88, 18.55))
    db.add_all([parcel_a, parcel_b, parcel_c, parcel_d])
    db.flush()

    db.add_all([
        TaxRecord(parcel_id=parcel_a.id, assessed_value=1000, annual_tax_amount=10, tax_status="OVERDUE", outstanding_amount=500),
        TaxRecord(parcel_id=parcel_c.id, assessed_value=1000, annual_tax_amount=10, tax_status="PAID", outstanding_amount=0),
    ])
    db.add_all([
        DisputeRecord(parcel_id=parcel_b.id, has_active_dispute=True, dispute_type="OWNERSHIP", case_status="FILED"),
        DisputeRecord(parcel_id=parcel_c.id, has_active_dispute=True, dispute_type="BOUNDARY", case_status="UNDER_REVIEW"),
    ])
    db.add(RestrictionRecord(parcel_id=parcel_c.id, has_restriction=True, restriction_type="FLOOD_PRONE", imposing_authority="Irrigation Dept"))
    db.add_all([
        GovernanceAlert(parcel_id=parcel_c.id, alert_type="UNAUTHORIZED_CHANGE_DETECTED", severity="CRITICAL", source="CHANGE_DETECTION", status="OPEN", explanation="x"),
        # A DISMISSED alert on parcel D must not count toward its score.
        GovernanceAlert(parcel_id=parcel_d.id, alert_type="TAX_OVERDUE", severity="HIGH", source="TAX_MONITOR", status="DISMISSED", explanation="x"),
    ])
    db.flush()

    return {"parcel_a": parcel_a, "parcel_b": parcel_b, "parcel_c": parcel_c, "parcel_d": parcel_d}


class TestGetRiskScore:
    def test_scores_a_parcel_with_only_a_tax_record_excluding_unavailable_factors(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/parcels/{p['parcel_a'].id}/risk-score")
        assert res.status_code == 200
        body = res.json()
        assert body["overallScore"] == 67
        assert body["riskBand"] == "HIGH"
        assert body["dataCompleteness"] == 0.6

        by_key = {f["key"]: f for f in body["factors"]}
        assert by_key["TAX_DELINQUENCY"]["available"] is True
        assert by_key["TAX_DELINQUENCY"]["score"] == 100
        assert by_key["ACTIVE_DISPUTE"]["available"] is False
        assert by_key["RESTRICTION"]["available"] is False
        assert by_key["GOVERNANCE_ALERTS"]["available"] is True
        assert by_key["GOVERNANCE_ALERTS"]["score"] == 0

    def test_scores_a_parcel_with_only_an_active_ownership_dispute(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/parcels/{p['parcel_b'].id}/risk-score")
        assert res.status_code == 200
        body = res.json()
        assert body["overallScore"] == 54
        assert body["riskBand"] == "HIGH"

        by_key = {f["key"]: f for f in body["factors"]}
        assert by_key["ACTIVE_DISPUTE"]["score"] == 90
        assert "ownership dispute is filed" in by_key["ACTIVE_DISPUTE"]["rationale"].lower()

    def test_combines_all_four_factors_when_every_department_has_a_record(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/parcels/{p['parcel_c'].id}/risk-score")
        assert res.status_code == 200
        body = res.json()
        assert body["overallScore"] == 46
        assert body["riskBand"] == "MEDIUM"
        assert body["dataCompleteness"] == 1.0

        by_key = {f["key"]: f for f in body["factors"]}
        assert by_key["TAX_DELINQUENCY"]["score"] == 0
        assert by_key["ACTIVE_DISPUTE"]["score"] == 65
        assert by_key["GOVERNANCE_ALERTS"]["score"] == 100
        assert by_key["RESTRICTION"]["score"] == 60

    def test_scores_a_parcel_with_no_department_records_as_low_with_low_data_completeness(self, db, client):
        p = _seed(db)
        res = client.get(f"/api/v1/parcels/{p['parcel_d'].id}/risk-score")
        assert res.status_code == 200
        body = res.json()
        assert body["overallScore"] == 0
        assert body["riskBand"] == "LOW"
        assert body["dataCompleteness"] == 0.2

        by_key = {f["key"]: f for f in body["factors"]}
        assert by_key["GOVERNANCE_ALERTS"]["score"] == 0
        assert "no open governance alerts" in by_key["GOVERNANCE_ALERTS"]["rationale"].lower()

    def test_returns_404_for_a_parcel_that_does_not_exist(self, db, client):
        _seed(db)
        res = client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/risk-score")
        assert res.status_code == 404


class TestGetTopRiskParcels:
    def test_ranks_parcels_by_overall_score_highest_first(self, db, client):
        p = _seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get("/api/v1/predictive-analytics/top-risk-parcels", headers=admin_headers)
        assert res.status_code == 200
        ids = [r["parcelId"] for r in res.json()]
        assert ids.index(str(p["parcel_a"].id)) < ids.index(str(p["parcel_b"].id))
        assert ids.index(str(p["parcel_b"].id)) < ids.index(str(p["parcel_c"].id))
        assert ids.index(str(p["parcel_c"].id)) < ids.index(str(p["parcel_d"].id))

    def test_respects_the_limit_query_parameter(self, db, client):
        p = _seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get("/api/v1/predictive-analytics/top-risk-parcels", params={"limit": 2}, headers=admin_headers)
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 2
        assert body[0]["parcelId"] == str(p["parcel_a"].id)
        assert body[1]["parcelId"] == str(p["parcel_b"].id)

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        _seed(db)
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get("/api/v1/predictive-analytics/top-risk-parcels", headers=officer_headers)
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/predictive-analytics/top-risk-parcels")
        assert res.status_code == 401
