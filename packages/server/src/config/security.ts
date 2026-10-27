import crypto from 'crypto';

/**
 * Password / secret hygiene helpers.
 *
 * These are deliberately conservative: the goal is to make it impossible to
 * accidentally ship the well-known development credentials (`admin123`,
 * `1111`, `dev_jwt_secret_...`) into a real installation.
 */

/** Minimum acceptable length for an employee password. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Substrings that identify placeholder or development secrets.
 * Keep this list lowercase — comparisons are case-insensitive.
 */
const WEAK_SECRET_PATTERNS = [
  'change_this',
  'change-this',
  'change_me',
  'change-me',
  'changeme',
  'your_secure',
  'placeholder',
  'dev_jwt_secret',
  'dev_session_secret',
  'dev_password',
  'test_secret',
  'example_secret',
  'secret_key',
  'password123',
];

/** Exact values that are never acceptable, regardless of length. */
const WEAK_SECRET_EXACT = new Set([
  'admin123',
  'admin',
  'password',
  'passw0rd',
  'qwerty',
  'letmein',
  '123456',
  '12345678',
  '123456789',
]);

/** Common trivial PINs that must never be used on a production install. */
const WEAK_PINS = new Set([
  '0000',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '1234',
  '4321',
  '0123',
  '1212',
  '000000',
  '111111',
  '123456',
  '654321',
]);

/**
 * Returns true when a secret/password is weak, a known default, or a
 * placeholder copied from `.env.example`.
 */
export function isWeakSecret(value: string | null | undefined): boolean {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (normalized.length < 8) return true;
  if (WEAK_SECRET_EXACT.has(normalized)) return true;

  return WEAK_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/** Returns true when a 4–6 digit PIN is trivially guessable. */
export function isWeakPin(pin: string | null | undefined): boolean {
  if (!pin) return true;

  const normalized = pin.trim();
  if (!/^\d{4,6}$/.test(normalized)) return true;
  if (WEAK_PINS.has(normalized)) return true;

  // All digits identical (e.g. 7777) is never acceptable.
  return new Set(normalized).size === 1;
}

/**
 * Generates a cryptographically strong, URL-safe password.
 * 18 random bytes → 24 base64url characters (~144 bits of entropy).
 */
export function generateStrongPassword(byteLength = 18): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/**
 * Throws when a production secret is weak. Used during environment validation
 * so the server fails closed instead of starting with a placeholder secret.
 */
export function assertStrongProductionSecret(name: string, value: string): void {
  if (isWeakSecret(value)) {
    throw new Error(
      `${name} is set to a weak or placeholder value. ` +
        'Generate a strong secret (for example: "openssl rand -hex 64") and update ' +
        'your environment file before running in production.',
    );
  }
}
