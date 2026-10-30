import { db } from '../../config/database';
import { POSRepository, type CheckoutPayload } from '../pos.repository';

/**
 * The >20% discount gate must require a *verified* manager PIN, not the
 * client-supplied `manager_id` (which anyone can invent). Regression cover for
 * the checkout discount-authorisation bypass.
 */
jest.mock('../../config/database', () => {
  const mockState: {
    products: Record<string, unknown>[];
    shift: Record<string, unknown> | null;
  } = {
    products: [],
    shift: { id: 1, status: 'open' },
  };

  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder['where'] = () => builder;
    builder['andWhere'] = () => builder;
    builder['whereIn'] = () => builder;
    builder['forUpdate'] = () => builder;
    builder['select'] = async () => (table === 'products' ? mockState.products : []);
    builder['first'] = async () => (table === 'cashier_shifts' ? mockState.shift : null);
    builder['insert'] = () => {
      if (table === 'sales') {
        // Sentinel: reaching the sale insert proves the discount gate let us through.
        throw new Error('SENTINEL_SALE_INSERT_REACHED');
      }
      return builder;
    };
    builder['returning'] = async () => [{}];
    builder['decrement'] = async () => 1;
    builder['increment'] = async () => 1;
    builder['update'] = async () => 1;
    return builder;
  };

  const trx = Object.assign((table: string) => makeBuilder(table), {
    raw: async () => ({ rows: [{ hash: 1, seq: 1 }] }),
    fn: { now: () => 'now' },
  });

  const db = Object.assign(() => makeBuilder('default'), {
    transaction: async (cb: (t: unknown) => unknown) => cb(trx),
    raw: async () => ({ rows: [] }),
    fn: { now: () => 'now' },
    __mockState: mockState,
  });

  return { db };
});

const mockState = (db as unknown as { __mockState: { products: Record<string, unknown>[] } })
  .__mockState;

function payload(overrides: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    shift_id: 1,
    register_id: 1,
    payment_method: 'cash',
    cash_received: 100,
    idempotency_key: 'checkout-key-1',
    items: [{ product_id: 5, quantity: 1, unit_price: 100, discount: 0 }],
    ...overrides,
  };
}

describe('POSRepository.checkout discount authorisation', () => {
  beforeEach(() => {
    mockState.products = [
      { id: 5, name: 'Coffee', barcode: 'C1', selling_price: '100.00', cost_price: '60.00' },
    ];
  });

  it('rejects a discount above 20% when only a client-supplied manager_id is present', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(payload({ manager_id: 2, global_discount: 50 }), 7, false, false, false),
    ).rejects.toThrow(/Manager authorization required/i);
  });

  it('accepts the same discount once a manager PIN has been verified by the controller', async () => {
    const repository = new POSRepository();

    // Passing the gate means we reach the sale insert (mocked as a sentinel throw).
    await expect(
      repository.checkout(payload({ manager_id: 2, global_discount: 50 }), 7, false, false, true),
    ).rejects.toThrow(/SENTINEL_SALE_INSERT_REACHED/);
  });

  it('still lets a normal discount through without any approval', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(payload({ global_discount: 10 }), 7, false, false, false),
    ).rejects.toThrow(/SENTINEL_SALE_INSERT_REACHED/);
  });

  it('rejects a cash sale whose tender is below the computed total', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(payload({ cash_received: 5 }), 7, false, false, false),
    ).rejects.toThrow(/Insufficient cash received/i);
  });

  it('rejects a line priced differently from the catalogue price', async () => {
    const repository = new POSRepository();

    // Online checkouts must never trust a client-supplied price (zero-price sale).
    await expect(
      repository.checkout(
        payload({ items: [{ product_id: 5, quantity: 1, unit_price: 0.01, discount: 0 }] }),
        7,
        false,
        false,
        false,
      ),
    ).rejects.toThrow(/Price mismatch/i);
  });

  it('quarantines an offline replay whose price is below the catalogue price', async () => {
    const repository = new POSRepository();

    // Offline replays are re-priced server-side. A price below the catalogue
    // price is no longer accepted with only an audit entry: it must be approved
    // by a manager, otherwise the sale is rejected so `syncOffline` can park it
    // in `offline_sync_quarantine`.
    await expect(
      repository.checkout(
        payload({ items: [{ product_id: 5, quantity: 1, unit_price: 0.01, discount: 0 }] }),
        7,
        true,
        true,
        false,
      ),
    ).rejects.toMatchObject({ code: 'OFFLINE_PRICE_APPROVAL_REQUIRED', reason: 'price_deviation' });
  });

  it('accepts the offline replay once a manager approved the lower price', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(
        payload({ items: [{ product_id: 5, quantity: 1, unit_price: 0.01, discount: 0 }] }),
        7,
        true,
        true,
        true,
      ),
    ).rejects.toThrow(/SENTINEL_SALE_INSERT_REACHED/);
  });

  it('re-prices an offline replay up to the catalogue price instead of overcharging', async () => {
    const repository = new POSRepository();

    // 150.00 offline vs 100.00 catalogue: repriced down to the catalogue price,
    // so the sentinel insert is reached with a 100.00 total.
    await expect(
      repository.checkout(
        payload({
          cash_received: 100,
          items: [{ product_id: 5, quantity: 1, unit_price: 150, discount: 0 }],
        }),
        7,
        true,
        true,
        false,
      ),
    ).rejects.toThrow(/SENTINEL_SALE_INSERT_REACHED/);
  });
});
