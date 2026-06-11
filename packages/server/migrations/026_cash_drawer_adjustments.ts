import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cash_drawer_adjustments', (table) => {
    table.increments('id').primary();
    table.integer('shift_id').unsigned().notNullable()
      .references('id').inTable('cashier_shifts')
      .onDelete('RESTRICT');
    table.integer('cashier_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.integer('manager_id').unsigned().notNullable()
      .references('id').inTable('employees')
      .onDelete('RESTRICT');
    table.integer('terminal_id').unsigned().nullable(); // Optional if tracking physical terminal
    table.string('adjustment_type', 50).notNullable(); // safe_drop, change_replenishment, petty_cash, etc.
    table.decimal('amount', 12, 2).notNullable(); // Absolute amount > 0
    table.string('reason_code', 50).notNullable(); // SAFE_DROP, PETTY_CASH
    table.text('reason_notes').nullable();
    table.timestamps(true, true);

    // Constraint: Amount must be positive
    table.check('amount > 0', [], 'drawer_adj_amount_check');
  });

  // Add trigger for updated_at
  await knex.raw(`
    CREATE TRIGGER update_cash_drawer_adjustments_updated_at
    BEFORE UPDATE ON cash_drawer_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cash_drawer_adjustments');
}
