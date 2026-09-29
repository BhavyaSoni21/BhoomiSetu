import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNetworkStore } from './network';

// Regression: screen recording (a throttled/hidden tab, or a recorder toggling
// a virtual NIC) must NOT flip the app to OFFLINE on a single failed probe.
describe('network probe resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNetworkStore.setState({ status: 'ONLINE', reachable: true });
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips probing while the tab is hidden and stays online', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const ok = await useNetworkStore.getState().probe();
    expect(ok).toBe(true);
    expect(useNetworkStore.getState().status).not.toBe('OFFLINE');
  });

  it('needs two consecutive failures before going OFFLINE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    await useNetworkStore.getState().probe();
    // one hiccup: reconnecting, but still usable (not offline)
    expect(useNetworkStore.getState().status).toBe('RECONNECTING');
    expect(useNetworkStore.getState().reachable).toBe(true);
    await useNetworkStore.getState().probe();
    // confirmed second failure: now offline
    expect(useNetworkStore.getState().status).toBe('OFFLINE');
    expect(useNetworkStore.getState().reachable).toBe(false);
  });

  it('recovers to ONLINE on a successful probe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    const ok = await useNetworkStore.getState().probe();
    expect(ok).toBe(true);
    expect(useNetworkStore.getState().status).toBe('ONLINE');
  });
});
