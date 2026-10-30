import { employeeRepository } from '../repositories/employee.repository';
import {
  AppError,
  AuthenticationError,
  ValidationError,
} from '../middleware/errorHandler';
import { invalidateAuthCache } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../middleware/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BCRYPT_ROUNDS, ERROR_CODES, HTTP_STATUS, type Role } from '../config/constants';
import {
  MIN_PASSWORD_LENGTH,
  isKnownDefaultPassword,
  isKnownDefaultPin,
  isWeakSecret,
} from '../config/security';

export interface LoginResult {
  token: string;
  employee: {
    id: number;
    username: string;
    role: Role;
    full_name: string;
    must_change_password: boolean;
  };
}

/**
 * Raised when an account's stored credential is a *published default*.
 *
 * The account is deliberately not allowed to fix this itself: whoever knows
 * `admin123` could otherwise log in and take the account over. An operator with
 * local shell access must rotate it with `npm run admin:rotate`.
 */
export class CredentialRotationRequiredError extends AppError {
  constructor(message?: string) {
    super(
      ERROR_CODES.CREDENTIAL_RESET_REQUIRED,
      message ??
        'This account still uses a published default credential and has been locked. ' +
          'An administrator must rotate it locally with "npm run admin:rotate -- --username <name>".',
      HTTP_STATUS.FORBIDDEN,
      { credential_reset_required: true },
    );
    this.name = 'CredentialRotationRequiredError';
  }
}


export class AuthService {
  /**
   * Log in an employee using username and password or PIN.
   * Enforces status checks (active and non-deleted).
   */
  async login(username: string, password?: string, pin?: string): Promise<LoginResult> {
    logger.debug('Attempting login authentication', {
      username,
      method: password ? 'password' : 'pin',
    });

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

    // 2.5 Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remainingMinutes = Math.ceil(
        (new Date(user.locked_until).getTime() - new Date().getTime()) / 60000,
      );
      logger.warn('Login blocked: Account is locked due to too many failed attempts', { username });
      throw new AuthenticationError(
        `Account is locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
      );
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

      const MAX_ATTEMPTS = 5;
      const LOCKOUT_DURATION_MINUTES = 15;
      const newAttempts = user.failed_login_attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000);
        await employeeRepository.lockAccount(user.id, lockoutUntil);
        logger.warn('Account locked due to max failed attempts', { username, lockoutUntil });
        throw new AuthenticationError(
          `Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
        );
      } else {
        await employeeRepository.incrementFailedLoginAttempts(user.id);
      }

      throw new AuthenticationError('Invalid username or credentials');
    }

    // 3.5 Refuse accounts whose *stored* credential is a published default.
    //
    // Migration 034 only protects accounts created after it ran. Installations
    // provisioned earlier still hold `admin123` / PIN `1111`; those credentials
    // are public, so the account is locked rather than handed a token. The first
    // time we see it, we also persist the lock so the account stays unusable even
    // if the attacker stops sending the default (and any stolen token dies with
    // the epoch bump).
    const usedDefaultPassword = password ? isKnownDefaultPassword(password) : false;
    const usedDefaultPin = pin ? isKnownDefaultPin(pin) : false;

    if (user.credential_rotation_required || usedDefaultPassword || usedDefaultPin) {
      if (!user.credential_rotation_required) {
        await employeeRepository.setCredentialRotationRequired(user.id, true);
        invalidateAuthCache(user.id);
        logger.warn('Locked account that authenticated with a published default credential', {
          userId: user.id,
          username: user.username,
          credential: usedDefaultPassword ? 'password' : 'pin',
        });
      }

      logger.warn('Login blocked: credential rotation required', {
        userId: user.id,
        username: user.username,
      });

      throw new CredentialRotationRequiredError();
    }

    // 4. Update last login timestamp and reset failed attempts
    await employeeRepository.updateLastLogin(user.id);
    if (user.failed_login_attempts > 0 || user.locked_until !== null) {
      await employeeRepository.resetFailedLoginAttempts(user.id);
    }

    // 5. Generate signed JWT token with minimal payload.
    //    `ae` (auth epoch) is compared against the database on every request, so
    //    bumping the employee's epoch kills all outstanding tokens.
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role as Role,
        ae: user.auth_epoch ?? 0,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
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
        must_change_password: employee.must_change_password ?? false,
      },
    };
  }

  /**
   * Change the password of the currently authenticated employee.
   *
   * Requires the current password (a stolen JWT alone must not be enough to
   * take over the account) and enforces the same password policy used for
   * provisioning. Clears `must_change_password` on success.
   */
  async changePassword(
    userId: number,
    username: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ token: string }> {
    const user = await employeeRepository.getPasswordAndPinHash(username);

    if (!user || user.id !== userId) {
      throw new AuthenticationError('Invalid username or credentials');
    }

    // Accounts flagged for operator rotation cannot self-serve: the current
    // credential is public, so letting the holder change it would hand the
    // account to whoever knows the default.
    if (user.credential_rotation_required) {
      throw new CredentialRotationRequiredError(
        'This account is locked because it used a published default credential. ' +
          'An administrator must rotate it locally with "npm run admin:rotate -- --username <name>".',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      logger.warn('Password change rejected: current password is incorrect', { username });
      throw new AuthenticationError('Current password is incorrect');
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    if (isWeakSecret(newPassword) || isKnownDefaultPassword(newPassword)) {
      throw new ValidationError('New password is too common or too easy to guess');
    }

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      throw new ValidationError('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Bumps `auth_epoch`, invalidating every other session for this employee.
    const authEpoch = await employeeRepository.updatePassword(userId, passwordHash);
    invalidateAuthCache(userId);

    logger.info('Employee password changed (audit log)', { userId, username });

    // Hand the caller a token minted against the new epoch so the session that
    // performed the rotation keeps working; all other sessions are now dead.
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role as Role,
        ae: authEpoch,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );

    return { token };
  }
}

// Single instance export (minimalist/no DI)
export const authService = new AuthService();
