import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../middleware/logger';
import { restoreService } from '../services/restore.service';

/**
 * Restore CLI.
 *
 *   # 1. validate only (default) — reads the file, checks checksum/schema/FKs,
 *   #    confirms the target is empty. Nothing is written.
 *   npm run db:restore -- --file talaat-market-full-2026-01-01T00-00-00-000Z.json \
 *                          --target talaat_market_restore
 *
 *   # 2. apply into the separate database
 *   npm run db:restore -- --file <name>.json --target talaat_market_restore --apply
 *
 * The target database must already exist and be migrated:
 *   createdb talaat_market_restore
 *   DB_NAME=talaat_market_restore npm run db:migrate
 *
 * The live database is never a valid target; promotion is a manual, offline step.
 */
interface CliOptions {
  file: string | undefined;
  target: string | undefined;
  apply: boolean;
  allowNonEmpty: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    file: undefined,
    target: undefined,
    apply: false,
    allowNonEmpty: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      options.file = argv[i + 1];
      i += 1;
    } else if (arg === '--target') {
      options.target = argv[i + 1];
      i += 1;
    } else if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--allow-non-empty') {
      options.allowNonEmpty = true;
    } else if (arg?.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.file) throw new Error('--file <backup.json> is required.');
  if (!options.target) throw new Error('--target <database> is required.');
  if (options.allowNonEmpty && !options.apply) {
    throw new Error('--allow-non-empty is only meaningful together with --apply.');
  }

  return options;
}

async function run(): Promise<void> {
  let exitCode = 0;

  try {
    const options = parseArgs(process.argv.slice(2));

    // Connect to the *live* database only to read environment-level validation
    // (the restore target is a separate connection). No writes happen there.
    await connectDatabase();

    const report = await restoreService.restore({
      file: String(options.file),
      targetDatabase: String(options.target),
      apply: options.apply,
      allowNonEmpty: options.allowNonEmpty,
    });

    logger.info(
      options.apply
        ? 'Restore applied to the target database'
        : 'Restore validation passed (dry run — nothing written)',
      {
        file: report.file,
        targetDatabase: report.targetDatabase,
        tables: report.tables,
        rows: Object.values(report.rowCounts).reduce((sum, count) => sum + count, 0),
        credentialsIncluded: report.credentialsIncluded,
      },
    );

    for (const warning of report.warnings) {
      logger.warn(warning);
    }

    if (options.apply) {
      logger.warn(
        'The live database was NOT modified. To promote the restored database: stop the server, ' +
          'rename/swap the databases, verify the login flow, then start the server again.',
      );
    }
  } catch (error) {
    exitCode = 1;
    logger.error('Restore failed', {
      code: (error as { code?: string }).code,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await disconnectDatabase().catch(() => undefined);
    process.exit(exitCode);
  }
}

void run();
