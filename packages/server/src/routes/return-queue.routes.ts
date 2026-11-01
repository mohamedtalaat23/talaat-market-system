import { Router } from 'express';
import * as controller from '../controllers/return-queue.controller';
import { requireAuth, requireRoles } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';

const returnQueueRouter = Router();

// Apply rate limiting
returnQueueRouter.use(standardRateLimiter);

// Apply authentication to all routes
returnQueueRouter.use(requireAuth);

// Queue CRUD
returnQueueRouter.post('/', controller.createQueue);
returnQueueRouter.get('/', controller.getQueues);
returnQueueRouter.get('/:id', controller.getQueueById);
returnQueueRouter.patch('/:id', controller.updateQueue);

// Scanner
returnQueueRouter.post('/:id/scan', controller.scanItem);

// Workflow
returnQueueRouter.post('/:id/submit', controller.submitQueue);
returnQueueRouter.post('/:id/approve', requireRoles('admin', 'manager'), controller.approveQueue);
returnQueueRouter.post('/:id/commit', requireRoles('admin', 'manager'), controller.commitQueue);
returnQueueRouter.post('/:id/cancel', controller.cancelQueue);

export { returnQueueRouter };
