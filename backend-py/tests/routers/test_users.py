"""Ported from backend/test/users.e2e-spec.ts.

Fully self-contained - a complete, unscoped port of the original spec.
"""

from app.models.audit import AuditLog
from app.models.user import User
from tests.helpers.auth import create_authenticated_user


def _seed(db):
    db.query(User).delete()
    db.query(AuditLog).delete()
    db.flush()
    admin, _, admin_headers = create_authenticated_user(db, "ADMIN")
    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    return {"admin": admin, "admin_headers": admin_headers, "officer_headers": officer_headers}


class TestFindAll:
    def test_lists_users_without_ever_including_a_password_hash(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/users", headers=s["admin_headers"])
        assert res.status_code == 200
        assert len(res.json()) >= 2
        assert "passwordHash" not in res.text and "password_hash" not in res.text

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/users", headers=s["officer_headers"])
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/users")
        assert res.status_code == 401

    def test_excludes_citizen_sign_in_accounts(self, db, client):
        s = _seed(db)
        citizen = User(email="excluded-citizen@test.com", password_hash="x", name="A Citizen", role="CITIZEN")
        db.add(citizen)
        db.flush()

        res = client.get("/api/v1/users", headers=s["admin_headers"])
        assert res.status_code == 200
        assert str(citizen.id) not in [u["id"] for u in res.json()]


class TestCreate:
    def test_creates_a_new_officer_account_and_logs_user_created(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/users", headers=s["admin_headers"],
            json={"email": "new.officer@test.gov.in", "password": "SecurePass123", "name": "New Officer", "role": "PLANNING_OFFICER"},
        )
        assert res.status_code == 201
        assert res.json()["role"] == "PLANNING_OFFICER"
        assert "passwordHash" not in res.json()

        created_user = db.query(User).filter(User.email == "new.officer@test.gov.in").first()
        assert created_user is not None
        assert created_user.password_hash != "SecurePass123"

        audit_entry = db.query(AuditLog).filter(AuditLog.action == "USER_CREATED", AuditLog.entity_id == res.json()["id"]).first()
        assert audit_entry is not None

    def test_creates_officer_with_district_assignment(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/users", headers=s["admin_headers"],
            json={"email": "district.officer@test.gov.in", "password": "SecurePass123", "name": "District Officer", "role": "LAND_RECORD_OFFICER", "district": "Pune"},
        )
        assert res.status_code == 201
        assert res.json()["district"] == "Pune"

        created_user = db.query(User).filter(User.email == "district.officer@test.gov.in").first()
        assert created_user is not None
        assert created_user.district == "Pune"

    def test_rejects_district_for_citizen_role(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/users", headers=s["admin_headers"],
            json={"email": "citizen@test.gov.in", "password": "SecurePass123", "name": "Citizen", "role": "CITIZEN", "district": "Pune"},
        )
        assert res.status_code == 400

    def test_rejects_a_duplicate_email_with_409(self, db, client):
        s = _seed(db)
        client.post("/api/v1/users", headers=s["admin_headers"], json={"email": "dup@test.gov.in", "password": "SecurePass123", "name": "First", "role": "PLANNING_OFFICER"})
        res = client.post("/api/v1/users", headers=s["admin_headers"], json={"email": "dup@test.gov.in", "password": "AnotherPass123", "name": "Duplicate", "role": "PLANNING_OFFICER"})
        assert res.status_code == 409

    def test_rejects_a_password_shorter_than_8_characters_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/users", headers=s["admin_headers"], json={"email": "short.pass@test.gov.in", "password": "short", "name": "X", "role": "PLANNING_OFFICER"})
        assert res.status_code == 400

    def test_rejects_a_long_enough_password_with_no_complexity_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/users", headers=s["admin_headers"], json={"email": "weak-complexity@test.gov.in", "password": "alllowercase", "name": "X", "role": "PLANNING_OFFICER"})
        assert res.status_code == 400

    def test_rejects_an_invalid_role_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/users", headers=s["admin_headers"], json={"email": "bad.role@test.gov.in", "password": "SecurePass123", "name": "X", "role": "SUPER_ADMIN"})
        assert res.status_code == 400

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/users", headers=s["officer_headers"], json={"email": "blocked@test.gov.in", "password": "SecurePass123", "name": "X", "role": "PLANNING_OFFICER"})
        assert res.status_code == 403


class TestUpdateRole:
    def test_changes_a_users_role_and_logs_user_role_changed(self, db, client):
        s = _seed(db)
        target = User(email="role-change@test.gov.in", password_hash="x", name="Role Target", role="PLANNING_OFFICER")
        db.add(target)
        db.flush()

        res = client.patch(f"/api/v1/users/{target.id}/role", headers=s["admin_headers"], json={"role": "DISPUTE_OFFICER"})
        assert res.status_code == 200
        assert res.json()["role"] == "DISPUTE_OFFICER"

        audit_entry = db.query(AuditLog).filter(AuditLog.action == "USER_ROLE_CHANGED", AuditLog.entity_id == str(target.id)).first()
        assert audit_entry is not None

    def test_rejects_an_admin_changing_their_own_role_with_400(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/users/{s['admin'].id}/role", headers=s["admin_headers"], json={"role": "PLANNING_OFFICER"})
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_user(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/users/00000000-0000-0000-0000-000000000000/role", headers=s["admin_headers"], json={"role": "PLANNING_OFFICER"})
        assert res.status_code == 404


class TestDelete:
    def test_deletes_a_user_account_and_logs_user_deleted(self, db, client):
        s = _seed(db)
        target = User(email="to-delete@test.gov.in", password_hash="x", name="Delete Target", role="PLANNING_OFFICER")
        db.add(target)
        db.flush()
        target_id = target.id

        res = client.delete(f"/api/v1/users/{target_id}", headers=s["admin_headers"])
        assert res.status_code == 204

        assert db.get(User, target_id) is None
        audit_entry = db.query(AuditLog).filter(AuditLog.action == "USER_DELETED", AuditLog.entity_id == str(target_id)).first()
        assert audit_entry is not None

    def test_rejects_an_admin_deleting_their_own_account_with_400(self, db, client):
        s = _seed(db)
        res = client.delete(f"/api/v1/users/{s['admin'].id}", headers=s["admin_headers"])
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_user(self, db, client):
        s = _seed(db)
        res = client.delete("/api/v1/users/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"])
        assert res.status_code == 404


class TestRevokeSessions:
    def test_revokes_user_sessions_and_logs_action(self, db, client):
        s = _seed(db)
        target = User(email="revoke-target@test.gov.in", password_hash="x", name="Revoke Target", role="PLANNING_OFFICER", token_version=5)
        db.add(target)
        db.flush()
        target_id = target.id

        res = client.post(f"/api/v1/users/{target_id}/revoke-sessions", headers=s["admin_headers"])
        assert res.status_code == 204

        refreshed = db.get(User, target_id)
        assert refreshed.token_version == 6

        audit_entry = db.query(AuditLog).filter(AuditLog.action == "USER_SESSIONS_REVOKED", AuditLog.entity_id == str(target_id)).first()
        assert audit_entry is not None

    def test_rejects_revoking_own_sessions_with_400(self, db, client):
        s = _seed(db)
        res = client.post(f"/api/v1/users/{s['admin'].id}/revoke-sessions", headers=s["admin_headers"])
        assert res.status_code == 400

    def test_returns_404_for_unknown_user(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/users/00000000-0000-0000-0000-000000000000/revoke-sessions", headers=s["admin_headers"])
        assert res.status_code == 404
