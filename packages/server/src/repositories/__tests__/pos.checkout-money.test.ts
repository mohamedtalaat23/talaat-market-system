import { db } from '../../config/database';
import { POSRepository, type CheckoutPayload } from '../pos.repository';

/**
 * Checkout money regression suite.
 *
 * Asserts the cent-exact totals that are persisted, that split tenders can never
 * overpay the sale, and that only the cash portion is added to the drawer.
 */
jest.mock('../../config/database', () => {
  const state: {
    products: Record<string, unknown>[];
    saleInsert: Record<string, unknown> | null;
    itemInserts: Record<string, unknown>[];
    shiftUpdates: Record<string, unknown>[];
    shiftUpdateParams: unknown[][];
  } = {
    products: [],
    saleInsert: null,
    itemInserts: [],
    shiftUpdates: [],
    shiftUpdateParams: [],
  };

  const makeBuilder = (table: string) => {
    const builder: Record<string, any> = {
      where: () => builder,
      andWhere: () => builder,
      whereIn: () => builder,
      forUpdate: () => builder,
      orderBy: () => builder,
      select: async () => (table === 'products' ? state.products : []),
      first: async () => (table === 'cashier_shifts' ? { id: 1, status: 'open' } : null),
      insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        if (table === 'sales') state.saleInsert = row as Record<string, unknown>;
        if (table === 'sale_items') state.itemInserts = row as Record<string, unknown>[];
        return builder;
      },
      returning: async () => [
        { id: 'sale-uuid', receipt_number: 'STR01-REG01-20260101-00001', ...(state.saleInsert ?? {}) },
      ],
      decrement: async () => 1,
      increment: async () => 1,
      update: (patch: Record<string, unknown>) => {
        if (table === 'cashier_shifts') state.shiftUpdates.push(patch);
        return builder;
      },
      then: (resolve: (value: unknown) => void) => resolve(1),
    };
    return builder;
  };

  const trx: any = (table: string) => makeBuilder(table);
  trx.raw = async (sql: string, params?: unknown[]) => {
    if (typeof sql === 'string' && sql.includes('nextval')) return { rows: [{ seq: 1 }] };
    if (typeof sql === 'string' && sql.includes('cashier_shifts')) return { rows: [] };
    if (params && params.length) state.shiftUpdateParams.push(params);
    return { rows: [{ hash: 1, seq: 1 }] };
  };
  trx.fn = { now: () => 'now' };

  const mockDb: any = (table: string) => makeBuilder(table);
  mockDb.raw = async () => ({ rows: [{ hash: 1 }] });
  mockDb.fn = { now: () => 'now' };
  mockDb.transaction = async (cb: (t: unknown) => unknown) => cb(trx);
  mockDb.__state = state;

  return { db: mockDb };
});

const state = (db as unknown as { __state: Record<string, any> }).__state;

function payload(overrides: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    shift_id: 1,
    register_id: 1,
    payment_method: 'cash',
    cash_received: 100,
    idempotency_key: 'money-key-1',


    items: [{ product_id: 5, quantity: 1, unit_price: 100, discount: 0 }],
    ...overrides,
  };
}

describe('POSRepository.checkout money handling', () => {
  beforeEach(() => {
    state['products'] = [
      { id: 5, name: 'Coffee', barcode: 'C1', selling_price: '19.99', cost_price: '10.00' },
      { id: 6, name: 'Tea', barcode: 'T1', selling_price: '0.10', cost_price: '0.05' },
    ];
    state['saleInsert'] = null;
    state['itemInserts'] = [];
    state['shiftUpdates'] = [];
    state['shiftUpdateParams'] = [];
  });

  it('persists decimal totals exactly for high-volume lines', async () => {
    const repository = new POSRepository();

    await repository.checkout(
      payload({
        cash_received: 70,
        items: [
          { product_id: 5, quantity: 3, unit_price: 19.99, discount: 0 },
          { product_id: 6, quantity: 10, unit_price: 0.1, discount: 0.3 },
        ],
      }),
      7,
    );

    const sale = state['saleInsert']!;
    // 3 × 19.99 = 59.97, 10 × 0.10 = 1.00 → subtotal 60.97; discount 0.30 → 60.67
    expect(sale['subtotal']).toBe(60.97);
    expect(sale['discount_amount']).toBe(0.3);
    expect(sale['total']).toBe(60.67);
    expect(sale['cash_paid']).toBe(60.67);
    expect(sale['change_given']).toBe(9.33);

    const lines = state['itemInserts'];
    expect(lines[0]?.['line_total']).toBe(59.97);
    expect(lines[1]?.['line_total']).toBe(0.7);
  });

  it('never records more than the amount due across split tenders', async () => {
    const repository = new POSRepository();

    await repository.checkout(
      payload({
        payment_method: 'split',
        cash_received: undefined,
        cash_amount: 10,
        card_amount: 15,
        items: [{ product_id: 5, quantity: 1, unit_price: 19.99, discount: 0 }],
      }),
      7,
    );

    const sale = state['saleInsert']!;
    expect(sale['total']).toBe(19.99);
    // 4.99 + 15.00 applied to the sale — never more than the 19.99 due.
    expect(sale['card_paid']).toBe(15);
    expect(sale['cash_paid']).toBe(4.99);
    expect(
      Math.round((Number(sale['cash_paid']) + Number(sale['card_paid'])) * 100) / 100,
    ).toBe(19.99);
    expect(sale['change_given']).toBe(5.01);
  });

  it('rejects a card tender above the amount due', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(
        payload({
          payment_method: 'split',
          cash_received: undefined,
          cash_amount: 0,
          card_amount: 25,
          items: [{ product_id: 5, quantity: 1, unit_price: 19.99, discount: 0 }],
        }),
        7,
      ),
    ).rejects.toThrow(/cannot exceed the amount due/);

    expect(state['saleInsert']).toBeNull();
  });

  it('rejects a discount larger than the cart', async () => {
    const repository = new POSRepository();

    await expect(
      repository.checkout(
        payload({
          global_discount: 20,
          cash_received: 0,
          items: [{ product_id: 5, quantity: 1, unit_price: 19.99, discount: 0 }],
        }),
        7,
      ),
    ).rejects.toThrow(/Global discount exceeds/);

    expect(state['saleInsert']).toBeNull();
  });

  it('adds only the cash portion to the drawer', async () => {
    const repository = new POSRepository();

    await repository.checkout(
      payload({
        payment_method: 'card',
        cash_received: undefined,
        items: [{ product_id: 5, quantity: 1, unit_price: 19.99, discount: 0 }],
      }),
      7,
    );

    // A pure card sale must not inflate expected cash.
    expect(state['shiftUpdates']).toHaveLength(0);
  });
});
