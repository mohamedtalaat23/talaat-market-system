import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db, connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { BCRYPT_ROUNDS } from '../config/constants';
import {
  MIN_PASSWORD_LENGTH,
  generateStrongPassword,
  isWeakPin,
  isWeakSecret,
} from '../config/security';
import { logger } from '../middleware/logger';

const CREDENTIALS_FILE_NAME = 'initial-admin-credentials.txt';

/**
 * Writes the generated first-run credentials to a private (0600) file.
 *
 * Writing to a file — instead of logging the password — keeps it out of
 * terminal scrollback and log aggregation while still letting the desktop
 * shell surface it to the operator exactly once.
 */
function writeCredentialsFile(username: string, password: string): string | null {
  const configPath = process.env['TALAAT_CONFIG_PATH'];
  const targetDir = configPath ? path.dirname(configPath) : process.cwd();

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, CREDENTIALS_FILE_NAME);
    const body = [
      '# Talaat Market — initial administrator credentials',
      '# Log in with these values, then change the password immediately.',
      '# Delete this file once the password has been rotated.',
      `username=${username}`,
      `password=${password}`,
      '',
    ].join('\n');

    fs.writeFileSync(filePath, body, { encoding: 'utf8', mode: 0o600 });
    // `mode` is ignored on some platforms; enforce it explicitly where possible.
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // Non-POSIX filesystems (e.g. Windows) do not support chmod.
    }

    return filePath;
  } catch (error) {
    logger.error('Failed to write initial admin credentials file', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Resolves the password for the first-run administrator.
 *
 * - `INITIAL_ADMIN_PASSWORD` when provided (must be strong).
 * - Otherwise a cryptographically random password is generated.
 *
 * The old behaviour — silently creating `admin` / `admin123` / PIN `1111` —
 * is intentionally removed: those credentials are published in the README and
 * are therefore compromised on every installation that shipped with them.
 */
function resolveInitialPassword(): { password: string; generated: boolean } {
  const provided = env.INITIAL_ADMIN_PASSWORD?.trim();

  if (!provided) {
    return { password: generateStrongPassword(), generated: true };
  }

  if (provided.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `INITIAL_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (isWeakSecret(provided)) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD is a known default or placeholder value. Choose a unique password.',
    );
  }

  return { password: provided, generated: false };
}

async function run(): Promise<void> {
  let exitCode = 0;

  try {
    await connectDatabase();

    const username = env.INITIAL_ADMIN_USERNAME;
    const existingAdmin = await db('employees').where({ username }).first();

    if (existingAdmin) {
      logger.info(`Administrator account "${username}" already exists; skipping creation.`);
      return;
    }

    const { password, generated } = resolveInitialPassword();
    const pin = env.INITIAL_ADMIN_PIN;

    if (pin && isWeakPin(pin)) {
      throw new Error(
        'INITIAL_ADMIN_PIN is trivially guessable (repeated/sequential digits). Choose a different PIN.',
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

    const credentialsFile = writeCredentialsFile(username, password);

    logger.warn(
      'Created first-run administrator account. A password change is required at first login.',
      {
        username,
        passwordGenerated: generated,
        credentialsFile: credentialsFile ?? '(could not be written — set INITIAL_ADMIN_PASSWORD)',
      },
    );
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

