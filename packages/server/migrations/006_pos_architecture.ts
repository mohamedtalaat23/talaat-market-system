import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create cashier_shifts table
  await knex.schema.createTable('cashier_shifts', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT'); // Prevent deleting cashiers with shift history
    table.string('status', 20).notNullable().defaultTo('open'); // open, closed
    table.timestamp('start_time', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('end_time', { useTz: true }).nullable();
    table.decimal('starting_cash', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('ending_cash', 12, 2).nullable();
    table.decimal('expected_cash', 12, 2).nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // 2. Add trigger for cashier_shifts updated_at
  await knex.raw(`
    CREATE TRIGGER update_cashier_shifts_updated_at
    BEFORE UPDATE ON cashier_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);

  // 3. Create manager_overrides table
  await knex.schema.createTable('manager_overrides', (table) => {
    table.increments('id').primary();
    table.integer('manager_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.integer('cashier_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.string('action_type', 50).notNullable(); // large_discount, price_override, void_transaction
    table.string('reference_id', 100).nullable(); // Sale ID, Product ID, etc.
    table.text('details').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // 4. Add shift_id to sales table
  await knex.schema.alterTable('sales', (table) => {
    table.integer('shift_id').unsigned().nullable()
      .references('id').inTable('cashier_shifts')
      .onDelete('RESTRICT');
  });

  // 5. Create a PostgreSQL sequence for concurrent-safe receipt numbering
  await knex.raw(`
    CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP SEQUENCE IF EXISTS receipt_number_seq;`);
  
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('shift_id');
  });

  await knex.schema.dropTableIfExists('manager_overrides');
  
  await knex.raw(`DROP TRIGGER IF EXISTS update_cashier_shifts_updated_at ON cashier_shifts;`);
  
  await knex.schema.dropTableIfExists('cashier_shifts');
}
