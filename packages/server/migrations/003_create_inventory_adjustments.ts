import { type Knex } from 'knex';

/**
 * Migration: Create Inventory Adjustments History Table
 * 
 * Creates the `inventory_adjustments` table to track all changes in stock levels.
 * Stores relative changes, previous stock, new stock, and reasons.
 * History remains immutable (no update/delete operations).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('inventory_adjustments', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('CASCADE'); // Delete log if product is deleted
    table.string('adjustment_type', 30).notNullable(); // stock_addition, stock_removal, damaged, expired, manual_correction
    table.decimal('quantity_change', 12, 3).notNullable();
    table.decimal('old_quantity', 12, 3).notNullable();
    table.decimal('new_quantity', 12, 3).notNullable();
    table.text('notes').nullable();
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL'); // Set employee link to null if employee is deleted
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Performance Indexes
    table.index(['product_id'], 'idx_adjustments_product_id');
    table.index(['created_at'], 'idx_adjustments_created_at');
  });
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('inventory_adjustments');
}
