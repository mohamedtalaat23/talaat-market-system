import { productService } from '../product.service';
import { productRepository } from '../../repositories/product.repository';
import { supplierService } from '../supplier.service';
import { db } from '../../config/database';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';

jest.mock('../../repositories/product.repository');
jest.mock('../supplier.service');
jest.mock('../../config/database', () => {
  const mockTrx = jest.fn();
  const mockDb = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      return cb(mockTrx);
    }),
  };
  return { db: mockDb };
});

jest.mock('../../middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should return paginated products', async () => {
      const mockItems = [{ id: 1, name: 'Product A' }];
      (productRepository.findAll as jest.Mock).mockResolvedValue(mockItems);
      (productRepository.countAll as jest.Mock).mockResolvedValue(1);

      const result = await productService.getProducts({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(result.items).toEqual(mockItems);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getProductById', () => {
    it('should throw NotFoundError if product not found', async () => {
      (productRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(productService.getProductById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getProductByBarcode', () => {
    it('should throw NotFoundError if product barcode not found', async () => {
      (productRepository.findByBarcode as jest.Mock).mockResolvedValue(null);

      await expect(productService.getProductByBarcode('12345')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createProduct', () => {
    it('should throw ConflictError if barcode is already taken', async () => {
      (productRepository.findByBarcode as jest.Mock).mockResolvedValue({ id: 1, name: 'Existing' });

      await expect(
        productService.createProduct({
          name: 'New',
          barcode: '12345',
          cost_price: 10,
          selling_price: 15,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should call validateSupplierAssignment if supplier_id is provided', async () => {
      (productRepository.findByBarcode as jest.Mock).mockResolvedValue(null);
      (productRepository.create as jest.Mock).mockResolvedValue({ id: 2 });
      (productRepository.findById as jest.Mock).mockResolvedValue({ id: 2, name: 'New' });

      await productService.createProduct({
        name: 'New',
        supplier_id: 5,
        cost_price: 10,
        selling_price: 15,
      });
      expect(supplierService.validateSupplierAssignment).toHaveBeenCalledWith(5);
    });

    it('should create product and inventory inside transaction', async () => {
      (productRepository.findByBarcode as jest.Mock).mockResolvedValue(null);
      (productRepository.create as jest.Mock).mockResolvedValue({ id: 2 });
      (productRepository.findById as jest.Mock).mockResolvedValue({ id: 2, name: 'New' });

      const result = await productService.createProduct({
        name: 'New',
        cost_price: 10,
        selling_price: 15,
        initial_quantity: 50,
      });

      expect(db.transaction).toHaveBeenCalled();
      expect(productRepository.create).toHaveBeenCalled();
      expect(productRepository.createInventory).toHaveBeenCalledWith(2, 50, expect.any(Function));
      expect(result.name).toBe('New');
    });
  });

  describe('updateProduct', () => {
    it('should throw NotFoundError if product to update does not exist', async () => {
      (productRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(productService.updateProduct(999, { name: 'Name' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ConflictError if updating barcode to an existing one', async () => {
      (productRepository.findById as jest.Mock).mockResolvedValue({ id: 1, barcode: '111' });
      (productRepository.findByBarcode as jest.Mock).mockResolvedValue({ id: 2, barcode: '222' });

      await expect(productService.updateProduct(1, { barcode: '222' })).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product', async () => {
      (productRepository.findById as jest.Mock).mockResolvedValue({ id: 1 });

      await productService.deleteProduct(1);
      expect(productRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });
});
