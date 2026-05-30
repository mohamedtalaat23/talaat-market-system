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
    error: jest.fn()
  }
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
        locked_until: null
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
        locked_until: null
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('user', 'wrongpass')).rejects.toThrow(/Account locked due to too many failed attempts/);
      expect(employeeRepository.lockAccount).toHaveBeenCalledWith(1, expect.any(Date));
    });

    it('should reject login if account is locked', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 600000) // Locked for 10 more minutes
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
        locked_until: null
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
      expect(employeeRepository.updateLastLogin).toHaveBeenCalledWith(1);
      expect(employeeRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(1);
    });
  });
});
