import bcrypt from 'bcryptjs';
import { db, connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { BCRYPT_ROUNDS } from '../config/constants';
import { isWeakPin } from '../config/security';
import {
  resolveCredentialsDir,
  resolveInitialPassword,
  writeInitialAdminCredentials,
} from './initial-admin';
import { logger } from '../middleware/logger';
import { runCredentialHygiene } from './credential-hygiene';

/**
 * Flags accounts that still hold published default credentials.
 *
 * Never blocks startup: a failure is logged loudly and the server continues
 * (login-time blocking still protects those accounts).
 */
async function applyCredentialHygiene(): Promise<void> {
  try {
    const result = await runCredentialHygiene();
    if (result.skipped) {
      logger.debug('Credential hygiene scan already completed for this installation.');
    }
  } catch (error) {
    logger.error('Credential hygiene scan failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function run(): Promise<void> {
  let exitCode = 0;

  try {
    await connectDatabase();

    const username = env.INITIAL_ADMIN_USERNAME;
    const existingAdmin = await db('employees').where({ username }).first();

    if (existingAdmin) {
      logger.info(`Administrator account "${username}" already exists; skipping creation.`);
      // Upgraded installations may still hold the published defaults; the
      // one-time scan locks those accounts (and is a no-op afterwards).
      await applyCredentialHygiene();
      return;
    }

    const { password, generated } = resolveInitialPassword(env.INITIAL_ADMIN_PASSWORD);
    const pin = env.INITIAL_ADMIN_PIN;

    if (pin && isWeakPin(pin)) {
      throw new Error(
        'INITIAL_ADMIN_PIN is trivially guessable (repeated/sequential digits). Choose a different PIN.',
      );
    }

    // Persist the credentials BEFORE creating the account. If the file cannot be
    // written and the password was generated, the password is unrecoverable —
    // aborting here leaves the database untouched so the operator can simply set
    // INITIAL_ADMIN_PASSWORD and re-run the bootstrap.
    const credentials = writeInitialAdminCredentials(
      username,
      password,
      resolveCredentialsDir(process.env['TALAAT_CONFIG_PATH']),
    );

    if (!credentials.ok) {
      logger.error('Failed to write initial admin credentials file', {
        error: credentials.error,
      });

      if (generated) {
        throw new Error(
          'Refusing to create the first-run administrator: the generated password could not be ' +
            'written to disk, so it could never be communicated. Set INITIAL_ADMIN_PASSWORD and ' +
            're-run the bootstrap.',
        );
      }

      logger.warn(
        'Continuing without a credentials file because INITIAL_ADMIN_PASSWORD was provided.',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const pinHash = pin ? await bcrypt.hash(pin, BCRYPT_ROUNDS) : null;

    await db('employees').insert({
      full_name: 'System Administrator',
      username,
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'admin',
      is_active: true,
      // Force a rotation so the provisioning password is never long-lived.
      must_change_password: true,
    });

    logger.warn(
      'Created first-run administrator account. A password change is required at first login.',
      {
        username,
        passwordGenerated: generated,
        credentialsFile: credentials.path ?? '(not written — INITIAL_ADMIN_PASSWORD was provided)',
      },
    );

    // Newly provisioned accounts already force a rotation; the scan keeps the
    // behaviour identical on fresh and upgraded databases.
    await applyCredentialHygiene();
  } catch (error) {
    exitCode = 1;
    logger.error('Database bootstrap failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await disconnectDatabase().catch((error) => {
      logger.error('Error closing database connection during bootstrap', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    process.exit(exitCode);
  }
}

void run();
