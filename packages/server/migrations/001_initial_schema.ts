import { type Knex } from 'knex';

/**
 * Initial Schema Migration
 * 
 * Sets up the core tables for the Talaat Market System.
 * Uses PostgreSQL-specific features:
 * 1. PL/pgSQL Function & Triggers: Automatically manages `updated_at` timestamps.
 * 2. GIN Index (pg_trgm): Accelerates fuzzy and partial matching on product names.
 * 3. CHECK Constraints: Enforces data integrity at the database layer (e.g. non-negative inventory).
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create helper function for automatically updating updated_at columns
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // 2. Create categories table
  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('name_ar', 100).nullable();
    table.integer('parent_id').unsigned().nullable()
      .references('id').inTable('categories')
      .onDelete('SET NULL');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true); // Adds created_at and updated_at with timezone
  });

  // 3. Create products table
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('barcode', 50).nullable().unique(); // Nullable allows non-barcoded items (e.g. loose produce)
    table.string('name', 255).notNullable();
    table.string('name_ar', 255).nullable();
    table.text('description').nullable();
    table.integer('category_id').unsigned().nullable()
      .references('id').inTable('categories')
      .onDelete('RESTRICT'); // Don't allow category deletion if products exist
    table.string('unit', 50).notNullable().defaultTo('pcs'); // pcs, kg, pack, etc.
    table.decimal('cost_price', 12, 2).notNullable();
    table.decimal('selling_price', 12, 2).notNullable();
    table.decimal('min_stock_level', 12, 3).notNullable().defaultTo(0.000);
    table.decimal('max_stock_level', 12, 3).notNullable().defaultTo(0.000);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    // Numeric check constraints
    table.check('cost_price >= 0', [], 'products_cost_price_check');
    table.check('selling_price >= 0', [], 'products_selling_price_check');
    table.check('min_stock_level >= 0', [], 'products_min_stock_level_check');
    table.check('max_stock_level >= 0', [], 'products_max_stock_level_check');
  });

  // 4. Create inventory table
  await knex.schema.createTable('inventory', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().notNullable().unique()
      .references('id').inTable('products')
      .onDelete('CASCADE'); // Delete inventory if product is deleted
    table.decimal('quantity', 12, 3).notNullable().defaultTo(0.000);
    table.decimal('reserved_quantity', 12, 3).notNullable().defaultTo(0.000); // For items in active carts
    table.timestamp('last_counted_at', { useTz: true }).nullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Constraints to prevent negative inventory values
    table.check('quantity >= 0', [], 'inventory_quantity_check');
    table.check('reserved_quantity >= 0', [], 'inventory_reserved_quantity_check');
  });

  // 5. Create employees table
  await knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.string('full_name', 150).notNullable();
    table.string('username', 50).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('pin_hash', 255).nullable(); // Quick unlock PIN
    table.string('role', 20).notNullable(); // admin, manager, cashier
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login', { useTz: true }).nullable();
    table.timestamps(true, true);
  });

  // 6. Create sales table
  await knex.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('receipt_number', 50).notNullable().unique();
    table.integer('cashier_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT'); // Cashier cannot be deleted if they processed sales
    table.string('payment_method', 20).notNullable(); // cash, card, split
    table.decimal('subtotal', 12, 2).notNullable();
    table.decimal('discount_amount', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('tax_amount', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('total', 12, 2).notNullable();
    table.decimal('cash_received', 12, 2).nullable();
    table.decimal('change_given', 12, 2).nullable();
    table.string('status', 20).notNullable().defaultTo('completed'); // completed, refunded, voided
    table.text('notes').nullable();
    table.timestamps(true, true);

    // Checks
    table.check('subtotal >= 0', [], 'sales_subtotal_check');
    table.check('discount_amount >= 0', [], 'sales_discount_check');
    table.check('tax_amount >= 0', [], 'sales_tax_check');
    table.check('total >= 0', [], 'sales_total_check');
  });

  // 7. Create sale_items table
  await knex.schema.createTable('sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').unsigned().notNullable()
      .references('id').inTable('sales')
      .onDelete('CASCADE'); // Delete line items if sale is deleted
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products')
      .onDelete('RESTRICT'); // Prevent product deletion if sales history exists
    table.decimal('quantity', 12, 3).notNullable();
    table.decimal('unit_price', 12, 2).notNullable();
    table.decimal('discount', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('line_total', 12, 2).notNullable();
    table.decimal('cost_at_sale', 12, 2).notNullable(); // cost price at time of sale for profit reports
    table.timestamps(true, true);

    // Checks
    table.check('quantity > 0', [], 'sale_items_quantity_check');
    table.check('unit_price >= 0', [], 'sale_items_unit_price_check');
    table.check('discount >= 0', [], 'sale_items_discount_check');
    table.check('line_total >= 0', [], 'sale_items_line_total_check');
    table.check('cost_at_sale >= 0', [], 'sale_items_cost_at_sale_check');
  });

  // 8. Create database triggers to auto-update updated_at on row changes
  const tablesWithUpdatedAt = ['categories', 'products', 'inventory', 'employees', 'sales', 'sale_items'];
  for (const tableName of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  // 9. Add indexes for performance optimization
  await knex.schema.alterTable('categories', (table) => {
    table.index(['parent_id'], 'idx_categories_parent_id');
  });

  await knex.schema.alterTable('products', (table) => {
    table.index(['category_id'], 'idx_products_category_id');
  });

  // Try creating pg_trgm GIN index for fast product fuzzy search
  // If the extension pg_trgm is not active/available, it will log a warning but won't break
  try {
    await knex.raw('CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);');
    await knex.raw('CREATE INDEX idx_products_name_ar_trgm ON products USING GIN (name_ar gin_trgm_ops);');
  } catch (err) {
    console.warn('⚠️ GIN pg_trgm indexes could not be created. Ensure pg_trgm extension is loaded.');
  }

  await knex.schema.alterTable('sales', (table) => {
    table.index(['cashier_id'], 'idx_sales_cashier_id');
    table.index(['created_at'], 'idx_sales_created_at');
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.index(['sale_id'], 'idx_sale_items_sale_id');
    table.index(['product_id'], 'idx_sale_items_product_id');
  });
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation / dependencies
  await knex.schema.dropTableIfExists('sale_items');
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('inventory');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('employees');

  // Drop the updated_at trigger helper function
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;');
}
