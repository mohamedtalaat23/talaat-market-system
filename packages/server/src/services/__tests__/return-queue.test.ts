import { ReturnQueueService } from '../return-queue.service';
import { db } from '../../config/database';
import { ConflictError, AuthorizationError, NotFoundError } from '../../middleware/errorHandler';

// Mock DB or dependencies for deep integration verification
jest.mock('../../config/database', () => {
  const dbMock: any = jest.fn();
  dbMock.transaction = jest.fn();
  dbMock.raw = jest.fn();
  dbMock.fn = { now: jest.fn().mockReturnValue('NOW()') };
  return { db: dbMock };
});

describe('ReturnQueueService Integration & Hostile Tests', () => {
  let service: ReturnQueueService;
  let trxMock: any;
  let queryBuilderMock: any;

  beforeEach(() => {
    service = new ReturnQueueService();
    jest.clearAllMocks();

    queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };

    trxMock = {
      ...queryBuilderMock,
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    (db as any).mockReturnValue(queryBuilderMock);
    (db.transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb(trxMock);
    });
  });

  describe('P1 - PATCH State Machine Bypass', () => {
    it('Rejects updates if state is not OPEN -> 409 Conflict', async () => {
      queryBuilderMock.first.mockResolvedValue({ queue_id: 'q1', state: 'COMMITTED' });
      await expect(service.updateQueue('q1', { owner_id: 'm1' })).rejects.toThrow(ConflictError);
    });

    it('Rejects updates modifying protected fields -> 403 AuthorizationError', async () => {
      queryBuilderMock.first.mockResolvedValue({ queue_id: 'q1', state: 'OPEN' });
      await expect(service.updateQueue('q1', { state: 'COMMITTED' })).rejects.toThrow(AuthorizationError);
      await expect(service.updateQueue('q1', { approved_by: 'hacker' })).rejects.toThrow(AuthorizationError);
      await expect(service.updateQueue('q1', { committed_by: 'hacker' })).rejects.toThrow(AuthorizationError);
    });

    it('Allows updates on specific safe fields when OPEN', async () => {
      queryBuilderMock.first.mockResolvedValue({ queue_id: 'q1', state: 'OPEN' });
      queryBuilderMock.returning.mockResolvedValue([{ queue_id: 'q1', owner_id: 'm2' }]);
      
      const result = await service.updateQueue('q1', { owner_id: 'm2' });
      expect(result.owner_id).toBe('m2');
      expect(queryBuilderMock.update).toHaveBeenCalledWith({ owner_id: 'm2', updated_at: 'NOW()' });
    });
  });

  describe('P2 - Separation of Duties', () => {
    it('creator != approver -> 409 Conflict', async () => {
      trxMock.first.mockResolvedValue({ queue_id: 'q1', created_by: 'm1', state: 'SUBMITTED' });
      await expect(service.approveQueue('q1', 'm1', true)).rejects.toThrow(ConflictError);
    });

    it('creator != committer -> 409 Conflict', async () => {
      trxMock.first.mockResolvedValue({ queue_id: 'q1', created_by: 'm1', state: 'APPROVED' });
      await expect(service.commitQueue('q1', 'm1')).rejects.toThrow(ConflictError);
    });
  });

  describe('P2 - Refund Persistence', () => {
    it('Inserts actual refund transactions inside commit transaction', async () => {
      trxMock.first
        .mockResolvedValueOnce({ queue_id: 'q1', created_by: 'cashier', state: 'APPROVED' }) // Queue
        .mockResolvedValueOnce({ price: 100 }); // Product

      trxMock.where.mockReturnValueOnce(trxMock); // Lock queue
      trxMock.where.mockReturnValueOnce([ // ReturnQueueItems
        { sku_id: 'sku1', quantity: 2, disposition: 'RESTOCK' }
      ]);
      
      trxMock.returning.mockResolvedValueOnce([{ id: 'refund_123' }]);

      await service.commitQueue('q1', 'manager2');

      // Verify refund_transactions insert
      expect(trxMock.insert).toHaveBeenCalledWith(expect.objectContaining({
        queue_id: 'q1',
        total_amount: 200,
        processed_by: 'manager2',
        status: 'COMPLETED'
      }));

      // Verify refund_transaction_lines insert
      expect(trxMock.insert).toHaveBeenCalledWith(expect.objectContaining({
        refund_transaction_id: 'refund_123',
        sku_id: 'sku1',
        quantity: 2,
        unit_price: 100,
        line_total: 200
      }));
    });
  });

  describe('P2 - Audit Persistence', () => {
    it('Records old_state and new_state on state transitions', async () => {
      trxMock.first.mockResolvedValue({ queue_id: 'q1', created_by: 'c1', state: 'OPEN' });
      trxMock.returning.mockResolvedValue([{}]);
      
      await service.submitQueue('q1', 'c1');
      expect(trxMock.insert).toHaveBeenCalledWith(expect.objectContaining({
        entity_id: 'q1',
        actor_id: 'c1',
        old_state: 'OPEN',
        new_state: 'SUBMITTED'
      }));
    });
  });

  describe('Scanner Upsert', () => {
    it('Validates ON CONFLICT DO UPDATE behavior', async () => {
      queryBuilderMock.first.mockResolvedValue({ queue_id: 'q1', state: 'OPEN' });
      (db.raw as jest.Mock).mockResolvedValue({ rows: [{ quantity: 5 }] });

      await service.scanItem('q1', 'sku1', 1, null, null, 'RESTOCK', null);
      expect(db.raw).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (queue_id, sku_id) DO UPDATE SET'),
        expect.any(Array)
      );
    });
  });

  describe('Idempotency & Race Conditions', () => {
    it('Double commit prevents duplicate operations -> 409 Conflict', async () => {
      trxMock.first.mockResolvedValue({ queue_id: 'q1', created_by: 'c1', state: 'COMMITTED' });
      await expect(service.commitQueue('q1', 'm2')).rejects.toThrow(ConflictError);
    });
  });
});
