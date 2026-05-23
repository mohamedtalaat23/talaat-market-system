/**
 * Shared TypeScript types for the client.
 *
 * Types here are used across multiple features and components.
 * Feature-specific types should live in their own feature folder.
 */

// ─── API Response Types ───────────────────────────────────────────────────────

/** Standard successful API response */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/** Standard paginated API response */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Standard error API response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Common Entity Types ──────────────────────────────────────────────────────

/** Base fields all DB entities share */
export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'cashier';

export interface CurrentUser {
  id: number;
  full_name: string;
  username: string;
  role: Role;
}

// ─── Server Info ──────────────────────────────────────────────────────────────

/** Health check response data */
export interface HealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      latencyMs: number | null;
    };
  };
  responseTimeMs: number;
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

/** Generic option for selects and dropdowns */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

/** Navigation item for the sidebar */
export interface NavItem {
  label: string;
  labelAr?: string;
  path: string;
  icon: string; // Lucide icon name
  roles: Role[]; // Which roles can see this item
  badge?: number; // Optional notification count
}

// ─── Electron API ─────────────────────────────────────────────────────────────

/** Type definition for the contextBridge-exposed electron API */
export interface ElectronAPI {
  printReceipt: (data: unknown) => Promise<void>;
  openCashDrawer: () => Promise<void>;
  createBackup: (path: string) => Promise<void>;
  restoreBackup: (path: string) => Promise<void>;
  getServerPort: () => Promise<number>;
  getAppVersion: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  selectFile: (filters: unknown) => Promise<string | null>;
}

// Augment the global Window interface with the Electron API
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
