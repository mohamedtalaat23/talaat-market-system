import { employeeRepository } from '../repositories/employee.repository';
import { AuthenticationError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { logger } from '../middleware/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { type Role } from '../config/constants';

export interface LoginResult {
  token: string;
  employee: {
    id: number;
    username: string;
    role: Role;
    full_name: string;
  };
}

export class AuthService {
  /**
   * Log in an employee using username and password or PIN.
   * Enforces status checks (active and non-deleted).
   */
  async login(username: string, password?: string, pin?: string): Promise<LoginResult> {
    logger.debug('Attempting login authentication', { username, method: password ? 'password' : 'pin' });

    // 1. Fetch credentials (including hashes) from database
    const user = await employeeRepository.getPasswordAndPinHash(username);
    if (!user) {
      // Use generic error message to prevent username enumeration
      throw new AuthenticationError('Invalid username or credentials');
    }

    // 2. Prevent soft-deleted or inactive employees from authenticating
    if (!user.is_active || user.deleted_at !== null) {
      logger.warn('Login blocked: Account is deactivated or deleted', { username });
      throw new AuthenticationError('This user account has been disabled');
    }

    // 3. Verify credentials
    let isMatch = false;

    if (password) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else if (pin) {
      if (!user.pin_hash) {
        throw new AuthenticationError('PIN quick-login is not configured for this user');
      }
      isMatch = await bcrypt.compare(pin, user.pin_hash);
    }

    if (!isMatch) {
      logger.warn('Login failed: Invalid credentials provided', { username });
      throw new AuthenticationError('Invalid username or credentials');
    }

    // 4. Update last login timestamp
    await employeeRepository.updateLastLogin(user.id);

    // 5. Generate signed JWT token with minimal payload
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role as Role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    // 6. Audit logging for logins
    logger.info('Employee login successful (audit log)', {
      userId: user.id,
      username: user.username,
      role: user.role,
      loginMethod: password ? 'password' : 'pin',
    });

    // Fetch default details to return
    const employee = await employeeRepository.findById(user.id);
    if (!employee) {
      throw new Error('Failed to retrieve employee profile details');
    }

    return {
      token,
      employee: {
        id: employee.id,
        username: employee.username,
        role: employee.role as Role,
        full_name: employee.full_name,
      },
    };
  }
}

// Single instance export (minimalist/no DI)
export const authService = new AuthService();
