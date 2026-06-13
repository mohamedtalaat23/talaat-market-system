import type { Request, Response, NextFunction } from 'express';
import { returnQueueService } from '../services/return-queue.service';
import { HTTP_STATUS } from '../config/constants';
import { AuthorizationError } from '../middleware/errorHandler';

export async function createQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { register_id, queue_type } = req.body;
    const queue = await returnQueueService.createQueue(userId, register_id, queue_type);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: queue });
  } catch (error) { next(error); }
}

export async function getQueues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { state, register_id } = req.query;
    const queues = await returnQueueService.getQueues({ 
      state: state as string, 
      register_id: register_id as string 
    });
    res.status(HTTP_STATUS.OK).json({ success: true, data: queues });
  } catch (error) { next(error); }
}

export async function getQueueById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const queue = await returnQueueService.getQueueById(req.params.id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: queue });
  } catch (error) { next(error); }
}

export async function updateQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const isManagerOrAdmin = ['manager', 'admin'].includes(role);

    const queue = await returnQueueService.getQueueById(req.params.id);
    if (!isManagerOrAdmin && queue.owner_id !== userId && queue.created_by !== userId) {
       throw new AuthorizationError('You are not authorized to edit this queue');
    }

    const updated = await returnQueueService.updateQueue(req.params.id, req.body);
    res.status(HTTP_STATUS.OK).json({ success: true, data: updated });
  } catch (error) { next(error); }
}

export async function scanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const isManagerOrAdmin = ['manager', 'admin'].includes(role);

    const queue = await returnQueueService.getQueueById(req.params.id);
    if (!isManagerOrAdmin && queue.owner_id !== userId && queue.created_by !== userId) {
       throw new AuthorizationError('You are not authorized to scan into this queue');
    }

    const { sku_id, quantity, original_sale_line_id, original_sale_id, disposition, non_restock_reason } = req.body;
    const item = await returnQueueService.scanItem(
      req.params.id, 
      sku_id, 
      quantity, 
      original_sale_line_id || null, 
      original_sale_id || null, 
      disposition, 
      non_restock_reason || null
    );
    res.status(HTTP_STATUS.OK).json({ success: true, data: item });
  } catch (error) { next(error); }
}

export async function submitQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const isManagerOrAdmin = ['manager', 'admin'].includes(role);

    const queue = await returnQueueService.getQueueById(req.params.id);
    if (!isManagerOrAdmin && queue.owner_id !== userId && queue.created_by !== userId) {
       throw new AuthorizationError('You are not authorized to submit this queue');
    }

    const submitted = await returnQueueService.submitQueue(req.params.id, userId);
    res.status(HTTP_STATUS.OK).json({ success: true, data: submitted });
  } catch (error) { next(error); }
}

export async function approveQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const managerId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const { return_condition_verified } = req.body;
    
    // Auth Check: must be manager or admin
    if (!['manager', 'admin'].includes(role)) {
      throw new AuthorizationError('Only managers or admins can approve queues');
    }

    const queue = await returnQueueService.approveQueue(req.params.id, managerId, return_condition_verified);
    res.status(HTTP_STATUS.OK).json({ success: true, data: queue });
  } catch (error) { next(error); }
}

export async function commitQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const managerId = (req as any).user?.id;
    const role = (req as any).user?.role;

    // Auth Check: must be manager or admin
    if (!['manager', 'admin'].includes(role)) {
      throw new AuthorizationError('Only managers or admins can commit queues');
    }

    const result = await returnQueueService.commitQueue(req.params.id, managerId);
    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function cancelQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const isManagerOrAdmin = ['manager', 'admin'].includes(role);

    const queue = await returnQueueService.getQueueById(req.params.id);
    if (!isManagerOrAdmin && queue.owner_id !== userId && queue.created_by !== userId) {
       throw new AuthorizationError('You are not authorized to cancel this queue');
    }

    const cancelled = await returnQueueService.cancelQueue(req.params.id, userId);
    res.status(HTTP_STATUS.OK).json({ success: true, data: cancelled });
  } catch (error) { next(error); }
}
