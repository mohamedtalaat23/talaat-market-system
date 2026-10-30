// Exercise the built preload using the sandbox's restricted require surface.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const calls = [];
let api;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../packages/desktop/dist/preload.js'), 'utf8'), {
  window: { localStorage: { getItem: () => null } }, crypto: require('node:crypto').webcrypto,
  require(name) {
    if (name !== 'electron') throw new Error(`Sandbox cannot load ${name}`);
    return { contextBridge: { exposeInMainWorld: (name, bridge) => { if(name !== 'electronAPI') throw new Error(name); api = bridge; } },
      ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve(); } } };
  },
});
if (!api || typeof api.getServerPort !== 'function') throw new Error('Preload bridge missing');
api.getServerPort();
if (calls.length !== 1 || typeof calls[0][0] !== 'string') throw new Error('IPC bridge failed');
console.log('Bundled preload loads with only electron available; IPC bridge verified.');
