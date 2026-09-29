import { create } from 'zustand';

// Centralized connectivity + sync state (spec §24/§25). navigator.onLine only
// says the NIC is up, not that the API is reachable, so we also probe /health.
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING' | 'SYNC_ERROR';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
// health is mounted at the server root (no /api/v1 prefix) - see backend main.py.
const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, '') + '/health';

interface NetworkState {
  status: NetworkStatus;
  reachable: boolean;      // last /health probe result
  pendingCount: number;    // queued offline operations awaiting sync
  conflictCount: number;
  lastSyncAt: number | null;
  setStatus: (s: NetworkStatus) => void;
  setPending: (n: number) => void;
  setConflicts: (n: number) => void;
  markSynced: () => void;
  probe: () => Promise<boolean>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  status: navigator.onLine ? 'ONLINE' : 'OFFLINE',
  reachable: navigator.onLine,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncAt: null,
  setStatus: (status) => set({ status }),
  setPending: (pendingCount) => set({ pendingCount }),
  setConflicts: (conflictCount) => set({ conflictCount }),
  markSynced: () => set({ lastSyncAt: Date.now(), status: get().reachable ? 'ONLINE' : 'OFFLINE' }),
  probe: async () => {
    if (!navigator.onLine) {
      set({ reachable: false, status: 'OFFLINE' });
      return false;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(HEALTH_URL, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      const ok = res.ok;
      set({ reachable: ok, status: ok ? (get().status === 'SYNCING' ? 'SYNCING' : 'ONLINE') : 'OFFLINE' });
      return ok;
    } catch {
      set({ reachable: false, status: 'OFFLINE' });
      return false;
    }
  },
}));

// Wire browser events once, at module load. Re-probe on regain so we don't
// trust a spurious `online` event (spec §24).
let started = false;
export function startNetworkMonitor() {
  if (started) return;
  started = true;
  const store = useNetworkStore.getState();
  window.addEventListener('online', () => {
    useNetworkStore.setState({ status: 'RECONNECTING' });
    void store.probe();
  });
  window.addEventListener('offline', () => useNetworkStore.setState({ status: 'OFFLINE', reachable: false }));
  void store.probe();
  // Light background heartbeat so a silently-dropped connection is noticed.
  setInterval(() => { void useNetworkStore.getState().probe(); }, 30_000);

  // Drain the offline queue whenever we transition back to reachable. Dynamic
  // import breaks the network<->sync cycle. Refresh badge counts on boot too.
  let wasReachable = useNetworkStore.getState().reachable;
  useNetworkStore.subscribe((s) => {
    if (s.reachable && !wasReachable) {
      void import('./sync').then((m) => m.syncOnReconnect());
    }
    wasReachable = s.reachable;
  });
  void import('./queue').then((m) => m.refreshCounts());
  // Boot drain: a fresh online load never crosses the false->true edge above,
  // so anything staged in a prior session (ops or evidence) would sit until the
  // next flip. Drain once on start if we're already reachable.
  void import('./sync').then((m) => { if (useNetworkStore.getState().reachable) m.syncOnReconnect(); });
}
