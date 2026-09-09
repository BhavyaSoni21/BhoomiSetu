import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { OfficerRole } from '../officer/officerAuth';

export type UserRole = OfficerRole | 'ADMIN' | 'CITIZEN';
export type ContactMethod = 'EMAIL' | 'MOBILE';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  // Optional: officer/admin accounts and every existing test fixture predate
  // these (docs/FRONTEND_UPGRADE_SPEC.md §3) - treat missing as "no mobile
  // on file"/"not verified" rather than requiring every call site and every
  // test in the app to be updated for fields most of them don't care about.
  mobileNumber?: string | null;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  pendingEmail?: string | null;
  pendingMobileNumber?: string | null;
  // Same "optional, treat missing as unknown" convention as the fields
  // above - powers the restructured Profile page's "Member since" display
  // (docs/FRONTEND_UPGRADE_SPEC.md §4).
  createdAt?: string;
  // Profile "more info, editable" fields (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up) - see useUpdateProfileDetails below.
  address?: string | null;
  governmentIdNumber?: string | null;
  occupation?: string | null;
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

// Accepts either identifier (docs/FRONTEND_UPGRADE_SPEC.md §3) - the caller
// passes whichever one it actually collected (LoginPage's method-selector),
// never both.
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { email?: string; mobileNumber?: string; password: string }>(
    async (credentials) => {
      const response = await apiService.post('/auth/login', credentials);
      setToken(response.data.accessToken);
      return response.data.user;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

export interface RegisterParams {
  name: string;
  method: ContactMethod;
  email?: string;
  mobileNumber?: string;
  password: string;
  confirmPassword: string;
}

// Citizen self-registration (docs/FRONTEND_UPGRADE_SPEC.md §3) - returns a
// session immediately, same as login, so the citizen lands signed in with
// the chosen contact method still unverified (see AuthService.register on
// the backend for why verification isn't a login gate).
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, RegisterParams>(
    async (params) => {
      const response = await apiService.post('/auth/register', params);
      setToken(response.data.accessToken);
      return response.data.user;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

// Shared by the post-registration OTP step and Profile's add/change-contact
// flow - both just need "verify this code for this method" and an updated
// user back.
export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { method: ContactMethod; code: string }>(
    async (params) => {
      const response = await apiService.post('/auth/verify-otp', params);
      return response.data;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

export function useResendOtp() {
  return useMutation<void, Error, { method: ContactMethod }>(async (params) => {
    await apiService.post('/auth/resend-otp', params);
  });
}

// Profile "add or change contact method" (docs/FRONTEND_UPGRADE_SPEC.md §3)
// - the backend decides add-vs-change from the signed-in user's own current
// state, not a flag this hook's caller sends.
export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { method: ContactMethod; email?: string; mobileNumber?: string }>(
    async (params) => {
      const response = await apiService.post('/auth/profile/contact', params);
      return response.data;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

// Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
// no OTP step, unlike useUpdateContact above (name/address/governmentIdNumber/
// occupation aren't identity-verification critical). Partial update - only
// send the fields that changed.
export function useUpdateProfileDetails() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { name?: string; address?: string; governmentIdNumber?: string; occupation?: string }>(
    async (params) => {
      const response = await apiService.post('/auth/profile/details', params);
      return response.data;
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
