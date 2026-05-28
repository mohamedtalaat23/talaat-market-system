import { employeeRepository, type Employee, type EmployeeFilters } from '../repositories/employee.repository';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config/constants';

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

    // 2. Hash password and PIN (if provided) using cost factor 12
    const password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    let pin_hash: string | null = null;
    if (data.pin) {
      pin_hash = await bcrypt.hash(data.pin, BCRYPT_ROUNDS);
    }

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
  async updateEmployee(id: number, data: any): Promise<Employee> {
    logger.info('Updating employee details', { id });

    // Ensure employee exists
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Employee', id);
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

    // Hash PIN if modified
    if (data.pin) {
      updates.pin_hash = await bcrypt.hash(data.pin, BCRYPT_ROUNDS);
      delete updates.pin;
    } else if (data.pin === null) {
      updates.pin_hash = null;
      delete updates.pin;
    }

    const updated = await employeeRepository.update(id, updates);
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
}

// Single instance export (minimalist/no DI)
export const employeeService = new EmployeeService();
