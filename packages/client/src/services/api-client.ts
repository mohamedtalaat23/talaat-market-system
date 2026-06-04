import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useLANStore } from '@/features/pos/stores/useLANStore';

/**
 * Configure API client with baseURL and standard headers.
 * Vite development server proxies "/api" requests to http://localhost:3001.
 */
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10s timeout
});

// Request interceptor to dynamically inject the JWT token from the Zustand store
apiClient.interceptors.request.use(
  (config) => {
    // Dynamically swap baseURL if operating as a LAN Client Terminal
    const { mode, hostAddress } = useLANStore.getState();
    if (mode === 'client' && hostAddress) {
      config.baseURL = `${hostAddress.replace(/\/$/, '')}/api/v1`;
    } else {
      config.baseURL = '/api/v1';
    }

    // Get token directly from the Zustand store state
    const token = useAuthStore.getState().token;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors globally, including automatic logouts on 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized (invalid token, account deactivated, session expired)
    if (error.response && error.response.status === 401) {
      // Avoid looping call if we are already logging out or initializing
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        useAuthStore.getState().logout();
      }
    }

    // Extract server error messages if available
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    const serverError = new Error(message);
    (serverError as any).status = error.response?.status;
    (serverError as any).code = error.response?.data?.code;

    return Promise.reject(serverError);
  },
);
