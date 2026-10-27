import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { employeeRepository } from '../repositories/employee.repository';
import { AppError, AuthenticationError, AuthorizationError } from './errorHandler';
import { HTTP_STATUS, type Role } from '../config/constants';
import { logger } from './logger';

interface JWTPayload {
  id: number;
  username: string;
  role: Role;
}

interface CachedEmployee {
  id: number;
  username: string;
  role: Role;
  is_active: boolean;
  deleted_at: Date | string | null;
  must_change_password: boolean;
  expiresAt: number;
}

// 60-second Time-To-Live in-memory employee auth status cache
const employeeAuthCache = new Map<number, CachedEmployee>();

/**
 * Endpoints that must stay reachable while an account is flagged
 * `must_change_password`, otherwise the user can never satisfy the requirement.
 */
const PASSWORD_CHANGE_ALLOWED_PATHS = ['/auth/change-password', '/auth/logout', '/auth/me'];

/**
 * Drops cached authorization state.
 *
 * Call after changing a password/role/status so the change takes effect
 * immediately instead of waiting for the 60-second cache TTL.
 */
export function invalidateAuthCache(userId?: number): void {
  if (userId === undefined) {
    employeeAuthCache.clear();
    return;
  }
  employeeAuthCache.delete(userId);
}

function isPasswordChangeAllowedPath(req: Request): boolean {
  const pathname = (req.originalUrl || '').split('?')[0] ?? '';
  return PASSWORD_CHANGE_ALLOWED_PATHS.some((allowed) => pathname.endsWith(allowed));
}


/**
 * Stateless Authentication Middleware
 *
 * Extracts Bearer token from the Authorization header, verifies it,
 * checks if the employee is still active and not deleted, and appends
 * user details to the Request object.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Authentication token is required'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AuthenticationError('Malformed authentication token'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    const now = Date.now();
    let cached = employeeAuthCache.get(decoded.id);

    // If cache missed or expired, fetch fresh details from repository
    if (!cached || cached.expiresAt < now) {
      const employee = await employeeRepository.findById(decoded.id);
      if (!employee) {
        logger.warn('Authentication blocked: Employee not found', { username: decoded.username });
        return next(new AuthenticationError('This user account has been disabled'));
      }
      cached = {
        id: employee.id,
        username: employee.username,
        role: employee.role as Role,
        is_active: !!employee.is_active,
        deleted_at: employee.deleted_at,
        must_change_password: !!employee.must_change_password,
        expiresAt: now + 60 * 1000, // 60-second TTL
      };
      employeeAuthCache.set(decoded.id, cached);
    }

    if (!cached.is_active || cached.deleted_at !== null) {
      logger.warn('Authentication blocked: Employee is inactive or has been deleted', {
        username: decoded.username,
      });
      return next(new AuthenticationError('This user account has been disabled'));
    }

    // Accounts provisioned with a temporary password must rotate it before
    // they can use any other endpoint.
    if (cached.must_change_password && !isPasswordChangeAllowedPath(req)) {
      logger.warn('Access blocked: password change required', {
        username: decoded.username,
        path: req.originalUrl,
      });
      return next(
        new AppError(
          'PASSWORD_CHANGE_REQUIRED',
          'You must change your password before accessing this resource',
          HTTP_STATUS.FORBIDDEN,
          { must_change_password: true },
        ),
      );
    }

    // Attach basic details to request object
    req.user = {
      id: cached.id,
      username: cached.username,
      role: cached.role,
      must_change_password: cached.must_change_password,
    };

    next();
  } catch (error) {
    logger.debug('JWT verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return next(new AuthenticationError('Invalid or expired authentication token'));
  }
}

/**
 * Role-Based Access Control Middleware
 *
 * Restricts route access to specified roles only.
 * Must be registered AFTER requireAuth middleware.
 */
export function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization blocked: Insufficient permissions', {
        userId: req.user.id,
        role: req.user.role,
        allowedRoles,
        path: req.originalUrl,
      });
      return next(new AuthorizationError('Insufficient permissions to access this resource'));
    }

    next();
  };
}
