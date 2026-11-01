import type { Knex } from 'knex';
// Additive only. Historical refunds keep their original values and NULL keys.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refunds', (table) => {
    table.string('idempotency_key', 100).nullable();
    table.unique(['sale_id', 'idempotency_key']);
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refunds', (table) => {
    table.dropUnique(['sale_id', 'idempotency_key']);
    table.dropColumn('idempotency_key');
  });
}
