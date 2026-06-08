import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Alter sales and sale_items to track aggregated refunds
  await knex.schema.alterTable('sales', (table) => {
    table.decimal('refunded_amount', 12, 2).notNullable().defaultTo(0.00);
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.decimal('refunded_quantity', 12, 3).notNullable().defaultTo(0.000);
  });

  // 2. Add database constraint for partial refunds (sale_items_refunded_quantity_check)
  await knex.raw(`
    ALTER TABLE sale_items
    ADD CONSTRAINT sale_items_refunded_quantity_check
    CHECK (refunded_quantity <= quantity);
  `);

  // 3. Create a PostgreSQL sequence for refund receipt numbers
  await knex.raw(`
    CREATE SEQUENCE IF NOT EXISTS refund_receipt_number_seq START 1;
  `);

  // 4. Create refunds table
  await knex.schema.createTable('refunds', (table) => {
    table.increments('id').primary();
    table.uuid('sale_id').notNullable()
      .references('id').inTable('sales')
      .onDelete('RESTRICT'); // Don't allow sale deletion if refunds exist
    table.string('refund_receipt_number', 50).notNullable().unique();
    table.integer('manager_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.integer('shift_id').unsigned().nullable()
      .references('id').inTable('cashier_shifts')
      .onDelete('RESTRICT');
    table.string('refund_type', 20).notNullable(); // full, partial, void
    table.decimal('original_sale_total', 12, 2).notNullable();
    table.decimal('total_refunded', 12, 2).notNullable();
    table.decimal('cash_refunded', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('debt_reversed', 12, 2).notNullable().defaultTo(0.00);
    table.text('reason').notNullable();
    table.string('status', 20).notNullable().defaultTo('completed'); // pending, completed, failed
    table.timestamps(true, true);

    // Numeric check constraints
    table.check('total_refunded >= 0', [], 'refunds_total_refunded_check');
    table.check('cash_refunded >= 0', [], 'refunds_cash_refunded_check');
    table.check('debt_reversed >= 0', [], 'refunds_debt_reversed_check');
  });

  // 5. Create refund_items table
  await knex.schema.createTable('refund_items', (table) => {
    table.increments('id').primary();
    table.integer('refund_id').unsigned().notNullable()
      .references('id').inTable('refunds')
      .onDelete('CASCADE');
    table.uuid('sale_item_id').notNullable()
      .references('id').inTable('sale_items')
      .onDelete('RESTRICT');
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('RESTRICT');
    table.decimal('quantity_refunded', 12, 3).notNullable();
    table.decimal('refund_amount', 12, 2).notNullable();
    table.boolean('restock_inventory').notNullable().defaultTo(true);
    table.timestamps(true, true);

    // Checks
    table.check('quantity_refunded > 0', [], 'refund_items_quantity_check');
    table.check('refund_amount >= 0', [], 'refund_items_amount_check');
  });

  // 6. Add updated_at triggers
  const tablesWithUpdatedAt = ['refunds', 'refund_items'];
  for (const tableName of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  // 7. Add indexes
  await knex.schema.alterTable('refunds', (table) => {
    table.index(['sale_id'], 'idx_refunds_sale_id');
    table.index(['manager_id'], 'idx_refunds_manager_id');
  });

  await knex.schema.alterTable('refund_items', (table) => {
    table.index(['refund_id'], 'idx_refund_items_refund_id');
    table.index(['sale_item_id'], 'idx_refund_items_sale_item_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers
  await knex.raw(`DROP TRIGGER IF EXISTS update_refund_items_updated_at ON refund_items;`);
  await knex.raw(`DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;`);

  // Drop tables
  await knex.schema.dropTableIfExists('refund_items');
  await knex.schema.dropTableIfExists('refunds');

  await knex.raw(`DROP SEQUENCE IF EXISTS refund_receipt_number_seq;`);

  // Drop constraint on sale_items
  await knex.raw(`
    ALTER TABLE sale_items
    DROP CONSTRAINT IF EXISTS sale_items_refunded_quantity_check;
  `);

  // Drop columns from sales and sale_items
  await knex.schema.alterTable('sale_items', (table) => {
    table.dropColumn('refunded_quantity');
  });

  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('refunded_amount');
  });
}
