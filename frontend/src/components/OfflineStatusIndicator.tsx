import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { useNetworkStore } from '../offline/network';
import { listOperations, discardOperation } from '../offline/queue';
import { syncNow } from '../offline/sync';
import type { OfflineOperation } from '../offline/db';

// Connectivity chip + SyncCenter (spec §25/§8). Shows live/offline, queued
// count and conflicts; the panel offers "Sync Now" and per-conflict discard
// (accept-server). Status only until opened — no polling of its own.
const OfflineStatusIndicator: React.FC = () => {
  const { online, status, pendingCount, conflictCount } = useOnlineStatus();
  const lastSyncAt = useNetworkStore((s) => s.lastSyncAt);
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<OfflineOperation[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void listOperations('CONFLICT').then(setConflicts);
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, pendingCount, conflictCount]);

  const syncing = status === 'SYNCING';
  const err = status === 'SYNC_ERROR';
  const label = err ? 'Sync error' : syncing ? 'Syncing…' : online ? 'Online' : 'Offline';
  const Icon = err ? AlertTriangle : syncing ? RefreshCw : online ? Wifi : WifiOff;
  const tone = err
    ? 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800'
    : online
    ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800'
    : 'text-slate-600 border-slate-300 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700';

  const discard = async (id: string) => {
    await discardOperation(id);
    setConflicts((c) => c.filter((o) => o.operationId !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-xs font-medium ${tone}`}
        title={pendingCount ? `${pendingCount} change(s) waiting to sync` : label}
        aria-label={`Sync status: ${label}`}
      >
        <Icon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        {pendingCount > 0 && <span className="rounded-full bg-current/10 px-1.5 tabular-nums">{pendingCount}</span>}
        {conflictCount > 0 && <span className="rounded-full bg-amber-500 text-white px-1.5 tabular-nums">{conflictCount}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-[8px] border border-[var(--border)] bg-[var(--surface-1)] p-3 text-left shadow-lg text-[var(--text-primary)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[var(--text-heading)]">Offline sync</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
          <dl className="text-xs space-y-1 mb-3">
            <div className="flex justify-between"><dt>Status</dt><dd className="font-medium">{label}</dd></div>
            <div className="flex justify-between"><dt>Pending</dt><dd className="tabular-nums">{pendingCount}</dd></div>
            <div className="flex justify-between"><dt>Last sync</dt><dd>{lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : '—'}</dd></div>
          </dl>
          <button
            type="button"
            disabled={!online || syncing || pendingCount === 0}
            onClick={() => void syncNow()}
            className="w-full rounded-[4px] bg-[var(--bhashini-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>

          {conflicts.length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-2">
              <div className="text-xs font-bold text-amber-700 mb-1">Conflicts ({conflicts.length})</div><p className="text-[11px] text-[var(--text-muted)] mb-2">Case creation syncs offline. Document and evidence uploads require a connection.</p>
              <ul className="space-y-1.5">
                {conflicts.map((c) => (
                  <li key={c.operationId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {c.entityType} · {(c.conflict as { reason?: string } | undefined)?.reason ?? 'conflict'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void discard(c.operationId)}
                      className="shrink-0 rounded-[4px] border border-[var(--border)] px-2 py-0.5 hover:bg-[var(--surface-2)]"
                      title="Keep the server's record and drop this offline copy"
                    >
                      Discard
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineStatusIndicator;
