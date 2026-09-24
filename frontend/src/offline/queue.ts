import { db, OfflineOperation, OpStatus } from './db';
import { useNetworkStore } from './network';

// Offline mutation queue (spec §7/§8). Permitted writes are staged here with a
// uuid idempotency key while offline, then drained by the SyncManager. This is
// a workspace, never source of truth — the server re-validates every op.

// Best-effort current user id from the JWT `sub`, so a queued op is owned and
// never replayed under the wrong account on a shared device (spec §36/§37).
export function currentUserId(): string {
  try {
    const tok = localStorage.getItem('access_token');
    if (!tok) return 'anon';
    const [, payload] = tok.split('.');
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return String(claims.sub ?? claims.user_id ?? 'anon');
  } catch {
    return 'anon';
  }
}

type NewOp = Pick<OfflineOperation, 'entityType' | 'action' | 'payload'> &
  Partial<Pick<OfflineOperation, 'entityId' | 'parcelId' | 'clientVersion'>>;

export async function enqueue(op: NewOp): Promise<OfflineOperation> {
  const now = Date.now();
  const row: OfflineOperation = {
    operationId: crypto.randomUUID(),
    ownerUserId: currentUserId(),
    entityType: op.entityType,
    entityId: op.entityId ?? null,
    action: op.action,
    payload: op.payload,
    parcelId: op.parcelId ?? null,
    clientVersion: op.clientVersion ?? 0,
    status: 'PENDING',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.operations.add(row);
  await refreshCounts();
  return row;
}

export function listOperations(status?: OpStatus): Promise<OfflineOperation[]> {
  const owner = currentUserId();
  const coll = db.operations.where('ownerUserId').equals(owner);
  return (status ? coll.filter((o) => o.status === status) : coll).toArray();
}

export async function updateOperation(operationId: string, patch: Partial<OfflineOperation>): Promise<void> {
  await db.operations.update(operationId, { ...patch, updatedAt: Date.now() });
  await refreshCounts();
}

// Accept-server resolution (spec §8): drop a conflicted/failed local op. The
// server already holds the authoritative record, so we discard the duplicate.
export async function discardOperation(operationId: string): Promise<void> {
  await db.operations.delete(operationId);
  await refreshCounts();
}

// Reflect queue state into the network store so the UI badge stays truthful.
export async function refreshCounts(): Promise<void> {
  const owner = currentUserId();
  const all = await db.operations.where('ownerUserId').equals(owner).toArray();
  const pending = all.filter((o) => o.status === 'PENDING' || o.status === 'FAILED' || o.status === 'SYNCING').length;
  const conflicts = all.filter((o) => o.status === 'CONFLICT').length;
  const s = useNetworkStore.getState();
  s.setPending(pending);
  s.setConflicts(conflicts);
}
