/**
 * Application-wide constants.
 *
 * Centralizing constants here prevents magic numbers/strings scattered
 * across the codebase and makes them easy to audit and update.
 */

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// ─── Authentication ────────────────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = 'talaat_sid';
/** Full session lifetime: 12 hours (ms) — covers a full work shift */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Auto-lock after 5 minutes of inactivity (ms) */
export const SESSION_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
/** Maximum failed PIN attempts before lockout */
export const MAX_PIN_ATTEMPTS = 5;
/** PIN lockout duration after max attempts (ms) */
export const PIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
/** bcrypt work factor — 12 is secure and fast enough on modern hardware */
export const BCRYPT_ROUNDS = 12;

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ─── Pagination ───────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

// ─── Inventory ────────────────────────────────────────────────────────────────
/** Receipt number prefix */
export const RECEIPT_PREFIX = 'TM';
/** Barcode prefix range for internal/store-weighed items */
export const INTERNAL_BARCODE_PREFIX_MIN = 20;
export const INTERNAL_BARCODE_PREFIX_MAX = 29;

// ─── Backup ───────────────────────────────────────────────────────────────────
/** Number of daily backups to retain */
export const BACKUP_RETAIN_DAILY = 7;
/** Number of weekly backups to retain */
export const BACKUP_RETAIN_WEEKLY = 4;

// ─── HTTP Status Codes ────────────────────────────────────────────────────────
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  INTERNAL_ERROR: 500,
} as const;

// ─── Error Codes ──────────────────────────────────────────────────────────────
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DB_ERROR: 'DB_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
