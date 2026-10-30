import fs from 'fs';
import path from 'path';
import { MIN_PASSWORD_LENGTH, generateStrongPassword, isWeakSecret } from '../config/security';

/**
 * First-run administrator provisioning helpers.
 *
 * Extracted from bootstrap.ts so the credential-file contract (location,
 * permissions, format) can be unit-tested without touching a database.
 */

/** File name the desktop shell looks for next to its managed config file. */
export const CREDENTIALS_FILE_NAME = 'initial-admin-credentials.txt';

/**
 * Directory the credentials file is written to.
 *
 * The desktop launcher passes `TALAAT_CONFIG_PATH` (an absolute path to its
 * managed `config.env`), so the credentials land next to it in the per-user
 * app data directory. A plain server install falls back to the working
 * directory.
 */
export function resolveCredentialsDir(configuredConfigPath?: string): string {
  return configuredConfigPath ? path.dirname(configuredConfigPath) : process.cwd();
}

export interface CredentialsWriteResult {
  ok: boolean;
  path?: string;
  error?: string;
}

/**
 * Writes the generated first-run credentials to a private (0600) file.
 *
 * Writing to a file — instead of logging the password — keeps it out of
 * terminal scrollback and log aggregation while still letting the desktop
 * shell surface it to the operator exactly once.
 */
export function writeInitialAdminCredentials(
  username: string,
  password: string,
  targetDir: string = resolveCredentialsDir(process.env['TALAAT_CONFIG_PATH']),
  filename: string = CREDENTIALS_FILE_NAME,
): CredentialsWriteResult {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, path.basename(filename));
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

    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
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
export function resolveInitialPassword(providedRaw?: string | null): {
  password: string;
  generated: boolean;
} {
  const provided = providedRaw?.trim();

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
