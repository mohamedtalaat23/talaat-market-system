import { db } from '../config/database';
import {
  employeeRepository,
  type Employee,
  type EmployeeFilters,
} from '../repositories/employee.repository';
import { NotFoundError, ConflictError, AuthorizationError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config/constants';
import { auditService } from './audit.service';

export interface PaginatedEmployees {
  items: Employee[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class EmployeeService {
  /**
   * Fetch list of employees with filters and paging.
   */
  async getEmployees(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    logger.debug('Fetching employee list with filters', { filters });

    const [items, total] = await Promise.all([
      employeeRepository.findAll(filters),
      employeeRepository.countAll(filters),
    ]);

    return {
      items,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  /**
   * Fetch employee by ID.
   */
  async getEmployeeById(id: number): Promise<Employee> {
    logger.debug('Fetching employee by ID', { id });
    const employee = await employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundError('Employee', id);
    }
    return employee;
  }

  /**
   * Create a new employee with hashed credentials.
   */
  async createEmployee(data: any): Promise<Employee> {
    logger.info('Creating new employee account', { username: data.username, role: data.role });

    // 1. Prevent duplicate usernames
    const existing = await employeeRepository.findByUsername(data.username);
    if (existing) {
      throw new ConflictError('Username is already taken');
    }

    // 2. Hash PIN if provided, and ensure it is unique across active employees
    let pin_hash: string | null = null;
    if (data.pin) {
      const activeEmployees = await employeeRepository.findAllWithPinHashes();
      for (const emp of activeEmployees) {
        if (emp.pin_hash && await bcrypt.compare(data.pin, emp.pin_hash)) {
          throw new ConflictError('PIN is already in use by another active employee');
        }
      }
      pin_hash = await bcrypt.hash(data.pin, BCRYPT_ROUNDS);
    }

    // 3. Hash password
    const password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // 3. Insert into repository
    const employee = await employeeRepository.create({
      full_name: data.full_name,
      username: data.username,
      password_hash,
      pin_hash,
      role: data.role,
      is_active: data.is_active ?? true,
    });

    logger.info('Employee account created successfully', { id: employee.id });
    return employee;
  }

  /**
   * Update employee details (hashes password/PIN if changed).
   */
  async updateEmployee(
    id: number,
    data: any,
    currentUserRole?: string,
    currentUserId?: number,
    ipAddress?: string,
    reason?: string
  ): Promise<Employee> {
    logger.info('Updating employee details', { id });

    // Ensure employee exists
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Employee', id);
    }

    if (existing.role === 'admin' && currentUserRole !== 'admin') {
      throw new AuthorizationError('You do not have permission to modify an administrator account');
    }

    // Check username uniqueness if changed
    if (data.username && data.username !== existing.username) {
      const duplicate = await employeeRepository.findByUsername(data.username);
      if (duplicate) {
        throw new ConflictError('Username is already taken');
      }
    }

    const updates: any = { ...data };

    // Hash password if modified
    if (data.password) {
      updates.password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
      delete updates.password;
    }

    // Hash PIN if modified, and ensure it is unique
    if (data.pin) {
      const activeEmployees = await employeeRepository.findAllWithPinHashes();
      for (const emp of activeEmployees) {
        if (emp.id !== id && emp.pin_hash && await bcrypt.compare(data.pin, emp.pin_hash)) {
          throw new ConflictError('PIN is already in use by another active employee');
        }
      }
      updates.pin_hash = await bcrypt.hash(data.pin, BCRYPT_ROUNDS);
      delete updates.pin;
    } else if (data.pin === null) {
      updates.pin_hash = null;
      delete updates.pin;
    }

    const updated = await db.transaction(async (trx) => {
      const updatedRow = await employeeRepository.update(id, updates, trx);

      // Audit role and status changes
      const oldValues: any = {};
      const newValues: any = {};
      const auditedFields = ['role', 'is_active'];

      for (const field of auditedFields) {
        if (data[field] !== undefined && data[field] !== (existing as any)[field]) {
          oldValues[field] = (existing as any)[field];
          newValues[field] = data[field];
        }
      }

      if (Object.keys(newValues).length > 0) {
        await auditService.logEvent({
          entityType: 'employee',
          entityId: id,
          action: 'permissions_change',
          oldValue: oldValues,
          newValue: newValues,
          userId: currentUserId,
          ipAddress: ipAddress,
          reason: reason || 'Employee permissions/status updated',
          trx,
        });
      }
      
      return updatedRow;
    });

    logger.info('Employee account updated successfully', { id });
    return updated;
  }

  /**
   * Soft-delete employee.
   */
  async deleteEmployee(id: number): Promise<void> {
    logger.info('Soft deleting employee account', { id });

    // Ensure employee exists
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Employee', id);
    }

    // Prevent deleting the last admin
    if (existing.role === 'admin') {
      const totalAdmins = await employeeRepository.countAll({ role: 'admin', is_active: true });
      if (totalAdmins <= 1) {
        throw new ConflictError('Cannot delete the last active administrator account');
      }
    }

    await employeeRepository.softDelete(id);
    logger.info('Employee account soft deleted successfully', { id });
  }

  /**
   * Get all active managers/admins.
   */
  async getActiveManagers(): Promise<Employee[]> {
    logger.debug('Fetching list of active managers/admins');
    return employeeRepository.findActiveManagers();
  }
}

// Single instance export (minimalist/no DI)
export const employeeService = new EmployeeService();
