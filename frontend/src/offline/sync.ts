import { db } from './db';
import { listOperations, updateOperation, refreshCounts, currentUserId } from './queue';
import { useNetworkStore } from './network';
import apiService from '../services/apiService';
import { autoSyncQueue, getLocalQueue } from '../services/verifierLocalSyncService';

// SyncManager (spec §8/§9). Drains queued ops to POST /api/v1/sync in one batch;
// the server is authoritative and idempotent (operationId is the key), so a
// retry after a dropped response never double-applies. Per-op outcome decides
// whether we mark SYNCED, surface a CONFLICT, or leave it FAILED for retry.

export interface SyncOpResult {
  operationId: string;
  status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';
  entityId?: string | null;
  conflict?: unknown;
  error?: string | null;
}

let running = false;

export async function syncNow(): Promise<{ applied: number; conflicts: number; failed: number } | null> {
  if (running) return null;
  if (!useNetworkStore.getState().reachable) return null;

  const pending = (await listOperations()).filter(
    (o) => o.status === 'PENDING' || o.status === 'FAILED',
  );
  if (pending.length === 0) {
    useNetworkStore.getState().markSynced();
    return { applied: 0, conflicts: 0, failed: 0 };
  }

  running = true;
  useNetworkStore.getState().setStatus('SYNCING');
  try {
    await Promise.all(pending.map((o) => updateOperation(o.operationId, { status: 'SYNCING' })));

    const body = {
      operations: pending.map((o) => ({
        operationId: o.operationId,
        entityType: o.entityType,
        action: o.action,
        payload: o.payload,
        parcelId: o.parcelId,
        clientVersion: o.clientVersion,
        clientCreatedAt: new Date(o.createdAt).toISOString(),
      })),
    };

    const resp = await apiService.post<{ results: SyncOpResult[] }>('/sync', body);
    let applied = 0, conflicts = 0, failed = 0;

    for (const r of resp.data.results) {
      const op = pending.find((p) => p.operationId === r.operationId);
      if (r.status === 'APPLIED' || r.status === 'DUPLICATE') {
        await updateOperation(r.operationId, { status: 'SYNCED', entityId: r.entityId ?? op?.entityId ?? null, lastError: null });
        applied++;
      } else if (r.status === 'CONFLICT') {
        await updateOperation(r.operationId, { status: 'CONFLICT', conflict: r.conflict, lastError: r.error ?? 'conflict' });
        conflicts++;
      } else {
        await updateOperation(r.operationId, { status: 'FAILED', attempts: (op?.attempts ?? 0) + 1, lastError: r.error ?? 'rejected' });
        failed++;
      }
    }

    // Prune successfully-synced ops so the queue doesn't grow unbounded.
    await db.operations.where('ownerUserId').equals(currentUserId()).and((o) => o.status === 'SYNCED').delete();
    await refreshCounts();

    const store = useNetworkStore.getState();
    if (failed > 0) store.setStatus('SYNC_ERROR');
    else store.markSynced();
    return { applied, conflicts, failed };
  } catch {
    // Whole batch failed (offline mid-flight, 5xx). Roll SYNCING back to FAILED
    // for the next attempt; backoff is the reconnect heartbeat, not a busy loop.
    for (const o of pending) {
      await updateOperation(o.operationId, { status: 'FAILED', attempts: o.attempts + 1, lastError: 'network' });
    }
    useNetworkStore.getState().setStatus('SYNC_ERROR');
    return null;
  } finally {
    running = false;
  }
}

// Kick a drain whenever connectivity returns. Called from the network monitor.
// Drains both queues: the JSON op queue (cases) and the verifier's multipart
// evidence queue (spec §9/§31) - the latter lives in localStorage with its own
// retry, so we fire it independently of pendingCount.
export function syncOnReconnect(): void {
  const s = useNetworkStore.getState();
  if (!s.reachable) return;
  if (s.pendingCount > 0) void syncNow();
  if (getLocalQueue().length > 0) void autoSyncQueue(apiService);
}
