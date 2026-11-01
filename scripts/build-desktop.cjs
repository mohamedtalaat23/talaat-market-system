const { build } = require('esbuild');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(root, 'packages/desktop/tsconfig.json')], { stdio: 'inherit' });
build({
  entryPoints: [path.join(root, 'packages/desktop/src/preload.ts')],
  outfile: path.join(root, 'packages/desktop/dist/preload.js'),
  bundle: true, platform: 'node', format: 'cjs', external: ['electron'],
}).catch(() => { process.exitCode = 1; });
