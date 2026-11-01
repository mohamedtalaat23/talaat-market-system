const path = require('node:path');
const fs = require('node:fs');
if (
  process.env.TALAAT_RELEASE_VERIFY !== '1' ||
  !process.env.DB_NAME?.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)
)
  throw new Error('Requires an explicit disposable loopback *_test database.');
const { db } = require('../packages/server/dist/config/database.js');
const { runCredentialHygiene } = require('../packages/server/dist/database/credential-hygiene.js');
const bcrypt = require('bcryptjs');
(async () => {
  const directory = path.resolve(__dirname, '../packages/server/dist/migrations');
  for (const name of fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.js') && !file.startsWith('036_'))
    .sort()) {
    await db.migrate.up({ directory, name, extension: 'js', loadExtensions: ['.js'] });
  }
  const [customer] = await db('customers')
    .insert({ name: 'Synthetic upgrade balance', balance: -12.34 })
    .returning('*');
  const [employee] = await db('employees')
    .insert({
      username: 'legacy_test_account',
      full_name: 'Synthetic legacy employee',
      role: 'manager',
      password_hash: await bcrypt.hash('manager123', 4),
    })
    .returning('*');
  await db.migrate.latest({ directory, extension: 'js', loadExtensions: ['.js'] });
  await runCredentialHygiene();
  if ((await db('customers').where({ id: customer.id }).first()).balance !== '-12.34')
    throw new Error('Upgrade changed a customer balance');
  const locked = await db('employees').where({ id: employee.id }).first();
  if (
    !locked.credential_rotation_required ||
    !locked.must_change_password ||
    locked.auth_epoch !== 1
  )
    throw new Error('Legacy credential hygiene failed');
  if (!(await db.schema.hasColumn('refunds', 'idempotency_key')))
    throw new Error('Refund migration missing');
  console.log(
    'Upgrade from 035 to 036 preserves synthetic records and locks published default credentials.',
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
