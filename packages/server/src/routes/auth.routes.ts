import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema, fastPinLoginSchema } from '../validators/employee.validator';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const authRouter = Router();

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

export { authRouter };
