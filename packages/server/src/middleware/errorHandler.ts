import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';
import { HTTP_STATUS, type ErrorCode } from '../config/constants';

// ─── Custom Error Classes ─────────────────────────────────────────────────────

/**
 * Base application error.
 *
 * All intentional errors thrown in services/controllers should extend this.
 * The global error handler uses `instanceof AppError` to produce clean
 * client responses. Unexpected errors (e.g., bugs, DB crashes) are caught
 * separately and never leak internals to the client.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = HTTP_STATUS.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain in compiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | number) {
    const message = id
      ? `${entity} with ID '${id}' was not found`
      : `${entity} was not found`;
    super('NOT_FOUND', message, HTTP_STATUS.NOT_FOUND);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, HTTP_STATUS.BAD_REQUEST, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, HTTP_STATUS.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, HTTP_STATUS.CONFLICT, details);
  }
}

export class InsufficientStockError extends AppError {
  constructor(productId: number, available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Product ID ${productId} has insufficient stock. Available: ${available}, Requested: ${requested}`,
      HTTP_STATUS.CONFLICT,
      { product_id: productId, available, requested },
    );
  }
}

// ─── Global Error Handler Middleware ─────────────────────────────────────────

/**
 * Express global error handler.
 *
 * Must be registered LAST in the middleware chain (after all routes).
 * The 4-parameter signature tells Express this is an error handler.
 *
 * Error flow:
 *   AppError      → structured JSON with code + message + details
 *   ZodError      → VALIDATION_ERROR with field-level details
 *   Unknown error → INTERNAL_ERROR, no details (prevents info leakage)
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Always log the full error for our records
  logger.error('Request error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    method: req.method,
    path: req.originalUrl,
  });

  // Handle known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  // Handle Zod validation errors (thrown by validate middleware)
  if (err instanceof ZodError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // Unexpected error — never leak internals
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  });
}

// ─── 404 Handler ─────────────────────────────────────────────────────────────

/**
 * Catch-all for routes that don't exist.
 * Register this AFTER all route definitions but BEFORE errorHandler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}
