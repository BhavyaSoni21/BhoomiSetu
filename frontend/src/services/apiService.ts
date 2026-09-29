import axios from 'axios';

// Opt-out flag: a 401 from a request marked this way is handled by its caller
// (an optional/background query) and must NOT force a global logout+redirect.
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

const apiService = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Absolute API base (origin + /api/v1) for requests that bypass this axios
// instance - MapLibre MVT tiles and the offline tile prefetch fetch
// `<apiBase>/tiles/*.pbf` directly. Two reasons it must be the full base, not a
// relative path: (1) on Vercel the SPA and API live on different origins, so a
// relative /api/... path hits the SPA rewrite (returns index.html) instead of
// the backend; (2) the tiles router is mounted under /api/v1 like every other
// route (main.py), so the version segment must be included. Deriving from
// baseURL carries both automatically.
export const apiBase = ((apiService.defaults.baseURL as string) || 'http://localhost:8000/api/v1').replace(/\/$/, '');

// Request interceptor for adding auth token
apiService.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiService.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from /auth/login itself just means "wrong email or password" -
    // that's a normal, user-facing form error the caller handles inline, not
    // a dead session. Notify React so it can navigate without a full document
    // reload, which would otherwise repaint the browser's blank canvas.
    const isLoginAttempt = error.config?.url?.includes('/auth/login');
    const token = localStorage.getItem('access_token');
    const isDemoToken = token?.startsWith('demo-jwt-token-');
    // Optional/background queries (e.g. Parcel 360's ownership badge) opt out
    // so their 401 doesn't evict a viewer from an otherwise-public page.
    const skipRedirect = error.config?.skipAuthRedirect === true;
    if (error.response?.status === 401 && !isLoginAttempt && !isDemoToken && !skipRedirect) {
      window.dispatchEvent(new Event('bhoomisetu:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default apiService;