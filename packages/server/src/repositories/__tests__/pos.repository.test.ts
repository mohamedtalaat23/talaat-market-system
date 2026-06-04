import { POSRepository, InventoryUnderflowError } from '../pos.repository';
import { db } from '../../config/database';

jest.mock('../../config/database', () => {
  const mockTrx = jest.fn();
  const mockDb = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      return cb(mockTrx);
    }),
    raw: jest.fn(),
  };
  return { db: mockDb };
});

describe('POSRepository', () => {
  let posRepository: POSRepository;
  let mockTrx: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    posRepository = new POSRepository();

    // Mock query builder to support chainable Knex operations
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      decrement: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockReturnThis(),
      _resolvedValue: [],
    };

    // Await resolves to _resolvedValue
    mockQueryBuilder.then = (resolve: any) => {
      resolve(mockQueryBuilder._resolvedValue);
    };

    // Mock transaction object
    mockTrx = jest.fn().mockReturnValue(mockQueryBuilder);
    mockTrx.raw = jest.fn().mockResolvedValue({ rows: [{ hash: 12345, seq: 1 }] });
    mockTrx.fn = { now: () => new Date() };

    (db.transaction as jest.Mock).mockImplementation(async (cb) => cb(mockTrx));
    (db.raw as jest.Mock).mockResolvedValue({ rows: [{ hash: 12345 }] });
  });

  describe('checkout', () => {
    const defaultPayload = {
      shift_id: 1,
      register_id: 1,
      payment_method: 'cash' as const,
      cash_received: 100,
      idempotency_key: 'unique-key',
      items: [
        { product_id: 2, quantity: 2, unit_price: 20, discount: 5 },
        { product_id: 1, quantity: 1, unit_price: 50, discount: 0 },
      ],
    };

    it('should throw error if active shift is missing', async () => {
      await expect(posRepository.checkout({ ...defaultPayload, shift_id: 0 }, 1)).rejects.toThrow(
        'Active shift is required',
      );
    });

    it('should return existing transaction if idempotency key matches', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({
        id: 'existing-id',
        idempotency_key: 'unique-key',
      });
      mockQueryBuilder._resolvedValue = [{ sale_id: 'existing-id', product_id: 2 }]; // for sale_items lookup

      const result = await posRepository.checkout(defaultPayload, 1);
      expect(result.id).toBe('existing-id');
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it('should calculate total correctly and process cash checkout', async () => {
      // items subtotal = (2*20) + (1*50) = 90
      // discounts = 5
      // total = 90 - 5 = 85
      // cash received = 100, change given = 15
      mockQueryBuilder.first.mockResolvedValueOnce(null); // idempotency check
      mockQueryBuilder.first.mockResolvedValueOnce(null); // product info or whatever
      mockQueryBuilder._resolvedValue = [
        { id: 1, cost_price: 10, name: 'Prod 1', barcode: '111' },
        { id: 2, cost_price: 15, name: 'Prod 2', barcode: '222' },
      ]; // product lookup

      // The returning() call resolves to a mock sale object
      mockQueryBuilder.returning.mockResolvedValueOnce([
        { id: 'mock-uuid', receipt_number: 'receipt-123' },
      ]);

      const result = await posRepository.checkout(defaultPayload, 1);
      expect(result.receipt_number).toBe('receipt-123');

      expect(mockTrx).toHaveBeenCalledWith('sales');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 90,
          discount_amount: 5,
          total: 85,
          change_given: 15,
          payment_method: 'cash',
        }),
      );
    });

    it('should throw error if cash received is less than total', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder._resolvedValue = [
        { id: 1, cost_price: 10, name: 'Prod 1', barcode: '111' },
        { id: 2, cost_price: 15, name: 'Prod 2', barcode: '222' },
      ];

      const payload = { ...defaultPayload, cash_received: 50 }; // total is 85

      await expect(posRepository.checkout(payload, 1)).rejects.toThrow(
        'Insufficient cash received',
      );
    });

    it('should throw error if split payment amount is less than total', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder._resolvedValue = [
        { id: 1, cost_price: 10, name: 'Prod 1', barcode: '111' },
        { id: 2, cost_price: 15, name: 'Prod 2', barcode: '222' },
      ];

      const payload = {
        ...defaultPayload,
        payment_method: 'split' as const,
        cash_amount: 40,
        card_amount: 30, // Total = 70 < 85
      };

      await expect(posRepository.checkout(payload, 1)).rejects.toThrow(
        'Insufficient split payment',
      );
    });

    it('should sort items by product_id ASC to prevent deadlock', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder._resolvedValue = [
        { id: 1, cost_price: 10, name: 'Prod 1', barcode: '111' },
        { id: 2, cost_price: 15, name: 'Prod 2', barcode: '222' },
      ];
      mockQueryBuilder.returning.mockResolvedValueOnce([
        { id: 'mock-uuid', receipt_number: 'receipt-123' },
      ]);

      await posRepository.checkout(defaultPayload, 1);

      // Verify products were selected with ordered IDs
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('id', [1, 2]); // sorted ASC: 1, 2
    });

    it('should throw InventoryUnderflowError if decrement returns 0 affected rows', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder._resolvedValue = [
        { id: 1, cost_price: 10, name: 'Prod 1', barcode: '111' },
        { id: 2, cost_price: 15, name: 'Prod 2', barcode: '222' },
      ];
      // Decrement fails (returns 0 rows affected)
      mockQueryBuilder.decrement.mockResolvedValueOnce(0);

      await expect(posRepository.checkout(defaultPayload, 1)).rejects.toThrow(
        InventoryUnderflowError,
      );
    });
  });
});
