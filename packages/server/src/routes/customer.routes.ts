import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { requireAuth, requireRoles } from '../middleware/auth';

const customerRouter = Router();

// Require authentication for all customer endpoints
customerRouter.use(requireAuth);

customerRouter.get('/', customerController.list.bind(customerController));
customerRouter.get('/:id', customerController.getDetail.bind(customerController));
customerRouter.post('/', customerController.create.bind(customerController));
customerRouter.put('/:id', customerController.update.bind(customerController));
customerRouter.post('/:id/payments', customerController.recordPayment.bind(customerController));

// Soft deletion is restricted to Admins and Managers
customerRouter.delete('/:id', requireRoles('admin', 'manager'), customerController.delete.bind(customerController));

export { customerRouter };
