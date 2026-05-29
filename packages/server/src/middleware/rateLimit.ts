import rateLimit from 'express-rate-limit';

// Standard rate limiter for typical operations
export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for authentication endpoints (login, password checks)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 authentication requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
