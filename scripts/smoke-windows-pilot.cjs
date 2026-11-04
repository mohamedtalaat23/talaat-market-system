// Runs only generated credentials and disposable databases using the bundled runtime.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { directory, validateRuntime } = require('./windows-runtime.cjs');
const root = path.resolve(__dirname, '..');
const resources = process.argv[2] ? path.resolve(process.argv[2]) : null;
const pg = resources ? path.join(resources, 'postgres/win-x64') : directory;
const serverDirectory = resources
  ? path.join(resources, 'server/dist')
  : path.join(root, 'packages/server/dist');
const evidenceDirectory = path.join(root, 'packages/desktop/release/pilot-evidence');
const secret = () => crypto.randomBytes(32).toString('hex');
async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}
function run(exe, args, env, allowFailure = false) {
  const result = spawnSync(exe, args, {
    env,
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
    // A daemon can inherit pg_ctl's pipes on Windows and keep spawnSync open
    // after pg_ctl exits. Its server output already goes to the disposable -l log.
    stdio: path.basename(exe).toLowerCase() === 'pg_ctl.exe' ? 'ignore' : 'pipe',
  });
  if (!allowFailure && (result.error || result.status !== 0))
    throw new Error(
      `${path.basename(exe)} failed: ${result.error?.message || result.stderr || 'nonzero exit'}`,
    );
  return result;
}
async function main() {
  if (process.platform !== 'win32')
    throw new Error('Bundled Windows runtime smoke test requires Windows.');
  validateRuntime(pg);
  console.log('Packaged PostgreSQL tools validated.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'Talaat pilot smoke '));
  const data = path.join(temp, 'data');
  const pwfile = path.join(temp, 'init-password');
  const password = secret();
  const dbPort = await freePort();
  const apiPort = await freePort();
  const env = {
    ...process.env,
    PATH: `${path.join(pg, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
    PGPASSWORD: password,
    PGUSER: 'pilot_smoke',
    PGHOST: '127.0.0.1',
    PGPORT: String(dbPort),
  };
  const exe = (name) => path.join(pg, 'bin', `${name}.exe`);
  let primaryError;
  let server;
  try {
    fs.writeFileSync(pwfile, password, { mode: 0o600 });
    run(
      exe('initdb'),
      [
        '-D',
        data,
        '--username=pilot_smoke',
        `--pwfile=${pwfile}`,
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ],
      env,
    );
    fs.rmSync(pwfile);
    console.log('Disposable SCRAM cluster initialized.');
    run(
      exe('pg_ctl'),
      [
        'start',
        '-D',
        data,
        '-l',
        path.join(temp, 'postgres.log'),
        '-o',
        `-p ${dbPort} -h 127.0.0.1`,
        '-w',
      ],
      env,
    );
    console.log('Disposable cluster started on loopback.');
    const hba = fs
      .readFileSync(path.join(data, 'pg_hba.conf'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*/, '').trim())
      .filter(Boolean);
    if (hba.some((line) => /\b(trust|peer|ident)\b/.test(line)))
      throw new Error('Smoke cluster contains passwordless access.');
    run(exe('createdb'), ['pilot_smoke_test'], env);
    run(exe('createdb'), ['pilot_restore_test'], env);
    const query = (database, sql) =>
      run(
        exe('psql'),
        ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-d', database, '-c', sql],
        env,
      ).stdout.trim();
    query(
      'pilot_smoke_test',
      'CREATE EXTENSION pgcrypto; CREATE EXTENSION pg_trgm; CREATE TABLE pilot_integrity (value integer); INSERT INTO pilot_integrity VALUES (38)',
    );
    const denied = run(
      exe('psql'),
      ['-X', '-w', '-d', 'pilot_smoke_test', '-c', 'SELECT 1'],
      { ...env, PGPASSWORD: secret() },
      true,
    );
    if (denied.status === 0) throw new Error('Database accepted an incorrect password.');
    const dump = path.join(temp, 'smoke.dump');
    run(exe('pg_dump'), ['-Fc', '-f', dump, 'pilot_smoke_test'], env);
    run(
      exe('pg_restore'),
      ['--exit-on-error', '--no-owner', '-d', 'pilot_restore_test', dump],
      env,
    );
    if (query('pilot_restore_test', 'SELECT value FROM pilot_integrity') !== '38')
      throw new Error('Dump/restore integrity failed.');
    console.log('SCRAM refusal, extensions and dump/restore passed.');
    const initialPassword = secret();
    const appEnv = {
      ...env,
      NODE_ENV: 'production',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(dbPort),
      DB_NAME: 'pilot_smoke_test',
      DB_USER: 'pilot_smoke',
      DB_PASSWORD: password,
      JWT_SECRET: secret(),
      SESSION_SECRET: secret(),
      INITIAL_ADMIN_USERNAME: 'pilot_admin',
      INITIAL_ADMIN_PASSWORD: initialPassword,
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: String(apiPort),
      LOG_DIR: path.join(temp, 'logs'),
      BACKUP_DIR: path.join(temp, 'backups'),
      TALAAT_CONFIG_PATH: path.join(temp, 'config.env'),
      TALAAT_DESKTOP_RENDERER_DIR: resources
        ? path.join(resources, 'client/dist')
        : path.join(root, 'packages/client/dist'),
    };
    for (const file of ['database/migrate.js', 'database/bootstrap.js']) {
      run(process.execPath, [path.join(serverDirectory, file)], appEnv);
      console.log(`Packaged ${file} completed.`);
    }
    query(
      'pilot_smoke_test',
      'SELECT idempotency_key, request_fingerprint FROM purchase_order_receipts LIMIT 0',
    );
    server = spawn(process.execPath, [path.join(serverDirectory, 'index.js')], {
      env: appEnv,
      cwd: temp,
      stdio: 'ignore',
      windowsHide: true,
    });
    let healthy = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error('Packaged API exited before readiness.');
      try {
        const r = await fetch(`http://127.0.0.1:${apiPort}/api/v1/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (r.ok) {
          healthy = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!healthy) throw new Error('Packaged API readiness timed out.');
    console.log('Packaged API is healthy.');
    const login = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pilot_admin', password: initialPassword }),
    });
    const authentication = await login.json();
    if (!login.ok || !authentication.data?.token) throw new Error('Packaged API login failed.');
    const rotate = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authentication.data.token}`,
      },
      body: JSON.stringify({ current_password: initialPassword, new_password: secret() }),
    });
    if (!rotate.ok) throw new Error('First-run password rotation failed.');
    console.log('First-run login and password rotation passed; starting renderer checks.');
    run(
      process.execPath,
      [path.join(__dirname, 'smoke-built-renderer.cjs'), `http://127.0.0.1:${apiPort}/`],
      process.env,
    );
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(evidenceDirectory, 'windows-smoke.json'),
      JSON.stringify(
        {
          passed: true,
          platform: process.platform,
          runtime: validateRuntime(pg),
          checks: [
            'SCRAM cluster initialization',
            'incorrect password denied',
            'pgcrypto and pg_trgm',
            'dump/restore integrity',
            'compiled migrations through 038',
            'packaged API readiness',
            'initial login and password rotation',
          ],
        },
        null,
        2,
      ),
    );
    console.log(
      'Windows runtime, dump/restore and packaged API smoke passed; no credentials exported.',
    );
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => {
        server.once('exit', resolve);
        setTimeout(resolve, 5000).unref();
      });
    }
    try {
      // Also stop a daemon that started before a control-command timeout.
      if (fs.existsSync(path.join(data, 'postmaster.pid')))
        run(exe('pg_ctl'), ['stop', '-D', data, '-m', 'fast', '-w'], env);
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error('Disposable cluster cleanup also failed; original smoke failure follows.');
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
