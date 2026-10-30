import type { CheckoutPayload } from '../pos.repository';
import { db } from '../../config/database';
import { POSRepository } from '../pos.repository';

/**
 * Duplicate-synchronisation guard (POST /pos/sync).
 *
 * Offline registers may replay the same queued sale many times (retry loop,
 * app restart, LAN reconnection). `syncOffline` must de-duplicate on both the
 * client sale id and the idempotency key *before* touching inventory, otherwise
 * a retry storm silently multiplies stock decrements and revenue.
 */
jest.mock('../../config/database', () => {
  const salesBuilder = {
    where: jest.fn(),
    select: jest.fn(),
  };

  return { db: jest.fn(() => salesBuilder) };
});

function payload(overrides: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    shift_id: 1,
    register_id: 1,
    payment_method: 'cash',
    cash_received: 30,
    idempotency_key: 'offline-key-1',
    items: [{ product_id: 3, quantity: 1, unit_price: 20, discount: 0 }],
    ...overrides,
  };
}

describe('POSRepository.syncOffline de-duplication', () => {
  const builder = (db as unknown as jest.Mock)() as { where: jest.Mock; select: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    builder.where.mockReturnValue(builder);
    builder.select.mockResolvedValue([]);
  });

  it('does not re-process a sale whose idempotency key already exists', async () => {
    builder.select.mockResolvedValueOnce([{ id: 'sale-1', idempotency_key: 'offline-key-1' }]);
    const repository = new POSRepository();
    const checkoutSpy = jest
      .spyOn(repository, 'checkout')
      .mockResolvedValue({ id: 'sale-1' } as never);

    const result = await repository.syncOffline([payload()], 7);

    expect(checkoutSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, syncedIds: ['offline-key-1'], failed: [] });
  });

  it('does not re-process a sale whose client id already exists', async () => {
    builder.select.mockResolvedValueOnce([{ id: 'sale-1', idempotency_key: 'other-key' }]);
    const repository = new POSRepository();
    const checkoutSpy = jest
      .spyOn(repository, 'checkout')
      .mockResolvedValue({ id: 'sale-1' } as never);

    const result = await repository.syncOffline(
      [payload({ id: 'sale-1', idempotency_key: 'brand-new-key' })],
      7,
    );

    expect(checkoutSpy).not.toHaveBeenCalled();
    expect(result.synced).toBe(0);
  });

  it('processes only the genuinely new sales in a mixed batch', async () => {
    builder.select.mockResolvedValueOnce([{ id: 'sale-1', idempotency_key: 'offline-key-1' }]);
    const repository = new POSRepository();
    const checkoutSpy = jest
      .spyOn(repository, 'checkout')
      .mockResolvedValue({ id: 'sale-2' } as never);

    const result = await repository.syncOffline(
      [payload(), payload({ id: 'sale-2', idempotency_key: 'offline-key-2' })],
      7,
    );

    expect(checkoutSpy).toHaveBeenCalledTimes(1);
    const [processedPayload, cashierId, bypassInventory, isOfflineSync] =
      checkoutSpy.mock.calls[0]!;
    expect(cashierId).toBe(7);
    expect(processedPayload.idempotency_key).toBe('offline-key-2');
    // Offline replays bypass the stock underflow guard (the physical sale
    // already happened) and are flagged so the repository logs anomalies.
    expect(bypassInventory).toBe(true);
    expect(isOfflineSync).toBe(true);
    expect(result).toEqual({ synced: 1, syncedIds: ['offline-key-1', 'sale-2'], failed: [] });
  });

  it('isolates a poison sale instead of failing the whole batch', async () => {
    const repository = new POSRepository();
    const checkoutSpy = jest
      .spyOn(repository, 'checkout')
      .mockRejectedValueOnce(new Error('Selected customer not found or has been deleted.'))
      .mockResolvedValueOnce({ id: 'sale-2' } as never);

    const result = await repository.syncOffline(
      [payload({ id: 'sale-1' }), payload({ id: 'sale-2', idempotency_key: 'key-2' })],
      7,
    );

    expect(checkoutSpy).toHaveBeenCalledTimes(2);
    expect(result.synced).toBe(1);
    expect(result.failed).toEqual([
      { id: 'sale-1', error: 'Selected customer not found or has been deleted.' },
    ]);
  });
});
