import { type Knex } from 'knex';

/**
 * Migration: Create Product Batches & Expiration Tracking Table
 *
 * Adds `product_batches` table to track product batch numbers, manufacturing/expiry dates,
 * and current batch stock quantities to support FEFO (First-Expired-First-Out) picking.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await knex.schema.createTable('product_batches', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('CASCADE');
    table.string('batch_number', 100).notNullable();
    table.date('expiration_date').notNullable();
    table.decimal('quantity', 12, 3).notNullable().defaultTo(0);
    table.decimal('cost_price', 10, 2).nullable();
    table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes for FEFO queries and batch search
    table.index(['product_id'], 'idx_batches_product_id');
    table.index(['expiration_date'], 'idx_batches_expiration_date');
    table.index(['product_id', 'expiration_date'], 'idx_batches_prod_exp');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_batches');
}
