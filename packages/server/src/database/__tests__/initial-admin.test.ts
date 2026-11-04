import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CREDENTIALS_FILE_NAME,
  resolveCredentialsDir,
  resolveInitialPassword,
  writeInitialAdminCredentials,
} from '../initial-admin';
import { MIN_PASSWORD_LENGTH } from '../../config/security';

/**
 * These tests pin the first-run administrator contract that the desktop shell
 * depends on: file name, location, permissions, parseable `username=` /
 * `password=` lines, and a fail-closed path when the password cannot be
 * persisted.
 */
describe('first-run administrator credential handling', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-credentials-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('keeps each recovered employee credential in a separate private file', () => {
    const a = writeInitialAdminCredentials(
      'employee-a',
      'synthetic-password-a',
      workDir,
      'recovery-a.txt',
    );
    const b = writeInitialAdminCredentials(
      'employee-b',
      'synthetic-password-b',
      workDir,
      'recovery-b.txt',
    );
    expect(a.ok && b.ok).toBe(true);
    expect(fs.readFileSync(a.path!, 'utf8')).toContain('username=employee-a');
    expect(fs.readFileSync(b.path!, 'utf8')).toContain('username=employee-b');
  });

  describe('resolveCredentialsDir', () => {
    it('writes next to the managed config file when TALAAT_CONFIG_PATH is set', () => {
      const configPath = path.join(workDir, 'config.env');

      expect(resolveCredentialsDir(configPath)).toBe(workDir);
    });

    it('falls back to the process working directory for plain server installs', () => {
      expect(resolveCredentialsDir(undefined)).toBe(process.cwd());
    });
  });

  describe('writeInitialAdminCredentials', () => {
    it('requests owner-only permissions and writes credentials the desktop shell can parse', () => {
      const write = jest.spyOn(fs, 'writeFileSync');
      const chmod = jest.spyOn(fs, 'chmodSync');
      const result = writeInitialAdminCredentials('admin', 'S3cret-Value-For-Test', workDir);

      expect(result.ok).toBe(true);
      expect(result.path).toBe(path.join(workDir, CREDENTIALS_FILE_NAME));

      const content = fs.readFileSync(result.path as string, 'utf8');
      expect(content).toMatch(/^username=admin$/m);
      expect(content).toMatch(/^password=S3cret-Value-For-Test$/m);
      // Same regexes the Electron main process uses to surface the password.
      expect(/^username=(.*)$/m.exec(content)?.[1]).toBe('admin');
      expect(/^password=(.*)$/m.exec(content)?.[1]).toBe('S3cret-Value-For-Test');

      expect(write).toHaveBeenCalledWith(result.path, expect.any(String), {
        encoding: 'utf8',
        mode: 0o600,
      });
      expect(chmod).toHaveBeenCalledWith(result.path, 0o600);
      // Windows reports writable files as 0666; privacy there depends on the
      // per-user AppData ACL and remains part of restricted-user pilot acceptance.
      if (process.platform !== 'win32') {
        expect(fs.statSync(result.path as string).mode & 0o777).toBe(0o600);
      }
      write.mockRestore();
      chmod.mockRestore();
    });

    it('creates the parent directory when it does not exist yet', () => {
      const nested = path.join(workDir, 'app-data', 'talaat');

      const result = writeInitialAdminCredentials('admin', 'another-strong-value', nested);

      expect(result.ok).toBe(true);
      expect(fs.existsSync(result.path as string)).toBe(true);
    });

    it('reports failure instead of throwing when the target is not writable', () => {
      // A regular file used as the parent directory makes mkdir/write fail.
      const blocker = path.join(workDir, 'not-a-directory');
      fs.writeFileSync(blocker, 'x');

      const result = writeInitialAdminCredentials('admin', 'irrelevant', path.join(blocker, 'sub'));

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.path).toBeUndefined();
    });
  });

  describe('resolveInitialPassword', () => {
    it('generates a strong password when INITIAL_ADMIN_PASSWORD is absent', () => {
      const { password, generated } = resolveInitialPassword(undefined);

      expect(generated).toBe(true);
      expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
      expect(resolveInitialPassword(null).generated).toBe(true);
      expect(resolveInitialPassword('   ').generated).toBe(true);
    });

    it('never repeats a generated password', () => {
      const generated = new Set(
        Array.from({ length: 20 }, () => resolveInitialPassword().password),
      );

      expect(generated.size).toBe(20);
    });

    it('uses an explicitly provided strong password', () => {
      const { password, generated } = resolveInitialPassword('a-strong-unique-passphrase');

      expect(generated).toBe(false);
      expect(password).toBe('a-strong-unique-passphrase');
    });

    it('refuses the historical default credentials', () => {
      // `admin123` is rejected by the length policy first, long placeholders by the
      // weak-secret policy — both must never become a real administrator password.
      expect(() => resolveInitialPassword('admin123')).toThrow(/at least/i);
      expect(() => resolveInitialPassword('admin-password-please-change-me')).toThrow(
        /known default|placeholder/i,
      );
    });

    it('refuses a password shorter than the policy minimum', () => {
      expect(() => resolveInitialPassword('short-pass')).toThrow(
        new RegExp(String(MIN_PASSWORD_LENGTH)),
      );
    });
  });
});
