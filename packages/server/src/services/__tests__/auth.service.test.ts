import { authService } from '../auth.service';
import { employeeRepository } from '../../repositories/employee.repository';
import { AuthenticationError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('../../repositories/employee.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw AuthenticationError if username not found', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(null);

      await expect(authService.login('wronguser', 'pass')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if user is inactive', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: false,
        deleted_at: null,
      });

      await expect(authService.login('user', 'pass')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on incorrect password and increment attempts', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 0,
        locked_until: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('user', 'wrongpass')).rejects.toThrow(AuthenticationError);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpass', 'hash');
      expect(employeeRepository.incrementFailedLoginAttempts).toHaveBeenCalledWith(1);
    });

    it('should lock account on max failed attempts', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 4, // 4 + 1 = 5 (max)
        locked_until: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('user', 'wrongpass')).rejects.toThrow(
        /Account locked due to too many failed attempts/,
      );
      expect(employeeRepository.lockAccount).toHaveBeenCalledWith(1, expect.any(Date));
    });

    it('should reject login if account is locked', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 600000), // Locked for 10 more minutes
      });

      await expect(authService.login('user', 'pass')).rejects.toThrow(/Account is locked/);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should login successfully with correct password', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user',
        role: 'cashier',
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 2, // Has previous failed attempts
        locked_until: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mocked_token');
      (employeeRepository.findById as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user',
        role: 'cashier',
        full_name: 'Test User',
      });

      const result = await authService.login('user', 'pass');

      expect(result.token).toBe('mocked_token');
      expect(result.employee.username).toBe('user');
      expect(result.employee.must_change_password).toBe(false);
      expect(employeeRepository.updateLastLogin).toHaveBeenCalledWith(1);
      expect(employeeRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(1);
    });

    it('exposes must_change_password when the account is flagged for rotation', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 2,
        username: 'admin',
        role: 'admin',
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 0,
        locked_until: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mocked_token');
      (employeeRepository.findById as jest.Mock).mockResolvedValue({
        id: 2,
        username: 'admin',
        role: 'admin',
        full_name: 'System Administrator',
        must_change_password: true,
      });

      const result = await authService.login('admin', 'pass');

      expect(result.employee.must_change_password).toBe(true);
    });
  });

  describe('changePassword', () => {
    const baseUser = {
      id: 5,
      username: 'user',
      role: 'cashier',
      is_active: true,
      deleted_at: null,
      password_hash: 'old-hash',
      failed_login_attempts: 0,
      locked_until: null,
      must_change_password: true,
    };

    it('rejects when the current password is incorrect', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.changePassword(5, 'user', 'wrong-password', 'BrandNewPassword456'),
      ).rejects.toThrow(AuthenticationError);
      expect(employeeRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a new password shorter than the policy minimum', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.changePassword(5, 'user', 'old', 'short')).rejects.toThrow(
        /at least 12 characters/,
      );
      expect(employeeRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a known weak or placeholder password', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        authService.changePassword(5, 'user', 'old', 'changeme-please-now'),
      ).rejects.toThrow(/too common/);
      expect(employeeRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        authService.changePassword(5, 'user', 'Zx9Qw7Er5Ty2Ui4O', 'Zx9Qw7Er5Ty2Ui4O'),
      ).rejects.toThrow(/must be different/);
      expect(employeeRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('stores a new hash and clears the rotation flag', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(false); // new password differs
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      await authService.changePassword(5, 'user', 'CurrentPassword123', 'BrandNewPassword456');

      expect(bcrypt.hash).toHaveBeenCalledWith('BrandNewPassword456', expect.any(Number));
      expect(employeeRepository.updatePassword).toHaveBeenCalledWith(5, 'new-hash');
    });
  });
});
