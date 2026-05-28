import { type Knex } from 'knex';

/**
 * Migration: Add shift details and payment method to customer transactions,
 * and add split payment details to sales table.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Alter customer_transactions table
  await knex.schema.alterTable('customer_transactions', (table) => {
    table.integer('shift_id').unsigned().nullable()
      .references('id').inTable('cashier_shifts')
      .onDelete('SET NULL');
      
    table.integer('register_id').unsigned().nullable()
      .references('id').inTable('registers')
      .onDelete('SET NULL');

    table.string('payment_method', 20).notNullable().defaultTo('cash');
    
    // Index for quick shift lookups
    table.index(['shift_id'], 'idx_cust_tx_shift_id');
  });

  // 2. Alter sales table to support split cash and card amounts
  await knex.schema.alterTable('sales', (table) => {
    table.decimal('cash_amount', 12, 2).nullable();
    table.decimal('card_amount', 12, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  // 1. Alter sales table to drop split amounts
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('cash_amount');
    table.dropColumn('card_amount');
  });

  // 2. Alter customer_transactions table to drop shift columns
  await knex.schema.alterTable('customer_transactions', (table) => {
    table.dropIndex(['shift_id'], 'idx_cust_tx_shift_id');
    table.dropColumn('shift_id');
    table.dropColumn('register_id');
    table.dropColumn('payment_method');
  });
}
