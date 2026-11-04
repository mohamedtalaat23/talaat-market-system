import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';

// This script inserts synthetic records. Refuse all non-test or remote targets before imports read .env.
if (
  process.env['NODE_ENV'] !== 'test' ||
  !process.env['DB_NAME']?.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(process.env['DB_HOST'] || '')
) {
  throw new Error('Set NODE_ENV=test and an explicit disposable loopback *_test database.');
}
const { db } = await import('../packages/server/src/config/database');
const { productRepository } =
  await import('../packages/server/src/repositories/product.repository');
const { posRepository } = await import('../packages/server/src/repositories/pos.repository');
const { setupTestData } =
  await import('../packages/server/src/repositories/__tests__/reversal_setup');
const prefix = `bench-${randomUUID().slice(0, 8)}`;
async function measure(operation: () => Promise<unknown>) {
  await operation();
  const samples: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    medianMs: Number(samples[15]!.toFixed(2)),
    p95Ms: Number(samples[28]!.toFixed(2)),
    samples: samples.length,
  };
}
try {
  for (let batch = 0; batch < 10; batch++) {
    const added = await db('products')
      .insert(
        Array.from({ length: 1000 }, (_, i) => ({
          name: `${prefix} grocery ${batch * 1000 + i}`,
          name_ar: `صنف اختبار ${batch * 1000 + i}`,
          barcode: `${prefix}-${batch * 1000 + i}`,
          selling_price: 10,
          cost_price: 5,
        })),
      )
      .returning('id');
    await db('inventory').insert(
      added.map((product) => ({ product_id: product.id, quantity: 100 })),
    );
  }
  const c = await setupTestData();
  const results = {
    syntheticProductsAdded: 10000,
    note: 'Warm local repository timings; excludes network, rendering, printing and concurrent registers.',
    catalog: await measure(() =>
      productRepository.findAll({
        page: 1,
        limit: 25,
        search: prefix,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
    ),
    posSearch: await measure(() => posRepository.searchProducts(prefix, 20)),
    checkout: await measure(() =>
      posRepository.checkout(
        {
          shift_id: c.shiftId,
          register_id: c.registerId,
          payment_method: 'cash',
          cash_received: 10,
          idempotency_key: randomUUID(),
          items: [{ product_id: c.productId, quantity: 1, unit_price: 10, discount: 0 }],
        },
        c.cashierId,
      ),
    ),
  };
  console.log(JSON.stringify(results, null, 2));
} finally {
  await db.destroy();
}
