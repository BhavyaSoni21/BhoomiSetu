"""Offline-sync batch schemas (spec §8). Client drains its queued mutations to
POST /sync; the server re-validates and applies each idempotently."""

from datetime import datetime
from typing import Any, Literal

from app.schemas.base import CamelModel


class SyncOperationIn(CamelModel):
    operation_id: str
    entity_type: Literal["case", "document", "evidence"]
    action: Literal["CREATE", "UPDATE"]
    payload: dict[str, Any]
    parcel_id: str | None = None
    client_version: int = 0
    client_created_at: datetime | None = None


class SyncBatchIn(CamelModel):
    operations: list[SyncOperationIn]


class SyncOpResultOut(CamelModel):
    operation_id: str
    status: Literal["APPLIED", "DUPLICATE", "CONFLICT", "REJECTED"]
    entity_id: str | None = None
    conflict: dict[str, Any] | None = None
    error: str | None = None


class SyncBatchOut(CamelModel):
    results: list[SyncOpResultOut]


class SyncStatusOut(CamelModel):
    processed: int
    conflicts: int
    rejected: int
    last_synced_at: datetime | None = None
