import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each employee to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Key by the authenticated Employee ID if present, fallback to IP for unauthenticated requests.
    // ipKeyGenerator() normalises IPv6 addresses to their /56 subnet — using the raw
    // req.ip would let a client rotate through addresses inside its own subnet and
    // bypass the limit (express-rate-limit flags this as ERR_ERL_KEY_GEN_IPV6).
    return req.user?.id ? `emp_${req.user.id}` : ipKeyGenerator(req.ip || '');
  },
});

// Stricter rate limiter for authentication endpoints (login, password checks)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit failed authentication attempts per IP
  skipSuccessfulRequests: true, // routine manager approvals must not lock out a busy store
  standardHeaders: true,
  legacyHeaders: false,
});
