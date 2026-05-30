import { type Knex } from 'knex';

/**
 * Migration 021: Performance Indexes
 *
 * Adds composite and GIN trigram indexes for query patterns that currently
 * degrade into sequential scans as operational history grows.
 *
 * Operational note: GIN index creation is non-trivial on large tables and
 * temporarily increases write latency. Run during a maintenance window.
 *
 * Indexes added:
 *  1. cashier_shifts(employee_id, status)         — getCurrentShift() filter
 *  2. cashier_shifts(status, end_time DESC)        — shift report listing
 *  3. manager_overrides(cashier_id, created_at)   — shift detail override lookup
 *  4. sales(receipt_number) GIN trigram           — ILIKE '%…%' receipt search
 *  5. products(barcode) GIN trigram               — ILIKE '%…%' barcode search
 */
export async function up(knex: Knex): Promise<void> {
  // ── 1. cashier_shifts composite indexes ────────────────────────────────────
  //
  // getCurrentShift() runs: WHERE employee_id = ? AND status = 'open'
  // This composite index eliminates the full table scan.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_cashier_shifts_employee_status
      ON cashier_shifts (employee_id, status);
  `);

  // Shift report listing: WHERE status = 'closed' ORDER BY end_time DESC
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status_end_time
      ON cashier_shifts (status, end_time DESC);
  `);

  // ── 2. manager_overrides composite index ────────────────────────────────────
  //
  // Shift detail fetches overrides: WHERE cashier_id = ? AND created_at BETWEEN …
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_manager_overrides_cashier_created_at
      ON manager_overrides (cashier_id, created_at DESC);
  `);

  // ── 3. GIN trigram indexes ──────────────────────────────────────────────────
  //
  // These require the pg_trgm extension. Unlike migration 001 which silently
  // skips trigram indexes when the extension is absent, this migration treats
  // missing pg_trgm as a hard error because product/receipt search quality is
  // the primary goal of this migration.
  //
  // If your DB role lacks superuser privileges, ask a DBA to run:
  //   CREATE EXTENSION IF NOT EXISTS pg_trgm;
  // before applying this migration.
  try {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm";');
  } catch (err) {
    // Role may lack CREATE EXTENSION privilege; verify whether it was
    // pre-installed instead.
    const check = await knex.raw("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm';");
    if (check.rows.length === 0) {
      throw new Error(
        '[Migration 021] The pg_trgm extension is not installed and could not be created automatically.\n' +
        'Ask a database superuser to run: CREATE EXTENSION pg_trgm;\n' +
        'Then re-run this migration.'
      );
    }
    // Extension already installed by DBA — safe to continue.
    console.log('[Migration 021] pg_trgm already installed by DBA; continuing index creation.');
  }

  // sales.receipt_number — receipt search uses ILIKE '%query%'
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_sales_receipt_number_trgm
      ON sales USING GIN (receipt_number gin_trgm_ops);
  `);

  // products.barcode — product/inventory barcode search uses ILIKE '%query%'
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm
      ON products USING GIN (barcode gin_trgm_ops);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_cashier_shifts_employee_status;');
  await knex.raw('DROP INDEX IF EXISTS idx_cashier_shifts_status_end_time;');
  await knex.raw('DROP INDEX IF EXISTS idx_manager_overrides_cashier_created_at;');
  await knex.raw('DROP INDEX IF EXISTS idx_sales_receipt_number_trgm;');
  await knex.raw('DROP INDEX IF EXISTS idx_products_barcode_trgm;');
}
