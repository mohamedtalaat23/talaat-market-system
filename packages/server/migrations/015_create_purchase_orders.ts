import { type Knex } from 'knex';

/**
 * Migration: Create Purchase Orders and Purchase Order Line Items
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create sequence for PO numbers
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;');

  // 2. Create purchase_orders table
  await knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary();
    table.string('po_number', 50).notNullable().unique();
    table.integer('supplier_id').unsigned().notNullable()
      .references('id').inTable('suppliers')
      .onDelete('RESTRICT');
    table.string('status', 20).notNullable().defaultTo('draft');
    table.timestamp('order_date', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('delivery_date', { useTz: true }).nullable();
    table.decimal('subtotal', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('discount_amount', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('tax_amount', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('total', 12, 2).notNullable().defaultTo(0.00);
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL');
    table.integer('received_by').unsigned().nullable()
      .references('id').inTable('employees')
      .onDelete('SET NULL');
    table.text('notes').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Performance Indexes
    table.index(['supplier_id'], 'idx_po_supplier_id');
    table.index(['status'], 'idx_po_status');

    // Numeric Check Constraints
    table.check('subtotal >= 0', [], 'po_subtotal_check');
    table.check('discount_amount >= 0', [], 'po_discount_check');
    table.check('tax_amount >= 0', [], 'po_tax_check');
    table.check('total >= 0', [], 'po_total_check');
  });

  // 3. Create purchase_order_items table
  await knex.schema.createTable('purchase_order_items', (table) => {
    table.increments('id').primary();
    table.integer('purchase_order_id').unsigned().notNullable()
      .references('id').inTable('purchase_orders')
      .onDelete('CASCADE');
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('RESTRICT');
    table.decimal('ordered_quantity', 12, 3).notNullable();
    table.decimal('received_quantity', 12, 3).notNullable().defaultTo(0.000);
    table.decimal('unit_cost', 12, 2).notNullable();
    table.decimal('line_total', 12, 2).notNullable();

    // Indexes
    table.index(['purchase_order_id'], 'idx_po_items_po_id');

    // Numeric Check Constraints
    table.check('ordered_quantity > 0', [], 'po_items_ordered_qty_check');
    table.check('received_quantity >= 0', [], 'po_items_received_qty_check');
    table.check('unit_cost >= 0', [], 'po_items_unit_cost_check');
    table.check('line_total >= 0', [], 'po_items_line_total_check');
  });

  // 4. Add updated_at trigger to purchase_orders table
  await knex.raw(`
    CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables and sequence
  await knex.schema.dropTableIfExists('purchase_order_items');
  await knex.schema.dropTableIfExists('purchase_orders');
  await knex.raw('DROP SEQUENCE IF EXISTS purchase_order_number_seq CASCADE;');
}
