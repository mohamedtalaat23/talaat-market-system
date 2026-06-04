import { PurchaseRepository } from '../purchase.repository';
import { db } from '../../config/database';

jest.mock('../../config/database', () => {
  const mockDb = jest.fn();
  (mockDb as any).transaction = jest.fn();
  (mockDb as any).raw = jest.fn();
  return { db: mockDb };
});

describe('PurchaseRepository', () => {
  let purchaseRepository: PurchaseRepository;
  let mockTrx: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    purchaseRepository = new PurchaseRepository();

    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      decrement: jest.fn().mockReturnThis(),
      increment: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn().mockResolvedValue(1),
      select: jest.fn().mockReturnThis(),
      _resolvedValue: [],
    };

    mockQueryBuilder.then = (resolve: any) => {
      resolve(mockQueryBuilder._resolvedValue);
    };

    (db as unknown as jest.Mock).mockReturnValue(mockQueryBuilder);

    mockTrx = jest.fn().mockReturnValue(mockQueryBuilder);
    mockTrx.raw = jest.fn().mockResolvedValue({ rows: [{ seq: 1 }] });
    mockTrx.fn = { now: () => new Date() };

    (db.transaction as jest.Mock).mockImplementation(async (cb) => cb(mockTrx));
  });

  describe('create', () => {
    it('should calculate totals and create draft purchase order', async () => {
      const input = {
        supplier_id: 1,
        discount_amount: 10,
        tax_amount: 5,
        items: [
          { product_id: 101, ordered_quantity: 5, unit_cost: 10.5 }, // 52.5
          { product_id: 102, ordered_quantity: 10, unit_cost: 5 }, // 50.0
        ],
      };
      // subtotal = 102.5
      // total = 102.5 - 10 + 5 = 97.5

      mockQueryBuilder.returning.mockResolvedValueOnce([{ id: 1, po_number: 'PO-123' }]); // insert PO header
      mockQueryBuilder.returning.mockResolvedValueOnce([
        { product_id: 101, ordered_quantity: 5, unit_cost: 10.5 },
        { product_id: 102, ordered_quantity: 10, unit_cost: 5 },
      ]); // insert PO items

      const result = await purchaseRepository.create(input, 1);

      expect(mockTrx).toHaveBeenCalledWith('purchase_orders');
      expect(mockQueryBuilder.insert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          subtotal: 102.5,
          discount_amount: 10,
          tax_amount: 5,
          total: 97.5,
          status: 'draft',
        }),
      );
      expect(result.po_number).toBe('PO-123');
    });
  });

  describe('updateStatus', () => {
    it('should throw error if PO is already received', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({ id: 1, status: 'received' });

      await expect(purchaseRepository.updateStatus(1, 'cancelled')).rejects.toThrow(
        'Completed purchase orders cannot be cancelled',
      );
    });

    it('should throw error if placing non-draft PO to ordered status', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({ id: 1, status: 'cancelled' });

      await expect(purchaseRepository.updateStatus(1, 'ordered')).rejects.toThrow(
        'Only draft purchase orders can be ordered',
      );
    });
  });

  describe('receiveGoods', () => {
    it('should throw error if PO is not in ordered status', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({ id: 1, status: 'draft' }); // not ordered

      await expect(
        purchaseRepository.receiveGoods(1, [{ product_id: 101, received_quantity: 5 }], 2),
      ).rejects.toThrow('Only ordered purchase orders can be received');
    });

    it('should process goods receipt and update stock + AVCO price', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({
        id: 1,
        po_number: 'PO-001',
        status: 'ordered',
      }); // PO header
      mockQueryBuilder._resolvedValue = [{ product_id: 101, purchase_order_id: 1, unit_cost: 10 }]; // PO items lines

      // For the loops:
      mockQueryBuilder.first
        .mockResolvedValueOnce({ product_id: 101, quantity: 20 }) // inventory stock
        .mockResolvedValueOnce({ id: 101, cost_price: 8 }); // product cost

      await purchaseRepository.receiveGoods(1, [{ product_id: 101, received_quantity: 10 }], 2);

      // currentStock = 20, currentCost = 8, addStock = 10, itemCost = 10
      // finalCostPrice = ((20 * 8) + (10 * 10)) / 30 = (160 + 100) / 30 = 260 / 30 = 8.67
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ cost_price: 8.67, updated_at: expect.any(Date) }),
      );

      // Verify physical stock incremented
      expect(mockQueryBuilder.increment).toHaveBeenCalledWith('quantity', 10);

      // Verify PO status finalized to received
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'received' }),
      );
    });
  });
});
