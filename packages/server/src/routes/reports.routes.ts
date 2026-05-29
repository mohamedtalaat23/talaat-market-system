import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth';
import * as controller from '../controllers/reports.controller';
import { standardRateLimiter } from '../middleware/rateLimit';

const reportsRouter = Router();

// Apply rate limiting
reportsRouter.use(standardRateLimiter);

// Protect all report endpoints. Only admin and managers have access.
reportsRouter.use(requireAuth);
reportsRouter.use(requireRoles('admin', 'manager'));

reportsRouter.get('/shifts', controller.getShifts);
reportsRouter.get('/shifts/:id', controller.getShiftDetail);
reportsRouter.get('/weekly', controller.getWeeklyReport);
reportsRouter.get('/overrides', controller.getOverrides);

export { reportsRouter };
