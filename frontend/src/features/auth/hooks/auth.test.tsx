import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthUser, useLogin, useLogout } from './auth';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const sampleUser = { id: 'u1', email: 'officer@test.gov.in', name: 'Asha', role: 'LAND_RECORD_OFFICER' as const };

describe('useAuthUser', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
  });

  it('resolves to null without ever calling the API when no token is stored', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthUser(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it('fetches /auth/me and resolves the user when a token is stored', async () => {
    localStorage.setItem('access_token', 'a-valid-token');
    vi.mocked(apiService.get).mockResolvedValue({ data: sampleUser });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthUser(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.data).toEqual(sampleUser));
    expect(apiService.get).toHaveBeenCalledWith('/auth/me');
  });

  it('clears the stored token and resolves null when /auth/me rejects (expired/invalid token)', async () => {
    localStorage.setItem('access_token', 'a-stale-token');
    vi.mocked(apiService.get).mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthUser(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('useLogin', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.post).mockReset();
  });

  it('stores the returned token and seeds the auth-me cache with the returned user', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { accessToken: 'new-token', user: sampleUser } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ email: 'officer@test.gov.in', password: 'pw' });
    });

    expect(apiService.post).toHaveBeenCalledWith('/auth/login', { email: 'officer@test.gov.in', password: 'pw' });
    expect(localStorage.getItem('access_token')).toBe('new-token');
    expect(client.getQueryData(['auth-me'])).toEqual(sampleUser);
  });
});

describe('useLogout', () => {
  it('removes the stored token and clears the auth-me cache', () => {
    localStorage.setItem('access_token', 'some-token');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['auth-me'], sampleUser);

    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(client) });
    act(() => result.current());

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(client.getQueryData(['auth-me'])).toBeNull();
  });
});
