import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';
import { requireAuth, requireRoles } from '../middleware/auth';

const supplierRouter = Router();

// Secure all supplier endpoints under authentication middleware
supplierRouter.use(requireAuth);

supplierRouter.get('/', supplierController.list.bind(supplierController));
supplierRouter.get('/:id', supplierController.detail.bind(supplierController));

// Modification and creations restricted to Admin and Manager roles
supplierRouter.post('/', requireRoles('admin', 'manager'), supplierController.create.bind(supplierController));
supplierRouter.put('/:id', requireRoles('admin', 'manager'), supplierController.update.bind(supplierController));
supplierRouter.delete('/:id', requireRoles('admin', 'manager'), supplierController.delete.bind(supplierController));

export { supplierRouter };
