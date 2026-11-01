import crypto from 'node:crypto';
export default async function setup() {
  // Check before importing env/database modules, which otherwise read .env.
  if (
    process.env['TALAAT_E2E'] !== '1' ||
    !process.env['DB_NAME']?.endsWith('_test') ||
    !['127.0.0.1', 'localhost'].includes(process.env['DB_HOST'] ?? '')
  ) {
    throw new Error(
      'E2E requires TALAAT_E2E=1 and an explicit disposable loopback DB_NAME ending _test.',
    );
  }
  const { db } = await import('../../server/src/config/database');
  const { default: bcrypt } = await import('bcryptjs');
  const suffix = crypto.randomBytes(5).toString('hex');
  const password = crypto.randomBytes(24).toString('base64url');
  const pin = '482913'; // synthetic test-only PIN, not an installer default
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const [cashier] = await db('employees')
      .insert({
        username: `e2e_${suffix}`,
        full_name: 'E2E Cashier',
        role: 'cashier',
        password_hash,
        must_change_password: false,
      })
      .returning('*');
    const [manager] = await db('employees')
      .insert({
        username: `e2e_mgr_${suffix}`,
        full_name: `E2E Manager ${suffix}`,
        role: 'manager',
        password_hash,
        pin_hash: await bcrypt.hash(pin, 12),
        must_change_password: false,
      })
      .returning('*');
    const [register] = await db('registers')
      .insert({ name: `E2E Register ${suffix}` })
      .returning('*');
    const [product] = await db('products')
      .insert({
        name: `E2E Cola ${suffix}`,
        barcode: `E2E-${suffix}`,
        selling_price: 10,
        cost_price: 5,
      })
      .returning('*');
    await db('inventory').insert({ product_id: product.id, quantity: 100 });
    process.env['E2E_FIXTURE'] = JSON.stringify({
      username: cashier.username,
      password,
      managerName: manager.full_name,
      managerId: manager.id,
      registerId: register.id,
      pin,
      productName: product.name,
    });
  } finally {
    await db.destroy();
  }
}
