import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';

/**
 * Health routes.
 * Mounted at: /api/v1/health
 */
const healthRouter = Router();

healthRouter.get('/', (req, res, next) => {
  getHealth(req, res).catch(next);
});

export { healthRouter };
