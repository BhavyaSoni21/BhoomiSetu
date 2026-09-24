import { useNetworkStore } from './network';

// Thin selector over the network store (spec §24/§25). Components that only
// need "am I online" shouldn't subscribe to the whole store.
export function useOnlineStatus() {
  const status = useNetworkStore((s) => s.status);
  const reachable = useNetworkStore((s) => s.reachable);
  const pendingCount = useNetworkStore((s) => s.pendingCount);
  const conflictCount = useNetworkStore((s) => s.conflictCount);
  const online = reachable && status !== 'OFFLINE';
  return { online, status, reachable, pendingCount, conflictCount };
}
