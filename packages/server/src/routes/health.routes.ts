import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { standardRateLimiter } from '../middleware/rateLimit';

/**
 * Health routes.
 * Mounted at: /api/v1/health
 */
const healthRouter = Router();

// Apply rate limiting
healthRouter.use(standardRateLimiter);

healthRouter.get('/', (req, res, next) => {
  getHealth(req, res).catch(next);
});

export { healthRouter };
