import { batchQuerySchema, createBatchSchema } from '../inventory.validator';

describe('createBatchSchema (POST /inventory/batches)', () => {
  const validPayload = {
    product_id: 7,
    batch_number: 'BATCH-2026-001',
    expiration_date: '2026-06-30',
    quantity: 24,
  };

  it('accepts a well-formed batch payload', () => {
    const result = createBatchSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validPayload);
  });

  it('coerces numeric strings coming from JSON form payloads', () => {
    const result = createBatchSchema.safeParse({
      ...validPayload,
      product_id: '7',
      quantity: '24.5',
      cost_price: '12.75',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ product_id: 7, quantity: 24.5, cost_price: 12.75 });
  });

  it('trims the batch number and allows cost_price to be omitted', () => {
    const result = createBatchSchema.safeParse({ ...validPayload, batch_number: '  B-1  ' });

    expect(result.success).toBe(true);
    expect(result.data?.batch_number).toBe('B-1');
    expect(result.data?.cost_price).toBeUndefined();
  });

  it.each([
    ['missing product id', { ...validPayload, product_id: undefined }],
    ['zero product id', { ...validPayload, product_id: 0 }],
    ['negative product id', { ...validPayload, product_id: -3 }],
    ['non-numeric product id', { ...validPayload, product_id: 'abc' }],
    ['fractional product id', { ...validPayload, product_id: 1.5 }],
  ])('rejects an invalid product id (%s)', (_label, payload) => {
    expect(createBatchSchema.safeParse(payload).success).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['longer than 100 characters', 'B'.repeat(101)],
  ])('rejects a batch number that is %s', (_label, batchNumber) => {
    expect(createBatchSchema.safeParse({ ...validPayload, batch_number: batchNumber }).success).toBe(
      false,
    );
  });

  it.each([
    ['a non ISO string', '30/06/2026'],
    ['unpadded ISO parts', '2026-6-3'],
    ['an impossible calendar day', '2026-02-31'],
    ['an impossible month', '2026-13-01'],
    ['a free-form string', 'next week'],
  ])('rejects expiration_date that is %s', (_label, expirationDate) => {
    expect(
      createBatchSchema.safeParse({ ...validPayload, expiration_date: expirationDate }).success,
    ).toBe(false);
  });

  it('accepts a leap day in a leap year', () => {
    expect(
      createBatchSchema.safeParse({ ...validPayload, expiration_date: '2028-02-29' }).success,
    ).toBe(true);
  });

  it.each([0, -5])('rejects a quantity of %s', (quantity) => {
    expect(createBatchSchema.safeParse({ ...validPayload, quantity }).success).toBe(false);
  });

  it('rejects a negative cost price', () => {
    expect(createBatchSchema.safeParse({ ...validPayload, cost_price: -1 }).success).toBe(false);
  });
});

describe('batchQuerySchema (GET /inventory/batches)', () => {
  it('accepts an empty query', () => {
    const result = batchQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('coerces query-string numbers', () => {
    const result = batchQuerySchema.safeParse({ product_id: '12', days_to_expiry: '30' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ product_id: 12, days_to_expiry: 30 });
  });

  it('rejects a negative days_to_expiry window', () => {
    expect(batchQuerySchema.safeParse({ days_to_expiry: '-1' }).success).toBe(false);
  });

  it('rejects a fractional days_to_expiry window', () => {
    expect(batchQuerySchema.safeParse({ days_to_expiry: '1.5' }).success).toBe(false);
  });

  it('rejects an invalid product_id filter', () => {
    expect(batchQuerySchema.safeParse({ product_id: '0' }).success).toBe(false);
  });
});
