import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('purchase_order_receipts', (table) => {
    table.string('idempotency_key', 100).nullable().unique();
    table.string('request_fingerprint', 64).nullable();
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('purchase_order_receipts', (table) => {
    table.dropColumn('idempotency_key');
    table.dropColumn('request_fingerprint');
  });
}
