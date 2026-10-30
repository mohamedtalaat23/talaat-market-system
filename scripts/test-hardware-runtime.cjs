const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createHardwareAuthorization, authorityUrl } = require('../packages/desktop/dist/ipc/authorization');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-hardware-'));
const log = path.join(directory, 'hardware-audit.ndjson');
const token = 'synthetic-hardware-test-token';
let denied = false;
const server = http.createServer((req, res) => {
  assert.equal(req.url, '/api/v1/auth/hardware-session');
  assert.equal(req.headers.authorization, `Bearer ${token}`);
  res.writeHead(denied ? 403 : 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: { id: 7, role: 'cashier', validUntil: Date.now()+3600000 } }));
});
(async () => {
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const gate = createHardwareAuthorization(port, log);
  const auth = { token, requestId: randomUUID() };
  await gate.execute('printer:enqueue-job', auth, () => 'accepted');
  await assert.rejects(gate.execute('printer:enqueue-job', auth, () => { throw Error('replay dispatched'); }));
  const restarted = createHardwareAuthorization(port, log);
  await assert.rejects(restarted.execute('printer:enqueue-job', auth, () => {}));
  denied = true;
  await assert.rejects(gate.execute('printer:get-queue', { token, requestId: randomUUID() }, () => {}));
  await new Promise(resolve => server.close(resolve));
  await assert.rejects(gate.execute('printer:get-queue', { token, requestId: randomUUID() }, () => {})); // 403 erased the lease
  assert.throws(() => authorityUrl(port, 'http://untrusted.example'));
  assert.throws(() => authorityUrl(port, 'https://user:password@example.com'));
  const events = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert(events.some(e => e.result === 'authorized' && e.employee === 7));
  assert(events.some(e => e.result === 'denied'));
  assert(!fs.readFileSync(log,'utf8').includes(token));
  console.log('Hardware protocol smoke passed: HTTP identity, fsynced audit, disk replay protection, revocation and HTTPS authority restrictions.');
})().catch(error => { console.error(error); process.exitCode=1; }).finally(() => { server.close(); fs.rmSync(directory, { recursive: true, force: true }); });
