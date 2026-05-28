import { type Knex } from 'knex';

/**
 * Fix print_status and print_count default values on sales table.
 * 
 * Migration 009 set wrong defaults:
 * - print_status defaulted to 'printed' -> corrected to 'pending_print'
 * - print_count defaulted to 1 -> corrected to 0
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.string('print_status').notNullable().defaultTo('pending_print').alter();
    table.integer('print_count').notNullable().defaultTo(0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.string('print_status').notNullable().defaultTo('printed').alter();
    table.integer('print_count').notNullable().defaultTo(1).alter();
  });
}
