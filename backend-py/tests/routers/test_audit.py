"""Ported from backend/test/audit.e2e-spec.ts, scoped down.

The original spec triggers most of its audit entries by calling live
`/auth/login`, `/workflows`, and `/governance-alerts/:id/status`
endpoints - none of which exist in backend-py yet (AuthModule and
WorkflowsModule are both deferred to last; GovernanceModule hasn't been
built). Rather than skip audit coverage entirely, the RBAC/filter/
pagination/404 behavior that's actually AuditModule's own responsibility
(the "GET /api/v1/audit" and "GET /api/v1/parcels/:id/audit" describe
blocks below) is ported as-is, with fixture rows seeded directly via
app.services.audit_service.log() instead of produced as a side effect of
those unbuilt endpoints. The metadata-shape/action-name assertions tied
to login/workflow/governance-alert triggers themselves are left for
those modules' own future test suites to cover once they exist.
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.models.parcel import Parcel
from app.services import audit_service
from tests.helpers.auth import create_authenticated_user


def _square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


def _clear_audit_logs(db):
    from app.models.audit import AuditLog

    db.query(AuditLog).delete()


class TestAuditService:
    def test_log_persists_and_parses_metadata_json_round_trip(self, db):
        _clear_audit_logs(db)
        audit_service.log(
            db, user_id="u1", user_role="ADMIN", action="AUTH_LOGIN", entity_type="USER", entity_id="u1",
            metadata={"ip": "127.0.0.1"},
        )
        rows = audit_service.find_all(db)
        assert len(rows) == 1
        assert rows[0].action == "AUTH_LOGIN"
        assert rows[0].metadata_json == '{"ip": "127.0.0.1"}'

    def test_log_with_no_metadata_stores_null(self, db):
        _clear_audit_logs(db)
        audit_service.log(db, user_id="u1", user_role="ADMIN", action="AUTH_LOGIN", entity_type="USER")
        rows = audit_service.find_all(db)
        assert rows[0].metadata_json is None


class TestGetAudit:
    def _seed(self, db, n=3):
        _clear_audit_logs(db)
        for i in range(n):
            audit_service.log(
                db, user_id=f"user-{i}", user_role="ADMIN", action="AUTH_LOGIN", entity_type="USER", entity_id=f"user-{i}",
            )
        audit_service.log(db, user_id="landrec-1", user_role="LAND_RECORD_OFFICER", action="GOVERNANCE_ALERT_STATUS_CHANGED", entity_type="GOVERNANCE_ALERT", entity_id="alert-1")
        db.flush()

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        self._seed(db)
        _, _, land_records_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get("/api/v1/audit", headers=land_records_headers)
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        self._seed(db)
        res = client.get("/api/v1/audit")
        assert res.status_code == 401

    def test_filters_by_entity_type(self, db, client):
        self._seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get("/api/v1/audit", params={"entityType": "GOVERNANCE_ALERT"}, headers=admin_headers)
        assert res.status_code == 200
        body = res.json()
        assert len(body) > 0
        assert all(entry["entityType"] == "GOVERNANCE_ALERT" for entry in body)

    def test_honors_an_explicit_limit_capped_to_the_most_recent_entries(self, db, client):
        self._seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        unlimited = client.get("/api/v1/audit", headers=admin_headers)
        assert unlimited.status_code == 200
        assert len(unlimited.json()) > 2

        limited = client.get("/api/v1/audit", params={"limit": 2}, headers=admin_headers)
        assert limited.status_code == 200
        assert len(limited.json()) == 2
        assert limited.json() == unlimited.json()[:2]

    def test_ignores_an_out_of_range_limit_and_falls_back_to_the_default_cap(self, db, client):
        self._seed(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get("/api/v1/audit", params={"limit": 99999}, headers=admin_headers)
        assert res.status_code == 200


class TestGetParcelAudit:
    def _seed_parcel(self, db):
        db.query(Parcel).delete()
        parcel = Parcel(canonical_parcel_id="AUDIT-1", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=500, geometry=_square(73.85, 18.52))
        db.add(parcel)
        db.flush()
        audit_service.log(db, user_id="landrec-1", user_role="LAND_RECORD_OFFICER", action="WORKFLOW_STEP_APPROVED", entity_type="WORKFLOW_STEP", entity_id="step-1", parcel_id=str(parcel.id))
        db.flush()
        return parcel

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        parcel = self._seed_parcel(db)
        res = client.get(f"/api/v1/parcels/{parcel.id}/audit")
        assert res.status_code == 401

    def test_allows_any_staff_role_not_just_admin(self, db, client):
        parcel = self._seed_parcel(db)
        _, _, land_records_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get(f"/api/v1/parcels/{parcel.id}/audit", headers=land_records_headers)
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["parcelId"] == str(parcel.id)
        assert body[0]["action"] == "WORKFLOW_STEP_APPROVED"

    def test_returns_404_for_an_unknown_parcel(self, db, client):
        self._seed_parcel(db)
        _, _, admin_headers = create_authenticated_user(db, "ADMIN")
        res = client.get("/api/v1/parcels/00000000-0000-0000-0000-000000000000/audit", headers=admin_headers)
        assert res.status_code == 404
