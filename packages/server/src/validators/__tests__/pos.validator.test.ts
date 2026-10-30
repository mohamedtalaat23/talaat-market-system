import { checkoutSchema, syncOfflineSchema, refundSaleSchema } from '../pos.validator';

const SALE_ITEM_ID = '5f0d1b9c-1f2a-4f7b-9a3e-8c6d5e4f3a2b';

/**
 * The POS payload is fully client-controlled (including offline replays), so
 * the schema is the first line of defence against tampered totals.
 */
const validCheckout = {
  shift_id: 12,
  register_id: 1,
  payment_method: 'cash',
  cash_received: 50,
  idempotency_key: 'sale-0001',
  items: [{ product_id: 3, quantity: 2, unit_price: 10, discount: 0 }],
};

describe('checkoutSchema tamper resistance', () => {
  it('accepts a well-formed checkout payload', () => {
    expect(checkoutSchema.safeParse(validCheckout).success).toBe(true);
  });

  it('requires an idempotency key so a replay can be de-duplicated', () => {
    const { idempotency_key: _omit, ...withoutKey } = validCheckout;

    expect(checkoutSchema.safeParse(withoutKey).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCheckout, idempotency_key: '  ' }).success).toBe(
      false,
    );
  });

  it.each([
    [
      'a negative unit price',
      { items: [{ product_id: 3, quantity: 1, unit_price: -5, discount: 0 }] },
    ],
    [
      'a negative line discount',
      { items: [{ product_id: 3, quantity: 1, unit_price: 5, discount: -2 }] },
    ],
    ['a zero quantity', { items: [{ product_id: 3, quantity: 0, unit_price: 5, discount: 0 }] }],
    [
      'a negative quantity',
      { items: [{ product_id: 3, quantity: -1, unit_price: 5, discount: 0 }] },
    ],
    ['an empty cart', { items: [] }],
    ['a negative global discount', { global_discount: -10 }],
    ['a negative cash tender', { cash_received: -1 }],
    ['an unknown payment method', { payment_method: 'voucher' }],
    ['a missing shift', { shift_id: undefined }],
  ])('rejects %s', (_label, override) => {
    expect(checkoutSchema.safeParse({ ...validCheckout, ...override }).success).toBe(false);
  });

  it('rejects a client-supplied sale id that is not a UUID', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, id: '1' }).success).toBe(false);
  });

  it('requires the manager PIN to be a 4-6 digit value when an override is claimed', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, manager_pin: 'abc' }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...validCheckout, manager_id: 2, manager_pin: '4821' }).success,
    ).toBe(true);
  });
});

describe('syncOfflineSchema (POST /pos/sync)', () => {
  it('accepts a batch of valid offline sales', () => {
    const result = syncOfflineSchema.safeParse({ transactions: [validCheckout] });

    expect(result.success).toBe(true);
  });

  it('rejects an empty batch', () => {
    expect(syncOfflineSchema.safeParse({ transactions: [] }).success).toBe(false);
  });

  it('rejects a batch containing a tampered item price', () => {
    const tampered = {
      ...validCheckout,
      idempotency_key: 'sale-0002',
      items: [{ product_id: 3, quantity: 1, unit_price: -0.01, discount: 0 }],
    };

    expect(syncOfflineSchema.safeParse({ transactions: [validCheckout, tampered] }).success).toBe(
      false,
    );
  });
});

describe('refundSaleSchema (POST /pos/sales/:id/refund)', () => {
  it('requires a manager id, a PIN and at least one item', () => {
    expect(refundSaleSchema.safeParse({}).success).toBe(false);
    expect(
      refundSaleSchema.safeParse({
        idempotency_key: 'refund-test-key',
        manager_id: 2,
        manager_pin: '4821',
        reason: 'damaged',
        items: [{ sale_item_id: SALE_ITEM_ID, quantity: 1, restock_inventory: false }],
      }).success,
    ).toBe(true);
  });

  it('rejects a zero or negative refund quantity', () => {
    for (const quantity of [0, -2]) {
      expect(
        refundSaleSchema.safeParse({
          idempotency_key: 'refund-test-key',
          manager_id: 2,
          manager_pin: '4821',
          reason: 'damaged',
          items: [{ sale_item_id: SALE_ITEM_ID, quantity, restock_inventory: false }],
        }).success,
      ).toBe(false);
    }
  });
});
