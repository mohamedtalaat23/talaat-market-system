import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Audit Logs: Alter entity_id to VARCHAR(36)
  await knex.schema.alterTable('audit_logs', (table) => {
    table.string('entity_id', 36).alter();
  });
  
  // Create index
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);`);

  // 2. Refunds: Add card_refunded
  await knex.schema.alterTable('refunds', (table) => {
    table.decimal('card_refunded', 12, 2).notNullable().defaultTo(0);
  });

  // 3. Sales: Add frozen tender allocation columns
  await knex.schema.alterTable('sales', (table) => {
    table.decimal('cash_paid', 12, 2).notNullable().defaultTo(0);
    table.decimal('card_paid', 12, 2).notNullable().defaultTo(0);
    table.decimal('debt_paid', 12, 2).notNullable().defaultTo(0);
  });

  // Backfill existing sales
  // For existing sales:
  // if payment_method = cash -> cash_paid = total
  // if payment_method = card -> card_paid = total
  // if payment_method = debt -> debt_paid = total
  // if payment_method = split -> cash_paid = cash_amount - change_given, card_paid = card_amount
  await knex.raw(`
    UPDATE sales
    SET 
      cash_paid = CASE 
        WHEN payment_method = 'cash' THEN total
        WHEN payment_method = 'split' THEN COALESCE(cash_amount, 0) - COALESCE(change_given, 0)
        ELSE 0
      END,
      card_paid = CASE 
        WHEN payment_method = 'card' THEN total
        WHEN payment_method = 'split' THEN COALESCE(card_amount, 0)
        ELSE 0
      END,
      debt_paid = CASE 
        WHEN payment_method = 'debt' THEN total
        ELSE 0
      END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('debt_paid');
    table.dropColumn('card_paid');
    table.dropColumn('cash_paid');
  });

  await knex.schema.alterTable('refunds', (table) => {
    table.dropColumn('card_refunded');
  });

  await knex.raw(`DROP INDEX IF EXISTS idx_audit_entity;`);

  // Reverting audit_logs to integer is extremely dangerous, we cast it back safely only if the data matches
  await knex.raw(`
    ALTER TABLE audit_logs 
    ALTER COLUMN entity_id TYPE integer 
    USING (CASE WHEN entity_id ~ '^[0-9]+$' THEN entity_id::integer ELSE NULL END)
  `);
}
