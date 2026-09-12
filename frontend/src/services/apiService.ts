import axios from 'axios';

const apiService = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
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
    // a dead session. Only an expired/invalid token on some other request
    // should force a hard redirect back to the login page.
    const isLoginAttempt = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiService;