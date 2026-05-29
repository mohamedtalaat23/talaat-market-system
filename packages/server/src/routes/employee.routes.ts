import { Router } from 'express';
import * as controller from '../controllers/employee.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requireRoles } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  employeeIdParamSchema,
} from '../validators/employee.validator';

const employeeRouter = Router();

// Apply rate limiting
employeeRouter.use(standardRateLimiter);

// Apply requireAuth middleware to ALL employee routes
employeeRouter.use(requireAuth);

// GET /employees - List employees with filters and paging (Admin & Manager only)
employeeRouter.get(
  '/',
  requireRoles('admin', 'manager'),
  validate({ query: employeeQuerySchema }),
  controller.getEmployees
);
// GET /employees/managers - Retrieve active managers and admins (Authenticated only)
employeeRouter.get(
  '/managers',
  controller.getActiveManagers
);

// GET /employees/:id - Retrieve employee profile detail (Admin & Manager only)
employeeRouter.get(
  '/:id',
  requireRoles('admin', 'manager'),
  validate({ params: employeeIdParamSchema }),
  controller.getEmployeeById
);

// POST /employees - Register a new employee (Admin only)
employeeRouter.post(
  '/',
  requireRoles('admin'),
  validate({ body: createEmployeeSchema }),
  controller.createEmployee
);

// PUT /employees/:id - Update employee details (Admin only)
employeeRouter.put(
  '/:id',
  requireRoles('admin'),
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  controller.updateEmployee
);

// DELETE /employees/:id - Soft-delete employee account (Admin only)
employeeRouter.delete(
  '/:id',
  requireRoles('admin'),
  validate({ params: employeeIdParamSchema }),
  controller.deleteEmployee
);

// POST /employees/verify-pin - Verify a manager PIN securely (Authenticated only)
employeeRouter.post(
  '/verify-pin',
  controller.verifyManagerPin
);

export { employeeRouter };
