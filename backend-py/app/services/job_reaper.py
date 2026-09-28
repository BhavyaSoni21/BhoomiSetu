"""Stuck-job reaper (DEP-01).

A Celery worker can die mid-task (OOM, redeploy, lost broker) leaving a job
pinned in 'running' forever, or a job can sit 'queued' with no worker to pick
it up. Neither ever reaches a terminal state on its own, so a poller/UI waits
indefinitely. This sweeps such jobs to 'failed' so callers see a real outcome.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.processing_job import ProcessingJob

# ponytail: fixed thresholds; make per-job-type if a slow pipeline trips them.
RUNNING_MAX_MINUTES = 30
QUEUED_MAX_MINUTES = 60


def reap_stuck_jobs(db: Session, now: datetime | None = None) -> int:
    """Mark timed-out running/queued jobs as failed. Returns count reaped."""
    now = now or datetime.now(timezone.utc)
    running_cutoff = now - timedelta(minutes=RUNNING_MAX_MINUTES)
    queued_cutoff = now - timedelta(minutes=QUEUED_MAX_MINUTES)

    stuck = (
        db.query(ProcessingJob)
        .filter(
            (
                (ProcessingJob.status == "running")
                & (ProcessingJob.started_at.isnot(None))
                & (ProcessingJob.started_at < running_cutoff)
            )
            | (
                (ProcessingJob.status == "queued")
                & (ProcessingJob.created_at < queued_cutoff)
            )
        )
        .all()
    )
    for job in stuck:
        job.error = (
            f"reaped: exceeded max {'runtime' if job.status == 'running' else 'queue wait'} "
            f"({RUNNING_MAX_MINUTES if job.status == 'running' else QUEUED_MAX_MINUTES}m)"
        )
        job.status = "failed"
        job.completed_at = now
    db.flush()
    return len(stuck)
