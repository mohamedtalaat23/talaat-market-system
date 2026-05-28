import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.decimal('global_discount', 12, 2).notNullable().defaultTo(0.00);
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.string('product_name', 255).notNullable().defaultTo('Unknown Product');
    table.string('barcode', 50).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sale_items', (table) => {
    table.dropColumn('product_name');
    table.dropColumn('barcode');
  });

  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('global_discount');
  });
}
