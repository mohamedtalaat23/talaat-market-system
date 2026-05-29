import bcrypt from 'bcryptjs';
import { db } from '../config/database';

interface LockoutRecord {
  attempts: number;
  lockedUntil?: number;
}

// In-memory lockout cache: managerId -> lockout details
const failedAttempts = new Map<number, LockoutRecord>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export class PinService {
  /**
   * Securely verifies a manager's PIN with brute-force lockout protection.
   * Lockout triggers after 5 failed attempts, lasting 5 minutes.
   */
  async verifyPin(managerId: number, pin: string): Promise<{ success: boolean; message: string }> {
    const record = failedAttempts.get(managerId);
    const now = Date.now();

    // Check if currently locked out
    if (record && record.lockedUntil && record.lockedUntil > now) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      return {
        success: false,
        message: `Too many failed PIN attempts. Locked out. Please try again in ${remainingMinutes} minute(s).`,
      };
    }

    // Retrieve active manager details from the database
    const employee = await db('employees')
      .where('id', managerId)
      .whereIn('role', ['manager', 'admin'])
      .where('is_active', true)
      .whereNull('deleted_at')
      .first();

    if (!employee || !employee.pin_hash) {
      return {
        success: false,
        message: 'Manager account not found or PIN quick-login is not configured',
      };
    }

    // Verify PIN match using bcrypt
    const isMatch = await bcrypt.compare(String(pin), employee.pin_hash);

    if (!isMatch) {
      const attempts = (record ? record.attempts : 0) + 1;
      
      if (attempts >= MAX_ATTEMPTS) {
        failedAttempts.set(managerId, {
          attempts,
          lockedUntil: now + LOCKOUT_DURATION_MS,
        });
        return {
          success: false,
          message: 'Invalid PIN. Maximum failed attempts reached. You are locked out for 5 minutes.',
        };
      } else {
        failedAttempts.set(managerId, { attempts });
        return {
          success: false,
          message: `Invalid PIN. ${MAX_ATTEMPTS - attempts} attempt(s) remaining before lockout.`,
        };
      }
    }

    // Verification succeeded: reset tracking for this manager
    failedAttempts.delete(managerId);
    return {
      success: true,
      message: 'PIN successfully verified',
    };
  }
}

export const pinService = new PinService();
