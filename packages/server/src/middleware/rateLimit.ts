import rateLimit from 'express-rate-limit';

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each employee to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Key by the authenticated Employee ID if present, fallback to IP for unauthenticated requests
    return req.user?.id ? `emp_${req.user.id}` : (req.ip || '');
  }
});

// Stricter rate limiter for authentication endpoints (login, password checks)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 authentication requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
