import { type Knex } from 'knex';

/**
 * Migration: Add indexes on foreign keys and commonly searched columns
 * to avoid slow sequential table scans in high-frequency queries.
 *
 * 1. Single index on sales(shift_id) for rapid shift balance audits and summaries.
 * 2. Composite index on sales(status, created_at) for date-range reporting.
 * 3. Single index on customer_transactions(shift_id) to balance cashier shift totals.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.index(['shift_id'], 'idx_sales_shift_id');
    table.index(['status', 'created_at'], 'idx_sales_status_created_at');
  });

  await knex.schema.alterTable('customer_transactions', (table) => {
    table.index(['shift_id'], 'idx_customer_transactions_shift_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.dropIndex(['shift_id'], 'idx_sales_shift_id');
    table.dropIndex(['status', 'created_at'], 'idx_sales_status_created_at');
  });

  await knex.schema.alterTable('customer_transactions', (table) => {
    table.dropIndex(['shift_id'], 'idx_customer_transactions_shift_id');
  });
}
