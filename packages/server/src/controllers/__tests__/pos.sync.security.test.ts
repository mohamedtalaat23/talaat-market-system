import { posController } from '../pos.controller';
import { posRepository } from '../../repositories/pos.repository';
import { pinService } from '../../services/pin.service';

jest.mock('../../config/database', () => ({
  db: jest.fn(),
}));

jest.mock('../../repositories/pos.repository', () => ({
  posRepository: {
    syncOffline: jest.fn(),
    processRefund: jest.fn(),
    checkout: jest.fn(),
  },
}));

jest.mock('../../services/pin.service', () => ({
  pinService: { verifyPin: jest.fn() },
}));

jest.mock('../../middleware/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const SALE_ITEM_ID = '5f0d1b9c-1f2a-4f7b-9a3e-8c6d5e4f3a2b';

function createRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

const validCheckout = {
  shift_id: 4,
  register_id: 1,
  payment_method: 'cash' as const,
  cash_received: 20,
  idempotency_key: 'offline-1',
  items: [{ product_id: 2, quantity: 1, unit_price: 10, discount: 0 }],
};

describe('POS offline sync — identity binding and tamper handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attributes every synced sale to the authenticated employee, never the payload', async () => {
    (posRepository.syncOffline as jest.Mock).mockResolvedValue({
      synced: 1,
      syncedIds: ['offline-1'],
      failed: [],
    });

    const req = {
      body: {
        // A tampering client tries to attribute the sale to a different cashier.
        cashier_id: 999,
        transactions: [{ ...validCheckout, cashier_id: 999, employee_id: 999 }],
      },
      user: { id: 7, role: 'cashier' },
    } as never;
    const res = createRes();

    await posController.syncOffline(req, res as never);

    expect(posRepository.syncOffline).toHaveBeenCalledTimes(1);
    const [, cashierId] = (posRepository.syncOffline as jest.Mock).mock.calls[0];
    expect(cashierId).toBe(7);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects an empty offline batch', async () => {
    const req = { body: { transactions: [] }, user: { id: 7, role: 'cashier' } } as never;
    const res = createRes();

    await posController.syncOffline(req, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(posRepository.syncOffline).not.toHaveBeenCalled();
  });

  it('rejects an offline batch that contains a negative price or quantity', async () => {
    const req = {
      body: {
        transactions: [
          {
            ...validCheckout,
            items: [{ product_id: 2, quantity: 1, unit_price: -10, discount: 0 }],
          },
        ],
      },
      user: { id: 7, role: 'cashier' },
    } as never;
    const res = createRes();

    await posController.syncOffline(req, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(posRepository.syncOffline).not.toHaveBeenCalled();
  });

  it('reports per-sale failures instead of throwing when a stored sale is rejected', async () => {
    (posRepository.syncOffline as jest.Mock).mockResolvedValue({
      synced: 0,
      syncedIds: [],
      failed: [{ id: 'offline-1', error: 'Insufficient inventory' }],
    });

    const req = {
      body: { transactions: [validCheckout] },
      user: { id: 7, role: 'cashier' },
    } as never;
    const res = createRes();

    await posController.syncOffline(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ failed: [{ id: 'offline-1', error: 'Insufficient inventory' }] }),
    );
  });
});

describe('POS reversals — manager authorisation', () => {
  const refundBody = {
    manager_id: 2,
    manager_pin: '4821',
    reason: 'Damaged goods',
    items: [{ sale_item_id: SALE_ITEM_ID, quantity: 1, restock_inventory: false }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a refund when the manager PIN is rejected', async () => {
    (pinService.verifyPin as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Invalid PIN. 4 attempt(s) remaining before lockout.',
    });

    const req = {
      params: { id: SALE_ITEM_ID },
      body: refundBody,
      user: { id: 7, role: 'cashier' },
      ip: '127.0.0.1',
    } as never;
    const res = createRes();

    await posController.refundSale(req, res as never);

    expect(pinService.verifyPin).toHaveBeenCalledWith(2, '4821', 7, '127.0.0.1');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(posRepository.processRefund).not.toHaveBeenCalled();
  });

  it('processes a refund once the PIN verifies', async () => {
    (pinService.verifyPin as jest.Mock).mockResolvedValue({ success: true, message: 'ok' });
    (posRepository.processRefund as jest.Mock).mockResolvedValue({ total_refunded: 10 });

    const req = {
      params: { id: SALE_ITEM_ID },
      body: refundBody,
      user: { id: 7, role: 'cashier' },
      ip: '127.0.0.1',
    } as never;
    const res = createRes();

    await posController.refundSale(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(posRepository.processRefund).toHaveBeenCalledTimes(1);
  });

  it('refuses a void without a valid manager PIN', async () => {
    (pinService.verifyPin as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Account locked',
    });

    const req = {
      params: { id: SALE_ITEM_ID },
      body: { manager_id: 2, manager_pin: '4821', reason: 'Customer changed mind' },
      user: { id: 7, role: 'cashier' },
      ip: '127.0.0.1',
    } as never;
    const res = createRes();

    await posController.voidSale(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(posRepository.processRefund).not.toHaveBeenCalled();
  });
});
