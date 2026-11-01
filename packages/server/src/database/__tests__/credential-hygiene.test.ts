import bcrypt from 'bcryptjs';
import {
  detectCompromisedCredentials,
  type CredentialCandidate,
} from '../credential-hygiene';

/**
 * Existing-install credential security.
 *
 * Migration 034 only protects accounts created after it ran. These tests pin the
 * detection that finds accounts still holding the credentials published in this
 * repository, using real bcrypt hashes (low cost factor to keep the suite fast).
 */
jest.mock('../../middleware/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../config/database', () => {
  const mockDb: any = jest.fn();
  mockDb.raw = jest.fn();
  mockDb.fn = { now: () => 'now' };
  return { db: mockDb };
});

function hash(secret: string): string {
  return bcrypt.hashSync(secret, 4);
}

function candidate(overrides: Partial<CredentialCandidate> = {}): CredentialCandidate {
  return {
    id: 1,
    username: 'admin',
    password_hash: hash('admin123'),
    pin_hash: hash('1111'),
    ...overrides,
  };
}

describe('detectCompromisedCredentials', () => {
  it('flags a password published in the seed/README', async () => {
    const result = await detectCompromisedCredentials([candidate()]);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.reasons).toContain('default_password');
  });

  it('flags the published manager/cashier seed passwords', async () => {
    const result = await detectCompromisedCredentials([
      candidate({ id: 2, username: 'manager', password_hash: hash('manager123'), pin_hash: null }),
      candidate({ id: 3, username: 'cashier', password_hash: hash('cashier123'), pin_hash: null }),
    ]);

    expect(result.findings.map((finding) => finding.username)).toEqual(['manager', 'cashier']);
  });

  it('flags a trivial PIN independently of the password', async () => {
    const result = await detectCompromisedCredentials([
      candidate({
        id: 4,
        username: 'supervisor',
        password_hash: hash('Zx9Qw7Er5Ty2Ui4O'),
        pin_hash: hash('1234'),
      }),
    ]);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.reasons).toEqual(['default_pin']);
  });

  it('does not flag a strong, unique credential', async () => {
    const result = await detectCompromisedCredentials([
      candidate({
        id: 5,
        username: 'owner',
        password_hash: hash('Zm4Rr9-Tk2Lp7-Qw8Xs1'),
        pin_hash: hash('482913'),
      }),
    ]);

    expect(result.findings).toHaveLength(0);
  });

  it('never returns the credential material', async () => {
    const result = await detectCompromisedCredentials([candidate()]);
    const serialized = JSON.stringify(result.findings);

    expect(serialized).not.toContain('admin123');
    expect(serialized).not.toContain('1111');
    expect(serialized).not.toContain('$2');
  });

  it('stops at the comparison budget instead of scanning forever', async () => {
    const result = await detectCompromisedCredentials(
      [candidate(), candidate({ id: 6, username: 'second' })],
      { maxComparisons: 3 },
    );

    expect(result.truncated).toBe(true);
    expect(result.comparisons).toBe(3);
  });
});
