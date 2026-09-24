"""Offline-sync endpoint (spec §8/§9).

Drains a field device's queued mutations. Every op is idempotent on its
client-generated ``operation_id`` (see ProcessedSyncOperation), re-validated
against RBAC + Case Invariant-1 server-side, and audited. The server stays
authoritative: a queued op never bypasses the same checks an online call runs.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import CITIZEN_ROLE
from app.database import get_db
from app.models.processed_sync_operation import ProcessedSyncOperation
from app.models.user import User
from app.schemas.case import CaseOut
from app.schemas.sync import (
    SyncBatchIn,
    SyncBatchOut,
    SyncOperationIn,
    SyncOpResultOut,
    SyncStatusOut,
)
from app.services import audit_service, case_service

router = APIRouter(prefix="/sync", tags=["sync"])


def _apply_case_create(db: Session, user: User, op: SyncOperationIn) -> SyncOpResultOut:
    """Re-run the exact online case-creation path so Invariant-1 is enforced,
    never bypassed (spec non-negotiable)."""
    p = op.payload
    result = case_service.create_case_from_application(
        db,
        citizen_id=str(user.id),
        parcel_id=p.get("parcelId") or p.get("parcel_id"),
        intent=p.get("intent"),
        priority=p.get("priority"),
        application_draft=p.get("applicationDraft") or p.get("application_draft"),
        citizen_edited_version=p.get("citizenEditedVersion") or p.get("citizen_edited_version"),
        ai_structured_understanding=p.get("aiStructuredUnderstanding") or p.get("ai_structured_understanding"),
        facts_database=p.get("factsDatabase") or p.get("facts_database"),
        citizen_statements=p.get("citizenStatements") or p.get("citizen_statements"),
        conversation=p.get("conversation"),
        routing_result=p.get("routingResult") or p.get("routing_result"),
        user=user,
    )
    if isinstance(result, str):
        if result == case_service.ACTIVE_CASE_EXISTS:
            # Invariant-1: an active case already exists (created online, or by
            # an earlier synced op). Not an error — surface as a conflict so the
            # client can drop the duplicate.
            return SyncOpResultOut(operation_id=op.operation_id, status="CONFLICT",
                                   conflict={"reason": "ACTIVE_CASE_EXISTS", "resolution": "SERVER"})
        return SyncOpResultOut(operation_id=op.operation_id, status="REJECTED", error=result)

    return SyncOpResultOut(operation_id=op.operation_id, status="APPLIED", entity_id=str(result.id))


@router.post("", response_model=SyncBatchOut)
def sync_batch(
    batch: SyncBatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    results: list[SyncOpResultOut] = []
    for op in batch.operations:
        # Idempotency: a replayed operation_id returns its stored outcome, never
        # re-applies (spec §8 — retry after a dropped response is safe).
        prior = db.query(ProcessedSyncOperation).filter_by(operation_id=op.operation_id).first()
        if prior is not None:
            results.append(SyncOpResultOut(
                operation_id=op.operation_id,
                status="DUPLICATE",
                entity_id=prior.entity_id,
                error=prior.error,
            ))
            continue

        if op.entity_type == "case" and op.action == "CREATE":
            res = _apply_case_create(db, user, op)
        else:
            # document/evidence sync lands in a later phase (spec Block C).
            res = SyncOpResultOut(operation_id=op.operation_id, status="REJECTED",
                                  error=f"unsupported offline op: {op.entity_type}/{op.action}")

        # Ledger every terminal outcome so a retry short-circuits here.
        db.add(ProcessedSyncOperation(
            operation_id=op.operation_id,
            owner_user_id=str(user.id),
            entity_type=op.entity_type,
            status=res.status,
            entity_id=res.entity_id,
            result=res.conflict,
            error=res.error,
            client_created_at=op.client_created_at.replace(tzinfo=None) if op.client_created_at else None,
        ))
        db.flush()

        if res.status == "APPLIED":
            audit_service.log(
                db,
                user_id=str(user.id),
                user_role=user.role,
                action="CASE_CREATED_OFFLINE_SYNC",
                entity_type="CASE",
                entity_id=res.entity_id,
                parcel_id=op.parcel_id,
                metadata={
                    "operationId": op.operation_id,
                    "clientCreatedAt": op.client_created_at.isoformat() if op.client_created_at else None,
                    "serverReceivedAt": datetime.now(timezone.utc).isoformat(),
                },
            )
        results.append(res)

    return SyncBatchOut(results=results)


@router.get("/status", response_model=SyncStatusOut)
def sync_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    rows = db.query(
        ProcessedSyncOperation.status, func.count(ProcessedSyncOperation.id),
    ).filter(ProcessedSyncOperation.owner_user_id == str(user.id)).group_by(ProcessedSyncOperation.status).all()
    counts = {s: c for s, c in rows}
    last = db.query(func.max(ProcessedSyncOperation.server_received_at)).filter(
        ProcessedSyncOperation.owner_user_id == str(user.id)
    ).scalar()
    return SyncStatusOut(
        processed=counts.get("APPLIED", 0) + counts.get("DUPLICATE", 0),
        conflicts=counts.get("CONFLICT", 0),
        rejected=counts.get("REJECTED", 0),
        last_synced_at=last,
    )
