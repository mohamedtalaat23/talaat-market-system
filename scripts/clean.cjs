const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targets = [
  'node_modules',
  'packages/client/dist',
  'packages/client/node_modules',
  'packages/server/dist',
  'packages/server/node_modules',
  'packages/desktop/dist',
  'packages/desktop/node_modules',
];

for (const target of targets) {
  fs.rmSync(path.join(root, target), { recursive: true, force: true });
}
