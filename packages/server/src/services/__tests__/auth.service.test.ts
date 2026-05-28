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

    it('should throw AuthenticationError on incorrect password', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('user', 'wrongpass')).rejects.toThrow(AuthenticationError);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpass', 'hash');
    });

    it('should login successfully with correct password', async () => {
      (employeeRepository.getPasswordAndPinHash as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user',
        role: 'cashier',
        is_active: true,
        deleted_at: null,
        password_hash: 'hash',
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
    });
  });
});
