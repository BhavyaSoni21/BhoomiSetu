import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import apiService from './apiService';

// Exercises the response interceptor registered in apiService.ts directly,
// rather than through a real HTTP round trip - this is what caught a real
// bug live (see docs/FEATURE_AUDIT.md §8 item 9): a blanket "any 401 ->
// window.location.href = '/login'" fired even for a failed login attempt
// itself, hard-reloading the page before the form ever got to show
// "Invalid email or password." Unit tests never caught it because every
// other test mocks the whole apiService module, bypassing this interceptor
// entirely - only a live browser check (Playwright) surfaced it.
function getResponseErrorHandler(): (error: unknown) => Promise<never> {
  const handlers = (apiService.interceptors.response as unknown as { handlers: Array<{ rejected: (error: unknown) => Promise<never> }> }).handlers;
  return handlers[handlers.length - 1].rejected;
}

describe('apiService response interceptor', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // jsdom doesn't implement real navigation - replace `location` with a
    // plain settable object so the redirect can actually be observed.
    // @ts-expect-error - intentionally replacing a read-only global for the test
    delete window.location;
    // @ts-expect-error - see above
    window.location = { href: '' };
  });

  afterEach(() => {
    // @ts-expect-error - restoring the real Location object replaced above
    window.location = originalLocation;
  });

  it('redirects to /login on a 401 from an unrelated endpoint', async () => {
    const handler = getResponseErrorHandler();
    await expect(
      handler({ response: { status: 401 }, config: { url: '/parcels/123/risk-score' } }),
    ).rejects.toBeTruthy();

    expect(window.location.href).toBe('/login');
  });

  it('does not redirect on a 401 from the login endpoint itself', async () => {
    const handler = getResponseErrorHandler();
    await expect(
      handler({ response: { status: 401 }, config: { url: '/auth/login' } }),
    ).rejects.toBeTruthy();

    expect(window.location.href).toBe('');
  });

  it('does not redirect on a non-401 error', async () => {
    const handler = getResponseErrorHandler();
    await expect(
      handler({ response: { status: 500 }, config: { url: '/parcels' } }),
    ).rejects.toBeTruthy();

    expect(window.location.href).toBe('');
  });
});
