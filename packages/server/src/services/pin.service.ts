import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { employeeRepository } from '../repositories/employee.repository';
import { auditService } from './audit.service';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export class PinService {
  /**
   * Securely verifies a manager's PIN with brute-force lockout protection via the DB.
   * Lockout triggers after 5 failed attempts, lasting 5 minutes.
   */
  async verifyPin(
    managerId: number,
    pin: string,
    requestingUserId?: number,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string }> {
    // I should get the employee by ID directly.
    const row = await db('employees')
      .select('id', 'pin_hash', 'role', 'is_active', 'deleted_at', 'failed_pin_attempts', 'pin_locked_until')
      .where('id', managerId)
      .whereIn('role', ['manager', 'admin'])
      .where('is_active', true)
      .whereNull('deleted_at')
      .first();

    if (!row || !row.pin_hash) {
      return {
        success: false,
        message: 'Manager account not found or PIN quick-login is not configured',
      };
    }

    const now = new Date();

    // Check if currently locked out
    if (row.pin_locked_until && row.pin_locked_until > now) {
      const remainingMinutes = Math.ceil((row.pin_locked_until.getTime() - now.getTime()) / 60000);
      return {
        success: false,
        message: `Too many failed PIN attempts. Locked out. Please try again in ${remainingMinutes} minute(s).`,
      };
    }

    // Verify PIN match using bcrypt
    const isMatch = await bcrypt.compare(String(pin), row.pin_hash);

    if (!isMatch) {
      const attempts = row.failed_pin_attempts + 1;

      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
        await employeeRepository.lockPin(managerId, lockedUntil);
        await employeeRepository.incrementFailedPinAttempts(managerId);

        await auditService.logEvent({
          entityType: 'employee',
          entityId: managerId,
          action: 'pin_lockout',
          newValue: { locked_until: lockedUntil },
          userId: requestingUserId || managerId,
          ipAddress: ipAddress,
          reason: 'Maximum failed PIN attempts reached',
        });

        return {
          success: false,
          message: 'Invalid PIN. Maximum failed attempts reached. You are locked out for 5 minutes.',
        };
      } else {
        await employeeRepository.incrementFailedPinAttempts(managerId);
        return {
          success: false,
          message: `Invalid PIN. ${MAX_ATTEMPTS - attempts} attempt(s) remaining before lockout.`,
        };
      }
    }

    // Verification succeeded: reset tracking if there were failed attempts
    if (row.failed_pin_attempts > 0 || row.pin_locked_until) {
      await employeeRepository.resetPinAttempts(managerId);

      await auditService.logEvent({
        entityType: 'employee',
        entityId: managerId,
        action: 'pin_unlock',
        userId: requestingUserId || managerId,
        ipAddress: ipAddress,
        reason: 'Successful PIN entry, resetting previous attempts/lockout',
      });
    }

    return {
      success: true,
      message: 'PIN successfully verified',
    };
  }
}

export const pinService = new PinService();
