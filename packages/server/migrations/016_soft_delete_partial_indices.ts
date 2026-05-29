import { type Knex } from 'knex';

/**
 * Migration: Hardening Soft-Delete Uniqueness Constraints & Inventory CHECK constraints
 * 
 * 1. Replaces global UNIQUE constraints with partial unique indexes (WHERE deleted_at IS NULL)
 *    for products.barcode, employees.username, customers.phone, and suppliers.supplier_code.
 * 2. Drops database-level inventory_quantity_check CHECK constraint to allow negative stock
 *    on authorized manager overrides, shifting safety checks to application-layer transactions.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Drop existing unique constraints
  await knex.raw('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_unique;');
  await knex.raw('ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_username_unique;');
  await knex.raw('ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_unique;');
  await knex.raw('ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_supplier_code_unique;');

  // 2. Drop potential unique indexes with identical names
  await knex.raw('DROP INDEX IF EXISTS products_barcode_unique;');
  await knex.raw('DROP INDEX IF EXISTS employees_username_unique;');
  await knex.raw('DROP INDEX IF EXISTS customers_phone_unique;');
  await knex.raw('DROP INDEX IF EXISTS suppliers_supplier_code_unique;');

  // 3. Create partial unique indexes where deleted_at IS NULL
  await knex.raw('CREATE UNIQUE INDEX products_barcode_unique ON products (barcode) WHERE deleted_at IS NULL;');
  await knex.raw('CREATE UNIQUE INDEX employees_username_unique ON employees (username) WHERE deleted_at IS NULL;');
  await knex.raw('CREATE UNIQUE INDEX customers_phone_unique ON customers (phone) WHERE deleted_at IS NULL;');
  await knex.raw('CREATE UNIQUE INDEX suppliers_supplier_code_unique ON suppliers (supplier_code) WHERE deleted_at IS NULL;');

  // 4. Drop database CHECK constraint on inventory table to allow negative quantity on override
  await knex.raw('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_quantity_check;');
}

export async function down(knex: Knex): Promise<void> {
  // 1. Re-add inventory CHECK constraint enforcing quantity >= 0
  await knex.raw('ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_check CHECK (quantity >= 0);');

  // 2. Drop partial unique indexes
  await knex.raw('DROP INDEX IF EXISTS products_barcode_unique;');
  await knex.raw('DROP INDEX IF EXISTS employees_username_unique;');
  await knex.raw('DROP INDEX IF EXISTS customers_phone_unique;');
  await knex.raw('DROP INDEX IF EXISTS suppliers_supplier_code_unique;');

  // 3. Re-create the standard unique constraints/indexes
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_barcode_unique UNIQUE (barcode);');
  await knex.raw('ALTER TABLE employees ADD CONSTRAINT employees_username_unique UNIQUE (username);');
  await knex.raw('ALTER TABLE customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);');
  await knex.raw('ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_code_unique UNIQUE (supplier_code);');
}
