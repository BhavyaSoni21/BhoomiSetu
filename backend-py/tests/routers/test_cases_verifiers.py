"""GET /cases/verifiers — officer-readable verifier picker with workload
(BACKLOG item 15). Guards two things that broke before: the route must not be
shadowed by /cases/{case_id} (would 422), and active_task_count must exclude
terminal-status tasks and non-verifier users.
"""

import uuid

from app.models.admin import Department
from app.models.case import Case, DepartmentTask
from app.models.user import User
from tests.helpers.auth import create_authenticated_user


def _task(case_id, dept_id, verifier_id, status):
    return DepartmentTask(
        case_id=case_id, department_id=dept_id,
        assigned_verifier_id=str(verifier_id), status=status,
    )


def test_officer_gets_verifiers_with_workload(db, client):
    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    v1 = User(email=f"v1-{uuid.uuid4()}@t.in", password_hash="x", name="Aisha", role="VERIFIER")
    v2 = User(email=f"v2-{uuid.uuid4()}@t.in", password_hash="x", name="Bhaskar", role="VERIFIER")
    db.add_all([v1, v2])

    dept = Department(code=f"D-{uuid.uuid4().hex[:8]}", name="Land Records")
    case = Case(case_no=f"C-{uuid.uuid4().hex[:8]}", citizen_id="c1", parcel_id="p1")
    db.add_all([dept, case])
    db.flush()

    # v1: 2 active (PENDING, IN_PROGRESS) + 2 terminal (COMPLETED, CANCELLED) → count 2
    db.add_all([
        _task(case.id, dept.id, v1.id, "PENDING"),
        _task(case.id, dept.id, v1.id, "IN_PROGRESS"),
        _task(case.id, dept.id, v1.id, "COMPLETED"),
        _task(case.id, dept.id, v1.id, "CANCELLED"),
    ])
    db.flush()

    res = client.get("/api/v1/cases/verifiers", headers=officer_headers)
    assert res.status_code == 200, res.text  # 422 here would mean the /{case_id} route shadowed us
    by_id = {r["id"]: r for r in res.json()}

    assert str(v1.id) in by_id and str(v2.id) in by_id
    assert by_id[str(v1.id)]["activeTaskCount"] == 2
    assert by_id[str(v2.id)]["activeTaskCount"] == 0
    # non-verifier accounts (the officer) must never leak into this list
    assert all(r["role"] == "VERIFIER" for r in res.json())


def test_my_tasks_include_case_no(db, client):
    """/cases/tasks/my must expose the human-readable case number (caseNo),
    not just the case UUID, so the My Tasks tab can show a real case no."""
    officer, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    dept = Department(code=f"D-{uuid.uuid4().hex[:8]}", name="Land Records")
    case = Case(case_no="C-DEMO-001", citizen_id="c1", parcel_id="p1")
    db.add_all([dept, case])
    db.flush()
    db.add(DepartmentTask(
        case_id=case.id, department_id=dept.id,
        assigned_officer_id=str(officer.id), status="ASSIGNED",
    ))
    db.flush()

    res = client.get("/api/v1/cases/tasks/my", headers=officer_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 1
    assert body[0]["caseNo"] == "C-DEMO-001"


def test_requires_staff_auth(db, client):
    _, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
    assert client.get("/api/v1/cases/verifiers").status_code == 401
    assert client.get("/api/v1/cases/verifiers", headers=citizen_headers).status_code == 403


def test_literal_routes_not_shadowed_by_case_id(db, client):
    """BACKLOG item 16: /verifier/tasks and /my sit after /{case_id}* in the file;
    they must still route to their own handlers, not 422 as a bad UUID case_id."""
    _, _, verifier_headers = create_authenticated_user(db, "VERIFIER")
    _, _, citizen_headers = create_authenticated_user(db, "CITIZEN")

    r = client.get("/api/v1/cases/verifier/tasks", headers=verifier_headers)
    assert r.status_code == 200, r.text  # 422 => shadowed by /{case_id}/tasks
    assert isinstance(r.json(), list)

    r = client.get("/api/v1/cases/my", headers=citizen_headers)
    assert r.status_code == 200, r.text  # 422 => shadowed by /{case_id}
    assert isinstance(r.json(), list)  # frontend consumes CaseOut[], not {cases,total}


def test_assigned_verifier_can_read_case_but_unassigned_cannot(db, client):
    """A verifier assigned to a task in the case may GET /cases/{id} (needed for
    the field visit); a verifier with no task in that case gets 403."""
    assigned, _, assigned_headers = create_authenticated_user(db, "VERIFIER")
    _, _, stranger_headers = create_authenticated_user(db, "VERIFIER")

    dept = Department(code=f"D-{uuid.uuid4().hex[:8]}", name="Land Records")
    case = Case(case_no=f"C-{uuid.uuid4().hex[:8]}", citizen_id="c1", parcel_id="p1")
    db.add_all([dept, case])
    db.flush()
    db.add(_task(case.id, dept.id, assigned.id, "ASSIGNED"))
    db.flush()

    assert client.get(f"/api/v1/cases/{case.id}", headers=assigned_headers).status_code == 200
    assert client.get(f"/api/v1/cases/{case.id}", headers=stranger_headers).status_code == 403

