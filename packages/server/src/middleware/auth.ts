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

/**
 * Stateless Authentication Middleware
 * 
 * Extracts Bearer token from the Authorization header, verifies it,
 * checks if the employee is still active and not deleted, and appends
 * user details to the Request object.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
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

    // Retrieve active details from repository
    const employee = await employeeRepository.findById(decoded.id);

    if (!employee || !employee.is_active || employee.deleted_at !== null) {
      logger.warn('Authentication blocked: Employee is inactive or has been deleted', { username: decoded.username });
      return next(new AuthenticationError('This user account has been disabled'));
    }

    // Attach basic details to request object
    req.user = {
      id: employee.id,
      username: employee.username,
      role: employee.role as Role,
    };

    next();
  } catch (error) {
    logger.debug('JWT verification failed', { error: error instanceof Error ? error.message : String(error) });
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
