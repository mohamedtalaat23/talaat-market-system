import { type Knex } from 'knex';

/**
 * Migration: Create Customers and Customer Transactions tables, and alter Sales table
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create customers table
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('phone', 20).nullable().unique();
    table.string('email', 100).nullable();
    table.text('address').nullable();
    table.decimal('balance', 12, 2).notNullable().defaultTo(0.00);
    table.integer('loyalty_points').notNullable().defaultTo(0);
    table.text('notes').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Indexes
    table.index(['phone'], 'idx_customers_phone');
    table.index(['deleted_at'], 'idx_customers_deleted_at');
  });

  // 2. Create customer_transactions table (Ledger)
  await knex.schema.createTable('customer_transactions', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned().notNullable()
      .references('id').inTable('customers')
      .onDelete('CASCADE');
    table.string('transaction_type', 20).notNullable(); // sale, payment, adjustment
    table.decimal('amount', 12, 2).notNullable(); // Signed amount (+ for payment/credits, - for credit purchase/debts)
    table.string('reference_id', 100).nullable(); // Sale receipt number, etc.
    table.text('notes').nullable();
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['customer_id'], 'idx_cust_tx_customer_id');
    table.index(['created_at'], 'idx_cust_tx_created_at');
  });

  // 3. Alter sales table to reference customer_id
  await knex.schema.alterTable('sales', (table) => {
    table.integer('customer_id').unsigned().nullable()
      .references('id').inTable('customers')
      .onDelete('SET NULL');
    
    table.index(['customer_id'], 'idx_sales_customer_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // 1. Alter sales table to drop column customer_id
  await knex.schema.alterTable('sales', (table) => {
    table.dropIndex(['customer_id'], 'idx_sales_customer_id');
    table.dropColumn('customer_id');
  });

  // 2. Drop customer_transactions table
  await knex.schema.dropTableIfExists('customer_transactions');

  // 3. Drop customers table
  await knex.schema.dropTableIfExists('customers');
}
