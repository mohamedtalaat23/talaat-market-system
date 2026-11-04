const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const manifest = require('../vendor/postgres/windows-runtime.json');
const directory = path.resolve(__dirname, '../vendor/postgres/win-x64');
const executables = ['initdb', 'postgres', 'pg_ctl', 'createdb', 'psql', 'pg_dump', 'pg_restore'];
const support = [
  'lib',
  'share',
  'share/postgresql.conf.sample',
  'share/pg_hba.conf.sample',
  'share/extension/pgcrypto.control',
  'share/extension/pg_trgm.control',
  'lib/pgcrypto.dll',
  'lib/pg_trgm.dll',
];
function verifyArchive(file, expected = manifest.sha256) {
  // Stream in acquisition; this helper also makes corrupted-archive rejection testable.
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== expected)
    throw new Error('PostgreSQL archive SHA-256 mismatch; nothing extracted.');
  return digest;
}
function validateRuntime(
  root = directory,
  { execute = process.platform === 'win32', run = spawnSync } = {},
) {
  const missing = [...executables.map((name) => `bin/${name}.exe`), ...support].filter(
    (file) => !fs.existsSync(path.join(root, file)),
  );
  for (const name of ['bin', 'lib', 'share']) {
    const entry = path.join(root, name);
    if (fs.existsSync(entry) && !fs.statSync(entry).isDirectory())
      missing.push(`${name} (directory required)`);
  }
  if (missing.length)
    throw new Error(`Incomplete Windows PostgreSQL runtime: ${missing.join(', ')}`);
  const noticeNames = fs
    .readdirSync(root)
    .filter((name) => /(copyright|license|licence|notice)/i.test(name));
  if (
    !noticeNames.some(
      (name) =>
        /^(copyright(?:\..+)?|server_licen[cs]e\.txt)$/i.test(name) &&
        fs.statSync(path.join(root, name)).isFile(),
    )
  )
    throw new Error('PostgreSQL distribution copyright/license notice is missing.');
  const receiptPath = path.join(root, 'runtime-provenance.json');
  if (!fs.existsSync(receiptPath))
    throw new Error('Runtime acquisition provenance is missing; run prepare-windows-runtime.cjs.');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (
    receipt.sha256 !== manifest.sha256 ||
    receipt.version !== manifest.version ||
    receipt.url !== manifest.url
  )
    throw new Error('Runtime provenance does not match the pinned distribution.');
  if (execute)
    for (const name of executables) {
      const result = run(path.join(root, 'bin', `${name}.exe`), ['--version'], {
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      });
      if (
        result.error ||
        result.status !== 0 ||
        !new RegExp(`PostgreSQL\\)?\\s+${manifest.version.replace('.', '\\.')}([\\s-]|$)`).test(
          result.stdout || '',
        )
      )
        throw new Error(
          `Wrong or unusable runtime version: ${name}; expected PostgreSQL ${manifest.version}.`,
        );
    }
  return {
    version: manifest.version,
    architecture: manifest.architecture,
    sha256: receipt.sha256,
    noticeNames,
  };
}
module.exports = { manifest, directory, executables, support, verifyArchive, validateRuntime };
