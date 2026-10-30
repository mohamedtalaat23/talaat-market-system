import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../middleware/logger';
import { runCredentialHygiene } from './credential-hygiene';

/**
 * Read-only audit of employee credentials against the published defaults.
 *
 *   npm run security:audit-credentials            # report only
 *   npm run security:audit-credentials -- --apply # also lock the accounts
 *
 * `--apply` is exactly what the server performs automatically at startup when it
 * detects a compromised account; running it here lets an operator see the result
 * before upgrading, or re-run it on demand.
 */
async function run(): Promise<void> {
  let exitCode = 0;

  try {
    const apply = process.argv.includes('--apply');

    await connectDatabase();

    const result = await runCredentialHygiene({ dryRun: !apply });

    logger.info('Credential audit finished', {
      scanned: result.scanned,
      flagged: result.flagged,
      applied: apply,
      comparisons: result.comparisons,
      truncated: result.truncated,
    });

    if (result.flagged > 0 && !apply) {
      logger.warn(
        'Accounts using published default credentials were found. Re-run with --apply to lock them, ' +
          'then rotate them with: npm run admin:rotate -- --all',
      );
    }
  } catch (error) {
    exitCode = 1;
    logger.error('Credential audit failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await disconnectDatabase().catch(() => undefined);
    process.exit(exitCode);
  }
}

void run();
