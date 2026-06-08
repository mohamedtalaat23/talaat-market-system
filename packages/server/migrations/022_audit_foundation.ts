import { type Knex } from 'knex';

/**
 * Audit Foundation Migration
 * 
 * 1. Creates a polymorphic `audit_logs` table for tracking security and configuration state changes.
 * 2. Adds PIN lockout tracking columns directly to the `employees` table.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create audit_logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.string('entity_type', 50).notNullable(); // e.g., 'product', 'employee', 'auth'
    table.integer('entity_id').unsigned().nullable(); // ID of the entity mutated
    table.string('action', 100).notNullable(); // e.g., 'price_change', 'pin_lockout'
    table.jsonb('old_value').nullable(); // JSON representing the previous state
    table.jsonb('new_value').nullable(); // JSON representing the new state
    table.integer('user_id').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL'); // Nullable for system-generated events or pre-auth actions
    table.string('ip_address', 45).nullable(); // IPv4 or IPv6 string
    table.text('reason').nullable(); // Optional reason provided for the change
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Create indexes for efficient querying of audit logs
  await knex.schema.alterTable('audit_logs', (table) => {
    table.index(['entity_type', 'entity_id'], 'idx_audit_logs_entity');
    table.index(['action'], 'idx_audit_logs_action');
    table.index(['user_id'], 'idx_audit_logs_user_id');
    table.index(['created_at'], 'idx_audit_logs_created_at');
  });

  // 2. Alter employees table for persistent PIN lockouts
  await knex.schema.alterTable('employees', (table) => {
    table.integer('failed_pin_attempts').notNullable().defaultTo(0);
    table.timestamp('pin_locked_until', { useTz: true }).nullable();
  });
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  // Drop PIN lockout columns from employees
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('failed_pin_attempts');
    table.dropColumn('pin_locked_until');
  });

  // Drop audit_logs table
  await knex.schema.dropTableIfExists('audit_logs');
}
