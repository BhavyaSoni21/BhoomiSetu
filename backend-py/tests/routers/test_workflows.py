"""Ported from backend/test/workflows.e2e-spec.ts.

The original spec builds one shared fixture set in beforeAll and lets
later `it`s build on state earlier ones left behind. tests/conftest.py's
per-test db/client fixtures roll back after every test instead, so each
test here seeds exactly what it needs via the shared `_seed` helper
(mirroring the pattern already used for test_spatial.py/test_parcels.py)
- every behavioral assertion from the original is preserved, only the
sequencing mechanics changed. The original's 1.1s sleeps (working around
SQLite's second-resolution CURRENT_TIMESTAMP) are dropped - Postgres has
microsecond resolution.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.common.parcel_generation.parcel_document_generator import ParcelDocumentFields, render_parcel_document_image
from app.models.parcel import CitizenParcel, Parcel, ParcelDocument
from app.models.notification import Notification
from app.models.workflow import Workflow, WorkflowPipelineConfig, WorkflowStep
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _clear(db):
    db.query(WorkflowStep).delete()
    db.query(Workflow).delete()
    db.query(Notification).delete()
    db.query(WorkflowPipelineConfig).delete()
    db.flush()


def _seed(db):
    _clear(db)
    parcel = Parcel(canonical_parcel_id="WF-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.85, 18.52))
    other_parcel = Parcel(canonical_parcel_id="WF-2", state_code="DL", district_code="NEW", local_body_code="DLLB001", area_sq_m=300, geometry=_square(77.2, 28.6))
    db.add_all([parcel, other_parcel])
    db.flush()

    admin, _, admin_headers = create_authenticated_user(db, "ADMIN")
    land_records_officer, _, land_records_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    _, _, registration_headers = create_authenticated_user(db, "REGISTRATION_OFFICER")

    citizen, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
    db.add_all([CitizenParcel(citizen_id=citizen.id, parcel_id=parcel.id), CitizenParcel(citizen_id=citizen.id, parcel_id=other_parcel.id)])
    db.flush()

    _, _, unassociated_citizen_headers = create_authenticated_user(db, "CITIZEN")

    return {
        "parcel": parcel, "other_parcel": other_parcel,
        "admin_headers": admin_headers,
        "land_records_officer_id": str(land_records_officer.id), "land_records_headers": land_records_headers,
        "registration_headers": registration_headers,
        "citizen_user_id": str(citizen.id), "citizen_headers": citizen_headers,
        "unassociated_citizen_headers": unassociated_citizen_headers,
    }


class TestCreate:
    def test_creates_a_workflow_with_submitted_status_and_auto_generates_the_3_step_pipeline(self, db, client, monkeypatch):
        # Force AI routing to fail so we test the deterministic fallback pipeline
        import app.services.groq_service as groq_service
        monkeypatch.setattr(groq_service, "complete_json", lambda *a, **kw: (_ for _ in ()).throw(Exception("AI unavailable")))

        s = _seed(db)
        res = client.post(
            "/api/v1/workflows", headers=s["citizen_headers"],
            json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST", "createdBy": "Jane Citizen", "requestDetails": "Need a copy for a loan application"},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["currentStatus"] == "SUBMITTED"
        assert body["parcelId"] == str(s["parcel"].id)
        assert len(body["steps"]) == 3
        assert [st["department"] for st in body["steps"]] == ["LAND_RECORDS", "REGISTRATION", "PLANNING"]
        assert all(st["status"] == "PENDING" for st in body["steps"])
        assert [st["stepOrder"] for st in body["steps"]] == [1, 2, 3]
        # AI routing failed (monkeypatched), falls back to deterministic pipeline_for()
        assert body["routingNotes"] is None

    def test_notifies_every_officer_holding_the_assigned_roles(self, db, client, monkeypatch):
        import app.services.groq_service as groq_service
        monkeypatch.setattr(groq_service, "complete_json", lambda *a, **kw: (_ for _ in ()).throw(Exception("AI unavailable")))

        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert res.status_code == 201

        notification = db.query(Notification).filter(Notification.user_id == s["land_records_officer_id"], Notification.type == "WORKFLOW_ASSIGNED", Notification.workflow_id == res.json()["id"]).first()
        assert notification is not None
        assert notification.parcel_id == str(s["parcel"].id)
        assert notification.read is False

    def test_accepts_no_created_by_request_details_defaulting_created_by_to_the_citizen(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "CORRECTION_REQUEST"})
        assert res.status_code == 201
        assert res.json()["createdBy"].startswith("Test CITIZEN")
        assert res.json()["requestDetails"] is None

    def test_rejects_a_request_for_a_non_existent_parcel_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": "00000000-0000-0000-0000-000000000000", "workflowType": "ROR_COPY_REQUEST"})
        assert res.status_code == 400

    def test_rejects_a_request_missing_required_fields_with_400(self, db, client):
        s = _seed(db)
        assert client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"workflowType": "ROR_COPY_REQUEST"}).status_code == 400
        assert client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id)}).status_code == 400

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert res.status_code == 401

    def test_rejects_a_staff_account_filing_a_request_with_403(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["land_records_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert res.status_code == 403

    def test_rejects_a_citizen_filing_for_an_unassociated_parcel_with_403(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["unassociated_citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert res.status_code == 403

    def test_dispute_filing_gets_its_own_single_step_dispute_review(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/workflows", headers=s["citizen_headers"],
            json={"parcelId": str(s["parcel"].id), "workflowType": "DISPUTE_FILING", "requestDetails": "Boundary dispute with neighbouring parcel"},
        )
        assert res.status_code == 201
        assert len(res.json()["steps"]) == 1
        step = res.json()["steps"][0]
        assert step["department"] == "DISPUTE" and step["assignedRole"] == "DISPUTE_OFFICER" and step["status"] == "PENDING" and step["stepOrder"] == 1


class TestGetOne:
    def test_returns_a_workflow_with_its_steps(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.get(f"/api/v1/workflows/{created.json()['id']}", headers=s["admin_headers"])
        assert res.status_code == 200
        assert res.json()["id"] == created.json()["id"]
        assert len(res.json()["steps"]) == 3

    def test_rejects_a_non_uuid_id_with_400(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/workflows/not-a-uuid", headers=s["admin_headers"]).status_code == 400

    def test_returns_404_for_a_well_formed_but_unknown_uuid(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"]).status_code == 404

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000").status_code == 401

    def test_allows_an_officer_whose_department_has_a_step(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert client.get(f"/api/v1/workflows/{created.json()['id']}", headers=s["land_records_headers"]).status_code == 200

    def test_returns_404_for_a_staff_role_with_no_step_in_the_workflow(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        _, _, tax_headers = create_authenticated_user(db, "TAX_OFFICER")
        assert client.get(f"/api/v1/workflows/{created.json()['id']}", headers=tax_headers).status_code == 404


class TestUpdateStatus:
    def test_updates_current_status_and_records_remarks(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.patch(f"/api/v1/workflows/{created.json()['id']}/status", headers=s["admin_headers"], json={"status": "UNDER_REVIEW", "remarks": "Assigned to land records officer"})
        assert res.status_code == 200
        assert res.json()["currentStatus"] == "UNDER_REVIEW"
        assert res.json()["lastRemarks"] == "Assigned to land records officer"
        assert len(res.json()["steps"]) == 3

    def test_returns_404_for_an_unknown_workflow(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/workflows/00000000-0000-0000-0000-000000000000/status", headers=s["admin_headers"], json={"status": "APPROVED"})
        assert res.status_code == 404


class TestGetParcelWorkflows:
    def test_lists_only_workflows_for_that_parcel_newest_first(self, db, client):
        s = _seed(db)
        first = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["other_parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        second = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["other_parcel"].id), "workflowType": "CORRECTION_REQUEST"})
        # Postgres's now()/CURRENT_TIMESTAMP is fixed per transaction, not
        # per statement - both inserts land in the same outer test
        # transaction (see conftest.py's db fixture), so they'd otherwise
        # get an identical created_at and make "newest first" unverifiable.
        # Bump the second one forward explicitly instead of sleeping.
        from datetime import datetime, timedelta

        second_workflow = db.get(Workflow, second.json()["id"])
        second_workflow.created_at = datetime.now() + timedelta(seconds=2)
        db.flush()

        res = client.get(f"/api/v1/parcels/{s['other_parcel'].id}/workflows")
        assert res.status_code == 200
        assert len(res.json()) == 2
        assert all(w["parcelId"] == str(s["other_parcel"].id) for w in res.json())
        assert res.json()[0]["id"] == second.json()["id"]
        assert res.json()[1]["id"] == first.json()["id"]

    def test_returns_an_empty_array_for_a_parcel_with_no_requests(self, db, client):
        _seed(db)
        fresh_parcel = Parcel(canonical_parcel_id="WF-3", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=200, geometry=_square(77.5, 12.9))
        db.add(fresh_parcel)
        db.flush()
        res = client.get(f"/api/v1/parcels/{fresh_parcel.id}/workflows")
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_404_for_an_unknown_parcel(self, db, client):
        _seed(db)
        assert client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/workflows").status_code == 404


class TestOfficerDashboardListing:
    def test_filters_by_department_and_step_status(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.get("/api/v1/workflows", params={"department": "LAND_RECORDS", "stepStatus": "PENDING"}, headers=s["land_records_headers"])
        assert res.status_code == 200
        assert any(w["id"] == created.json()["id"] for w in res.json())
        assert all(any(st["department"] == "LAND_RECORDS" and st["status"] == "PENDING" for st in w["steps"]) for w in res.json())

    def test_excludes_a_workflow_whose_matching_step_has_already_been_decided(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        land_records_step = next(st for st in created.json()["steps"] if st["department"] == "LAND_RECORDS")
        client.patch(f"/api/v1/workflows/{created.json()['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})

        res = client.get("/api/v1/workflows", params={"department": "LAND_RECORDS", "stepStatus": "PENDING"}, headers=s["land_records_headers"])
        assert not any(w["id"] == created.json()["id"] for w in res.json())

    def test_returns_every_workflow_with_no_filters_admin_only(self, db, client):
        s = _seed(db)
        client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.get("/api/v1/workflows", headers=s["admin_headers"])
        assert res.status_code == 200
        assert len(res.json()) > 0

    def test_honors_an_explicit_limit(self, db, client):
        s = _seed(db)
        for _ in range(3):
            client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        unlimited = client.get("/api/v1/workflows", headers=s["admin_headers"])
        assert len(unlimited.json()) > 2
        limited = client.get("/api/v1/workflows", params={"limit": 2}, headers=s["admin_headers"])
        assert len(limited.json()) == 2
        assert [w["id"] for w in limited.json()] == [w["id"] for w in unlimited.json()[:2]]

    def test_scopes_an_officers_request_to_their_own_department(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.get("/api/v1/workflows", params={"department": "REGISTRATION"}, headers=s["land_records_headers"])
        assert any(w["id"] == created.json()["id"] for w in res.json())
        assert all(any(st["department"] == "LAND_RECORDS" for st in w["steps"]) for w in res.json())

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/workflows").status_code == 401


class TestReviewStep:
    def test_approving_every_step_moves_the_workflow_to_approved(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        last = None
        for step in created["steps"]:
            last = client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["admin_headers"], json={"action": "APPROVE", "remarks": f"{step['department']} looks good"})
        assert last.json()["currentStatus"] == "APPROVED"
        assert all(st["status"] == "APPROVED" for st in last.json()["steps"])
        assert all(st["completedAt"] is not None for st in last.json()["steps"])

    def test_rejecting_one_step_moves_the_whole_workflow_to_rejected(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        registration_step = next(st for st in created["steps"] if st["department"] == "REGISTRATION")
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{registration_step['id']}", headers=s["registration_headers"], json={"action": "REJECT", "remarks": "Ownership mismatch"})
        assert res.status_code == 200
        assert res.json()["currentStatus"] == "REJECTED"
        decided = next(st for st in res.json()["steps"] if st["id"] == registration_step["id"])
        assert decided["status"] == "REJECTED" and decided["remarks"] == "Ownership mismatch"
        assert all(st["status"] == "PENDING" for st in res.json()["steps"] if st["id"] != registration_step["id"])

    def test_partially_approved_workflow_is_in_progress(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        land_records_step = next(st for st in created["steps"] if st["department"] == "LAND_RECORDS")
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert res.json()["currentStatus"] == "IN_PROGRESS"

    def test_rejects_missing_remarks_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE"})
        assert res.status_code == 400

    def test_rejects_empty_string_remarks_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "REJECT", "remarks": ""})
        assert res.status_code == 400

    def test_rejects_reviewing_an_already_decided_step_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "REJECT", "remarks": "Rejected"})
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_workflow(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert res.status_code == 404

    def test_returns_404_when_the_step_does_not_belong_to_that_workflow(self, db, client):
        s = _seed(db)
        first = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        second = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "CORRECTION_REQUEST"}).json()
        res = client.patch(f"/api/v1/workflows/{first['id']}/steps/{second['steps'][0]['id']}", headers=s["admin_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert res.status_code == 404

    def test_rejects_an_invalid_action_value_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["admin_headers"], json={"action": "MAYBE"})
        assert res.status_code == 400

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", json={"action": "APPROVE", "remarks": "Approved"})
        assert res.status_code == 401

    def test_rejects_an_officer_deciding_a_step_outside_their_department_with_403(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        registration_step = next(st for st in created["steps"] if st["department"] == "REGISTRATION")

        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{registration_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert res.status_code == 403

        still_pending = client.get(f"/api/v1/workflows/{created['id']}", headers=s["admin_headers"])
        assert next(st for st in still_pending.json()["steps"] if st["id"] == registration_step["id"])["status"] == "PENDING"

    def test_notifies_the_citizen_when_their_step_is_decided(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        land_records_step = next(st for st in created["steps"] if st["department"] == "LAND_RECORDS")
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "All documents verified"})

        notification = db.query(Notification).filter(Notification.user_id == s["citizen_user_id"], Notification.type == "WORKFLOW_STEP_APPROVED", Notification.workflow_id == created["id"]).first()
        assert notification is not None
        assert "All documents verified" in notification.message

    def test_lets_admin_decide_a_step_regardless_of_department(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        planning_step = next(st for st in created["steps"] if st["department"] == "PLANNING")
        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{planning_step['id']}", headers=s["admin_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert next(st for st in res.json()["steps"] if st["id"] == planning_step["id"])["status"] == "APPROVED"


class TestGetMine:
    def test_returns_only_the_citizens_own_requests_across_all_parcels(self, db, client):
        s = _seed(db)
        own = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["other_parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        res = client.get("/api/v1/workflows/mine", headers=s["citizen_headers"])
        assert res.status_code == 200
        assert any(w["id"] == own.json()["id"] for w in res.json())
        assert all(w["parcelId"] in (str(s["parcel"].id), str(s["other_parcel"].id)) for w in res.json())
        assert len(res.json()[0]["steps"]) > 0

    def test_returns_an_empty_array_for_a_citizen_with_no_parcels(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/workflows/mine", headers=s["unassociated_citizen_headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_rejects_a_staff_account_with_403(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/workflows/mine", headers=s["admin_headers"]).status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/workflows/mine").status_code == 401


class TestLandClaimRequest:
    def test_is_exempt_from_the_association_check(self, db, client):
        s = _seed(db)
        unclaimed = Parcel(canonical_parcel_id="WF-CLAIM-1", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=400, geometry=_square(77.6, 12.95))
        db.add(unclaimed)
        db.flush()

        res = client.post("/api/v1/workflows", headers=s["unassociated_citizen_headers"], json={"parcelId": str(unclaimed.id), "workflowType": "LAND_CLAIM_REQUEST"})
        assert res.status_code == 201
        assert len(res.json()["steps"]) == 1
        step = res.json()["steps"][0]
        assert step["department"] == "LAND_RECORDS" and step["assignedRole"] == "LAND_RECORD_OFFICER" and step["status"] == "PENDING"

        assert db.query(CitizenParcel).filter(CitizenParcel.parcel_id == unclaimed.id).first() is None

    def test_rejects_a_claim_on_an_already_linked_parcel_with_409(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["unassociated_citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "LAND_CLAIM_REQUEST"})
        assert res.status_code == 409

    def test_approving_the_claim_step_creates_the_link(self, db, client):
        s = _seed(db)
        unclaimed = Parcel(canonical_parcel_id="WF-CLAIM-2", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=410, geometry=_square(77.61, 12.95))
        db.add(unclaimed)
        db.flush()
        claimant, _, claimant_headers = create_authenticated_user(db, "CITIZEN")

        created = client.post("/api/v1/workflows", headers=claimant_headers, json={"parcelId": str(unclaimed.id), "workflowType": "LAND_CLAIM_REQUEST"}).json()
        approve_res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Papers verified"})
        assert approve_res.status_code == 200
        assert approve_res.json()["currentStatus"] == "APPROVED"

        mine_res = client.get("/api/v1/parcels/mine", headers=claimant_headers)
        assert any(p["id"] == str(unclaimed.id) for p in mine_res.json()["parcels"])

    def test_rechecks_for_a_conflict_at_review_time_with_409(self, db, client):
        s = _seed(db)
        unclaimed = Parcel(canonical_parcel_id="WF-CLAIM-3", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=420, geometry=_square(77.62, 12.95))
        db.add(unclaimed)
        db.flush()
        claimant, _, claimant_headers = create_authenticated_user(db, "CITIZEN")
        someone_else, _, _ = create_authenticated_user(db, "CITIZEN")

        created = client.post("/api/v1/workflows", headers=claimant_headers, json={"parcelId": str(unclaimed.id), "workflowType": "LAND_CLAIM_REQUEST"}).json()

        db.add(CitizenParcel(citizen_id=someone_else.id, parcel_id=unclaimed.id))
        db.flush()

        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        assert res.status_code == 409


class TestDocumentVerificationRequest:
    def test_requires_association_and_routes_to_land_records(self, db, client):
        s = _seed(db)
        assert client.post("/api/v1/workflows", headers=s["unassociated_citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "DOCUMENT_VERIFICATION_REQUEST"}).status_code == 403

        res = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "DOCUMENT_VERIFICATION_REQUEST"})
        assert res.status_code == 201
        assert len(res.json()["steps"]) == 1
        assert res.json()["steps"][0]["department"] == "LAND_RECORDS"

    def test_approving_creates_a_bare_registered_document_when_none_on_file(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "DOCUMENT_VERIFICATION_REQUEST"}).json()
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})

        document = db.query(ParcelDocument).filter(ParcelDocument.parcel_id == str(s["parcel"].id)).first()
        assert document is not None
        assert document.registration_status == "REGISTERED"

    def test_flips_an_existing_unregistered_document_to_registered(self, db, client):
        s = _seed(db)
        db.add(ParcelDocument(parcel_id=str(s["other_parcel"].id), document_type="ROR_COPY", file_name="x.png", file_path="", mime_type="image/png", registration_status="UNREGISTERED"))
        db.flush()

        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["other_parcel"].id), "workflowType": "DOCUMENT_VERIFICATION_REQUEST"}).json()
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})

        document = db.query(ParcelDocument).filter(ParcelDocument.parcel_id == str(s["other_parcel"].id)).first()
        assert document.registration_status == "REGISTERED"


class TestEvidenceUpload:
    def test_stores_uploaded_document_and_runs_precheck(self, db, client):
        s = _seed(db)
        claimant, _, claimant_headers = create_authenticated_user(db, "CITIZEN")
        unclaimed = Parcel(canonical_parcel_id="WF-EVIDENCE-1", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=500, geometry=_square(77.63, 12.95))
        db.add(unclaimed)
        db.flush()
        image = render_parcel_document_image(ParcelDocumentFields(owner_name=claimant.name, survey_number="N/A", area_sq_m=500, state_code="KA", district_code="BAN", registration_status="UNREGISTERED"))

        res = client.post(
            "/api/v1/workflows", headers=claimant_headers,
            data={"parcelId": str(unclaimed.id), "workflowType": "LAND_CLAIM_REQUEST"},
            files={"document": ("document.png", image, "image/png")},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["evidenceFileName"]
        assert body["evidenceFilePath"]
        assert body["evidenceMimeType"] == "image/png"
        import json
        precheck = json.loads(body["verificationPrecheck"])
        assert precheck["verdict"] == "MATCHED"
        assert next(c for c in precheck["checks"] if c["field"] == "OWNER_NAME")["status"] == "MATCHED"

    def test_approving_promotes_evidence_into_the_parcel_document_overwriting_existing(self, db, client):
        s = _seed(db)
        claimant, _, claimant_headers = create_authenticated_user(db, "CITIZEN")
        unclaimed = Parcel(canonical_parcel_id="WF-EVIDENCE-2", state_code="KA", district_code="BAN", local_body_code="KALB001", area_sq_m=500, geometry=_square(77.64, 12.95))
        db.add(unclaimed)
        db.flush()
        db.add(ParcelDocument(parcel_id=str(unclaimed.id), document_type="ROR_COPY", file_name="stale.png", file_path="", mime_type="image/png", extracted_text="stale unrelated text", registration_status="UNREGISTERED"))
        db.flush()
        image = render_parcel_document_image(ParcelDocumentFields(owner_name=claimant.name, survey_number="N/A", area_sq_m=500, state_code="KA", district_code="BAN", registration_status="UNREGISTERED"))

        created = client.post(
            "/api/v1/workflows", headers=claimant_headers,
            data={"parcelId": str(unclaimed.id), "workflowType": "LAND_CLAIM_REQUEST"},
            files={"document": ("document.png", image, "image/png")},
        ).json()

        client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})

        document = db.query(ParcelDocument).filter(ParcelDocument.parcel_id == str(unclaimed.id)).first()
        assert document.registration_status == "REGISTERED"
        assert document.file_name != "stale.png"
        assert claimant.name in document.extracted_text

    def test_a_plain_json_request_still_works(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"})
        assert res.json()["evidenceFileName"] is None
        assert res.json()["evidenceFilePath"] is None


class TestEscalateStep:
    def test_admin_can_notify_the_officer_without_deciding_the_step(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        land_records_step = next(st for st in created["steps"] if st["department"] == "LAND_RECORDS")

        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}/escalate", headers=s["admin_headers"], json={"message": "This one looks stale, please check it today."})
        assert res.status_code == 201
        untouched = next(st for st in res.json()["steps"] if st["id"] == land_records_step["id"])
        assert untouched["status"] == "PENDING" and untouched["action"] is None

        notification = db.query(Notification).filter(Notification.user_id == s["land_records_officer_id"], Notification.type == "ADMIN_ESCALATION", Notification.workflow_id == created["id"]).first()
        assert notification is not None
        assert notification.parcel_id == str(s["parcel"].id)
        assert notification.message == "This one looks stale, please check it today."

    def test_rejects_escalating_an_already_decided_step_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{step['id']}/escalate", headers=s["admin_headers"], json={"message": "Too late"})
        assert res.status_code == 400

    def test_rejects_a_missing_message_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}/escalate", headers=s["admin_headers"], json={})
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_workflow(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000/escalate", headers=s["admin_headers"], json={"message": "Please check"})
        assert res.status_code == 404

    def test_rejects_escalation_from_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}/escalate", headers=s["land_records_headers"], json={"message": "Please check"})
        assert res.status_code == 403


class TestReopenStep:
    def test_admin_can_reopen_a_decided_step_and_notify_the_officer(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        land_records_step = next(st for st in created["steps"] if st["department"] == "LAND_RECORDS")
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Looks fine"})

        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}/reopen", headers=s["admin_headers"], json={"message": "Please re-check the owner name, it looks off."})
        assert res.status_code == 201
        reopened = next(st for st in res.json()["steps"] if st["id"] == land_records_step["id"])
        assert reopened["status"] == "PENDING" and reopened["action"] is None and reopened["remarks"] is None and reopened["completedAt"] is None
        assert res.json()["currentStatus"] == "IN_PROGRESS"

        notification = db.query(Notification).filter(Notification.user_id == s["land_records_officer_id"], Notification.type == "ADMIN_REOPENED_STEP", Notification.workflow_id == created["id"]).first()
        assert notification is not None
        assert notification.parcel_id == str(s["parcel"].id)
        assert notification.message == "Please re-check the owner name, it looks off."

    def test_lets_the_officer_decide_the_reopened_step_again(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        land_records_step = next(st for st in created["steps"] if st["department"] == "LAND_RECORDS")
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "REJECT", "remarks": "Missing document"})
        client.post(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}/reopen", headers=s["admin_headers"], json={"message": "Please look again"})

        res = client.patch(f"/api/v1/workflows/{created['id']}/steps/{land_records_step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Confirmed, document is present"})
        assert next(st for st in res.json()["steps"] if st["id"] == land_records_step["id"])["status"] == "APPROVED"

    def test_rejects_reopening_a_still_pending_step_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}/reopen", headers=s["admin_headers"], json={"message": "Nothing to reopen yet"})
        assert res.status_code == 400

    def test_rejects_a_missing_message_with_400(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{step['id']}/reopen", headers=s["admin_headers"], json={})
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_workflow(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000/reopen", headers=s["admin_headers"], json={"message": "Please check"})
        assert res.status_code == 404

    def test_rejects_reopening_from_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        step = created["steps"][0]
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{step['id']}", headers=s["land_records_headers"], json={"action": "APPROVE", "remarks": "Approved"})
        res = client.post(f"/api/v1/workflows/{created['id']}/steps/{step['id']}/reopen", headers=s["land_records_headers"], json={"message": "Please check"})
        assert res.status_code == 403


class TestDisputeFilingExemptionAndConflictFlow:
    def test_is_exempt_from_the_association_check(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/workflows", headers=s["unassociated_citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "DISPUTE_FILING", "requestDetails": "I believe this parcel is actually mine."})
        assert res.status_code == 201
        assert len(res.json()["steps"]) == 1
        assert res.json()["steps"][0]["department"] == "DISPUTE"

    def test_lets_a_citizen_file_a_dispute_for_a_parcel_their_claim_just_conflicted_on(self, db, client):
        s = _seed(db)
        disputer, _, disputer_headers = create_authenticated_user(db, "CITIZEN")
        image = render_parcel_document_image(ParcelDocumentFields(owner_name=disputer.name, survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))

        conflict_res = client.post(
            "/api/v1/workflows", headers=disputer_headers,
            data={"parcelId": str(s["parcel"].id), "workflowType": "LAND_CLAIM_REQUEST"},
            files={"document": ("document.png", image, "image/png")},
        )
        assert conflict_res.status_code == 409

        dispute_res = client.post(
            "/api/v1/workflows", headers=disputer_headers,
            data={"parcelId": str(s["parcel"].id), "workflowType": "DISPUTE_FILING", "requestDetails": "This parcel is linked to another account, but I believe it is mine."},
            files={"document": ("document.png", image, "image/png")},
        )
        assert dispute_res.status_code == 201
        assert dispute_res.json()["evidenceFileName"]

    def test_never_promotes_dispute_evidence_into_the_parcel_document(self, db, client):
        s = _seed(db)
        disputer, _, disputer_headers = create_authenticated_user(db, "CITIZEN")
        fresh_parcel = Parcel(canonical_parcel_id="WF-DISPUTE-NOPROMOTE", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.86, 18.52))
        db.add(fresh_parcel)
        db.flush()
        image = render_parcel_document_image(ParcelDocumentFields(owner_name=disputer.name, survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))

        created = client.post(
            "/api/v1/workflows", headers=disputer_headers,
            data={"parcelId": str(fresh_parcel.id), "workflowType": "DISPUTE_FILING"},
            files={"document": ("document.png", image, "image/png")},
        ).json()
        assert created["verificationPrecheck"] is None

        _, _, dispute_officer_headers = create_authenticated_user(db, "DISPUTE_OFFICER")
        client.patch(f"/api/v1/workflows/{created['id']}/steps/{created['steps'][0]['id']}", headers=dispute_officer_headers, json={"action": "APPROVE", "remarks": "Approved"})

        assert db.query(ParcelDocument).filter(ParcelDocument.parcel_id == str(fresh_parcel.id)).first() is None


class TestGetEvidence:
    def test_serves_a_workflows_submitted_evidence_file_to_staff(self, db, client):
        s = _seed(db)
        image = render_parcel_document_image(ParcelDocumentFields(owner_name="Evidence Test", survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))
        created = client.post(
            "/api/v1/workflows", headers=s["citizen_headers"],
            data={"parcelId": str(s["parcel"].id), "workflowType": "CORRECTION_REQUEST"},
            files={"document": ("document.png", image, "image/png")},
        ).json()

        res = client.get(f"/api/v1/workflows/{created['id']}/evidence", headers=s["admin_headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"

    def test_returns_404_when_the_workflow_carries_no_evidence(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        assert client.get(f"/api/v1/workflows/{created['id']}/evidence", headers=s["admin_headers"]).status_code == 404

    def test_rejects_a_citizen_account_with_403(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence", headers=s["citizen_headers"]).status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence").status_code == 401


class TestVerifierAssignmentAndFieldEvidence:
    def test_admin_assigns_a_verifier_and_it_is_reflected_on_the_workflow(self, db, client):
        s = _seed(db)
        verifier, _, _ = create_authenticated_user(db, "VERIFIER")
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()

        res = client.patch(f"/api/v1/workflows/{created['id']}/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(verifier.id)})
        assert res.status_code == 200
        assert res.json()["assignedVerifierId"] == str(verifier.id)

    def test_rejects_assignment_from_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        verifier, _, _ = create_authenticated_user(db, "VERIFIER")
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        res = client.patch(f"/api/v1/workflows/{created['id']}/assign-verifier", headers=s["land_records_headers"], json={"verifierId": str(verifier.id)})
        assert res.status_code == 403

    def test_assign_verifier_returns_404_for_an_unknown_workflow(self, db, client):
        s = _seed(db)
        verifier, _, _ = create_authenticated_user(db, "VERIFIER")
        res = client.patch("/api/v1/workflows/00000000-0000-0000-0000-000000000000/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(verifier.id)})
        assert res.status_code == 404

    def test_verifier_sees_only_workflows_assigned_to_them(self, db, client):
        s = _seed(db)
        verifier, _, verifier_headers = create_authenticated_user(db, "VERIFIER")
        other_verifier, _, other_verifier_headers = create_authenticated_user(db, "VERIFIER")
        mine = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        not_mine = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["other_parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        client.patch(f"/api/v1/workflows/{mine['id']}/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(verifier.id)})
        client.patch(f"/api/v1/workflows/{not_mine['id']}/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(other_verifier.id)})

        res = client.get("/api/v1/workflows/assigned-to-me", headers=verifier_headers)
        assert res.status_code == 200
        assert [w["id"] for w in res.json()] == [mine["id"]]

        res_other = client.get("/api/v1/workflows/assigned-to-me", headers=other_verifier_headers)
        assert [w["id"] for w in res_other.json()] == [not_mine["id"]]

    def test_assigned_verifier_can_submit_field_evidence(self, db, client):
        s = _seed(db)
        verifier, _, verifier_headers = create_authenticated_user(db, "VERIFIER")
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        client.patch(f"/api/v1/workflows/{created['id']}/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(verifier.id)})

        image = render_parcel_document_image(ParcelDocumentFields(owner_name="Field Visit", survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))
        res = client.post(
            f"/api/v1/workflows/{created['id']}/field-evidence", headers=verifier_headers,
            data={"latitude": "18.5204", "longitude": "73.8567", "capturedAt": "2026-09-15T10:30:00Z", "notes": "Boundary matches records"},
            files={"photo": ("visit.png", image, "image/png")},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["latitude"] == 18.5204
        assert body["longitude"] == 73.8567
        assert body["notes"] == "Boundary matches records"

        listed = client.get(f"/api/v1/workflows/{created['id']}/field-evidence", headers=s["admin_headers"])
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        photo = client.get(f"/api/v1/workflows/{created['id']}/field-evidence/{body['id']}/photo", headers=s["admin_headers"])
        assert photo.status_code == 200
        assert photo.headers["content-type"] == "image/png"

    def test_rejects_field_evidence_for_a_workflow_not_assigned_to_this_verifier(self, db, client):
        s = _seed(db)
        _, _, verifier_headers = create_authenticated_user(db, "VERIFIER")
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        # Never assigned to this verifier.
        image = render_parcel_document_image(ParcelDocumentFields(owner_name="Field Visit", survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))
        res = client.post(
            f"/api/v1/workflows/{created['id']}/field-evidence", headers=verifier_headers,
            data={"latitude": "18.5", "longitude": "73.8", "capturedAt": "2026-09-15T10:30:00Z"},
            files={"photo": ("visit.png", image, "image/png")},
        )
        assert res.status_code == 403

    def test_rejects_a_non_image_photo_with_400(self, db, client):
        s = _seed(db)
        verifier, _, verifier_headers = create_authenticated_user(db, "VERIFIER")
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        client.patch(f"/api/v1/workflows/{created['id']}/assign-verifier", headers=s["admin_headers"], json={"verifierId": str(verifier.id)})

        res = client.post(
            f"/api/v1/workflows/{created['id']}/field-evidence", headers=verifier_headers,
            data={"latitude": "18.5", "longitude": "73.8", "capturedAt": "2026-09-15T10:30:00Z"},
            files={"photo": ("visit.txt", b"not an image", "text/plain")},
        )
        assert res.status_code == 400

    def test_rejects_an_officer_submitting_field_evidence_with_403(self, db, client):
        s = _seed(db)
        created = client.post("/api/v1/workflows", headers=s["citizen_headers"], json={"parcelId": str(s["parcel"].id), "workflowType": "ROR_COPY_REQUEST"}).json()
        image = render_parcel_document_image(ParcelDocumentFields(owner_name="Field Visit", survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED"))
        res = client.post(
            f"/api/v1/workflows/{created['id']}/field-evidence", headers=s["land_records_headers"],
            data={"latitude": "18.5", "longitude": "73.8", "capturedAt": "2026-09-15T10:30:00Z"},
            files={"photo": ("visit.png", image, "image/png")},
        )
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_assigned_to_me_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/workflows/assigned-to-me").status_code == 401
