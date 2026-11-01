import { employeeService } from '../employee.service';
import { employeeRepository } from '../../repositories/employee.repository';
import { auditService } from '../audit.service';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';

jest.mock('../../repositories/employee.repository');
jest.mock('bcryptjs');
jest.mock('../../middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
// `updateEmployee` wraps the write in `db.transaction` and records an audit event,
// so both must be stubbed — otherwise the unit test would need a live PostgreSQL.
jest.mock('../../config/database', () => ({
  db: {
    transaction: jest.fn(async (callback: (trx: unknown) => unknown) => callback(jest.fn())),
  },
}));
jest.mock('../audit.service', () => ({
  auditService: { logEvent: jest.fn().mockResolvedValue(undefined) },
}));

describe('EmployeeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (employeeRepository.findAllWithPinHashes as jest.Mock).mockResolvedValue([]);
  });

  describe('getEmployees', () => {
    it('should return paginated employees', async () => {
      const mockItems = [{ id: 1, full_name: 'John Doe' }];
      (employeeRepository.findAll as jest.Mock).mockResolvedValue(mockItems);
      (employeeRepository.countAll as jest.Mock).mockResolvedValue(1);

      const result = await employeeService.getEmployees({ page: 1, limit: 10 });
      expect(result.items).toEqual(mockItems);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('getEmployeeById', () => {
    it('should throw NotFoundError if employee does not exist', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(employeeService.getEmployeeById(999)).rejects.toThrow(NotFoundError);
    });

    it('should return employee if found', async () => {
      const mockEmployee = { id: 1, full_name: 'John Doe' };
      (employeeRepository.findById as jest.Mock).mockResolvedValue(mockEmployee);

      const result = await employeeService.getEmployeeById(1);
      expect(result).toEqual(mockEmployee);
    });
  });

  describe('createEmployee', () => {
    it('should throw ConflictError if username is taken', async () => {
      (employeeRepository.findByUsername as jest.Mock).mockResolvedValue({
        id: 2,
        username: 'taken',
      });

      await expect(
        employeeService.createEmployee({
          username: 'taken',
          password: 'password',
          role: 'cashier',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should successfully create employee and hash password/pin', async () => {
      (employeeRepository.findByUsername as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('hashed_pin')
        .mockResolvedValueOnce('hashed_pass');
      const mockCreated = { id: 1, username: 'newuser' };
      (employeeRepository.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await employeeService.createEmployee({
        full_name: 'New User',
        username: 'newuser',
        password: 'password',
        pin: '1234',
        role: 'cashier',
      });

      expect(bcrypt.hash).toHaveBeenNthCalledWith(1, '1234', 12);
      expect(bcrypt.hash).toHaveBeenNthCalledWith(2, 'password', 12);
      expect(employeeRepository.create).toHaveBeenCalledWith({
        full_name: 'New User',
        username: 'newuser',
        password_hash: 'hashed_pass',
        pin_hash: 'hashed_pin',
        role: 'cashier',
        is_active: true,
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateEmployee', () => {
    it('should throw NotFoundError if employee does not exist', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(employeeService.updateEmployee(999, { full_name: 'New Name' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ConflictError if updating username to an already existing username', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({ id: 1, username: 'user1' });
      (employeeRepository.findByUsername as jest.Mock).mockResolvedValue({
        id: 2,
        username: 'taken',
      });

      await expect(employeeService.updateEmployee(1, { username: 'taken' })).rejects.toThrow(
        ConflictError,
      );
    });

    it('should update employee and hash password/pin if modified', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({ id: 1, username: 'user1' });
      (bcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('hashed_pass')
        .mockResolvedValueOnce('hashed_pin');
      const mockUpdated = { id: 1, username: 'user1' };
      (employeeRepository.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await employeeService.updateEmployee(1, {
        password: 'newpassword',
        pin: '4321',
      });

      expect(bcrypt.hash).toHaveBeenNthCalledWith(1, 'newpassword', 12);
      expect(bcrypt.hash).toHaveBeenNthCalledWith(2, '4321', 12);
      expect(employeeRepository.update).toHaveBeenCalledWith(
        1,
        {
          password_hash: 'hashed_pass',
          pin_hash: 'hashed_pin',
        },
        expect.any(Function),
      );
      expect(result).toEqual(mockUpdated);
    });

    it('records an audit event when the role changes', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user1',
        role: 'cashier',
        is_active: true,
      });
      (employeeRepository.update as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user1',
        role: 'manager',
      });

      await employeeService.updateEmployee(
        1,
        { role: 'manager' },
        'admin',
        42,
        '127.0.0.1',
        'promotion',
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'employee',
          entityId: 1,
          action: 'permissions_change',
          oldValue: { role: 'cashier' },
          newValue: { role: 'manager' },
          userId: 42,
          ipAddress: '127.0.0.1',
          reason: 'promotion',
        }),
      );
    });

    it('does not write an audit event when no audited field changes', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'user1',
        role: 'cashier',
        is_active: true,
      });
      (employeeRepository.update as jest.Mock).mockResolvedValue({ id: 1, username: 'user1' });

      await employeeService.updateEmployee(1, { full_name: 'Renamed' }, 'admin', 42);

      expect(auditService.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('deleteEmployee', () => {
    it('should throw NotFoundError if employee does not exist', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(employeeService.deleteEmployee(999)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if trying to delete the last active admin', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: 'admin' });
      (employeeRepository.countAll as jest.Mock).mockResolvedValue(1);

      await expect(employeeService.deleteEmployee(1)).rejects.toThrow(ConflictError);
      expect(employeeRepository.countAll).toHaveBeenCalledWith({ role: 'admin', is_active: true });
    });

    it('should successfully delete non-admin or if there are other admins', async () => {
      (employeeRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: 'admin' });
      (employeeRepository.countAll as jest.Mock).mockResolvedValue(2);

      await employeeService.deleteEmployee(1);
      expect(employeeRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });
});
