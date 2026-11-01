import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../config/database';
import type { Knex } from 'knex';
import { env } from '../config/env';
import { logger } from '../middleware/logger';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  EXCLUDED_TABLES,
  computePayloadChecksum,
  encodeRow,
  orderTables,
  type BackupMeta,
  type BackupPayload,
  type Row,
  type SchemaInfo,
} from './backup-format';

/**
 * Expands a leading `~` and resolves relative paths.
 *
 * The desktop launcher passes an absolute, per-user directory through
 * `BACKUP_DIR` so snapshots land outside the (updatable / read-only)
 * application bundle; `.env.example` documents `~/TalaatMarket/backups`.
 */
function resolveBackupDir(configured?: string): string {
  const value = (configured ?? '').trim() || 'backups';

  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

interface TableColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ForeignKeyRow {
  table_name: string;
  column_name: string;
  referenced_table: string;
}

export interface CreateBackupOptions {
  /**
   * Include `employees.password_hash` / `pin_hash` so a restored installation can
   * authenticate as before. Default true — a DR backup without credentials needs a
   * manual rotation of every account after restore.
   */
  includeCredentials?: boolean;
}

export interface BackupSummary {
  filename: string;
  timestamp: string;
  sizeBytes: number;
  tables: number;
  rowCounts: Record<string, number>;
  credentialsIncluded: boolean;
}

export class BackupService {
  private backupDir: string;

  constructor() {
    this.backupDir = resolveBackupDir(env.BACKUP_DIR);
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
    }
  }

  /** Base (non-view, non-knex) tables in the public schema. */
  private async listTables(connection: Knex): Promise<string[]> {
    const rows = await connection('information_schema.tables')
      .select('table_name')
      .where({ table_schema: 'public', table_type: 'BASE TABLE' });

    return rows
      .map((row: { table_name: string }) => row.table_name)
      .filter((name: string) => !EXCLUDED_TABLES.includes(name))
      .sort();
  }

  /**
   * Reads the FK graph and primary keys so the restore order is derived from the
   * actual schema rather than a hard-coded list that drifts.
   */
  private async introspectSchema(connection: Knex): Promise<SchemaInfo> {
    const columns: TableColumn[] = await connection('information_schema.columns')
      .select('table_name', 'column_name', 'data_type', 'is_nullable', 'column_default')
      .where({ table_schema: 'public' });

    const fkRows = await connection.raw(`
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

    const pkRows = await connection.raw(`
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

    void columns;

    return {
      foreignKeys: ((fkRows.rows ?? []) as ForeignKeyRow[]).map((row) => ({
        table: row.table_name,
        column: row.column_name,
        referencedTable: row.referenced_table,
      })),
      primaryKeys,
    };
  }

  /** Applied migration names, used to refuse restoring into a different schema. */
  private async listMigrations(connection: Knex): Promise<string[]> {
    const exists = await connection('information_schema.tables')
      .select('table_name')
      .where({ table_schema: 'public', table_name: 'knex_migrations' })
      .first();

    if (!exists) return [];

    const rows = await connection('knex_migrations').select('name').orderBy('id', 'asc');
    return rows.map((row: { name: string }) => row.name);
  }

  /**
   * Creates a **complete** logical backup of every application table.
   *
   * The file contains personal and financial data (and, by default, credential
   * hashes), so it is written with mode 0600 into `BACKUP_DIR` and is never logged.
   */
  async createBackup(options: CreateBackupOptions = {}): Promise<BackupSummary> {
    const includeCredentials = options.includeCredentials ?? true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `talaat-market-full-${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    logger.info('Creating full database backup...', { filename, includeCredentials });

    // Every table and migration is read from the same MVCC snapshot. Otherwise
    // a checkout between table reads can produce an unrestorable backup.
    const payload = await db.transaction(
      async (trx) => {
        const tables = await this.listTables(trx);
        if (tables.length === 0) {
          throw new Error('No application tables found — is the database migrated?');
        }

        const schema = await this.introspectSchema(trx);
        const tableOrder = orderTables(tables, schema);

        const data: Record<string, Row[]> = {};
        const rowCounts: Record<string, number> = {};

        for (const table of tableOrder) {
          const rows: Row[] = await trx(table).select('*');
          data[table] = rows.map((row) => {
            const encoded = encodeRow(row);
            if (!includeCredentials && table === 'employees') {
              delete encoded['password_hash'];
              delete encoded['pin_hash'];
            }
            return encoded;
          });
          rowCounts[table] = data[table]!.length;
        }

        const meta: BackupMeta = {
          system: 'Talaat Market System',
          format: BACKUP_FORMAT,
          format_version: BACKUP_FORMAT_VERSION,
          app_version: process.env['npm_package_version'] ?? 'unknown',
          created_at: new Date().toISOString(),
          ...(env.DB_NAME ? { database: env.DB_NAME } : {}),
          tables_included: tableOrder,
          table_order: tableOrder,
          row_counts: rowCounts,
          migrations: await this.listMigrations(trx),
          credentials_included: includeCredentials,
          sensitivity: 'confidential',
          payload_sha256: computePayloadChecksum(data, tableOrder),
        };

        return { meta, data } satisfies BackupPayload;
      },
      { isolationLevel: 'repeatable read', readOnly: true },
    );
    const content = JSON.stringify(payload, null, 2);

    fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // Non-POSIX filesystems do not support chmod.
    }

    const stats = fs.statSync(filePath);

    logger.info('Full database backup completed', {
      filename,
      sizeBytes: stats.size,
      tables: payload.meta.table_order.length,
      rows: Object.values(payload.meta.row_counts).reduce((sum, count) => sum + count, 0),
    });

    return {
      filename,
      timestamp: payload.meta.created_at,
      sizeBytes: stats.size,
      tables: payload.meta.table_order.length,
      rowCounts: payload.meta.row_counts,
      credentialsIncluded: includeCredentials,
    };
  }

  /**
   * List existing backups in the configured `BACKUP_DIR` directory.
   *
   * Only metadata is returned (never file contents).
   */
  async listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    const files = fs.readdirSync(this.backupDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const stats = fs.statSync(path.join(this.backupDir, filename));
        return {
          filename,
          sizeBytes: stats.size,
          created_at: stats.birthtime,
        };
      })
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /** Absolute path for a backup file, refusing anything outside BACKUP_DIR. */
  resolveBackupPath(filename: string): string {
    const candidate = path.resolve(this.backupDir, filename);
    const root = path.resolve(this.backupDir);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      throw new Error('Backup path escapes the configured backup directory.');
    }
    return candidate;
  }

  /** Directory backups are written to (used by the restore CLI). */
  get directory(): string {
    return this.backupDir;
  }
}

export const backupService = new BackupService();
