import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create registers table
  await knex.schema.createTable('registers', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Insert a default register so the system works immediately
  await knex('registers').insert({ name: 'Main Register 1' });

  // 2. Add register_id to cashier_shifts
  await knex.schema.alterTable('cashier_shifts', (table) => {
    table.integer('register_id').unsigned().references('id').inTable('registers').defaultTo(1);
  });

  // 3. Add columns to sales
  await knex.schema.alterTable('sales', (table) => {
    table.integer('register_id').unsigned().references('id').inTable('registers').defaultTo(1);
    table.string('print_status').notNullable().defaultTo('printed');
    table.integer('print_count').notNullable().defaultTo(1);
  });

  // 4. Add trigger for registers updated_at
  await knex.raw(`
    CREATE TRIGGER update_registers_updated_at
    BEFORE UPDATE ON registers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS update_registers_updated_at ON registers;`);
  
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('print_count');
    table.dropColumn('print_status');
    table.dropColumn('register_id');
  });

  await knex.schema.alterTable('cashier_shifts', (table) => {
    table.dropColumn('register_id');
  });

  await knex.schema.dropTableIfExists('registers');
}
