import { type Knex } from 'knex';

/**
 * Migration: Add Soft Delete Support to Products
 * 
 * Adds a nullable `deleted_at` timestamp with timezone column to the `products` table,
 * along with a performance index to accelerate filtering out deleted items.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['deleted_at'], 'idx_products_deleted_at');
  });
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.dropIndex(['deleted_at'], 'idx_products_deleted_at');
    table.dropColumn('deleted_at');
  });
}
