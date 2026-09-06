import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { OfficerRole } from '../officer/officerAuth';

export type UserRole = OfficerRole | 'ADMIN' | 'CITIZEN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// apiService's request interceptor already looks for a token under this
// exact key (see services/apiService.ts) - that scaffolding predates real
// auth and was simply never fed a real token until now.
const TOKEN_KEY = 'access_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage failures (private browsing, quota) - the session just
    // won't survive a reload, which is a graceful degradation here.
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // See setToken.
  }
}

const AUTH_QUERY_KEY = ['auth-me'];

// Backed by React Query (the pattern already used everywhere else in this
// app) rather than a hand-rolled context/store, so every component that
// calls this - RequireAuth, OfficerPortal, AdminPortal - shares one cached
// result and one /auth/me request per session, not one each.
export function useAuthUser() {
  return useQuery<AuthUser | null>(
    AUTH_QUERY_KEY,
    async () => {
      if (!getToken()) return null;
      try {
        const response = await apiService.get('/auth/me');
        return response.data;
      } catch {
        // An expired/invalid token: clear it so the app doesn't keep
        // retrying with credentials the server has already rejected.
        clearToken();
        return null;
      }
    },
    { retry: false, staleTime: Infinity },
  );
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { email: string; password: string }>(
    async ({ email, password }) => {
      const response = await apiService.post('/auth/login', { email, password });
      setToken(response.data.accessToken);
      return response.data.user;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearToken();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  };
}
