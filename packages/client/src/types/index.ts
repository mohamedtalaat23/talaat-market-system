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

/**
 * The active cashier shift record stored in the POS store.
 * Shape mirrors the server response from POST /pos/shifts/open
 * and GET /pos/shifts/:id/summary.
 */
export interface ActiveShift {
  id: number;
  register_id: number;
  opened_by: number;
  opened_at: string;
  closed_at: string | null;
  starting_cash: number;
  ending_cash: number | null;
  cash_sales: number;
  card_sales: number;
  total_discounts: number;
  expected_cash: number | null;
  status: 'open' | 'closed';
}

/**
 * A customer record selected and attached to an active POS cart.
 * Shape mirrors the customer API response from GET /customers.
 */
export interface POSCustomer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
  loyalty_points: number;
  notes: string | null;
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

// ─── Shared Printing Types (Phase 12) ──────────────────────────────────────────

export interface ReceiptItem {
  name: string;
  name_ar?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface ReceiptTotals {
  subtotal: number;
  discount: number;
  globalDiscount?: number;
  tax: number;
  total: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
}

export interface Receipt {
  receiptNumber: string;
  cashierName: string;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  items: ReceiptItem[];
  totals: ReceiptTotals;
  timestamp: string;
  printCount?: number;
  paymentMethod: string;
  isReprint?: boolean;
}

export interface PrinterConfig {
  type: 'mock' | 'usb';
  paperWidth: 58 | 80;
  devicePath: string;
  autoPrint: boolean;
  retries: number;
}

export interface PrintJob {
  id: string;
  receipt: Receipt;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  error?: string | null;
  createdAt: string;
}

export interface PrinterStatus {
  online: boolean;
  message: string;
}

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

  // Native ESC/POS Hardware printing (Phase 12)
  enqueuePrintJob: (receipt: Receipt) => Promise<{ success: boolean; jobId: string }>;
  getPrintJobs: () => Promise<PrintJob[]>;
  retryPrintJob: (jobId: string) => Promise<boolean>;
  clearPrintQueue: () => Promise<void>;
  getPrinterStatus: () => Promise<PrinterStatus>;
  getPrinterConfig: () => Promise<PrinterConfig>;
  updatePrinterConfig: (config: PrinterConfig) => Promise<boolean>;
  discoverPrinters: () => Promise<string[]>;
  testPrinter: (config: PrinterConfig) => Promise<PrinterStatus>;

  // Durable Offline Storage (C-2)
  // Uses a structural type instead of importing OfflineSale to avoid
  // circular dependency between types/index.ts and the store module.
  persistOfflineSale: (sale: {
    id: string;
    idempotency_key: string;
    payload: unknown;
    saleData: unknown;
    timestamp: string;
  }) => Promise<void>;
  getOfflineSales: () => Promise<
    {
      id: string;
      idempotency_key: string;
      payload: unknown;
      saleData: unknown;
      timestamp: string;
    }[]
  >;
  removeOfflineSale: (id: string) => Promise<void>;
}

// Augment the global Window interface with the Electron API
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
