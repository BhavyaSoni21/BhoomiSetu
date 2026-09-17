import axios from 'axios';

const apiService = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    if (error.response?.status === 401 && !isLoginAttempt && !isDemoToken) {
      window.dispatchEvent(new Event('bhoomisetu:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default apiService;