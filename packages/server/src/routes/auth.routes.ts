import { db } from '../config/database';
import { pinService } from '../services/pin.service';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { invalidateAuthCache } from '../middleware/auth';
import { employeeRepository } from '../repositories/employee.repository';
import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import {
  loginSchema,
  fastPinLoginSchema,
  changePasswordSchema,
} from '../validators/employee.validator';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const authRouter = Router();

// Hardware authorization bypasses the ordinary auth cache on every call.
authRouter.post(
  '/hardware-session',
  rateLimit({ windowMs: 60000, limit: 600 }),
  (_req, _res, next) => {
    invalidateAuthCache();
    next();
  },
  requireAuth,
  async (req, res, next) => {
    try {
      const employee = await employeeRepository.findById(req.user!.id);
      if (
        !employee ||
        !employee.is_active ||
        employee.must_change_password ||
        employee.credential_rotation_required
      ) {
        res.status(403).json({ success: false });
        return;
      }
      const claims = jwt.decode(req.headers.authorization!.slice(7)) as {
        exp?: number;
        ae?: number;
      };
      if (!claims.exp || employee.auth_epoch !== (claims.ae ?? 0)) {
        res.status(403).json({ success: false });
        return;
      }
      if (req.body?.operation === 'offline:remove-sale') {
        const key = req.body.approval?.idempotency_key;
        if (
          typeof key !== 'string' ||
          key.length === 0 ||
          key.length > 2000 ||
          !(await db('sales').where({ idempotency_key: key, cashier_id: employee.id }).first())
        ) {
          res.status(403).json({ success: false });
          return;
        }
      }
      let approvedOperation: string | undefined;
      let approvedBy: number | undefined;
      if (
        employee.role === 'cashier' &&
        ['printer:open-cash-drawer', 'printer:print-receipt'].includes(req.body?.operation)
      ) {
        const approval = req.body.approval;
        if (
          !approval ||
          !Number.isInteger(approval.manager_id) ||
          !/^\d{4,6}$/.test(approval.pin)
        ) {
          res.status(403).json({ success: false });
          return;
        }
        if (
          !(await pinService.verifyPin(approval.manager_id, approval.pin, employee.id, req.ip))
            .success
        ) {
          res.status(403).json({ success: false });
          return;
        }
        approvedOperation = req.body.operation;
        approvedBy = approval.manager_id;
      }
      res.json({
        data: {
          id: employee.id,
          role: employee.role,
          validUntil: claims.exp * 1000,
          approvedOperation,
          approvedBy,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Apply strict rate limiting to authentication routes
authRouter.use(authRateLimiter);

// POST /auth/login - Authenticate credentials and return JWT
authRouter.post('/login', validate({ body: loginSchema }), controller.login);

// POST /auth/fast-pin - Fast PIN Switching login
authRouter.post('/fast-pin', validate({ body: fastPinLoginSchema }), controller.fastPinLogin);

// POST /auth/logout - Logout (stateless client-side clearing confirmation)
authRouter.post('/logout', controller.logout);

// GET /auth/me - Retrieve current authenticated user profile
authRouter.get('/me', requireAuth, controller.getMe);

// POST /auth/change-password - Rotate own password (also clears must_change_password)
authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

export { authRouter };
