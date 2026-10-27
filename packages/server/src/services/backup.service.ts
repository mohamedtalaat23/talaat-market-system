import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../config/database';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

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

export class BackupService {
  private backupDir: string;

  constructor() {
    this.backupDir = resolveBackupDir(env.BACKUP_DIR);
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Triggers a snapshot database backup.
   */
  async createBackup(): Promise<{ filename: string; timestamp: string; sizeBytes: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `talaat_market_backup_${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    logger.info('Creating database snapshot backup...', { filename });

    // Gather core table data snapshots
    const [products, inventory, categories, settings, salesCount] = await Promise.all([
      db('products').whereNull('deleted_at').select('*'),
      db('inventory').select('*'),
      db('categories').select('*'),
      db('settings').select('*'),
      db('sales').count({ count: '*' }).first(),
    ]);

    const backupPayload = {
      meta: {
        system: 'Talaat Market System',
        created_at: new Date().toISOString(),
        version: '1.0.0',
        tables_included: ['products', 'inventory', 'categories', 'settings'],
        total_sales_records: Number(salesCount?.count || 0),
      },
      data: {
        categories,
        products,
        inventory,
        settings,
      },
    };

    const content = JSON.stringify(backupPayload, null, 2);
    // Snapshot contains the full settings/product catalogue, so keep it readable
    // by the service account only (0600) instead of the process umask default.
    fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });

    const stats = fs.statSync(filePath);

    logger.info('Database snapshot backup completed successfully', {
      filename,
      sizeBytes: stats.size,
    });

    return {
      filename,
      timestamp: new Date().toISOString(),
      sizeBytes: stats.size,
    };
  }

  /**
   * List existing backups in the configured `BACKUP_DIR` directory.
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
}

export const backupService = new BackupService();
