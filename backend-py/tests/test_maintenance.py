"""DEP-01 reaper + SEC-03 invariant regression checks."""

from datetime import datetime, timedelta, timezone

from app.models.processing_job import ProcessingJob
from app.services.job_reaper import reap_stuck_jobs, RUNNING_MAX_MINUTES, QUEUED_MAX_MINUTES


def _make(db, **kw):
    job = ProcessingJob(job_type="etl", payload={}, **kw)
    db.add(job)
    db.flush()
    return job


def test_reaper_fails_only_timed_out_jobs(db):
    now = datetime.now(timezone.utc)
    stale_running = _make(db, status="running", started_at=now - timedelta(minutes=RUNNING_MAX_MINUTES + 5))
    fresh_running = _make(db, status="running", started_at=now - timedelta(minutes=1))
    stale_queued = _make(db, status="queued")
    # created_at is server-default now(); force it stale
    stale_queued.created_at = now - timedelta(minutes=QUEUED_MAX_MINUTES + 5)
    succeeded = _make(db, status="succeeded")
    db.flush()

    reaped = reap_stuck_jobs(db, now=now)

    assert reaped == 2
    db.refresh(stale_running)
    db.refresh(fresh_running)
    db.refresh(stale_queued)
    db.refresh(succeeded)
    assert stale_running.status == "failed" and "runtime" in stale_running.error
    assert stale_queued.status == "failed" and "queue wait" in stale_queued.error
    assert fresh_running.status == "running"
    assert succeeded.status == "succeeded"
