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
  async (config) => {
    if (typeof window !== 'undefined') {
      const isMutation = ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '');
      if (isMutation) {
        let csrfToken = localStorage.getItem('csrfToken');
        if (!csrfToken) {
          try {
            const baseUrl = getBaseUrl();
            const csrfRes = await axios.get(`${baseUrl}/csrf-token`, { withCredentials: true });
            if (csrfRes.data && typeof csrfRes.data.csrfToken === 'string') {
              const tokenStr: string = csrfRes.data.csrfToken;
              csrfToken = tokenStr;
              localStorage.setItem('csrfToken', tokenStr);
            }
          } catch (e) {
            console.error('Failed to auto-fetch CSRF token:', e);
          }
        }
        if (csrfToken) {
          config.headers['x-csrf-token'] = csrfToken;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors like 401 Unauthorized or 403 CSRF failures
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If 403 CSRF token error and not already retried
    if (
      error.response &&
      error.response.status === 403 &&
      typeof error.response.data?.message === 'string' &&
      error.response.data.message.includes('CSRF') &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const baseUrl = getBaseUrl();
        const csrfRes = await axios.get(`${baseUrl}/csrf-token`, { withCredentials: true });
        if (csrfRes.data && csrfRes.data.csrfToken) {
          const freshToken = csrfRes.data.csrfToken;
          localStorage.setItem('csrfToken', freshToken);
          originalRequest.headers['x-csrf-token'] = freshToken;
          return axiosInstance(originalRequest);
        }
      } catch (retryErr) {
        console.error('CSRF token refresh retry failed:', retryErr);
      }
    }

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
