import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('locked_until');
    table.dropColumn('failed_login_attempts');
  });
}
