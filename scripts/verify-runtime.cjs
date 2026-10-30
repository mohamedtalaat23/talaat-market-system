// Synthetic, disposable runtime smoke test; refuses configured business databases.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');
if (
  process.env.TALAAT_RELEASE_VERIFY !== '1' ||
  !process.env.DB_NAME?.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)
) {
  throw new Error('Requires TALAAT_RELEASE_VERIFY=1 and an explicit loopback *_test database.');
}
const root = path.resolve(__dirname, '..');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-runtime-'));
fs.cpSync(path.join(root, 'packages/server/dist'), path.join(runtime, 'server/dist'), {
  recursive: true,
});
fs.cpSync(
  path.join(root, 'packages/desktop/runtime-stage/node_modules'),
  path.join(runtime, 'node_modules'),
  { recursive: true },
);
const secret = () => crypto.randomBytes(32).toString('hex');
const initial = secret();
const env = {
  ...process.env,
  NODE_ENV: 'production',
  INITIAL_ADMIN_USERNAME: 'release_admin',
  INITIAL_ADMIN_PASSWORD: initial,
  INITIAL_ADMIN_PIN: '482913',
  JWT_SECRET: secret(),
  SESSION_SECRET: secret(),
  SERVER_HOST: '127.0.0.1',
  SERVER_PORT: '55443',
  TALAAT_CONFIG_PATH: path.join(runtime, 'config.env'),
  LOG_DIR: path.join(runtime, 'logs'),
  BACKUP_DIR: path.join(runtime, 'backups'),
};
function run(file) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(runtime, 'server/dist', file), [], {
      cwd: runtime,
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${file} timed out`));
    }, 45000);
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(new Error(`${file} failed (${code}); inspect disposable runtime logs`));
    });
  });
}
let server;
(async () => {
  await run('database/migrate.js');
  await run('database/bootstrap.js');
  server = fork(path.join(runtime, 'server/dist/index.js'), [], {
    cwd: runtime,
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server readiness timeout')), 15000);
    server.on('message', (message) => {
      if (message === 'ready') {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited (${code})`));
    });
  });
  const request = (url, body, token) =>
    fetch(`http://127.0.0.1:55443/api/v1${url}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  if (!(await request('/health')).ok) throw new Error('Health check failed');
  const login = await request('/auth/login', { username: 'release_admin', password: initial });
  const authentication = await login.json();
  if (!login.ok || !authentication.data?.token)
    throw new Error('Initial administrator login failed');
  const token = authentication.data.token;
  if ((await request('/products', undefined, token)).status !== 403)
    throw new Error('Temporary password bypassed rotation gate');
  const rotation = await request(
    '/auth/change-password',
    { current_password: initial, new_password: secret() },
    token,
  );
  if (!rotation.ok) throw new Error('Password rotation failed');
  if ((await request('/auth/me', undefined, token)).status !== 401)
    throw new Error('Old session survived rotation');
  console.log(
    'Isolated packaged runtime: migrations, bootstrap, health, password gate and token revocation passed.',
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server && server.exitCode === null) {
      await new Promise((resolve) => {
        server.once('exit', resolve);
        server.kill('SIGTERM');
        setTimeout(() => {
          if (server.exitCode === null) server.kill('SIGKILL');
          resolve();
        }, 5000).unref();
      });
    }
    console.log(`Disposable runtime evidence: ${runtime}`);
  });
