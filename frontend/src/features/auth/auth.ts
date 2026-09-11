import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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
      } catch (err) {
        // Only a genuine 401 (the server itself rejected this token -
        // JwtStrategy.validate() found no matching user, or the token is
        // malformed) means the session is really over; clear it so the app
        // doesn't keep retrying with credentials the server has already
        // rejected. Per the user's explicit "the account must not sign out
        // until the signout button is pressed, even if the site is
        // refreshed" - a network blip, a 5xx, or the backend being briefly
        // unreachable on page load must NOT be treated the same way; those
        // get a couple of retries (below) and otherwise just leave the
        // query in an error state rather than silently signing the user out.
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          clearToken();
          return null;
        }
        throw err;
      }
    },
    { retry: 2, retryDelay: 1000, staleTime: Infinity },
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

export interface PendingRegistration {
  registrationId: string;
  method: ContactMethod;
  target: string;
}

// Citizen self-registration (docs/FRONTEND_UPGRADE_SPEC.md §3, revised per
// the user's explicit "the account should not be created until the number
// or the email is verified") - no account/token exists yet after this call.
// Returns just enough to drive the OTP step; useVerifyRegistrationOtp below
// is what actually creates the account and signs the citizen in.
export function useRegister() {
  return useMutation<PendingRegistration, Error, RegisterParams>(async (params) => {
    const response = await apiService.post('/auth/register', params);
    return response.data;
  });
}

// The registration flow's own verify/resend, keyed by registrationId (a
// PendingRegistration on the backend) rather than a signed-in user + method -
// there's no account or token yet at this point. This is the one call in the
// whole registration flow that actually creates the account.
export function useVerifyRegistrationOtp() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, { registrationId: string; code: string }>(
    async (params) => {
      const response = await apiService.post('/auth/register/verify-otp', params);
      setToken(response.data.accessToken);
      return response.data.user;
    },
    {
      onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
    },
  );
}

export function useResendRegistrationOtp() {
  return useMutation<void, Error, { registrationId: string }>(async (params) => {
    await apiService.post('/auth/register/resend-otp', params);
  });
}

// Profile's add/change-contact flow only from here on - operates on the
// signed-in user's own account (unlike the registration pair above, which
// has no account yet).
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
    // Best-effort: bumps the account's tokenVersion server-side
    // (POST /auth/logout, backend/src/auth/auth.controller.ts) so this
    // token - and any other outstanding copy of it - actually stops
    // validating, rather than merely being dropped from this browser's
    // localStorage below. Never awaited/blocking - a dead network shouldn't
    // stop the user from signing out on this device.
    try {
      apiService.post('/auth/logout')?.catch(() => {});
    } catch {
      // Ignore - see above.
    }
    clearToken();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  };
}
