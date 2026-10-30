import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertPasswordAuthentication } from '../postgres-security';

describe('managed PostgreSQL authentication policy', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-hba-'));
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  it.each(['host all all 127.0.0.1/32 trust', 'local all all trust', 'host all all ::1/128 trust'])(
    'refuses %s without editing the file',
    (rule) => {
      const file = path.join(directory, 'pg_hba.conf');
      fs.writeFileSync(file, rule);
      expect(() => assertPasswordAuthentication(file)).toThrow(/passwordless/);
      expect(fs.readFileSync(file, 'utf8')).toBe(rule);
    },
  );
  it('accepts password-authenticated rules and ignores commented trust examples', () => {
    const file = path.join(directory, 'pg_hba.conf');
    fs.writeFileSync(
      file,
      '# host all all 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\nlocal all all scram-sha-256',
    );
    expect(() => assertPasswordAuthentication(file)).not.toThrow();
  });
});
