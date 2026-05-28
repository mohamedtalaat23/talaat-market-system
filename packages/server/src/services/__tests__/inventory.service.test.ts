import { inventoryService } from '../inventory.service';
import { db } from '../../config/database';
import { inventoryRepository } from '../../repositories/inventory.repository';
import { ConflictError, NotFoundError } from '../../middleware/errorHandler';

jest.mock('../../config/database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('../../repositories/inventory.repository');
jest.mock('../../middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adjustStock', () => {
    it('should throw ConflictError if resulting quantity drops below zero', async () => {
      // Mock the transaction to execute the callback with a mock trx object
      const mockTrx: any = jest.fn();
      mockTrx.mockReturnValue(mockTrx);
      mockTrx.where = jest.fn().mockReturnValue(mockTrx);
      mockTrx.first = jest.fn().mockResolvedValue({ quantity: 5 });
      
      (db.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(mockTrx);
      });

      await expect(
        inventoryService.adjustStock(1, 'stock_removal', -10)
      ).rejects.toThrow(ConflictError);
    });

    it('should successfully adjust stock and log adjustment', async () => {
      const mockTrx: any = jest.fn();
      mockTrx.mockReturnValue(mockTrx);
      mockTrx.where = jest.fn().mockReturnValue(mockTrx);
      mockTrx.first = jest.fn().mockResolvedValue({ quantity: 10 });
      
      (db.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(mockTrx);
      });

      (inventoryRepository.findByProductId as jest.Mock).mockResolvedValue({
        product_id: 1,
        quantity: 5,
      });

      const result = await inventoryService.adjustStock(1, 'stock_removal', -5);

      expect(inventoryRepository.updateStock).toHaveBeenCalledWith(1, 5, mockTrx);
      expect(inventoryRepository.logAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 1,
          adjustment_type: 'stock_removal',
          quantity_change: -5,
          old_quantity: 10,
          new_quantity: 5,
        }),
        mockTrx
      );
      expect(result.quantity).toBe(5);
    });

    it('should throw NotFoundError if product is not found', async () => {
      const mockTrx: any = jest.fn();
      mockTrx.mockReturnValue(mockTrx);
      mockTrx.where = jest.fn().mockReturnValue(mockTrx);
      mockTrx.first = jest.fn().mockResolvedValue(null);
      
      (db.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(mockTrx);
      });

      await expect(
        inventoryService.adjustStock(999, 'stock_removal', -5)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
