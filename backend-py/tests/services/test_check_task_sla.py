"""check_task_sla falls back to the task's own SLA columns when no SLAConfig
row exists (BACKLOG: officer SLA tab showed "No SLA" for every task because
zero SLAConfig rows are seeded, though tasks carry their own thresholds)."""

import uuid
from datetime import timedelta

from app.models.admin import Department
from app.models.case import Case, DepartmentTask
from app.services import case_service as s
from app.services.case_service import _now


def _task(db, **cols):
    dept = Department(code=f"D-{uuid.uuid4().hex[:8]}", name="Land Records")
    case = Case(case_no=f"C-{uuid.uuid4().hex[:8]}", citizen_id="c1", parcel_id="p1")
    db.add_all([dept, case])
    db.flush()
    t = DepartmentTask(case_id=case.id, department_id=dept.id, status="ASSIGNED", **cols)
    db.add(t)
    db.flush()
    return t


def test_fallback_to_task_thresholds_breach(db):
    t = _task(db, sla_warning_threshold=48, sla_breach_threshold=96)
    t.created_at = _now() - timedelta(hours=100)  # past breach
    db.flush()
    sla = s.check_task_sla(db, str(t.id))
    assert sla is not None  # was None before the fallback → "No SLA"
    assert sla["status"] == "BREACH"
    assert sla["elapsed_hours"] >= 96


def test_fallback_ok_within_thresholds(db):
    t = _task(db, sla_warning_threshold=48, sla_breach_threshold=96)
    t.created_at = _now() - timedelta(hours=1)
    db.flush()
    assert s.check_task_sla(db, str(t.id))["status"] == "OK"


def test_still_none_without_any_threshold(db):
    t = _task(db)  # no SLAConfig, no task thresholds
    assert s.check_task_sla(db, str(t.id)) is None
