import { create } from 'zustand';

// Centralized connectivity + sync state (spec §24/§25). navigator.onLine only
// says the NIC is up, not that the API is reachable, so we also probe /health.
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING' | 'SYNC_ERROR';

// TEMPORARY KILL-SWITCH: force the app permanently ONLINE and disable all
// probing / offline-flip / queueing. Set back to false to restore the real
// connectivity pipeline. Reason: Render free-tier cold-start 502s were flipping
// the app offline and staging writes; keep everything going straight to the
// network until the backend is kept warm.
const FORCE_ONLINE = true;

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
  status: FORCE_ONLINE || navigator.onLine ? 'ONLINE' : 'OFFLINE',
  reachable: FORCE_ONLINE || navigator.onLine,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncAt: null,
  setStatus: (status) => set({ status }),
  setPending: (pendingCount) => set({ pendingCount }),
  setConflicts: (conflictCount) => set({ conflictCount }),
  markSynced: () => set({ lastSyncAt: Date.now(), status: get().reachable ? 'ONLINE' : 'OFFLINE' }),
  probe: async () => {
    if (FORCE_ONLINE) {
      set({ reachable: true, status: get().status === 'SYNCING' ? 'SYNCING' : 'ONLINE' });
      return true;
    }
    if (!navigator.onLine) {
      set({ reachable: false, status: 'OFFLINE' });
      return false;
    }
    // A hidden/backgrounded tab (screen recording a different window, tab
    // switch, minimized) has its timers and fetches throttled by the browser;
    // a probe that aborts there is not evidence of being offline. Skip it and
    // keep the current state - visibilitychange re-probes when we're back.
    if (typeof document !== 'undefined' && document.hidden) {
      return get().reachable;
    }
    try {
      const ctrl = new AbortController();
      // 10s, not 4s: a cold Render free-tier backend takes tens of seconds to
      // wake, and a slow wake is not "offline". The 2-fail debounce below still
      // guards against a single genuine hiccup.
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(HEALTH_URL, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) {
        consecutiveFails = 0;
        set({ reachable: true, status: get().status === 'SYNCING' ? 'SYNCING' : 'ONLINE' });
        return true;
      }
      return failProbe(set, get);
    } catch {
      return failProbe(set, get);
    }
  },
}));

// One aborted/failed probe isn't "offline" - a screen recorder or a CPU spike
// can make a single /health fetch miss its 4s window. Only flip to OFFLINE
// after two consecutive real failures; the first schedules a fast re-check.
let consecutiveFails = 0;
function failProbe(set: (p: Partial<NetworkState>) => void, get: () => NetworkState): boolean {
  consecutiveFails++;
  if (consecutiveFails >= 2) {
    set({ reachable: false, status: 'OFFLINE' });
    return false;
  }
  set({ status: 'RECONNECTING' }); // keep reachable=true; app stays usable
  setTimeout(() => { void get().probe(); }, 3000);
  return get().reachable;
}

// Wire browser events once, at module load. Re-probe on regain so we don't
// trust a spurious `online` event (spec §24).
let started = false;
export function startNetworkMonitor() {
  if (started) return;
  started = true;
  const store = useNetworkStore.getState();
  if (FORCE_ONLINE) {
    // No probing, no online/offline/visibility flips, no heartbeat - stay ONLINE.
    useNetworkStore.setState({ reachable: true, status: 'ONLINE' });
    void import('./queue').then((m) => m.refreshCounts());
    // Drain anything staged in a prior session now that we're forced-online.
    void import('./sync').then((m) => m.syncOnReconnect());
    return;
  }
  window.addEventListener('online', () => {
    useNetworkStore.setState({ status: 'RECONNECTING' });
    void store.probe();
  });
  // navigator's `offline` event can be spurious (a recorder or VPN toggling a
  // virtual NIC fires it). Verify with a probe instead of hard-flipping, same
  // as we distrust a spurious `online`.
  window.addEventListener('offline', () => {
    useNetworkStore.setState({ status: 'RECONNECTING' });
    void store.probe();
  });
  // Re-probe the moment a throttled/hidden tab becomes visible again.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void useNetworkStore.getState().probe();
    });
  }
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
