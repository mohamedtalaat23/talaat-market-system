import crypto from 'crypto';

/**
 * Backup file format (v2) and its validation rules.
 *
 * Design notes:
 *   - A backup is a **complete logical export** of every application table, in a
 *     foreign-key-safe order, so it can actually be used to rebuild the store
 *     (sales, sale items, shifts, customers, employees, purchases, refunds,
 *     inventory, settings, audit logs, …). The previous implementation only
 *     exported the catalogue and called itself "disaster recovery".
 *   - `meta.payload_sha256` is a checksum of the data section, computed with the
 *     tables in `meta.table_order`, so a truncated or hand-edited file is rejected
 *     before anything is written.
 *   - `meta.migrations` records the schema the snapshot came from. Restoring into
 *     a database whose migration list differs is refused: silently guessing a
 *     mapping between schema versions is how data gets corrupted.
 *   - Credential hashes are included only when `credentials_included` is true.
 *   - Everything in this module is pure (no database access) so it can be
 *     unit-tested.
 */

export const BACKUP_FORMAT = 'talaat-full-backup';
export const BACKUP_FORMAT_VERSION = 2;

/** Tables that are never part of a logical backup (knex bookkeeping). */
export const EXCLUDED_TABLES = ['knex_migrations', 'knex_migrations_lock'];

export type Row = Record<string, unknown>;

export interface BackupMeta {
  system: string;
  format: string;
  format_version: number;
  app_version: string;
  created_at: string;
  database?: string;
  tables_included: string[];
  table_order: string[];
  row_counts: Record<string, number>;
  migrations: string[];
  credentials_included: boolean;
  sensitivity: 'confidential';
  payload_sha256: string;
}

export interface BackupPayload {
  meta: BackupMeta;
  data: Record<string, Row[]>;
}

export class BackupValidationError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BackupValidationError';
    this.code = code;
  }
}

/**
 * Encodes values that JSON cannot round-trip (`bytea` buffers).
 *
 * Everything else — including `NUMERIC`, which the driver returns as a string —
 * survives untouched, which keeps monetary columns exact.
 */
export function encodeRow(row: Row): Row {
  const encoded: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (Buffer.isBuffer(value)) {
      encoded[key] = { __bytea: value.toString('base64') };
    } else if (value instanceof Date) {
      encoded[key] = value.toISOString();
    } else {
      encoded[key] = value;
    }
  }
  return encoded;
}

/** Decodes `{ __bytea }` markers back into Buffers for insertion. */
export function decodeRow(row: Row): Row {
  const decoded: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === 'object' && '__bytea' in (value as Record<string, unknown>)) {
      decoded[key] = Buffer.from(String((value as Record<string, unknown>)['__bytea']), 'base64');
    } else {
      decoded[key] = value;
    }
  }
  return decoded;
}

/** Stable checksum over the data section (tables in the recorded order). */
export function computePayloadChecksum(
  data: Record<string, Row[]>,
  tableOrder: readonly string[],
): string {
  const canonical = tableOrder.map((table) => [table, data[table] ?? []]);
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export interface SchemaInfo {
  /** Table → foreign keys pointing at other tables. */
  foreignKeys: { table: string; column: string; referencedTable: string }[];
  /** Primary-key column per table (used for integrity checks). */
  primaryKeys: Record<string, string | null>;
}

/**
 * Orders tables so every parent is inserted before its children.
 *
 * Throws when the schema contains a reference cycle: that would require deferred
 * constraints, and silently producing a restore order that fails midway is worse
 * than refusing.
 */
export function orderTables(tables: readonly string[], schema: SchemaInfo): string[] {
  const deps = new Map<string, Set<string>>();
  for (const table of tables) deps.set(table, new Set());

  for (const fk of schema.foreignKeys) {
    if (!deps.has(fk.table) || !deps.has(fk.referencedTable)) continue;
    if (fk.table === fk.referencedTable) continue; // self-reference is fine
    deps.get(fk.table)!.add(fk.referencedTable);
  }

  const ordered: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();

  const visit = (table: string, path: string[]): void => {
    if (done.has(table)) return;

    if (visiting.has(table)) {
      throw new BackupValidationError(
        'FOREIGN_KEY_CYCLE',
        `Cannot build a safe restore order: circular foreign keys between ${[...path, table].join(' → ')}.`,
      );
    }

    visiting.add(table);
    for (const dependency of deps.get(table) ?? []) {
      visit(dependency, [...path, table]);
    }
    visiting.delete(table);
    done.add(table);
    ordered.push(table);
  };

  for (const table of [...tables].sort()) visit(table, []);

  return ordered;
}

export interface ValidationOptions {
  /** Migrations currently applied to the *target* database. */
  currentMigrations?: readonly string[];
}

export interface ValidationResult {
  meta: BackupMeta;
  tables: string[];
  rowCounts: Record<string, number>;
}

/**
 * Validates a parsed backup file before any write happens.
 *
 * Checks: format/version, table list consistency, per-table row counts, payload
 * checksum, migration compatibility and referential integrity *inside* the
 * payload (a child row pointing at a parent that is not in the file would fail
 * mid-restore).
 */
export function validateBackupPayload(
  payload: unknown,
  schema: SchemaInfo,
  options: ValidationOptions = {},
): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    throw new BackupValidationError('NOT_A_BACKUP', 'Backup file is empty or not a JSON object.');
  }

  const candidate = payload as Partial<BackupPayload>;
  const meta = candidate.meta;

  if (!meta || typeof meta !== 'object') {
    throw new BackupValidationError('MISSING_META', 'Backup file has no "meta" section.');
  }
  if (meta.format !== BACKUP_FORMAT) {
    throw new BackupValidationError(
      'UNSUPPORTED_FORMAT',
      `Unsupported backup format "${String(meta.format)}". Expected "${BACKUP_FORMAT}".`,
    );
  }
  if (Number(meta.format_version) !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError(
      'UNSUPPORTED_VERSION',
      `Unsupported backup format version ${String(meta.format_version)}. This build supports ${BACKUP_FORMAT_VERSION}.`,
    );
  }
  if (!Array.isArray(meta.table_order) || meta.table_order.length === 0) {
    throw new BackupValidationError('MISSING_TABLE_ORDER', 'Backup file has no table order.');
  }

  const data = candidate.data;
  if (!data || typeof data !== 'object') {
    throw new BackupValidationError('MISSING_DATA', 'Backup file has no "data" section.');
  }

  for (const table of meta.table_order) {
    if (!Array.isArray(data[table])) {
      throw new BackupValidationError('MISSING_TABLE', `Backup file is missing table "${table}".`);
    }
  }

  const rowCounts: Record<string, number> = {};
  for (const table of meta.table_order) {
    rowCounts[table] = data[table]!.length;
    const expected = meta.row_counts?.[table];
    if (typeof expected === 'number' && expected !== rowCounts[table]) {
      throw new BackupValidationError(
        'ROW_COUNT_MISMATCH',
        `Table "${table}" has ${rowCounts[table]} rows but the file declares ${expected}.`,
      );
    }
  }

  const checksum = computePayloadChecksum(data, meta.table_order);
  if (!meta.payload_sha256 || checksum !== meta.payload_sha256) {
    throw new BackupValidationError(
      'CHECKSUM_MISMATCH',
      'Backup checksum does not match its contents — the file is corrupted or was modified.',
    );
  }

  if (options.currentMigrations) {
    const backupMigrations = [...(meta.migrations ?? [])].sort().join(',');
    const currentMigrations = [...options.currentMigrations].sort().join(',');
    if (backupMigrations !== currentMigrations) {
      throw new BackupValidationError(
        'SCHEMA_MISMATCH',
        'The backup was taken on a different schema version. Run the matching migrations on the ' +
          'target database first (or restore with the build that produced the backup).',
      );
    }
  }

  assertReferentialIntegrity(data as Record<string, Row[]>, meta.table_order, schema);

  return { meta, tables: meta.table_order, rowCounts };
}

/**
 * Verifies that every foreign-key value in the payload exists on its parent table.
 * Null FKs are ignored; problems are reported by table/column, never row content.
 */
export function assertReferentialIntegrity(
  data: Record<string, Row[]>,
  tables: readonly string[],
  schema: SchemaInfo,
): void {
  if (!schema.foreignKeys || schema.foreignKeys.length === 0) return;

  const idsByTable = new Map<string, Set<string>>();
  for (const table of tables) {
    const pk = schema.primaryKeys[table];
    if (!pk) continue;
    idsByTable.set(
      table,
      new Set((data[table] ?? []).map((row) => String(row[pk]))),
    );
  }

  const violations: string[] = [];

  for (const fk of schema.foreignKeys) {
    if (!tables.includes(fk.table) || !tables.includes(fk.referencedTable)) continue;
    const parentIds = idsByTable.get(fk.referencedTable);
    if (!parentIds) continue;

    for (const row of data[fk.table] ?? []) {
      const value = row[fk.column];
      if (value === null || value === undefined) continue;
      if (!parentIds.has(String(value))) {
        violations.push(`${fk.table}.${fk.column} → ${fk.referencedTable}`);
        break; // one report per column is enough
      }
    }
  }

  if (violations.length > 0) {
    throw new BackupValidationError(
      'BROKEN_REFERENCES',
      `Backup contains rows referencing records that are not in the file: ${violations.join(', ')}.`,
    );
  }
}

/**
 * Refuses restore targets that would overwrite the live database.
 *
 * Restores always target a *separate* database that the operator creates; the live
 * database may only be replaced by promoting that database manually after it has
 * been verified.
 */
export function assertSafeRestoreTarget(targetDatabase: string, liveDatabase: string): void {
  const target = (targetDatabase ?? '').trim();

  if (!target) {
    throw new BackupValidationError('TARGET_REQUIRED', 'A target database name is required.');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(target)) {
    throw new BackupValidationError(
      'INVALID_TARGET',
      'Target database name may only contain letters, digits and underscores.',
    );
  }
  if (target === liveDatabase) {
    throw new BackupValidationError(
      'LIVE_DATABASE_TARGET',
      'Refusing to restore into the live database. Restore into a separate database and promote it after verification.',
    );
  }
}

