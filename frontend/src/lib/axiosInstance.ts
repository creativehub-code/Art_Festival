import axios from 'axios';

const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, '');
};

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach CSRF token for state-changing requests
axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const csrfToken = localStorage.getItem('csrfToken');
      if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors like 401 Unauthorized
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401, clear non-sensitive state and redirect to login
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        // Prevent redirect loop if already on login page
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
