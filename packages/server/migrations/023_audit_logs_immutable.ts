import { type Knex } from 'knex';

/**
 * Audit Logs Immutable Migration
 * 
 * Creates a generic Postgres function and a trigger on the `audit_logs` table
 * to strictly enforce append-only rules. Any UPDATE or DELETE operations will
 * be actively aborted by the database engine.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create the trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are append-only. Modification and deletion are strictly prohibited.';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Attach the trigger to the audit_logs table
  await knex.raw(`
    CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();
  `);
}

/**
 * Rollback Migration
 */
export async function down(knex: Knex): Promise<void> {
  // Drop the trigger
  await knex.raw('DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;');
  
  // Drop the function
  await knex.raw('DROP FUNCTION IF EXISTS prevent_audit_modification();');
}
