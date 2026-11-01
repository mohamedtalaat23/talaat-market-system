// Install only the locked server + desktop production dependency closures.
// This directory is disposable build output; installed customer data is never used.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'packages/desktop/runtime-stage');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const file of ['package.json', 'package-lock.json', ...['server', 'client', 'desktop'].map(p => `packages/${p}/package.json`)]) {
  const destination = path.join(stage, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'ci', '--omit=dev', '--ignore-scripts', '--workspace=packages/server',
  '--workspace=packages/desktop', '--include-workspace-root=false', '--no-audit', '--no-fund',
], { cwd: stage, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const modules = path.join(stage, 'node_modules');
for (const forbidden of ['electron', 'electron-builder', 'typescript', 'eslint', 'vite', 'vitest', 'jest', 'react', '@playwright/test']) {
  if (fs.existsSync(path.join(modules, forbidden))) throw new Error(`Development/client dependency in runtime: ${forbidden}`);
}
// Workspace links are build-time bookkeeping, not runtime dependencies.
for (const entry of fs.readdirSync(modules)) {
  const entryPath = path.join(modules, entry);
  if (fs.lstatSync(entryPath).isSymbolicLink()) fs.unlinkSync(entryPath);
}
const scope = path.join(modules, '@talaat-market');
if (fs.existsSync(scope)) fs.rmSync(scope, { recursive: true });
const packages = Object.entries(JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages)
  .filter(([key]) => key.startsWith('node_modules/') && fs.existsSync(path.join(stage, key, 'package.json')))
  .map(([name, value]) => ({ path: name, version: value.version, integrity: value.integrity }));
fs.writeFileSync(path.join(stage, 'runtime-inventory.json'), JSON.stringify({ packages }, null, 2));
console.log(`Verified ${packages.length} runtime packages; no client/build/test dependencies.`);
