import type { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { HTTP_STATUS } from '../config/constants';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';

/**
 * Valid transitions ONLY:
 * DRAFT -> PENDING_APPROVAL
 * PENDING_APPROVAL -> POSTING
 * POSTING -> POSTED
 * DRAFT -> CANCELLED
 * PENDING_APPROVAL -> CANCELLED
 */

export async function createCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, location } = req.body;
    const created_by = (req as any).user?.id;

    if (!['blind', 'guided', 'investigation'].includes(type)) {
      throw new ValidationError('Invalid cycle count type');
    }

    const [newCycleCount] = await db('cycle_counts').insert({
      type,
      location,
      status: 'draft',
      created_by,
      total_variance_value: 0,
      expires_at: db.raw("NOW() + INTERVAL '24 hours'")
    }).returning('*');

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: newCycleCount });
  } catch (error) {
    next(error);
  }
}

export async function getCycleCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = db('cycle_counts').orderBy('created_at', 'desc');

    if (req.query.status) {
      query.where('status', req.query.status);
    }

    const counts = await query.clone().limit(limit).offset(offset);
    const countRes: any = await query.clone().count('id as count');
    const count = countRes[0].count;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
      meta: {
        total: Number(count),
        page,
        limit,
        totalPages: Math.ceil(Number(count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCycleCountById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const cycleCount = await db('cycle_counts').where({ id }).first();
    if (!cycleCount) throw new NotFoundError('Cycle Count not found', id);

    const items = await db('cycle_count_items')
      .join('products', 'cycle_count_items.product_id', 'products.id')
      .where('cycle_count_id', id)
      .select(
        'cycle_count_items.*',
        'products.name as product_name',
        'products.barcode'
      )
      .orderBy('cycle_count_items.created_at', 'asc');

    res.status(HTTP_STATUS.OK).json({ success: true, data: { ...cycleCount, items } });
  } catch (error) {
    next(error);
  }
}

export async function updateCycleCountItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { product_id, counted_qty, location, notes } = req.body;

    await db.transaction(async (trx) => {
      const cycleCount = await trx('cycle_counts').where({ id }).forUpdate().first();
      if (!cycleCount) throw new NotFoundError('Cycle Count not found', id);

      if (cycleCount.status !== 'draft' && cycleCount.status !== 'pending_approval') {
        throw new ConflictError('Can only update items in draft or pending_approval state');
      }

      const product = await trx('products').where('id', product_id).first();
      if (!product) throw new NotFoundError('Product not found', product_id);

      // Check current live inventory
      const inv = await trx('inventory').where('product_id', product_id).first();
      const system_qty = inv ? Number(inv.quantity) : 0;
      const variance = counted_qty - system_qty;

      // Upsert item
      const existingItem = await trx('cycle_count_items')
        .where({ cycle_count_id: id, product_id })
        .first();

      if (existingItem) {
        await trx('cycle_count_items')
          .where('id', existingItem.id)
          .update({
            counted_qty,
            variance,
            notes,
            location: location || existingItem.location,
            updated_at: db.fn.now()
          });
      } else {
        await trx('cycle_count_items').insert({
          cycle_count_id: id,
          product_id,
          system_qty,
          counted_qty,
          variance,
          notes,
          location
        });
      }
    });

    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function scanCycleCountItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { barcode } = req.body;

    if (!barcode) {
      throw new ValidationError('Barcode is required');
    }

    await db.transaction(async (trx) => {
      // 1. Lock cycle count
      const cycleCount = await trx('cycle_counts').where({ id }).forUpdate().first();
      if (!cycleCount) throw new NotFoundError('Cycle Count not found', id);

      if (cycleCount.status !== 'draft' && cycleCount.status !== 'pending_approval') {
        throw new ConflictError('Can only scan items in draft or pending_approval state');
      }

      // 2. Resolve product by barcode
      const product = await trx('products').where({ barcode }).first();
      if (!product) throw new NotFoundError('Product not found for barcode', barcode);

      const product_id = product.id;

      // 3. Resolve live inventory system qty
      const inv = await trx('inventory').where('product_id', product_id).first();
      const system_qty = inv ? Number(inv.quantity) : 0;

      // 4. Atomic Upsert for counted_qty + 1
      await trx.raw(`
        INSERT INTO cycle_count_items (cycle_count_id, product_id, system_qty, counted_qty, variance)
        VALUES (?, ?, ?, 1, 1 - ?)
        ON CONFLICT (cycle_count_id, product_id) DO UPDATE SET
          counted_qty = cycle_count_items.counted_qty + 1,
          variance = cycle_count_items.counted_qty + 1 - cycle_count_items.system_qty,
          updated_at = NOW()
      `, [id, product_id, system_qty, system_qty]);
    });

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Item scanned successfully' });
  } catch (error) {
    next(error);
  }
}

export async function postCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { idempotency_key, manager_id, pin } = req.body;
    const current_user_id = (req as any).user?.id;

    await db.transaction(async (trx) => {
      // 1. Lock cycle count
      const cycleCount = await trx('cycle_counts').where({ id }).forUpdate().first();
      if (!cycleCount) throw new NotFoundError('Cycle Count not found', id);

      if (cycleCount.status !== 'draft' && cycleCount.status !== 'pending_approval') {
        throw new ConflictError(`Cannot post batch in state: ${cycleCount.status}`);
      }

      if (cycleCount.idempotency_key && cycleCount.idempotency_key === idempotency_key) {
        throw new ConflictError('This batch is already being processed or was processed.');
      }

      // Check draft expiry
      if (cycleCount.expires_at && new Date() > new Date(cycleCount.expires_at)) {
        await trx('cycle_counts').where({ id }).update({ status: 'cancelled' });
        throw new ConflictError('Cycle count draft has expired and was auto-cancelled.');
      }

      // Enforce Ownership
      const currentUser = await trx('employees').where('id', current_user_id).first();
      if (!currentUser) throw new ConflictError('User not found');
      
      const isCreator = cycleCount.created_by === current_user_id;
      const isAssigned = cycleCount.assigned_to === current_user_id;
      const isManagerOrAdmin = ['manager', 'admin'].includes(currentUser.role);
      
      if (!isCreator && !isAssigned && !isManagerOrAdmin) {
         throw new ConflictError('You are not authorized to post this cycle count.');
      }

      // Change status to posting to prevent concurrent posting
      await trx('cycle_counts').where({ id }).update({ 
        status: 'posting', 
        idempotency_key 
      });

      // 2. Fetch items and recalculate actual variance using LIVE unit_cost
      const items = await trx('cycle_count_items').where({ cycle_count_id: id });

      let totalVarianceValue = 0;
      let requiresManagerApproval = false;
      let requiresAdminApproval = false;

      const postingSnapshotRows = [];

      for (const item of items) {
        // Lock inventory row
        const inv = await trx('inventory').where('product_id', item.product_id).forUpdate().first();
        const liveQty = inv ? Number(inv.quantity) : 0;
        
        // Lock product row to get unit_cost
        const prod = await trx('products').where('id', item.product_id).first();
        const liveCost = prod ? Number(prod.cost_price) : 0;

        // Apply Variance: The user counted X. When they counted, system was Y. 
        // Variance = (X - Y). E.g. counted 12, system was 10. Variance is +2.
        // We apply +2 to the liveQty. 
        const variance = Number(item.variance);
        const finalVarianceCost = variance * liveCost;
        totalVarianceValue += Math.abs(finalVarianceCost);

        // Check negative inventory boundary BEFORE saving
        if (liveQty + variance < 0) {
          throw new ConflictError(`Cycle count variance exceeds available inventory for product ${prod?.name}. Recount required.`);
        }

        // Threshold checks
        if (Math.abs(finalVarianceCost) > 500) requiresManagerApproval = true;

        postingSnapshotRows.push({
          product_id: item.product_id,
          live_qty_before: liveQty,
          variance_applied: variance,
          live_qty_after: liveQty + variance,
          live_unit_cost: liveCost,
          final_variance_cost: finalVarianceCost
        });

        // Update item with exact snapshot values
        await trx('cycle_count_items').where('id', item.id).update({
          unit_cost: liveCost,
          final_variance_cost: finalVarianceCost
        });
      }

      if (totalVarianceValue > 5000) requiresAdminApproval = true;

      // Check PIN if required
      if (requiresManagerApproval || requiresAdminApproval) {
        if (!manager_id || !pin) {
          // Send it to pending approval
          await trx('cycle_counts').where({ id }).update({ status: 'pending_approval' });
          throw new ConflictError(`Approval required. Total Variance: EGP ${totalVarianceValue.toFixed(2)}`);
        }

        const employee = await trx('employees').where('id', manager_id).first();
        if (!employee) throw new ConflictError('Invalid manager ID');

        const { pinService } = await import('../services/pin.service');
        const verification = await pinService.verifyPin(manager_id, pin, current_user_id, req.ip);
        if (!verification.success) {
           await trx('cycle_counts').where({ id }).update({ status: 'pending_approval' });
           throw new ConflictError('Invalid Manager PIN');
        }

        if (requiresAdminApproval && employee.role !== 'admin') {
           await trx('cycle_counts').where({ id }).update({ status: 'pending_approval' });
           throw new ConflictError('Total variance exceeds EGP 5000. Admin approval required.');
        }

        if (requiresManagerApproval && !['manager', 'admin'].includes(employee.role)) {
           await trx('cycle_counts').where({ id }).update({ status: 'pending_approval' });
           throw new ConflictError('Manager approval required.');
        }
      }

      // 3. Process Ledger Adjustments
      for (const snapshot of postingSnapshotRows) {
        if (snapshot.variance_applied === 0) continue;

        // Update inventory table
        await trx('inventory')
          .where('product_id', snapshot.product_id)
          .update({ quantity: snapshot.live_qty_after, updated_at: db.fn.now() });

        // Log adjustment
        await trx('inventory_adjustments').insert({
          product_id: snapshot.product_id,
          adjustment_type: 'stock_reconciliation',
          quantity_change: snapshot.variance_applied,
          old_quantity: snapshot.live_qty_before,
          new_quantity: snapshot.live_qty_after,
          reason_code: 'CYCLE_COUNT',
          notes: `Cycle Count Batch #${id}`,
          created_by: current_user_id
        });
      }

      // 4. Finalize Cycle Count
      const postingSnapshot = {
        live_inventory_rows: postingSnapshotRows.length,
        total_variance_value: totalVarianceValue,
        approval_level: requiresAdminApproval ? 'admin' : (requiresManagerApproval ? 'manager' : 'none'),
        posted_by: manager_id || current_user_id
      };

      await trx('cycle_counts').where({ id }).update({
        status: 'posted',
        total_variance_value: totalVarianceValue,
        approved_by: manager_id || null,
        posting_snapshot: JSON.stringify(postingSnapshot),
        posted_at: db.fn.now()
      });
    });

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Cycle count posted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function cancelCycleCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await db.transaction(async (trx) => {
      const cycleCount = await trx('cycle_counts').where({ id }).forUpdate().first();
      if (!cycleCount) throw new NotFoundError('Cycle Count not found', id);

      if (cycleCount.status !== 'draft' && cycleCount.status !== 'pending_approval') {
        throw new ConflictError('Cannot cancel a posted cycle count');
      }

      await trx('cycle_counts').where({ id }).update({ status: 'cancelled' });
    });

    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}
