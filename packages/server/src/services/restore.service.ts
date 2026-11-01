import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import knex, { type Knex } from 'knex';
import { db } from '../config/database';
import { env } from '../config/env';
import { logger } from '../middleware/logger';
import {
  BackupValidationError,
  EXCLUDED_TABLES,
  assertSafeRestoreTarget,
  decodeRow,
  orderTables,
  validateBackupPayload,
  type BackupPayload,
  type Row,
  type SchemaInfo,
} from './backup-format';

/**
 * Restore of a full backup into a **separate** database.
 *
 * Safety model:
 *   - Never writes to the live database. The target must be a different database
 *     name (and the connection is still verified against `env.DB_NAME`).
 *   - Never mutates an existing target that contains application data; the target
 *     must be freshly created and migrated (empty tables).
 *   - Dry-run by default. `apply: true` is required to write.
 *   - Validation happens before any write: format, checksum, schema (migration)
 *     match, row counts, and referential integrity inside the payload.
 *   - All inserts run in one transaction; a failure rolls the whole restore back.
 *   - After a successful restore the operator promotes the target database
 *     manually (rename/`ALTER DATABASE` when the app is stopped). Nothing in the
 *     application re-points itself automatically.
 *
 * Note: restoring a backup that was taken *without* credentials leaves every
 * employee unable to authenticate (hashes absent). Those rows are restored with
 * `credential_rotation_required = true`, so `npm run admin:rotate -- --all`
 * provisions them immediately after the restore.
 */

export interface RestoreOptions {
  /** Absolute path to a backup file, or the file name inside BACKUP_DIR. */
  file: string;
  /** Target database name — must differ from the live database. */
  targetDatabase: string;
  /** Write to the target. Defaults to false (validation only). */
  apply?: boolean;
  /** Legacy option: true is rejected; merging existing data is unsupported. */
  allowNonEmpty?: boolean;
}

export interface RestoreReport {
  file: string;
  targetDatabase: string;
  applied: boolean;
  tables: number;
  rowCounts: Record<string, number>;
  migrations: string[];
  credentialsIncluded: boolean;
  warnings: string[];
}

function createTargetConnection(targetDatabase: string): Knex {
  return knex({
    client: 'pg',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: targetDatabase,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: false,
    },
    pool: { min: 0, max: 2 },
  });
}

async function introspectTarget(trx: Knex | Knex.Transaction): Promise<SchemaInfo> {
  const fkRows = await trx.raw(`
    SELECT
      tc.table_name AS table_name,
      kcu.column_name AS column_name,
      ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  const pkRows = await trx.raw(`
    SELECT tc.table_name AS table_name, kcu.column_name AS column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  `);

  const primaryKeys: Record<string, string | null> = {};
  for (const row of (pkRows.rows ?? []) as { table_name: string; column_name: string }[]) {
    primaryKeys[row.table_name] = row.column_name;
  }

  return {
    foreignKeys: (
      (fkRows.rows ?? []) as {
        table_name: string;
        column_name: string;
        referenced_table: string;
      }[]
    ).map((row) => ({
      table: row.table_name,
      column: row.column_name,
      referencedTable: row.referenced_table,
    })),
    primaryKeys,
  };
}

async function listMigrations(target: Knex): Promise<string[]> {
  const exists = await target('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public', table_name: 'knex_migrations' })
    .first();

  if (!exists) return [];

  const rows = await target('knex_migrations').select('name').orderBy('id', 'asc');
  return rows.map((row: { name: string }) => row.name);
}

// These are the only rows inserted by migrations. They may be replaced in a
// fresh restore target, but never accept an installation with business data.
const migrationDefaults: Record<string, Row[]> = {
  registers: [{ id: 1, name: 'Main Register 1', status: 'active' }],
  settings: [
    { key: 'return_queue_warning_minutes', value: 15 },
    { key: 'return_queue_critical_minutes', value: 30 },
  ],
  NonRestockReason: [
    { reason_code: 'DAMAGED', description: 'Item physically damaged' },
    { reason_code: 'EXPIRED', description: 'Item past expiration date' },
    { reason_code: 'OPENED', description: 'Item seal broken or opened' },
    { reason_code: 'CONTAMINATED', description: 'Item contaminated or spoiled' },
    { reason_code: 'SUPPLIER_RECALL', description: 'Recalled by supplier' },
    { reason_code: 'CUSTOMER_DISSATISFACTION', description: 'Customer unhappy, cannot resell' },
    { reason_code: 'OTHER', description: 'Other (requires notes)' },
  ],
};

async function assertTargetIsEmpty(
  target: Knex,
  tables: readonly string[],
  allowNonEmpty: boolean,
): Promise<string[]> {
  if (allowNonEmpty) {
    throw new BackupValidationError(
      'TARGET_NOT_EMPTY',
      'Merging into an existing database is unsupported. Use a fresh migrated target.',
    );
  }
  for (const table of tables) {
    const rows: Row[] = await target(table).select('*');
    if (rows.length === 0) continue;
    const defaults = migrationDefaults[table];
    const isDefault =
      defaults &&
      rows.length === defaults.length &&
      defaults.every((expected) =>
        rows.some((row) =>
          Object.entries(expected).every(
            ([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value),
          ),
        ),
      );
    if (!isDefault) {
      throw new BackupValidationError(
        'TARGET_NOT_EMPTY',
        `Target database already contains data in "${table}". Use a fresh migrated database.`,
      );
    }
  }
  return [];
}

/** Resets every sequence owned by a table column so new inserts do not collide. */
async function resyncSequences(
  trx: Knex.Transaction,
  tables: readonly string[],
  primaryKeys: Record<string, string | null>,
): Promise<void> {
  for (const table of tables) {
    const pk = primaryKeys[table];
    if (!pk) continue;

    const seqRow = await trx.raw('SELECT pg_get_serial_sequence(quote_ident(?), ?) AS seq', [
      table,
      pk,
    ]);
    const sequence = seqRow.rows?.[0]?.seq as string | null;
    if (!sequence) continue;

    await trx.raw(`SELECT setval(?, COALESCE((SELECT MAX(??) FROM ??), 0) + 1, false)`, [
      sequence,
      pk,
      table,
    ]);
  }
  const numbering = [
    { sequence: 'receipt_number_seq', sources: [['sales', 'receipt_number']] },
    { sequence: 'refund_receipt_number_seq', sources: [['refunds', 'refund_receipt_number']] },
    {
      sequence: 'purchase_order_number_seq',
      sources: [
        ['purchase_orders', 'po_number'],
        ['purchase_order_receipts', 'receipt_number'],
      ],
    },
  ];
  for (const { sequence, sources } of numbering) {
    let max = 0;
    for (const [table, column] of sources) {
      const result = await trx.raw(
        "SELECT COALESCE(MAX(substring(?? from '([0-9]+)$')::bigint), 0) AS max FROM ??",
        [column!, table!],
      );
      max = Math.max(max, Number(result.rows[0].max));
    }
    await trx.raw('SELECT setval(?, ?, false)', [sequence, max + 1]);
  }
}

export class RestoreService {
  /**
   * Validates (and optionally applies) a backup to a separate database.
   *
   * Throws `BackupValidationError` with a machine-readable `code` for every
   * refusal; nothing is written before validation passes.
   */
  async restore(options: RestoreOptions): Promise<RestoreReport> {
    assertSafeRestoreTarget(options.targetDatabase, env.DB_NAME);

    const { backupService } = await import('./backup.service');
    const filePath = fs.existsSync(options.file)
      ? options.file
      : path.join(backupService.directory, options.file);

    if (!fs.existsSync(filePath)) {
      throw new BackupValidationError('FILE_NOT_FOUND', `Backup file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    let parsed: BackupPayload;
    try {
      parsed = JSON.parse(raw) as BackupPayload;
    } catch {
      throw new BackupValidationError('INVALID_JSON', 'Backup file is not valid JSON.');
    }

    const target = createTargetConnection(options.targetDatabase);
    const warnings: string[] = [];

    try {
      await target.raw('SELECT 1');

      const targetMigrations = await listMigrations(target);
      if (targetMigrations.length === 0) {
        throw new BackupValidationError(
          'TARGET_NOT_MIGRATED',
          'Target database has no migrations applied. Create the database and run `npm run db:migrate` against it first.',
        );
      }

      const jsonColumns: { table_name: string; column_name: string }[] = await target(
        'information_schema.columns',
      )
        .select('table_name', 'column_name')
        .where({ table_schema: 'public' })
        .whereIn('data_type', ['json', 'jsonb']);
      const schema = await introspectTarget(target);
      const validation = validateBackupPayload(parsed, schema, {
        currentMigrations: targetMigrations,
      });

      // Re-derive the insert order from the *target* schema; a backup taken on an
      // older schema may not be ordered correctly for this one.
      const targetTables = await target('information_schema.tables')
        .select('table_name')
        .where({ table_schema: 'public', table_type: 'BASE TABLE' });
      const tableOrder = orderTables(
        targetTables
          .map((row: { table_name: string }) => row.table_name)
          .filter((table: string) => !EXCLUDED_TABLES.includes(table)),
        schema,
      );

      const missing = tableOrder.filter((table) => !(table in parsed.data));
      if (missing.length > 0) {
        throw new BackupValidationError(
          'TARGET_SCHEMA_AHEAD',
          `The target database has tables the backup does not contain (${missing.join(', ')}). ` +
            'Use a backup taken on the same schema version.',
        );
      }

      warnings.push(
        ...(await assertTargetIsEmpty(target, tableOrder, options.allowNonEmpty ?? false)),
      );

      if (!parsed.meta.credentials_included) {
        warnings.push(
          'Backup was taken without credential hashes: every employee will be locked and must be ' +
            're-provisioned with `npm run admin:rotate -- --all` after the restore.',
        );
      }

      if (!options.apply) {
        return {
          file: filePath,
          targetDatabase: options.targetDatabase,
          applied: false,
          tables: tableOrder.length,
          rowCounts: validation.rowCounts,
          migrations: parsed.meta.migrations ?? [],
          credentialsIncluded: parsed.meta.credentials_included,
          warnings,
        };
      }

      await target.transaction(async (trx) => {
        // Prevent a writer from slipping data in after the emptiness check.
        for (const table of tableOrder) {
          await trx.raw('LOCK TABLE ?? IN ACCESS EXCLUSIVE MODE', [table]);
        }
        await assertTargetIsEmpty(trx, tableOrder, false);
        for (const table of [...tableOrder].reverse()) {
          await trx(table).delete();
        }
        for (const table of tableOrder) {
          const rows = (parsed.data[table] ?? []) as Row[];
          if (rows.length === 0) continue;

          const prepared = rows.map((row) => {
            const decoded = decodeRow(row);
            // node-postgres encodes JS arrays as SQL arrays; JSON columns need
            // explicit JSON text to preserve arrays (including nested arrays).
            for (const column of jsonColumns) {
              if (
                column.table_name === table &&
                decoded[column.column_name] !== undefined &&
                decoded[column.column_name] !== null
              ) {
                decoded[column.column_name] = JSON.stringify(decoded[column.column_name]);
              }
            }
            if (table === 'employees' && !parsed.meta.credentials_included) {
              // No usable credential: keep the person, lock the account.
              decoded['password_hash'] = crypto.randomBytes(48).toString('hex');
              delete decoded['pin_hash'];
              decoded['credential_rotation_required'] = true;
              decoded['must_change_password'] = true;
            }
            return decoded;
          });

          // Chunked to keep parameter counts well under PostgreSQL's limit.
          const chunkSize = 500;
          for (let index = 0; index < prepared.length; index += chunkSize) {
            await trx(table).insert(prepared.slice(index, index + chunkSize));
          }
        }

        await resyncSequences(trx, tableOrder, schema.primaryKeys);

        // Post-restore verification: every table must contain what the file declared.
        for (const table of tableOrder) {
          const row = await trx(table).count({ count: '*' }).first();
          const count = Number((row as { count?: string } | undefined)?.count ?? 0);
          const expected = validation.rowCounts[table] ?? 0;
          if (count !== expected) {
            throw new BackupValidationError(
              'POST_RESTORE_MISMATCH',
              `Post-restore verification failed for "${table}": expected ${expected} rows, found ${count}.`,
            );
          }
        }
      });

      logger.warn('Backup restored into a separate database', {
        targetDatabase: options.targetDatabase,
        tables: tableOrder.length,
        rows: Object.values(validation.rowCounts).reduce((sum, count) => sum + count, 0),
      });

      return {
        file: filePath,
        targetDatabase: options.targetDatabase,
        applied: true,
        tables: tableOrder.length,
        rowCounts: validation.rowCounts,
        migrations: parsed.meta.migrations ?? [],
        credentialsIncluded: parsed.meta.credentials_included,
        warnings,
      };
    } finally {
      await target.destroy().catch(() => undefined);
    }
  }
}

export const restoreService = new RestoreService();

/** Kept so the CLI can reuse the existing pool for read-only checks. */
export { db };
