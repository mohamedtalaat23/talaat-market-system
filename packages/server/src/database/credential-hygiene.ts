import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { logger } from '../middleware/logger';
import { KNOWN_DEFAULT_PASSWORDS, KNOWN_DEFAULT_PINS } from '../config/security';

/**
 * Detection of credentials that are known to be compromised.
 *
 * Migration 034 only makes *new* accounts rotate their password; it does nothing
 * for installations that were provisioned earlier with the published defaults
 * (`admin` / `admin123`, PIN `1111`, `manager123`, `cashier123`). Those accounts
 * stayed usable forever because `must_change_password` defaulted to false.
 *
 * This module finds them. It works on bcrypt hashes, so it can only test a small
 * candidate list per account — the list is deliberately short (the credentials
 * that were published) and the number of comparisons is capped so a large staff
 * table cannot stall startup.
 */

export type CompromiseReason = 'default_password' | 'default_pin';

export interface CredentialCandidate {
  id: number;
  username: string;
  password_hash: string | null;
  pin_hash: string | null;
}

export interface CompromiseFinding {
  id: number;
  username: string;
  reasons: CompromiseReason[];
}

export interface DetectionOptions {
  passwordCandidates?: readonly string[];
  pinCandidates?: readonly string[];
  /** Hard cap on bcrypt comparisons (each one is intentionally expensive). */
  maxComparisons?: number;
}

const DEFAULT_MAX_COMPARISONS = 240;

/**
 * Compares each candidate hash against the published default credentials.
 *
 * Returns only the accounts that matched, with the reason(s). Never returns or
 * logs a password, PIN or hash.
 */
export async function detectCompromisedCredentials(
  candidates: readonly CredentialCandidate[],
  options: DetectionOptions = {},
): Promise<{ findings: CompromiseFinding[]; comparisons: number; truncated: boolean }> {
  const passwordCandidates = options.passwordCandidates ?? KNOWN_DEFAULT_PASSWORDS;
  const pinCandidates = options.pinCandidates ?? KNOWN_DEFAULT_PINS;
  const maxComparisons = options.maxComparisons ?? DEFAULT_MAX_COMPARISONS;

  const findings: CompromiseFinding[] = [];
  let comparisons = 0;
  let truncated = false;

  for (const candidate of candidates) {
    const reasons: CompromiseReason[] = [];

    if (candidate.password_hash) {
      for (const known of passwordCandidates) {
        if (comparisons >= maxComparisons) {
          truncated = true;
          break;
        }
        comparisons += 1;
        if (await bcrypt.compare(known, candidate.password_hash)) {
          reasons.push('default_password');
          break;
        }
      }
    }

    if (candidate.pin_hash && !truncated) {
      for (const known of pinCandidates) {
        if (comparisons >= maxComparisons) {
          truncated = true;
          break;
        }
        comparisons += 1;
        if (await bcrypt.compare(known, candidate.pin_hash)) {
          reasons.push('default_pin');
          break;
        }
      }
    }

    if (reasons.length > 0) {
      findings.push({ id: candidate.id, username: candidate.username, reasons });
    }

    if (truncated) break;
  }

  return { findings, comparisons, truncated };
}

export interface HygieneResult {
  scanned: number;
  flagged: number;
  comparisons: number;
  truncated: boolean;
  skipped: boolean;
}

/** Settings key holding the one-time scan marker (no secrets, no PII). */
export const HYGIENE_MARKER_KEY = 'security_credential_hygiene';
const HYGIENE_MARKER_VERSION = 1;

async function hasCompletedScan(): Promise<boolean> {
  try {
    const row = await db('settings').where({ key: HYGIENE_MARKER_KEY }).first();
    const value = row?.value;
    return Boolean(value && Number(value.version) >= HYGIENE_MARKER_VERSION);
  } catch {
    // Missing table / permissions problems must not prevent the scan.
    return false;
  }
}

async function recordScan(result: HygieneResult): Promise<void> {
  try {
    await db('settings')
      .insert({
        key: HYGIENE_MARKER_KEY,
        value: JSON.stringify({
          version: HYGIENE_MARKER_VERSION,
          scanned_at: new Date().toISOString(),
          flagged_accounts: result.flagged,
          final: !result.truncated,
        }),
        updated_at: db.fn.now(),
      })
      .onConflict('key')
      .merge(['value', 'updated_at']);
  } catch (error) {
    logger.warn('Could not persist the credential hygiene marker', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Runs the detection and flags every matching account.
 *
 * Flagging sets `credential_rotation_required` (login is refused until an
 * operator rotates the credential locally) and bumps `auth_epoch` so any token
 * already issued to that account stops working.
 *
 * The scan is a one-time operation (bcrypt comparisons are deliberately
 * expensive). It is skipped when a completed marker exists unless `force` is set.
 * A truncated scan is never marked complete, so the next start resumes it.
 */
export async function runCredentialHygiene(
  options: DetectionOptions & { dryRun?: boolean; force?: boolean } = {},
): Promise<HygieneResult> {
  if (!options.force && (await hasCompletedScan())) {
    return { scanned: 0, flagged: 0, comparisons: 0, truncated: false, skipped: true };
  }

  const candidates = await db('employees')
    .select('id', 'username', 'password_hash', 'pin_hash')
    .whereNull('deleted_at');

  const { findings, comparisons, truncated } = await detectCompromisedCredentials(
    candidates as CredentialCandidate[],
    options,
  );

  if (!options.dryRun) {
    for (const finding of findings) {
      await db('employees').where('id', finding.id).update({
        credential_rotation_required: true,
        must_change_password: true,
        auth_epoch: db.raw('auth_epoch + 1'),
        updated_at: db.fn.now(),
      });
    }
  }

  const result: HygieneResult = {
    scanned: candidates.length,
    flagged: findings.length,
    comparisons,
    truncated,
    skipped: false,
  };

  if (findings.length > 0) {
    logger.warn(
      'Credential hygiene: accounts using published default credentials were disabled pending rotation',
      {
        flagged: findings.length,
        // Usernames are operational identifiers, not customer data; passwords,
        // PINs and hashes are never logged.
        usernames: findings.map((finding) => finding.username),
        reasons: findings.map((finding) => finding.reasons.join('+')),
        dryRun: options.dryRun ?? false,
        comparisons,
      },
    );
  } else {
    logger.info('Credential hygiene: no published default credentials detected', { comparisons });
  }

  if (truncated) {
    logger.warn(
      'Credential hygiene stopped early because the comparison budget was exhausted. ' +
        'Run `npm run security:audit-credentials` to complete the scan.',
      { comparisons },
    );
  }

  if (!options.dryRun && !truncated) {
    await recordScan(result);
  }

  return result;
}
