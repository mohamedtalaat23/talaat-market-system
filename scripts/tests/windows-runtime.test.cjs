const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  manifest,
  executables,
  support,
  validateRuntime,
  verifyArchive,
} = require('../windows-runtime.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-runtime-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const item of [...executables.map((name) => `bin/${name}.exe`), ...support]) {
    const file = path.join(root, item);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (['lib', 'share'].includes(item)) fs.mkdirSync(file, { recursive: true });
    else fs.writeFileSync(file, 'synthetic fixture');
  }
  fs.writeFileSync(path.join(root, 'COPYRIGHT'), 'Synthetic test notice');
  fs.writeFileSync(path.join(root, 'runtime-provenance.json'), JSON.stringify(manifest));
  return root;
}
test('rejects a corrupt archive before extraction', (t) => {
  const root = fixture(t);
  const archive = path.join(root, 'test.zip');
  fs.writeFileSync(archive, 'corrupt');
  assert.throws(() => verifyArchive(archive), /SHA-256 mismatch/);
});
test('requires every executable, support files and notices', (t) => {
  for (const file of [
    ...executables.map((name) => `bin/${name}.exe`),
    'share/extension/pgcrypto.control',
    'lib/pg_trgm.dll',
    'COPYRIGHT',
    'lib',
    'share',
  ]) {
    const root = fixture(t);
    fs.rmSync(path.join(root, file), { recursive: true });
    assert.throws(() => validateRuntime(root, { execute: false }), /Incomplete|notice/);
  }
});
test('rejects a wrong executable version and validates each pinned tool', (t) => {
  const root = fixture(t);
  let calls = 0;
  const run = () => {
    calls++;
    return { status: 0, stdout: 'postgres (PostgreSQL) 16.15\n' };
  };
  assert.equal(validateRuntime(root, { execute: true, run }).version, '16.15');
  assert.equal(calls, 7);
  assert.throws(
    () =>
      validateRuntime(root, {
        execute: true,
        run: () => ({ status: 0, stdout: 'postgres (PostgreSQL) 17.1' }),
      }),
    /version/,
  );
});
test('rejects substituted acquisition metadata', (t) => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, 'runtime-provenance.json'),
    JSON.stringify({ ...manifest, sha256: '0'.repeat(64) }),
  );
  assert.throws(() => validateRuntime(root, { execute: false }), /provenance/);
});
