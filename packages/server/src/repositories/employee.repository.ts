import { db } from '../config/database';
import type { Knex } from 'knex';

export interface Employee {
  id: number;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface EmployeeAuthDetails {
  id: number;
  username: string;
  password_hash: string;
  pin_hash: string | null;
  role: string;
  is_active: boolean;
  deleted_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  failed_pin_attempts: number;
  pin_locked_until: Date | null;
}

export interface CreateEmployeeInput {
  full_name: string;
  username: string;
  password_hash: string;
  pin_hash?: string | null;
  role: string;
  is_active?: boolean;
}

export interface UpdateEmployeeInput {
  full_name?: string;
  username?: string;
  password_hash?: string;
  pin_hash?: string | null;
  role?: string;
  is_active?: boolean;
}

export interface EmployeeFilters {
  page: number;
  limit: number;
  role?: 'admin' | 'manager' | 'cashier';
  is_active?: boolean;
}

export class EmployeeRepository {
  // Select fields that exclude hashes by default
  private readonly defaultSelect = [
    'id',
    'full_name',
    'username',
    'role',
    'is_active',
    'last_login',
    'created_at',
    'updated_at',
    'deleted_at',
  ];

  /**
   * Find employees with pagination and filters. Excludes hashes.
   */
  async findAll(filters: EmployeeFilters): Promise<Employee[]> {
    const query = db('employees').select(this.defaultSelect).whereNull('deleted_at'); // Exclude soft-deleted

    if (filters.role) {
      query.where('role', filters.role);
    }

    if (filters.is_active !== undefined) {
      query.where('is_active', filters.is_active);
    }

    const offset = (filters.page - 1) * filters.limit;
    query.limit(filters.limit).offset(offset);
    query.orderBy('full_name', 'asc');

    return await query;
  }

  /**
   * Count total employees matching filters (ignoring limit/offset).
   */
  async countAll(filters: Omit<EmployeeFilters, 'page' | 'limit'>): Promise<number> {
    const query = db('employees').whereNull('deleted_at').count({ count: 'id' });

    if (filters.role) {
      query.where('role', filters.role);
    }

    if (filters.is_active !== undefined) {
      query.where('is_active', filters.is_active);
    }

    const result = await query.first();
    return Number(result?.count ?? 0);
  }

  /**
   * Find employee by ID. Excludes hashes.
   */
  async findById(id: number): Promise<Employee | null> {
    const row = await db('employees')
      .select(this.defaultSelect)
      .whereNull('deleted_at')
      .where('id', id)
      .first();

    return row || null;
  }

  /**
   * Find employee by username. Excludes hashes.
   */
  async findByUsername(username: string): Promise<Employee | null> {
    const row = await db('employees')
      .select(this.defaultSelect)
      .whereNull('deleted_at')
      .where('username', username)
      .first();

    return row || null;
  }

  /**
   * Retrieve password and pin hashes for authentication validation.
   * Internal database method — NEVER leaked to API controllers.
   */
  async getPasswordAndPinHash(username: string): Promise<EmployeeAuthDetails | null> {
    const row = await db('employees')
      .select(
        'id',
        'username',
        'password_hash',
        'pin_hash',
        'role',
        'is_active',
        'deleted_at',
        'failed_login_attempts',
        'locked_until',
        'failed_pin_attempts',
        'pin_locked_until'
      )
      .where('username', username)
      .first();

    return row || null;
  }

  /**
   * Create a new employee.
   */
  async create(data: CreateEmployeeInput, trx?: Knex.Transaction): Promise<Employee> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    const [row] = await queryBuilder.insert(data).returning(this.defaultSelect);
    return row;
  }

  /**
   * Update employee details.
   */
  async update(id: number, data: UpdateEmployeeInput, trx?: Knex.Transaction): Promise<Employee> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    const [row] = await queryBuilder.where('id', id).update(data).returning(this.defaultSelect);
    return row;
  }

  /**
   * Soft delete employee by setting deleted_at.
   */
  async softDelete(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({
      deleted_at: new Date(),
      is_active: false, // Deactivate on delete
    });
  }

  /**
   * Update last login timestamp.
   */
  async updateLastLogin(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({ last_login: new Date() });
  }

  /**
   * Increment failed login attempts.
   */
  async incrementFailedLoginAttempts(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).increment('failed_login_attempts', 1);
  }

  /**
   * Lock the employee account until the specified time.
   */
  async lockAccount(id: number, until: Date, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({ locked_until: until });
  }

  /**
   * Reset failed login attempts and clear lock.
   */
  async resetFailedLoginAttempts(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({
      failed_login_attempts: 0,
      locked_until: null,
    });
  }

  /**
   * Increment failed PIN attempts.
   */
  async incrementFailedPinAttempts(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).increment('failed_pin_attempts', 1);
  }

  /**
   * Lock the employee PIN until the specified time.
   */
  async lockPin(id: number, until: Date, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({ pin_locked_until: until });
  }

  /**
   * Reset failed PIN attempts and clear lock.
   */
  async resetPinAttempts(id: number, trx?: Knex.Transaction): Promise<void> {
    const queryBuilder = trx ? trx('employees') : db('employees');
    await queryBuilder.where('id', id).update({
      failed_pin_attempts: 0,
      pin_locked_until: null,
    });
  }

  /**
   * Find all active managers and admins. Excludes hashes.
   */
  async findActiveManagers(): Promise<Employee[]> {
    return db('employees')
      .select('id', 'full_name', 'username', 'role')
      .whereIn('role', ['manager', 'admin'])
      .where('is_active', true)
      .whereNull('deleted_at')
      .orderBy('full_name', 'asc');
  }
}

// Single instance export (minimalist/no DI)
export const employeeRepository = new EmployeeRepository();
