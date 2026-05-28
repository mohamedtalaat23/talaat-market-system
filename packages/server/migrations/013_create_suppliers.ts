import { type Knex } from 'knex';

/**
 * Migration: Create Suppliers table and link to Products
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create suppliers table
  await knex.schema.createTable('suppliers', (table) => {
    table.increments('id').primary();
    table.string('supplier_code', 30).notNullable().unique();
    table.string('name', 150).notNullable();
    table.string('contact_name', 150).nullable();
    table.string('phone', 20).nullable();
    table.string('email', 100).nullable();
    table.text('address').nullable();
    table.text('notes').nullable();
    table.string('status', 30).notNullable().defaultTo('active'); // active, inactive, suspended
    
    // Audit preparation fields
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL');

    // Timestamps
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Indexes
    table.index(['phone'], 'idx_suppliers_phone');
    table.index(['deleted_at'], 'idx_suppliers_deleted_at');
    table.index(['supplier_code'], 'idx_suppliers_supplier_code');
  });

  // 2. Alter products table to link to supplier_id
  await knex.schema.alterTable('products', (table) => {
    table.integer('supplier_id').unsigned().nullable()
      .references('id').inTable('suppliers')
      .onDelete('SET NULL');

    table.index(['supplier_id'], 'idx_products_supplier_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // 1. Alter products table to drop supplier_id and index
  await knex.schema.alterTable('products', (table) => {
    table.dropIndex(['supplier_id'], 'idx_products_supplier_id');
    table.dropColumn('supplier_id');
  });

  // 2. Drop suppliers table
  await knex.schema.dropTableIfExists('suppliers');
}
