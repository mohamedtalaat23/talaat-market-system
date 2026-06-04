import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { employeeRepository } from '../repositories/employee.repository';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { type Role } from '../config/constants';
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
  expiresAt: number;
}

// 60-second Time-To-Live in-memory employee auth status cache
const employeeAuthCache = new Map<number, CachedEmployee>();

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

    // Attach basic details to request object
    req.user = {
      id: cached.id,
      username: cached.username,
      role: cached.role,
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
