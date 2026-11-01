import { type Knex } from 'knex';

/**
 * Adds a flag that forces an employee to rotate their password at next login.
 *
 * This is set for auto-provisioned accounts (first-run bootstrap admin and
 * seeded development employees) so a known/initial password can never be
 * used as the long-term credential.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.boolean('must_change_password').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('must_change_password');
  });
}
