import { type Knex } from 'knex';

/**
 * Migration: Add Soft Delete Support to Employees
 * 
 * Adds a nullable `deleted_at` timestamp with timezone column to the `employees` table,
 * along with a performance index to accelerate filtering out deleted employees.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['deleted_at'], 'idx_employees_deleted_at');
  });
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.dropIndex(['deleted_at'], 'idx_employees_deleted_at');
    table.dropColumn('deleted_at');
  });
}
