const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { manifest, validateRuntime } = require('./windows-runtime.cjs');
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'packages/desktop/release');
const resources = path.join(release, 'win-unpacked/resources');
function required(relative) {
  if (!fs.existsSync(path.join(resources, relative)))
    throw new Error(`Packaged resource missing: ${relative}`);
}
async function main() {
  for (const file of [
    'client/dist/index.html',
    'client/dist/fonts/cairo-400.ttf',
    'client/dist/fonts/inter-OFL.txt',
    'client/dist/fonts/cairo-OFL.txt',
    'client/dist/fonts/jetbrainsmono-OFL.txt',
    'server/dist/index.js',
    'server/dist/migrations/037_offline_reconciliation.js',
    'server/dist/migrations/038_purchase_receipt_idempotency.js',
    'node_modules/knex/package.json',
    'runtime-inventory.json',
    'app.asar',
  ])
    required(file);
  for (const name of [
    'electron',
    'electron-builder',
    'typescript',
    'eslint',
    'vite',
    'vitest',
    'jest',
    'react',
    '@playwright/test',
  ])
    if (fs.existsSync(path.join(resources, 'node_modules', name)))
      throw new Error(`Development tool included: ${name}`);
  // Scan paths only, never collect contents of app data or configuration files.
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const p = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(p);
      else if (
        /^\.env(?:\.|$)|^config\.env$|^initial-admin-credentials|^recovery-.*\.txt$/i.test(
          entry.name,
        )
      )
        throw new Error(`Configuration/credential file packaged: ${path.relative(resources, p)}`);
    }
  }
  scan(resources);
  const asar = await import('@electron/asar');
  const entries = asar.listPackage(path.join(resources, 'app.asar'));
  if (!entries.some((file) => file.replaceAll('\\', '/').endsWith('/dist/preload.js')))
    throw new Error('Packaged preload is missing.');
  if (
    entries.some((file) =>
      /(^|[\/\\])(?:\.env(?:\.[^/\\]+)?|config\.env|recovery-[^/\\]+\.txt)$/.test(file),
    )
  )
    throw new Error('Configuration data found inside app archive.');
  const installers = fs.readdirSync(release).filter((file) => file.endsWith('.exe'));
  if (installers.length !== 1)
    throw new Error(`Expected one installer, found ${installers.length}.`);
  const evidence = path.join(release, 'pilot-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const installer = installers[0];
  const checksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(release, installer)))
    .digest('hex');
  fs.writeFileSync(path.join(evidence, 'SHA256SUMS.txt'), `${checksum}  ${installer}\n`);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const desktop = require('../packages/desktop/package.json');
  const builder = fs.readFileSync(path.join(root, 'packages/desktop/electron-builder.yml'), 'utf8');
  const record = {
    kind: 'unsigned-internal-candidate',
    commit,
    node: process.version,
    electron: builder.match(/^electronVersion:\s*(.+)$/m)[1].trim(),
    applicationVersion: desktop.version,
    postgresql: manifest,
    installer: { filename: installer, sha256: checksum },
    runtime: validateRuntime(path.join(resources, 'postgres/win-x64')),
    nativeInstallerAcceptance: 'not-tested',
    hardwareAcceptance: 'not-tested',
    fiscalAcceptance: 'not-tested',
  };
  fs.writeFileSync(path.join(evidence, 'build-manifest.json'), JSON.stringify(record, null, 2));
  fs.copyFileSync(
    path.join(resources, 'runtime-inventory.json'),
    path.join(evidence, 'runtime-inventory.json'),
  );
  fs.copyFileSync(
    path.join(resources, 'postgres/win-x64/runtime-provenance.json'),
    path.join(evidence, 'postgres-provenance.json'),
  );
  console.log(
    JSON.stringify({ commit, installer, sha256: checksum, packagedResourcesVerified: true }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
