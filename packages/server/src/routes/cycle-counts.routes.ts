import { Router } from 'express';
import * as controller from '../controllers/cycle-count.controller';
import { requireAuth } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';

const cycleCountRouter = Router();

// Apply rate limiting
cycleCountRouter.use(standardRateLimiter);

// Secure all routes with JWT authentication
cycleCountRouter.use(requireAuth);

cycleCountRouter.post('/', controller.createCycleCount);
cycleCountRouter.get('/', controller.getCycleCounts);
cycleCountRouter.get('/:id', controller.getCycleCountById);
cycleCountRouter.put('/:id/items', controller.updateCycleCountItems);
cycleCountRouter.post('/:id/scan', controller.scanCycleCountItem);
cycleCountRouter.post('/:id/post', controller.postCycleCount);
cycleCountRouter.post('/:id/cancel', controller.cancelCycleCount);

export { cycleCountRouter };
