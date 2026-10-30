import bcrypt from 'bcryptjs';
import { db, connectDatabase, disconnectDatabase } from '../config/database';
import { BCRYPT_ROUNDS } from '../config/constants';
import { generateStrongPassword, isWeakPin } from '../config/security';
import { logger } from '../middleware/logger';
import { resolveCredentialsDir, writeInitialAdminCredentials } from './initial-admin';

/**
 * Operator recovery CLI for credential rotation.
 *
 * Usage (run on the machine that hosts the database — this is intentionally a
 * local-shell-only operation, there is no HTTP endpoint for it):
 *
 *   npm run admin:rotate -- --username admin
 *   npm run admin:rotate -- --username admin --pin 482913
 *   npm run admin:rotate -- --all [--dry-run]
 *
 * What it does:
 *   - generates a cryptographically strong password for the account;
 *   - clears `credential_rotation_required`, forces `must_change_password`;
 *   - bumps `auth_epoch`, so every existing session/token for the account dies;
 *   - writes the new credential to a 0600 file next to the managed config
 *     (`initial-admin-credentials.txt`) and prints only the path — the secret is
 *     never written to logs or terminal scrollback.
 *
 * `--all` re-issues credentials for *every* employee that is currently flagged
 * (never for unflagged accounts), which is the documented mass-recovery path.
 */
interface CliOptions {
  username: string | undefined;
  pin: string | undefined;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { username: undefined, pin: undefined, all: false, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--username') {
      options.username = argv[i + 1];
      i += 1;
    } else if (arg === '--pin') {
      options.pin = argv[i + 1];
      i += 1;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg?.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.all && !options.username) {
    throw new Error('Provide --username <name> or --all.');
  }

  return options;
}

async function rotateOne(
  employee: { id: number; username: string },
  options: CliOptions,
): Promise<void> {
  if (options.dryRun) {
    logger.info(`[dry-run] Would rotate credentials for ${employee.username}`);
    return;
  }

  const password = generateStrongPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const pinHash = options.pin ? await bcrypt.hash(options.pin, BCRYPT_ROUNDS) : undefined;

  await db('employees').where('id', employee.id).update({
    password_hash: passwordHash,
    ...(pinHash ? { pin_hash: pinHash } : {}),
    credential_rotation_required: false,
    must_change_password: true,
    password_changed_at: new Date(),
    failed_login_attempts: 0,
    locked_until: null,
    failed_pin_attempts: 0,
    pin_locked_until: null,
    auth_epoch: db.raw('auth_epoch + 1'),
    updated_at: db.fn.now(),
  });

  const file = writeInitialAdminCredentials(
    employee.username,
    password,
    resolveCredentialsDir(process.env['TALAAT_CONFIG_PATH']),
  );

  logger.warn('Rotated credentials for employee', {
    username: employee.username,
    credentialsFile: file.ok ? file.path : '(could not be written — copy the password from the operator console)',
    pinRotated: Boolean(options.pin),
  });
}

async function run(): Promise<void> {
  let exitCode = 0;

  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.pin && isWeakPin(options.pin)) {
      throw new Error(
        'The supplied PIN is trivially guessable (repeated/sequential digits). Choose a different PIN.',
      );
    }

    await connectDatabase();

    if (options.all) {
      const flagged = await db('employees')
        .select('id', 'username')
        .where({ credential_rotation_required: true })
        .whereNull('deleted_at');

      if (flagged.length === 0) {
        logger.info('No accounts are currently flagged for credential rotation.');
      }

      for (const employee of flagged) {
        await rotateOne(employee, options);
      }

      logger.info('Credential rotation complete', { accounts: flagged.length });
    } else {
      const employee = await db('employees')
        .select('id', 'username')
        .where({ username: options.username })
        .whereNull('deleted_at')
        .first();

      if (!employee) {
        throw new Error(`No active employee found with username "${options.username}".`);
      }

      await rotateOne(employee, options);
    }
  } catch (error) {
    exitCode = 1;
    logger.error('Credential rotation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await disconnectDatabase().catch(() => undefined);
    process.exit(exitCode);
  }
}

void run();
