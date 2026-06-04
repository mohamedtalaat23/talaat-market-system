import { ReportsRepository } from '../reports.repository';
import { db } from '../../config/database';

jest.mock('../../config/database', () => {
  const mockDb = jest.fn();
  return { db: mockDb };
});

describe('ReportsRepository', () => {
  let reportsRepository: ReportsRepository;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    reportsRepository = new ReportsRepository();

    mockQueryBuilder = {
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereBetween: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      groupByRaw: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      first: jest.fn(),
      _resolvedValue: [],
    };

    mockQueryBuilder.then = (resolve: any) => {
      resolve(mockQueryBuilder._resolvedValue);
    };

    (db as unknown as jest.Mock).mockReturnValue(mockQueryBuilder);
    db.raw = jest.fn().mockImplementation((val) => val);
  });

  describe('getShifts', () => {
    it('should return paginated shift listings', async () => {
      let callCount = 0;
      mockQueryBuilder.then = (resolve: any) => {
        if (callCount === 0) {
          callCount++;
          resolve([{ total: 1 }]);
        } else {
          resolve([
            {
              id: 1,
              cashier_name: 'John',
              starting_cash: '100.00',
              expected_cash: '150.00',
              ending_cash: '150.00',
              variance: '0.00',
            },
          ]);
        }
      };

      const result = await reportsRepository.getShifts({ page: 1, limit: 10 });

      expect(result.items[0].starting_cash).toBe(100);
      expect(result.items[0].variance).toBe(0);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getShiftDetail', () => {
    it('should return null if shift not found', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const result = await reportsRepository.getShiftDetail(999);
      expect(result).toBeNull();
    });

    it('should return shift detail with summary info', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce({
          id: 1,
          employee_id: 2,
          starting_cash: '100.00',
          expected_cash: '120.00',
          ending_cash: '120.00',
          variance: '0.00',
          start_time: new Date(),
          end_time: new Date(),
        }) // shift query
        .mockResolvedValueOnce({ count: 1 }) // tx count
        .mockResolvedValueOnce({
          total_revenue: '20.00',
          total_discounts: '0.00',
          cash_sales_total: '20.00',
          card_sales_total: '0.00',
        }) // salesSummary
        .mockResolvedValueOnce({
          payment_amount: '0.00',
          cash_payments: '0.00',
          card_payments: '0.00',
        }); // paymentSummary

      // transactions
      mockQueryBuilder._resolvedValue = [
        {
          id: 1,
          receipt_number: 'R1',
          total: '20.00',
          change_given: '0.00',
          discount_amount: '0.00',
          global_discount: '0.00',
        },
      ];

      const result = await reportsRepository.getShiftDetail(1);

      expect(result).not.toBeNull();
      expect(result?.summary.total_revenue).toBe(20);
      expect(result?.transactions[0].total).toBe(20);
    });
  });

  describe('getWeeklyReport', () => {
    it('should aggregate sales for 7 days and return top products', async () => {
      const weekStart = '2026-06-01T00:00:00Z';
      const weekEnd = '2026-06-07T23:59:59Z';

      const mockSales = [
        { sale_date: '2026-06-01', tx_count: 5, total_rev: '500.00', total_disc: '10.00' },
      ];
      const mockProducts = [
        { product_name: 'Coke', total_quantity_sold: '10', total_revenue: '100.00' },
      ];

      // Custom sequence for thenable resolution in getWeeklyReport
      let callCount = 0;
      mockQueryBuilder.then = (resolve: any) => {
        if (callCount === 0) {
          callCount++;
          resolve(mockSales);
        } else {
          resolve(mockProducts);
        }
      };

      const result = await reportsRepository.getWeeklyReport(weekStart, weekEnd);

      expect(result.days?.[0]?.date).toBe('2026-06-01');
      expect(result.days?.[0]?.transaction_count).toBe(5);
      expect(result.days?.[0]?.net_revenue).toBe(490);
      expect(result.top_products?.[0]?.product_name).toBe('Coke');
      expect(result.top_products?.[0]?.total_quantity_sold).toBe(10);
    });
  });
});
