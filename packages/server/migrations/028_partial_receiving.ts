import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Alter purchase_order_items to include shortage tracking
  await knex.schema.alterTable('purchase_order_items', (table) => {
    table.decimal('shortage_quantity', 12, 3).notNullable().defaultTo(0.000);
    table.string('shortage_reason', 50).nullable();
    
    // Add check constraint for shortage quantity
    table.check('shortage_quantity >= 0', [], 'po_items_shortage_qty_check');
  });

  // 2. Create purchase_order_receipts table
  await knex.schema.createTable('purchase_order_receipts', (table) => {
    table.increments('id').primary();
    table.integer('purchase_order_id').unsigned().notNullable()
      .references('id').inTable('purchase_orders')
      .onDelete('CASCADE');
    table.string('receipt_number', 50).notNullable().unique();
    table.string('status', 20).notNullable().defaultTo('posted'); // draft, posted, voided
    table.integer('received_by').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.text('notes').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['purchase_order_id'], 'idx_po_receipts_po_id');
  });

  // 3. Create purchase_order_receipt_items table
  await knex.schema.createTable('purchase_order_receipt_items', (table) => {
    table.increments('id').primary();
    table.integer('receipt_id').unsigned().notNullable()
      .references('id').inTable('purchase_order_receipts')
      .onDelete('CASCADE');
    table.integer('po_item_id').unsigned().notNullable()
      .references('id').inTable('purchase_order_items')
      .onDelete('CASCADE');
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('RESTRICT');
    table.decimal('quantity_received', 12, 3).notNullable();
    table.decimal('unit_cost', 12, 2).notNullable();
    
    table.check('quantity_received > 0', [], 'pori_qty_check');
    table.check('unit_cost >= 0', [], 'pori_cost_check');
    
    table.index(['receipt_id'], 'idx_pori_receipt_id');
  });

  // 4. Add updated_at trigger for receipts
  await knex.raw(`
    CREATE TRIGGER update_po_receipts_updated_at
    BEFORE UPDATE ON purchase_order_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('purchase_order_receipt_items');
  await knex.schema.dropTableIfExists('purchase_order_receipts');
  
  await knex.schema.alterTable('purchase_order_items', (table) => {
    table.dropColumn('shortage_quantity');
    table.dropColumn('shortage_reason');
  });
}
