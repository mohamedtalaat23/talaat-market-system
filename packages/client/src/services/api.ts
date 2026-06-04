import axios from 'axios';
import type { ApiResponse, ApiErrorResponse } from '@/types';

/**
 * Axios API client instance.
 *
 * Design decisions:
 *
 * 1. BASE URL: In Electron production, the client loads from file://
 *    and the server port is passed via IPC. In development, Vite's proxy
 *    handles /api → localhost:3001. We use a relative base URL that works
 *    in both cases.
 *
 * 2. CREDENTIALS: Always included so session cookies are sent automatically.
 *
 * 3. INTERCEPTORS:
 *    - Request: Could add auth headers or request IDs in the future
 *    - Response: Unwrap the `data` field from our standard response envelope
 *    - Error: Translate HTTP errors into user-friendly messages
 */

// Base URL — resolved dynamically to support Electron's dynamic port
function getBaseUrl(): string {
  // If running in Electron and the server port was communicated via IPC,
  // the window.electronAPI.getServerPort() can be called to get the port.
  // For now, in dev mode Vite proxies /api → localhost:3001.
  // In production Electron, we'll update this via the server port IPC.
  return '/api/v1';
}

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15_000, // 15 second timeout
  withCredentials: true, // Send session cookies
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request Interceptor ────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Future: Add request ID for tracing
    // config.headers['X-Request-ID'] = uuid();
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ── Response Interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Our API always returns { success: true, data: ... }
    // Unwrap and return just the data field for convenience
    const body = response.data as ApiResponse<unknown>;
    if (body.success) {
      return { ...response, data: body.data };
    }
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as ApiErrorResponse | undefined;

      // Session expired → redirect to login
      if (error.response?.status === 401) {
        // Auth store will handle this via a global event
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }

      // Enrich the error with our server's error code
      const enrichedError = new Error(responseData?.error?.message ?? error.message);
      (enrichedError as any).code = responseData?.error?.code;
      (enrichedError as any).details = responseData?.error?.details;

      return Promise.reject(enrichedError);
    }

    return Promise.reject(error);
  },
);

// ── Typed API helpers ──────────────────────────────────────────────────────────

export const api = {
  get: <T>(url: string, config?: Parameters<typeof apiClient.get>[1]) =>
    apiClient.get<T>(url, config).then((res) => res.data as T),

  post: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.post>[2]) =>
    apiClient.post<T>(url, data, config).then((res) => res.data as T),

  put: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.put>[2]) =>
    apiClient.put<T>(url, data, config).then((res) => res.data as T),

  patch: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.patch>[2]) =>
    apiClient.patch<T>(url, data, config).then((res) => res.data as T),

  delete: <T>(url: string, config?: Parameters<typeof apiClient.delete>[1]) =>
    apiClient.delete<T>(url, config).then((res) => res.data as T),
};
