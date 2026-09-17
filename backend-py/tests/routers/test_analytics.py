"""Ported from backend/test/analytics.e2e-spec.ts.

One test - "increments recentLogins24h after a real POST /auth/login" -
isn't ported as-is: it depends on POST /auth/login, which doesn't exist
in backend-py yet (AuthModule is deferred to the very end, alongside
WorkflowsModule which has just landed). Ported here instead as a direct
AuditLog seed with action=AUTH_LOGIN - the same counting logic
get_summary's recent_logins_24h uses, exercised without the unbuilt
endpoint. AuthModule's own future test suite covers the real login path.
"""

from datetime import datetime, timedelta, timezone

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.audit import AuditLog
from app.models.department_record import DisputeRecord, PlanningRecord, RegistrationRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.models.workflow import Workflow, WorkflowStep
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _clear(db):
    db.query(WorkflowStep).delete()
    db.query(Workflow).delete()
    db.query(GovernanceAlert).delete()
    db.query(DisputeRecord).delete()
    db.query(PlanningRecord).delete()
    db.query(RegistrationRecord).delete()
    db.query(TaxRecord).delete()
    db.query(AuditLog).delete()
    db.query(Parcel).delete()
    db.flush()


def _seed(db):
    _clear(db)
    p1 = Parcel(canonical_parcel_id="AN-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.85, 18.52))
    p2 = Parcel(canonical_parcel_id="AN-2", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.86, 18.53))
    p3 = Parcel(canonical_parcel_id="AN-3", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.87, 18.54))
    db.add_all([p1, p2, p3])
    db.flush()

    db.add_all([
        TaxRecord(parcel_id=p1.id, assessed_value=1000, annual_tax_amount=10, tax_status="PAID", outstanding_amount=0),
        TaxRecord(parcel_id=p2.id, assessed_value=1000, annual_tax_amount=10, tax_status="OVERDUE", outstanding_amount=10),
        TaxRecord(parcel_id=p3.id, assessed_value=1000, annual_tax_amount=10, tax_status="OVERDUE", outstanding_amount=10),
    ])
    db.add_all([
        RegistrationRecord(parcel_id=p1.id, registration_status="REGISTERED"),
        RegistrationRecord(parcel_id=p2.id, registration_status="NOT_REGISTERED"),
    ])
    db.add_all([
        PlanningRecord(parcel_id=p1.id, land_use="RESIDENTIAL", zoning_classification="R-1", master_plan_reference="Test Plan", building_permission_status="APPROVED"),
        PlanningRecord(parcel_id=p2.id, land_use="RESIDENTIAL", zoning_classification="R-1", master_plan_reference="Test Plan", building_permission_status="APPROVED"),
        PlanningRecord(parcel_id=p3.id, land_use="COMMERCIAL", zoning_classification="C-1", master_plan_reference="Test Plan", building_permission_status="APPROVED"),
    ])
    db.add_all([
        DisputeRecord(parcel_id=p1.id, has_active_dispute=True, case_status="UNDER_REVIEW"),
        DisputeRecord(parcel_id=p2.id, has_active_dispute=False, case_status=None),
    ])
    db.add_all([
        Workflow(parcel_id=p1.id, workflow_type="ROR_COPY_REQUEST", current_status="SUBMITTED"),
        Workflow(parcel_id=p1.id, workflow_type="ROR_COPY_REQUEST", current_status="APPROVED"),
        Workflow(parcel_id=p2.id, workflow_type="CORRECTION_REQUEST", current_status="SUBMITTED"),
    ])
    db.add_all([
        GovernanceAlert(parcel_id=str(p1.id), alert_type="TAX_OVERDUE", severity="LOW", source="TAX_MONITOR", status="OPEN", explanation="x"),
        GovernanceAlert(parcel_id=str(p2.id), alert_type="TAX_OVERDUE", severity="LOW", source="TAX_MONITOR", status="OPEN", explanation="x"),
        GovernanceAlert(parcel_id=str(p3.id), alert_type="UNAUTHORIZED_CHANGE_DETECTED", severity="HIGH", source="CHANGE_DETECTION", status="DISMISSED", explanation="x"),
    ])
    db.flush()

    _, _, admin_headers = create_authenticated_user(db, "ADMIN")
    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")

    return {"p1": p1, "p2": p2, "p3": p3, "admin_headers": admin_headers, "officer_headers": officer_headers}


class TestGetSummary:
    def test_returns_correct_totals(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        assert res.status_code == 200
        totals = res.json()["totals"]
        assert totals["parcels"] == 3
        assert totals["workflows"] == 3
        assert totals["openAlerts"] == 2
        assert totals["activeDisputes"] == 1
        assert totals["totalUsers"] >= 2
        assert totals["recentLogins24h"] == 0

    def test_returns_a_correct_tax_status_distribution(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        by_key = {d["key"]: d["count"] for d in res.json()["taxStatusDistribution"]}
        assert by_key["PAID"] == 1
        assert by_key["OVERDUE"] == 2

    def test_returns_a_correct_workflow_status_distribution(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        by_key = {d["key"]: d["count"] for d in res.json()["workflowStatusDistribution"]}
        assert by_key["SUBMITTED"] == 2
        assert by_key["APPROVED"] == 1

    def test_returns_a_correct_alert_severity_distribution(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        by_key = {d["key"]: d["count"] for d in res.json()["alertSeverityDistribution"]}
        assert by_key["LOW"] == 2
        assert by_key["HIGH"] == 1

    def test_returns_correct_land_use_and_dispute_case_status_distributions(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        land_use = {d["key"]: d["count"] for d in res.json()["landUseDistribution"]}
        assert land_use["RESIDENTIAL"] == 2
        assert land_use["COMMERCIAL"] == 1

        dispute_status = {d["key"]: d["count"] for d in res.json()["disputeCaseStatusDistribution"]}
        assert dispute_status["UNDER_REVIEW"] == 1
        # The null-case_status dispute record is excluded (grouping filters IS NOT NULL).
        assert sum(dispute_status.values()) == 1

    def test_increments_recent_logins_24h_for_a_recent_auth_login_entry(self, db, client):
        s = _seed(db)
        before = client.get("/api/v1/analytics/summary", headers=s["admin_headers"]).json()

        db.add(AuditLog(user_id="some-user", user_role="PLANNING_OFFICER", action="AUTH_LOGIN", entity_type="USER", created_at=datetime.now(timezone.utc).replace(tzinfo=None)))
        db.flush()

        after = client.get("/api/v1/analytics/summary", headers=s["admin_headers"]).json()
        assert after["totals"]["recentLogins24h"] == before["totals"]["recentLogins24h"] + 1

    def test_does_not_count_a_stale_login_older_than_24h(self, db, client):
        s = _seed(db)
        db.add(AuditLog(user_id="some-user", user_role="PLANNING_OFFICER", action="AUTH_LOGIN", entity_type="USER", created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=25)))
        db.flush()
        res = client.get("/api/v1/analytics/summary", headers=s["admin_headers"])
        assert res.json()["totals"]["recentLogins24h"] == 0

    def test_does_not_count_citizen_sign_in_accounts_toward_total_users(self, db, client):
        s = _seed(db)
        before = client.get("/api/v1/analytics/summary", headers=s["admin_headers"]).json()
        create_authenticated_user(db, "CITIZEN")
        after = client.get("/api/v1/analytics/summary", headers=s["admin_headers"]).json()
        assert after["totals"]["totalUsers"] == before["totals"]["totalUsers"]

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/analytics/summary", headers=s["officer_headers"]).status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/analytics/summary").status_code == 401


class TestGetOfficerMonitoring:
    def test_lists_every_officer_including_zero_activity_ones(self, db, client):
        s = _seed(db)
        idle_officer, _, _ = create_authenticated_user(db, "ENCUMBRANCE_OFFICER")

        res = client.get("/api/v1/analytics/officer-monitoring", headers=s["admin_headers"])
        assert res.status_code == 200
        entry = next(e for e in res.json() if e["userId"] == str(idle_officer.id))
        assert entry["name"] == idle_officer.name
        assert entry["role"] == "ENCUMBRANCE_OFFICER"
        assert entry["department"] == "ENCUMBRANCE"
        assert entry["pendingInRoleQueue"] == 0
        assert entry["approvedCount"] == 0
        assert entry["rejectedCount"] == 0
        assert entry["avgDecisionHours"] is None
        assert entry["lastActivityAt"] is None

    def test_reflects_real_pending_workflow_step_counts_grouped_by_role(self, db, client):
        s = _seed(db)
        parcel = Parcel(canonical_parcel_id="AN-PENDING", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.9, 18.6))
        db.add(parcel)
        db.flush()
        workflow = Workflow(parcel_id=parcel.id, workflow_type="ROR_COPY_REQUEST", current_status="SUBMITTED")
        db.add(workflow)
        db.flush()
        db.add_all([
            WorkflowStep(workflow_id=workflow.id, step_order=1, department="RESTRICTION", assigned_role="RESTRICTION_OFFICER", status="PENDING"),
            WorkflowStep(workflow_id=workflow.id, step_order=2, department="RESTRICTION", assigned_role="RESTRICTION_OFFICER", status="PENDING"),
        ])
        db.flush()
        restriction_officer, _, _ = create_authenticated_user(db, "RESTRICTION_OFFICER")

        res = client.get("/api/v1/analytics/officer-monitoring", headers=s["admin_headers"])
        entry = next(e for e in res.json() if e["userId"] == str(restriction_officer.id))
        assert entry["pendingInRoleQueue"] >= 2

    def test_attributes_decisions_to_the_specific_officer_via_audit_log(self, db, client):
        s = _seed(db)
        decider_officer, _, _ = create_authenticated_user(db, "PLANNING_OFFICER")
        parcel = Parcel(canonical_parcel_id="AN-DECIDED", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=_square(73.91, 18.61))
        db.add(parcel)
        db.flush()
        workflow = Workflow(parcel_id=parcel.id, workflow_type="ROR_COPY_REQUEST", current_status="APPROVED")
        db.add(workflow)
        db.flush()

        db.add_all([
            AuditLog(user_id=str(decider_officer.id), user_role="PLANNING_OFFICER", action="WORKFLOW_STEP_APPROVED", entity_type="WORKFLOW_STEP", entity_id="step-1", parcel_id=str(parcel.id), metadata_json=f'{{"workflowId": "{workflow.id}", "department": "PLANNING"}}'),
            AuditLog(user_id=str(decider_officer.id), user_role="PLANNING_OFFICER", action="WORKFLOW_STEP_REJECTED", entity_type="WORKFLOW_STEP", entity_id="step-2", parcel_id=str(parcel.id), metadata_json=f'{{"workflowId": "{workflow.id}", "department": "PLANNING"}}'),
        ])
        db.flush()

        res = client.get("/api/v1/analytics/officer-monitoring", headers=s["admin_headers"])
        entry = next(e for e in res.json() if e["userId"] == str(decider_officer.id))
        assert entry["approvedCount"] == 1
        assert entry["rejectedCount"] == 1
        assert entry["avgDecisionHours"] is not None
        assert isinstance(entry["avgDecisionHours"], (int, float))
        assert entry["lastActivityAt"]

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        assert client.get("/api/v1/analytics/officer-monitoring", headers=s["officer_headers"]).status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        assert client.get("/api/v1/analytics/officer-monitoring").status_code == 401
