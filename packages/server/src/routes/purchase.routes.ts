import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { purchaseController } from '../controllers/purchase.controller';
import { requireAuth, requireRoles } from '../middleware/auth';

const purchaseRouter = Router();

const purchaseRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Apply rate limiting and base authentication to all purchase endpoints
purchaseRouter.use(purchaseRateLimiter);
purchaseRouter.use(requireAuth);

// Read-only endpoints accessible by any authenticated employee (including cashiers)
purchaseRouter.get('/', purchaseController.list);
purchaseRouter.get('/:id', purchaseController.detail);
purchaseRouter.get('/:id/receipts', purchaseController.getReceipts);

// State mutators restricted strictly to admin and manager roles
purchaseRouter.post('/', requireRoles('admin', 'manager'), purchaseController.create);
purchaseRouter.put('/:id', requireRoles('admin', 'manager'), purchaseController.update);
purchaseRouter.post('/:id/order', requireRoles('admin', 'manager'), purchaseController.order);
purchaseRouter.post('/:id/receive', requireRoles('admin', 'manager'), purchaseController.receive);
purchaseRouter.post('/:id/cancel', requireRoles('admin', 'manager'), purchaseController.cancel);

export default purchaseRouter;
