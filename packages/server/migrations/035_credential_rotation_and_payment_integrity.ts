import { type Knex } from 'knex';

/**
 * Credential-rotation and accounting hardening.
 *
 * 1. `employees.credential_rotation_required`
 *    Set when a stored credential is known to be a *published default*
 *    (`admin123`, PIN `1111`, …). Such an account cannot log in and cannot
 *    rotate its own password (an attacker who knows the default would otherwise
 *    simply change it); an operator rotates it locally with
 *    `npm run admin:rotate -- --username <name>`.
 *
 * 2. `employees.auth_epoch`
 *    Included in every JWT as `ae`. Bumping it invalidates all previously issued
 *    tokens for that employee, so a rotation cannot be bypassed by a token that
 *    was stolen before the rotation. Default 0 keeps existing tokens valid until
 *    a rotation actually happens (backward compatible with tokens issued before
 *    this migration, which simply have no `ae` claim and are treated as 0).
 *
 * 3. `customer_transactions.idempotency_key`
 *    Makes customer payments retry-safe; the partial unique index prevents the
 *    same key being posted twice for the same customer.
 *
 * 4. `offline_sync_quarantine`
 *    Offline sales whose replayed price or discount needs manager approval are
 *    parked here instead of being posted at the client-supplied amount.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('employees', (table) => {
    table.boolean('credential_rotation_required').notNullable().defaultTo(false);
    table.integer('auth_epoch').notNullable().defaultTo(0);
    table.timestamp('password_changed_at', { useTz: true }).nullable();
  });

  await knex.schema.alterTable('customer_transactions', (table) => {
    table.string('idempotency_key', 100).nullable();
    table.index(['customer_id', 'idempotency_key'], 'idx_customer_tx_idempotency');
  });

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_tx_idempotency
    ON customer_transactions (customer_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);

  await knex.schema.createTable('offline_sync_quarantine', (table) => {
    table.increments('id').primary();
    table.string('idempotency_key', 100).notNullable().unique();
    table.uuid('sale_id').nullable();
    table.integer('cashier_id').references('id').inTable('employees').onDelete('SET NULL');
    table.string('reason', 40).notNullable();
    table.integer('product_id').nullable();
    table.text('detail').nullable();
    table.jsonb('payload').notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.integer('resolved_by').references('id').inTable('employees').onDelete('SET NULL');
    table.timestamp('resolved_at', { useTz: true }).nullable();
    table.text('resolution_notes').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['status', 'created_at'], 'idx_offline_quarantine_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('offline_sync_quarantine');

  await knex.raw('DROP INDEX IF EXISTS uq_customer_tx_idempotency');

  await knex.schema.alterTable('customer_transactions', (table) => {
    table.dropIndex(['customer_id', 'idempotency_key'], 'idx_customer_tx_idempotency');
    table.dropColumn('idempotency_key');
  });

  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('password_changed_at');
    table.dropColumn('auth_epoch');
    table.dropColumn('credential_rotation_required');
  });
}
