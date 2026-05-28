import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('settings', (table) => {
    table.string('key', 50).primary();
    table.jsonb('value').notNullable();
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.integer('updated_by').references('id').inTable('employees').onDelete('RESTRICT').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
}
