import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Drop the updated_at trigger from the previous migration
  await knex.raw(`DROP TRIGGER IF EXISTS update_cash_drawer_adjustments_updated_at ON cash_drawer_adjustments`);

  // Create immutability function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION enforce_adjustment_immutability()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'cash_drawer_adjustments is an immutable ledger. Updates and deletions are prohibited.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create triggers to prevent UPDATE and DELETE
  await knex.raw(`
    CREATE TRIGGER prevent_update_adjustments
    BEFORE UPDATE ON cash_drawer_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_adjustment_immutability();
  `);

  await knex.raw(`
    CREATE TRIGGER prevent_delete_adjustments
    BEFORE DELETE ON cash_drawer_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_adjustment_immutability();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS prevent_update_adjustments ON cash_drawer_adjustments`);
  await knex.raw(`DROP TRIGGER IF EXISTS prevent_delete_adjustments ON cash_drawer_adjustments`);
  await knex.raw(`DROP FUNCTION IF EXISTS enforce_adjustment_immutability`);

  await knex.raw(`
    CREATE TRIGGER update_cash_drawer_adjustments_updated_at
    BEFORE UPDATE ON cash_drawer_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}
