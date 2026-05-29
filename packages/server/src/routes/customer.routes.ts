import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { requireAuth, requireRoles } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  createCustomerSchema,
  updateCustomerSchema,
  recordPaymentSchema,
  customerIdParamSchema,
  customerQuerySchema,
} from '../validators/customer.validator';

const customerRouter = Router();

// Apply rate limiting
customerRouter.use(standardRateLimiter);

// Require authentication for all customer endpoints
customerRouter.use(requireAuth);

customerRouter.get(
  '/',
  validate({ query: customerQuerySchema }),
  customerController.list.bind(customerController)
);

customerRouter.get(
  '/:id',
  validate({ params: customerIdParamSchema }),
  customerController.getDetail.bind(customerController)
);

customerRouter.post(
  '/',
  validate({ body: createCustomerSchema }),
  customerController.create.bind(customerController)
);

customerRouter.put(
  '/:id',
  validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
  customerController.update.bind(customerController)
);

customerRouter.post(
  '/:id/payments',
  validate({ params: customerIdParamSchema, body: recordPaymentSchema }),
  customerController.recordPayment.bind(customerController)
);

// Soft deletion is restricted to Admins and Managers
customerRouter.delete(
  '/:id',
  requireRoles('admin', 'manager'),
  validate({ params: customerIdParamSchema }),
  customerController.delete.bind(customerController)
);

export { customerRouter };

