"""Ported from backend/test/ai.e2e-spec.ts.

The original mocks the `openai` SDK (`jest.mock('openai')`) so these
tests exercise ai_service's query-filtering and validation logic against
a controllable fake model response, never a real Groq API call. Ported
here by monkeypatching `groq_service.complete_json` directly instead -
simpler than mocking the SDK, and the same substitution already used for
HistoricalImageryModule's narrative_service.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.department_record import TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import CitizenParcel, Parcel
from app.services import groq_service
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _stub_groq(monkeypatch, json_response):
    monkeypatch.setattr(groq_service, "complete_json", lambda system_prompt, user_prompt: json_response)


def _seed(db):
    db.query(Parcel).delete()
    db.query(GovernanceAlert).delete()
    db.flush()

    parcel = Parcel(canonical_parcel_id="AI-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.85, 18.52))
    overdue_parcel = Parcel(canonical_parcel_id="AI-2", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=400, geometry=_square(73.86, 18.53))
    db.add_all([parcel, overdue_parcel])
    db.flush()

    db.add(TaxRecord(parcel_id=parcel.id, assessed_value=100000, annual_tax_amount=500, tax_status="PAID", outstanding_amount=0))
    db.add(TaxRecord(parcel_id=overdue_parcel.id, assessed_value=80000, annual_tax_amount=400, tax_status="OVERDUE", outstanding_amount=400))

    alert = GovernanceAlert(parcel_id=str(parcel.id), alert_type="TAX_OVERDUE", severity="LOW", source="TAX_MONITOR", status="OPEN", explanation="Outstanding property tax of 400 is overdue for this parcel.")
    db.add(alert)
    db.flush()

    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    owner_citizen, _, owner_citizen_headers = create_authenticated_user(db, "CITIZEN")
    db.add(CitizenParcel(citizen_id=owner_citizen.id, parcel_id=parcel.id))
    _, _, other_citizen_headers = create_authenticated_user(db, "CITIZEN")
    db.flush()

    return {
        "parcel": parcel, "overdue_parcel": overdue_parcel, "alert": alert,
        "officer_headers": officer_headers, "owner_citizen_headers": owner_citizen_headers, "other_citizen_headers": other_citizen_headers,
    }


class TestPostQuery:
    def test_executes_the_actual_db_query_using_ai_derived_filters(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"intent": "DATA_QUERY", "reply": "Here are the overdue-tax parcels.", "filters": {"tax_status": "OVERDUE"}})

        res = client.post("/api/v1/ai/query", json={"query": "Show me parcels with overdue tax"})
        assert res.status_code == 200
        body = res.json()
        assert body["intent"] == "DATA_QUERY"
        assert body["reply"] == "Here are the overdue-tax parcels."
        assert body["filters"] == {"tax_status": "OVERDUE"}
        result_ids = [p["id"] for p in body["results"]]
        assert str(s["overdue_parcel"].id) in result_ids
        assert str(s["parcel"].id) not in result_ids

    def test_silently_strips_a_hallucinated_filter_key(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"intent": "DATA_QUERY", "reply": "Here you go.", "filters": {"tax_status": "PAID", "made_up_field": "anything"}})

        res = client.post("/api/v1/ai/query", json={"query": "Show me parcels with paid tax"})
        assert res.status_code == 200
        body = res.json()
        assert body["filters"] == {"tax_status": "PAID"}
        assert str(s["parcel"].id) in [p["id"] for p in body["results"]]

    def test_answers_a_help_intent_with_just_a_reply(self, db, client, monkeypatch):
        _seed(db)
        _stub_groq(monkeypatch, {"intent": "HELP", "reply": "Use the Search Parcels panel and enter a ULPIN or Survey Number."})

        res = client.post("/api/v1/ai/query", json={"query": "How do I search for a parcel?"})
        assert res.status_code == 200
        assert res.json() == {"intent": "HELP", "reply": "Use the Search Parcels panel and enter a ULPIN or Survey Number."}

    def test_treats_a_data_query_with_no_filters_as_a_help_shaped_reply(self, db, client, monkeypatch):
        _seed(db)
        _stub_groq(monkeypatch, {"intent": "DATA_QUERY", "reply": "Could you say which parcels you mean?"})

        res = client.post("/api/v1/ai/query", json={"query": "show me some parcels"})
        assert res.status_code == 200
        assert res.json() == {"intent": "HELP", "reply": "Could you say which parcels you mean?"}

    def test_rejects_with_502_when_the_ai_response_has_an_invalid_enum_value(self, db, client, monkeypatch):
        _seed(db)
        _stub_groq(monkeypatch, {"intent": "DATA_QUERY", "reply": "x", "filters": {"tax_status": "MAYBE_OVERDUE"}})
        res = client.post("/api/v1/ai/query", json={"query": "anything"})
        assert res.status_code == 502

    def test_rejects_with_502_when_the_ai_response_is_missing_intent_reply(self, db, client, monkeypatch):
        _seed(db)
        _stub_groq(monkeypatch, {"notIntent": {}})
        res = client.post("/api/v1/ai/query", json={"query": "anything"})
        assert res.status_code == 502

    def test_rejects_a_request_with_an_empty_query_with_400(self, db, client):
        _seed(db)
        assert client.post("/api/v1/ai/query", json={"query": ""}).status_code == 400
        assert client.post("/api/v1/ai/query", json={}).status_code == 400

    def test_normalizes_a_human_phrased_state_district_to_stored_short_codes(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"intent": "DATA_QUERY", "reply": "Here you go.", "filters": {"state": "Maharashtra", "district": "Pune"}})

        res = client.post("/api/v1/ai/query", json={"query": "Show me parcels in Pune, Maharashtra"})
        assert res.status_code == 200
        body = res.json()
        ids = [p["id"] for p in body["results"]]
        assert str(s["parcel"].id) in ids
        assert str(s["overdue_parcel"].id) in ids
        assert all(p["stateCode"] == "MH" and p["districtCode"] == "PUN" for p in body["results"])


class TestPostParcelsExplain:
    def _stub_explanation(self, monkeypatch):
        _stub_groq(monkeypatch, {"summary": "x", "risk_level": "LOW", "findings": [], "recommended_action": "None."})

    def test_returns_a_validated_structured_explanation(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"summary": "This parcel has registration and tax data on file.", "risk_level": "LOW", "findings": [{"type": "TAX", "description": "Tax is paid in full."}], "recommended_action": "No action needed."})

        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain")
        assert res.status_code == 200
        assert res.json()["risk_level"] == "LOW"
        assert len(res.json()["findings"]) == 1

    def test_returns_404_for_an_unknown_parcel_without_calling_the_ai(self, db, client, monkeypatch):
        _seed(db)
        called = []
        monkeypatch.setattr(groq_service, "complete_json", lambda *a, **k: called.append(1))
        res = client.post("/api/v1/ai/parcels/00000000-0000-0000-0000-000000000000/explain")
        assert res.status_code == 404
        assert called == []

    def test_rejects_a_non_uuid_id_with_400(self, db, client):
        _seed(db)
        assert client.post("/api/v1/ai/parcels/not-a-uuid/explain").status_code == 400

    def test_rejects_with_502_when_the_ai_omits_a_required_field(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"summary": "Missing risk level and the rest"})
        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain")
        assert res.status_code == 502

    def test_withholds_tax_from_the_data_sent_to_the_ai_for_an_anonymous_caller(self, db, client, monkeypatch):
        s = _seed(db)
        captured = {}

        def fake_complete_json(system_prompt, user_prompt):
            captured["user_prompt"] = user_prompt
            return {"summary": "x", "risk_level": "LOW", "findings": [], "recommended_action": "None."}

        monkeypatch.setattr(groq_service, "complete_json", fake_complete_json)
        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain")
        assert res.status_code == 200
        import json
        assert json.loads(captured["user_prompt"])["departments"]["tax"] is None

    def test_withholds_tax_for_a_citizen_who_does_not_own_this_parcel(self, db, client, monkeypatch):
        s = _seed(db)
        captured = {}

        def fake_complete_json(system_prompt, user_prompt):
            captured["user_prompt"] = user_prompt
            return {"summary": "x", "risk_level": "LOW", "findings": [], "recommended_action": "None."}

        monkeypatch.setattr(groq_service, "complete_json", fake_complete_json)
        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain", headers=s["other_citizen_headers"])
        assert res.status_code == 200
        import json
        assert json.loads(captured["user_prompt"])["departments"]["tax"] is None

    def test_includes_real_tax_data_for_the_owning_citizen(self, db, client, monkeypatch):
        s = _seed(db)
        captured = {}

        def fake_complete_json(system_prompt, user_prompt):
            captured["user_prompt"] = user_prompt
            return {"summary": "x", "risk_level": "LOW", "findings": [], "recommended_action": "None."}

        monkeypatch.setattr(groq_service, "complete_json", fake_complete_json)
        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain", headers=s["owner_citizen_headers"])
        assert res.status_code == 200
        import json
        assert json.loads(captured["user_prompt"])["departments"]["tax"]["taxStatus"] == "PAID"

    def test_includes_real_tax_data_for_staff_regardless_of_association(self, db, client, monkeypatch):
        s = _seed(db)
        captured = {}

        def fake_complete_json(system_prompt, user_prompt):
            captured["user_prompt"] = user_prompt
            return {"summary": "x", "risk_level": "LOW", "findings": [], "recommended_action": "None."}

        monkeypatch.setattr(groq_service, "complete_json", fake_complete_json)
        res = client.post(f"/api/v1/ai/parcels/{s['parcel'].id}/explain", headers=s["officer_headers"])
        assert res.status_code == 200
        import json
        assert json.loads(captured["user_prompt"])["departments"]["tax"]["taxStatus"] == "PAID"


class TestPostAlertsExplain:
    def test_returns_a_validated_structured_explanation(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"summary": "Property tax is overdue for this parcel.", "risk_level": "MEDIUM", "findings": [{"type": "TAX_OVERDUE", "description": "Outstanding balance of 400."}], "recommended_action": "OFFICER_REVIEW"})

        res = client.post(f"/api/v1/ai/alerts/{s['alert'].id}/explain", headers=s["officer_headers"])
        assert res.status_code == 200
        assert res.json()["risk_level"] == "MEDIUM"
        assert res.json()["recommended_action"] == "OFFICER_REVIEW"

    def test_returns_404_for_an_unknown_alert_without_calling_the_ai(self, db, client, monkeypatch):
        s = _seed(db)
        called = []
        monkeypatch.setattr(groq_service, "complete_json", lambda *a, **k: called.append(1))
        res = client.post("/api/v1/ai/alerts/00000000-0000-0000-0000-000000000000/explain", headers=s["officer_headers"])
        assert res.status_code == 404
        assert called == []

    def test_rejects_with_502_for_an_invalid_risk_level(self, db, client, monkeypatch):
        s = _seed(db)
        _stub_groq(monkeypatch, {"summary": "x", "risk_level": "EXTREME", "findings": [], "recommended_action": "x"})
        res = client.post(f"/api/v1/ai/alerts/{s['alert'].id}/explain", headers=s["officer_headers"])
        assert res.status_code == 502

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        s = _seed(db)
        res = client.post(f"/api/v1/ai/alerts/{s['alert'].id}/explain")
        assert res.status_code == 401
