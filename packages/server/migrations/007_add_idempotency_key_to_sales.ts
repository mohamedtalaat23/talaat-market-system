import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.string('idempotency_key', 100).nullable().unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('idempotency_key');
  });
}
