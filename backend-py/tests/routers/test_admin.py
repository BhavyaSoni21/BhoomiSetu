"""Ported from backend/test/admin-departments.e2e-spec.ts.

Fully self-contained - a complete, unscoped port of the original spec.
"""

from app.models.admin import Department
from app.models.audit import AuditLog
from tests.helpers.auth import create_authenticated_user


def _seed(db):
    db.query(Department).delete()
    db.flush()
    _, _, admin_headers = create_authenticated_user(db, "ADMIN")
    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    return {"admin_headers": admin_headers, "officer_headers": officer_headers}


class TestFindAll:
    def test_lists_departments_ordered_by_name(self, db, client):
        s = _seed(db)
        db.add_all([Department(code="ZZZ_LAST", name="Zzz Department"), Department(code="AAA_FIRST", name="Aaa Department")])
        db.flush()

        res = client.get("/api/v1/admin/departments", headers=s["admin_headers"])
        assert res.status_code == 200
        names = [d["name"] for d in res.json()]
        assert names.index("Aaa Department") < names.index("Zzz Department")

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/admin/departments", headers=s["officer_headers"])
        assert res.status_code == 403

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/admin/departments")
        assert res.status_code == 401


class TestCreate:
    def test_creates_a_department_and_logs_department_created(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/admin/departments", headers=s["admin_headers"],
            json={"code": "TAX", "name": "Tax Department", "description": "Property tax assessment and collection", "contactEmail": "tax@bhoomisetu.gov.in"},
        )
        assert res.status_code == 201
        assert res.json()["code"] == "TAX"
        assert res.json()["name"] == "Tax Department"

        audit_entry = db.query(AuditLog).filter(AuditLog.action == "DEPARTMENT_CREATED", AuditLog.entity_id == res.json()["id"]).first()
        assert audit_entry is not None

    def test_rejects_a_duplicate_code_with_409(self, db, client):
        s = _seed(db)
        db.add(Department(code="TAX", name="Existing Tax"))
        db.flush()
        res = client.post("/api/v1/admin/departments", headers=s["admin_headers"], json={"code": "TAX", "name": "Duplicate Tax"})
        assert res.status_code == 409

    def test_rejects_a_missing_name_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/admin/departments", headers=s["admin_headers"], json={"code": "NO_NAME"})
        assert res.status_code == 400

    def test_rejects_an_invalid_contact_email_with_400(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/admin/departments", headers=s["admin_headers"], json={"code": "BAD_EMAIL", "name": "Bad Email Dept", "contactEmail": "not-an-email"})
        assert res.status_code == 400

    def test_rejects_a_non_admin_officer_with_403(self, db, client):
        s = _seed(db)
        res = client.post("/api/v1/admin/departments", headers=s["officer_headers"], json={"code": "BLOCKED", "name": "Blocked Dept"})
        assert res.status_code == 403


class TestUpdate:
    def test_updates_a_department_and_logs_department_updated(self, db, client):
        s = _seed(db)
        target = Department(code="PLANNING_T", name="Planning Old Name")
        db.add(target)
        db.flush()

        res = client.patch(
            f"/api/v1/admin/departments/{target.id}", headers=s["admin_headers"],
            json={"name": "Planning Department", "description": "Zoning and master plan oversight"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "Planning Department"
        assert res.json()["description"] == "Zoning and master plan oversight"
        assert res.json()["code"] == "PLANNING_T"

        audit_entry = db.query(AuditLog).filter(AuditLog.action == "DEPARTMENT_UPDATED", AuditLog.entity_id == str(target.id)).first()
        assert audit_entry is not None

    def test_returns_404_for_an_unknown_department(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/admin/departments/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"], json={"name": "Unknown Target"})
        assert res.status_code == 404


class TestDelete:
    def test_deletes_a_department_and_logs_department_deleted(self, db, client):
        s = _seed(db)
        target = Department(code="TO_DELETE", name="To Delete")
        db.add(target)
        db.flush()
        target_id = target.id

        res = client.delete(f"/api/v1/admin/departments/{target_id}", headers=s["admin_headers"])
        assert res.status_code == 204

        assert db.get(Department, target_id) is None
        audit_entry = db.query(AuditLog).filter(AuditLog.action == "DEPARTMENT_DELETED", AuditLog.entity_id == str(target_id)).first()
        assert audit_entry is not None

    def test_returns_404_for_an_unknown_department(self, db, client):
        s = _seed(db)
        res = client.delete("/api/v1/admin/departments/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"])
        assert res.status_code == 404
