import { db } from '../config/database';
import { NotFoundError, ConflictError, AuthorizationError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';

export class ReturnQueueService {
  async createQueue(userId: string, registerId: string, queueType: 'RECEIPT' | 'UNRECEIPTED') {
    logger.info('Creating return queue', { userId, registerId, queueType });
    const [queue] = await db('ReturnQueue').insert({
      created_by: userId,
      owner_id: userId,
      queue_created_register_id: registerId,
      queue_type: queueType,
      state: 'OPEN',
    }).returning('*');
    return queue;
  }

  async getQueues(filters: { state?: string; register_id?: string }) {
    const query = db('ReturnQueueAgeState')
      .leftJoin('ReturnQueue', 'ReturnQueueAgeState.queue_id', 'ReturnQueue.queue_id')
      .select('ReturnQueue.*', 'ReturnQueueAgeState.age_state')
      .orderBy('ReturnQueue.created_at', 'desc');
      
    if (filters.state) query.where('ReturnQueue.state', filters.state);
    if (filters.register_id) query.where('ReturnQueue.queue_created_register_id', filters.register_id);
    
    return await query;
  }

  async getQueueById(queueId: string) {
    const queue = await db('ReturnQueueAgeState')
      .leftJoin('ReturnQueue', 'ReturnQueueAgeState.queue_id', 'ReturnQueue.queue_id')
      .select('ReturnQueue.*', 'ReturnQueueAgeState.age_state')
      .where('ReturnQueue.queue_id', queueId)
      .first();

    if (!queue) throw new NotFoundError('Return Queue', queueId);

    const items = await db('ReturnQueueItem')
      .where('queue_id', queueId)
      .orderBy('line_number', 'asc');

    return { ...queue, items };
  }

  async updateQueue(queueId: string, updates: any) {
    const queue = await db('ReturnQueue').where({ queue_id: queueId }).first();
    if (!queue) throw new NotFoundError('Return Queue', queueId);
    
    // P1: Must only work when state = OPEN
    if (queue.state !== 'OPEN') {
      throw new ConflictError('Cannot update a queue that is not in OPEN state');
    }

    // P1: Reject protected fields
    const protectedFields = ['state', 'approved_by', 'committed_by', 'created_by', 'queue_type', 'queue_id', 'queue_created_register_id'];
    for (const field of protectedFields) {
      if (field in updates) {
        throw new AuthorizationError(`Cannot modify protected field: ${field}`);
      }
    }

    // P1: May only update specific fields
    const safeUpdates: any = {};
    if (updates.owner_id !== undefined) safeUpdates.owner_id = updates.owner_id;
    if (updates.return_condition_verified !== undefined) safeUpdates.return_condition_verified = updates.return_condition_verified;
    if (updates.notes !== undefined) safeUpdates.notes = updates.notes;

    if (Object.keys(safeUpdates).length === 0) return queue;

    const [updatedQueue] = await db('ReturnQueue')
      .where({ queue_id: queueId })
      .update({ ...safeUpdates, updated_at: db.fn.now() })
      .returning('*');
      
    return updatedQueue;
  }

  async scanItem(
    queueId: string, 
    skuId: string, 
    quantity: number, 
    originalSaleLineId: string | null, 
    originalSaleId: string | null, 
    disposition: string, 
    nonRestockReason: string | null
  ) {
    const queue = await db('ReturnQueue').where({ queue_id: queueId }).first();
    if (!queue) throw new NotFoundError('Return Queue', queueId);
    if (queue.state !== 'OPEN') throw new ConflictError('Cannot scan items into a non-OPEN queue');

    // Perform ON CONFLICT DO UPDATE
    const [item] = await db.raw(`
      INSERT INTO "ReturnQueueItem" 
      (queue_id, sku_id, quantity, disposition, non_restock_reason, original_sale_id, original_sale_line_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, now())
      ON CONFLICT (queue_id, sku_id) DO UPDATE SET 
        quantity = "ReturnQueueItem".quantity + EXCLUDED.quantity,
        disposition = EXCLUDED.disposition,
        non_restock_reason = EXCLUDED.non_restock_reason,
        updated_at = now()
      RETURNING *
    `, [queueId, skuId, quantity, disposition, nonRestockReason, originalSaleId, originalSaleLineId]);

    return item.rows ? item.rows[0] : item;
  }

  async updateItem(queueId: string, lineNumber: number, updates: any) {
    const queue = await db('ReturnQueue').where({ queue_id: queueId }).first();
    if (!queue) throw new NotFoundError('Return Queue', queueId);
    if (queue.state !== 'OPEN') throw new ConflictError('Cannot edit items in a non-OPEN queue');

    const [item] = await db('ReturnQueueItem')
      .where({ queue_id: queueId, line_number: lineNumber })
      .update({ ...updates, updated_at: db.fn.now() })
      .returning('*');
      
    if (!item) throw new NotFoundError('Return Queue Item', String(lineNumber));
    return item;
  }

  async submitQueue(queueId: string, userId: string) {
    return db.transaction(async trx => {
      const queue = await trx('ReturnQueue').where({ queue_id: queueId, state: 'OPEN' }).forUpdate().first();
      if (!queue) throw new ConflictError('Queue not found or not in OPEN state');

      const [updated] = await trx('ReturnQueue')
        .where({ queue_id: queueId })
        .update({ state: 'SUBMITTED', updated_at: db.fn.now() })
        .returning('*');

      await trx('audit_logs').insert({
        entity_id: queueId,
        entity_type: 'ReturnQueue',
        actor_id: userId,
        old_state: 'OPEN',
        new_state: 'SUBMITTED',
        created_at: db.fn.now()
      });

      return updated;
    });
  }

  async approveQueue(queueId: string, managerId: string, returnConditionVerified: boolean) {
    if (!returnConditionVerified) throw new ConflictError('Approval requires physical item verification');
    
    return db.transaction(async trx => {
      const queue = await trx('ReturnQueue').where({ queue_id: queueId }).forUpdate().first();
      if (!queue) throw new NotFoundError('Queue', queueId);
      if (queue.state !== 'SUBMITTED') throw new ConflictError('Queue must be SUBMITTED to approve');

      // P2: Prevent self-approval (Separation of duties)
      if (queue.created_by === managerId) {
        throw new ConflictError('You cannot approve your own return queue');
      }

      const [approvedQueue] = await trx('ReturnQueue')
        .where({ queue_id: queueId })
        .update({ 
          state: 'APPROVED', 
          approved_by: managerId,
          return_condition_verified: true,
          updated_at: db.fn.now()
        })
        .returning('*');

      await trx('audit_logs').insert({
        entity_id: queueId,
        entity_type: 'ReturnQueue',
        actor_id: managerId,
        old_state: 'SUBMITTED',
        new_state: 'APPROVED',
        created_at: db.fn.now()
      });

      return approvedQueue;
    });
  }

  async commitQueue(queueId: string, managerId: string) {
    return db.transaction(async (trx) => {
      logger.info('Beginning commit transaction for return queue', { queueId });

      // 1. & 2. Lock the ReturnQueue row in SERIALIZABLE/FOR UPDATE transaction
      const queue = await trx('ReturnQueue').where({ queue_id: queueId }).forUpdate().first();
      if (!queue) throw new NotFoundError('Queue', queueId);

      // P2: Prevent self-commit (Separation of duties)
      if (queue.created_by === managerId) {
        throw new ConflictError('You cannot commit a queue you created');
      }

      // 3. Idempotency protection: Validate state is exactly APPROVED
      if (queue.state === 'COMMITTED') {
         throw new ConflictError('Queue is already committed');
      }
      if (queue.state !== 'APPROVED') {
        throw new ConflictError('Queue must be APPROVED to commit');
      }

      // 4. Transition state to COMMITTED
      await trx('ReturnQueue')
        .where({ queue_id: queueId })
        .update({ 
          state: 'COMMITTED', 
          committed_by: managerId,
          updated_at: db.fn.now()
        });

      // Fetch items to process
      const items = await trx('ReturnQueueItem').where({ queue_id: queueId });
      let totalRefund = 0;
      const refundLines = [];

      for (const item of items) {
        // Find product cost/price
        const product = await trx('products').where('id', item.sku_id).first();
        if (!product) throw new NotFoundError('Product', item.sku_id);

        const lineTotal = Number(product.price || 0) * item.quantity;
        totalRefund += lineTotal;

        refundLines.push({
          sku_id: item.sku_id,
          quantity: item.quantity,
          unit_price: product.price,
          line_total: lineTotal
        });

        // 7. Adjust physical stock in Inventory based on RESTOCK disposition
        if (item.disposition === 'RESTOCK') {
          const inv = await trx('inventory').where('product_id', item.sku_id).forUpdate().first();
          const oldQuantity = inv ? Number(inv.quantity) : 0;
          const newQuantity = oldQuantity + item.quantity;

          if (inv) {
            await trx('inventory').where('product_id', item.sku_id).update({ quantity: newQuantity, updated_at: db.fn.now() });
          } else {
            await trx('inventory').insert({ product_id: item.sku_id, quantity: newQuantity });
          }

          // 6. Create InventoryLedger entries
          await trx('inventory_adjustments').insert({
            product_id: item.sku_id,
            adjustment_type: 'return',
            quantity_change: item.quantity,
            old_quantity: oldQuantity,
            new_quantity: newQuantity,
            reason_code: 'RETURN_RESTOCK',
            notes: `Return Queue ${queueId}`,
            created_by: managerId
          });
        } else {
          // Disposition = NON_RESTOCKABLE
          await trx('inventory_adjustments').insert({
            product_id: item.sku_id,
            adjustment_type: 'damage',
            quantity_change: 0,
            old_quantity: 0,
            new_quantity: 0,
            reason_code: item.non_restock_reason,
            notes: `Return Queue ${queueId} Write-off`,
            created_by: managerId
          });
        }
      }

      // 5. Create RefundTransaction record
      const [refundTx] = await trx('refund_transactions').insert({
        queue_id: queueId,
        total_amount: totalRefund,
        processed_by: managerId,
        status: 'COMPLETED',
        created_at: db.fn.now()
      }).returning('*');

      for (const line of refundLines) {
        await trx('refund_transaction_lines').insert({
          refund_transaction_id: refundTx.id,
          ...line
        });
      }

      // 8. Inserts audit records
      await trx('audit_logs').insert({
        entity_id: queueId,
        entity_type: 'ReturnQueue',
        actor_id: managerId,
        old_state: 'APPROVED',
        new_state: 'COMMITTED',
        created_at: db.fn.now()
      });

      // 9. Commits transaction automatically
      return { success: true, queueId, totalRefund };
    }, { isolationLevel: 'serializable' });
  }

  async cancelQueue(queueId: string, userId: string) {
    return db.transaction(async trx => {
      const queue = await trx('ReturnQueue').where({ queue_id: queueId }).forUpdate().first();
      if (!queue) throw new NotFoundError('Queue', queueId);

      if (['COMMITTED', 'CANCELLED'].includes(queue.state)) {
        throw new ConflictError(`Cannot cancel a queue in state: ${queue.state}`);
      }

      const oldState = queue.state;

      const [cancelledQueue] = await trx('ReturnQueue')
        .where({ queue_id: queueId })
        .update({ state: 'CANCELLED', updated_at: db.fn.now() })
        .returning('*');

      await trx('audit_logs').insert({
        entity_id: queueId,
        entity_type: 'ReturnQueue',
        actor_id: userId,
        old_state: oldState,
        new_state: 'CANCELLED',
        created_at: db.fn.now()
      });

      return cancelledQueue;
    });
  }
}

export const returnQueueService = new ReturnQueueService();
