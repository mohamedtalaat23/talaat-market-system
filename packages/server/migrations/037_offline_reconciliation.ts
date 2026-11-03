import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('offline_sync_quarantine', (table) => {
    table.timestamp('reconciled_at', { useTz: true }).nullable();
    table.integer('reconciled_by').unsigned().references('id').inTable('employees').nullable();
    table.text('reconciliation_notes').nullable();
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('offline_sync_quarantine', (table) => {
    table.dropColumns('reconciled_at', 'reconciled_by', 'reconciliation_notes');
  });
}
