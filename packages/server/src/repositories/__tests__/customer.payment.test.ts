import { db } from '../../config/database';
import { CustomerPaymentError, CustomerRepository } from '../customer.repository';

/**
 * Customer payment accounting regression suite.
 *
 * The fake database is stateful so the tests can assert that a failed step rolls
 * the ledger, the cached balance and the shift's expected cash back together.
 */
jest.mock('../../config/database', () => {
  const state: {
    customer: Record<string, any>;
    shift: Record<string, any> | null;
    ledger: Record<string, any>[];
    shiftUpdates: Record<string, any>[];
    failLedgerInsert: boolean;
  } = {
    customer: { id: 1, balance: '-50.00', deleted_at: null },
    shift: { id: 9, status: 'open', register_id: 1, expected_cash: '100.00' },
    ledger: [],
    shiftUpdates: [],
    failLedgerInsert: false,
  };

  const snapshot = () => ({
    balance: state.customer['balance'],
    expectedCash: state.shift?.['expected_cash'],
    ledgerLength: state.ledger.length,
  });
  const restore = (snap: ReturnType<typeof snapshot>) => {
    state.customer['balance'] = snap.balance;
    if (state.shift) state.shift['expected_cash'] = snap.expectedCash;
    state.ledger.length = snap.ledgerLength;
    state.shiftUpdates.length = 0;
  };

  const raw = (sql: string, params: number[]) => ({ __raw: sql, params });

  const makeBuilder = (table: string) => {
    let whereClause: Record<string, any> = {};
    let pendingPatch: Record<string, any> | null = null;

    const applyUpdate = () => {
      if (!pendingPatch) return;
      if (table === 'customers') {
        const rawBalance = pendingPatch['balance'];
        if (rawBalance?.__raw?.includes('balance + ?')) {
          const next = Number(state.customer['balance']) + Number(rawBalance.params[0]);
          state.customer['balance'] = next.toFixed(2);
        }
      }
      if (table === 'cashier_shifts') {
        const rawCash = pendingPatch['expected_cash'];
        state.shiftUpdates.push({ where: { ...whereClause }, patch: pendingPatch });
        if (rawCash?.__raw?.includes('expected_cash + ?') && state.shift) {
          state.shift['expected_cash'] = (
            Number(state.shift['expected_cash']) + Number(rawCash.params[0])
          ).toFixed(2);
        }
      }
    };

    const builder: Record<string, any> = {
      where(clause: Record<string, any>) {
        whereClause = { ...whereClause, ...clause };
        return builder;
      },
      whereNull() {
        return builder;
      },
      forUpdate() {
        return builder;
      },
      first: async () => {
        if (table === 'customers') return state.customer;
        if (table === 'cashier_shifts') {
          if (!state.shift) return null;
          return state.shift['status'] === whereClause['status'] &&
            state.shift['id'] === whereClause['id']
            ? state.shift
            : null;
        }
        if (table === 'customer_transactions') {
          return (
            state.ledger.find(
              (row) =>
                row['customer_id'] === whereClause['customer_id'] &&
                row['idempotency_key'] === whereClause['idempotency_key'],
            ) ?? null
          );
        }
        return null;
      },
      insert: async (row: Record<string, any>) => {
        if (table === 'customer_transactions') {
          if (state.failLedgerInsert) throw new Error('ledger unavailable');
          state.ledger.push(row);
        }
        return [row];
      },
      update: (patch: Record<string, any>) => {
        pendingPatch = patch;
        return builder;
      },
      returning: async () => {
        applyUpdate();
        return [{ ...state.customer }];
      },
      then: (resolve: (value: unknown) => void) => {
        applyUpdate();
        resolve(1);
      },
    };

    return builder;
  };

  const trx: any = (table: string) => makeBuilder(table);
  trx.raw = (sql: string, params: number[]) => raw(sql, params);
  trx.fn = { now: () => 'now' };

  const mockDb: any = (table: string) => makeBuilder(table);
  mockDb.raw = raw;
  mockDb.fn = { now: () => 'now' };
  mockDb.transaction = async (cb: (t: unknown) => unknown) => {
    const snap = snapshot();
    try {
      return await cb(trx);


    } catch (error) {
      restore(snap);
      throw error;
    }
  };
  mockDb.__state = state;

  return { db: mockDb };
});
const state = (db as unknown as { __state: Record<string, any> }).__state;

const baseInput = {
  customerId: 1,
  paymentMethod: 'cash' as const,
  userId: 4,
  shiftId: 9,
  registerId: 1,
};

describe('CustomerRepository.recordPayment', () => {
  beforeEach(() => {
    state['customer'] = { id: 1, balance: '-50.00', deleted_at: null };
    state['shift'] = { id: 9, status: 'open', register_id: 1, expected_cash: '100.00' };
    state['ledger'] = [];
    state['shiftUpdates'] = [];
    state['failLedgerInsert'] = false;
  });

  it('posts a cash payment to the ledger, the balance and the drawer', async () => {
    const repository = new CustomerRepository();
    const result = await repository.recordPayment({ ...baseInput, amount: 20 });

    expect(result.appliedAmount).toBe(20);
    expect(result.outstandingBefore).toBe(50);
    expect(result.outstandingAfter).toBe(30);
    expect(state['ledger']).toHaveLength(1);
    expect(state['ledger'][0]?.shift_id).toBe(9);
    expect(state['ledger'][0]?.payment_method).toBe('cash');
    expect(state['shift']?.expected_cash).toBe('120.00');
  });

  it('does not add card settlements to the cash drawer', async () => {
    const repository = new CustomerRepository();
    await repository.recordPayment({ ...baseInput, amount: 20, paymentMethod: 'card' });

    expect(state['shift']?.expected_cash).toBe('100.00');
    expect(state['ledger'][0]?.payment_method).toBe('card');
  });

  it('accepts a payment equal to the outstanding balance', async () => {
    const repository = new CustomerRepository();
    const result = await repository.recordPayment({ ...baseInput, amount: 50 });

    expect(result.outstandingAfter).toBe(0);
    expect(state['customer'].balance).toBe('0.00');
  });

  it('rejects an overpayment without touching any state', async () => {
    const repository = new CustomerRepository();

    await expect(repository.recordPayment({ ...baseInput, amount: 50.01 })).rejects.toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
    });

    expect(state['ledger']).toHaveLength(0);
    expect(state['customer'].balance).toBe('-50.00');
    expect(state['shift']?.expected_cash).toBe('100.00');
  });

  it('rejects a payment when the customer owes nothing', async () => {
    state['customer'].balance = '0.00';
    const repository = new CustomerRepository();

    await expect(repository.recordPayment({ ...baseInput, amount: 10 })).rejects.toMatchObject({
      code: 'NO_OUTSTANDING_BALANCE',
    });
    expect(state['ledger']).toHaveLength(0);
  });

  it('rejects non-positive amounts before posting anything', async () => {
    const repository = new CustomerRepository();

    await expect(repository.recordPayment({ ...baseInput, amount: 0 })).rejects.toBeInstanceOf(
      CustomerPaymentError,
    );
    await expect(repository.recordPayment({ ...baseInput, amount: -5 })).rejects.toMatchObject({
      code: 'AMOUNT_INVALID',
    });
    expect(state['ledger']).toHaveLength(0);
  });

  it('returns the original payment for a duplicate idempotency key', async () => {
    const repository = new CustomerRepository();
    const first = await repository.recordPayment({
      ...baseInput,
      amount: 10,
      idempotencyKey: 'pay-key-0001',
    });
    const second = await repository.recordPayment({
      ...baseInput,
      amount: 10,
      idempotencyKey: 'pay-key-0001',
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(state['ledger']).toHaveLength(1);
    expect(state['customer'].balance).toBe('-40.00');
  });

  it('rejects payments on a shift that is not open', async () => {
    state['shift'].status = 'closed';
    const repository = new CustomerRepository();

    await expect(repository.recordPayment({ ...baseInput, amount: 10 })).rejects.toMatchObject({
      code: 'SHIFT_NOT_OPEN',
    });
    expect(state['ledger']).toHaveLength(0);
  });

  it('rolls the ledger, balance and drawer back when a later step fails', async () => {
    state['failLedgerInsert'] = true;
    const repository = new CustomerRepository();

    await expect(repository.recordPayment({ ...baseInput, amount: 10 })).rejects.toThrow(
      /ledger unavailable/,
    );

    expect(state['ledger']).toHaveLength(0);
    expect(state['customer'].balance).toBe('-50.00');
    expect(state['shift']?.expected_cash).toBe('100.00');
  });

  it('handles fractional-cent input without drift', async () => {
    state['customer'].balance = '-0.30';
    const repository = new CustomerRepository();

    const result = await repository.recordPayment({ ...baseInput, amount: 0.1 + 0.2 });

    expect(result.appliedAmount).toBe(0.3);
    expect(state['customer'].balance).toBe('0.00');
    expect(state['ledger'][0]?.amount).toBe(0.3);
  });
});
