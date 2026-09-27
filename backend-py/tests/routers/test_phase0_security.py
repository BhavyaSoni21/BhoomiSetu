"""Phase 0 security fixes:
- mock external-department APIs are refused on a production host unless
  EXPOSE_MOCK_DEPT_APIS is set (dev is unaffected);
- _can_manage_case is jurisdiction-scoped: a department officer manages a
  case only when it has a task in their own department.
"""

import uuid

from app.config import get_settings
from app.models.admin import Department
from app.models.case import Case, DepartmentTask
from app.services import case_service
from tests.helpers.auth import create_authenticated_user


def _dept(db, code):
    existing = db.query(Department).filter(Department.code == code).first()
    if existing:
        return existing
    d = Department(code=code, name=code.title())
    db.add(d)
    db.flush()
    return d


def test_mock_dept_apis_refused_in_production(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "expose_mock_dept_apis", False)
    # A whole-router-gated mock endpoint (land_records) and an interspersed
    # per-parcel lookup both 404 in production.
    assert client.get("/api/v1/state-a/land-records").status_code == 404
    assert client.get(f"/api/v1/registration/{uuid.uuid4()}").status_code == 404

    # Flag opts them back in on the same production host.
    monkeypatch.setattr(settings, "expose_mock_dept_apis", True)
    assert client.get("/api/v1/state-a/land-records").status_code == 200


def test_mock_dept_apis_open_in_dev(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "")  # not production
    assert client.get("/api/v1/state-a/land-records").status_code == 200


def test_can_manage_case_is_jurisdiction_scoped(db):
    case = Case(case_no=f"C-{uuid.uuid4().hex[:8]}", citizen_id="c1", parcel_id="p1")
    land_dept = _dept(db, "LAND_RECORDS")
    db.add(case)
    db.flush()
    db.add(DepartmentTask(case_id=case.id, department_id=land_dept.id, status="PENDING"))
    db.flush()

    land_officer, _, _ = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    reg_officer, _, _ = create_authenticated_user(db, "REGISTRATION_OFFICER")
    admin, _, _ = create_authenticated_user(db, "ADMIN")

    # Officer whose department has a task in the case may manage it.
    assert case_service._can_manage_case(land_officer, case, db) is True
    # Officer of an unrelated department may NOT (the old code returned True).
    assert case_service._can_manage_case(reg_officer, case, db) is False
    # ADMIN always may.
    assert case_service._can_manage_case(admin, case, db) is True
