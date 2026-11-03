import crypto from 'node:crypto';
export const journeys = [
  'checkout',
  'cart',
  'returns',
  'purchasing',
  'accounts',
  'handover',
  'offline',
  'owner',
] as const;
export type Journey = (typeof journeys)[number];
export type Language = 'en' | 'ar';
export function assertTestDatabase() {
  if (
    process.env['TALAAT_E2E'] !== '1' ||
    !process.env['DB_NAME']?.endsWith('_test') ||
    !['127.0.0.1', 'localhost'].includes(process.env['DB_HOST'] ?? '')
  )
    throw new Error('Explicit disposable loopback *_test database required.');
}
export async function createFixture(language: Language, journey: Journey) {
  assertTestDatabase();
  const { db } = await import('../../server/src/config/database');
  const { default: bcrypt } = await import('bcryptjs');
  const suffix = crypto.randomBytes(6).toString('hex');
  const password = crypto.randomBytes(24).toString('base64url');
  const pin = '482913';
  const password_hash = await bcrypt.hash(password, 4);
  const pin_hash = await bcrypt.hash(pin, 4);
  async function employee(role: 'admin' | 'manager' | 'cashier', tag: string) {
    const [row] = await db('employees')
      .insert({
        username: `daily_${tag}_${suffix}`,
        full_name: `${journey} ${tag} ${suffix}`,
        role,
        password_hash,
        pin_hash: role === 'cashier' ? null : pin_hash,
        must_change_password: false,
      })
      .returning('*');
    return { id: Number(row.id), username: row.username, full_name: row.full_name };
  }
  const admin = await employee('admin', 'admin');
  const manager = await employee('manager', 'manager');
  const cashier = await employee('cashier', 'cashier');
  const nextCashier = await employee('cashier', 'next');
  const [register] = await db('registers')
    .insert({ name: `Daily ${journey} ${language} ${suffix}` })
    .returning('*');
  const [supplier] = await db('suppliers')
    .insert({ supplier_code: `D-${suffix}`, name: `000 Daily supplier ${suffix}`, status: 'active' })
    .returning('*');
  const [customer] = await db('customers')
    .insert({ name: `Daily customer ${suffix}`, balance: 0 })
    .returning('*');
  const [product] = await db('products')
    .insert({
      name: `Daily ${journey} ${suffix}`,
      name_ar: `صنف تجربة ${journey} ${suffix}`,
      barcode: `628${Date.now()}${Math.floor(Math.random() * 1000)}`,
      selling_price: 10,
      cost_price: 5,
      supplier_id: supplier.id,
    })
    .returning('*');
  await db('inventory').insert({ product_id: product.id, quantity: 100 });
  const { purchaseRepository } = await import('../../server/src/repositories/purchase.repository');
  const order = await purchaseRepository.create(
    {
      supplier_id: supplier.id,
      items: [{ product_id: product.id, ordered_quantity: 4, unit_cost: 5 }],
    },
    manager.id,
  );
  return {
    language,
    journey,
    password,
    pin,
    admin,
    manager,
    cashier,
    nextCashier,
    registerId: Number(register.id),
    productId: Number(product.id),
    productName: product.name,
    productNameAr: product.name_ar,
    barcode: product.barcode,
    customerId: Number(customer.id),
    customerName: customer.name,
    supplierId: Number(supplier.id),
    supplierName: supplier.name,
    orderId: Number(order.id),
    username: cashier.username,
    managerName: manager.full_name,
    managerId: manager.id,
  };
}
export type Fixture = Awaited<ReturnType<typeof createFixture>>;
export function fixture(language: Language, journey: Journey): Fixture {
  return JSON.parse(process.env[`DAILY_${language}_${journey}`]!);
}
