import { Knex } from 'knex';

/**
 * Migration 005
 * Adds a database-level CHECK constraint to the inventory table
 * to ensure that stock quantity never drops below 0.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_quantity_check;');
  await knex.raw('ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_check CHECK (quantity >= 0);');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_quantity_check;');
}
