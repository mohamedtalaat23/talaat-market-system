import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { isDev } from './config/env';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

/**
 * Express application factory.
 *
 * We export a factory function rather than the app directly so it's
 * easy to create fresh instances for testing.
 *
 * Middleware order matters:
 *   1. Security headers (helmet) — first, always
 *   2. CORS — before any route that might be cross-origin
 *   3. Body parsing — before routes read req.body
 *   4. Compression — after body parsing, compresses responses
 *   5. Request logging — early, captures all requests
 *   6. Routes — main application logic
 *   7. 404 handler — after routes, catches unmatched paths
 *   8. Error handler — last, handles all thrown errors
 */
export function createApp(): express.Application {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: [
            "'self'",
            'ws://localhost:5173',
            'http://localhost:5173',
            'ws://127.0.0.1:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
          ],
        },
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Allowed origins:
  //   • Development:  Vite dev server on localhost:5173
  //   • Production:  Electron renderer loads from file:// (origin is null/undefined)
  //                  LAN client registers reach this server via http://192.168.x.x:3001
  //                  All RFC 1918 private subnets are allowed — this API is LAN-only
  //                  and never exposed to the public internet.
  //
  // Why not origin: false in production?
  //   When a client-mode Electron window (file://) POSTs to http://192.168.x.x:3001,
  //   the browser engine treats it as a cross-origin request. Without an
  //   Access-Control-Allow-Origin header, the response is silently blocked.
  const LAN_ORIGIN_REGEX =
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin: Electron file:// renderer and server-to-server calls
        if (!origin) {
          return callback(null, true);
        }
        // Allow Vite dev server in development
        if (isDev && (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173')) {
          return callback(null, true);
        }
        // Allow any RFC 1918 private LAN address (client registers)
        if (LAN_ORIGIN_REGEX.test(origin)) {
          return callback(null, true);
        }
        // Reject everything else
        callback(new Error(`CORS: Origin '${origin}' is not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Compression ───────────────────────────────────────────────────────────
  // gzip/brotli compress responses > 1KB — significant for report data
  app.use(compression());

  // ── Request Logging ───────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Trust Proxy ───────────────────────────────────────────────────────────
  // Required if running behind a reverse proxy (Nginx) in LAN mode
  if (!isDev) {
    app.set('trust proxy', 1);
  }

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use(apiRouter);

  // ── 404 Handler ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Global Error Handler ──────────────────────────────────────────────────
  // Must be the LAST middleware registered
  app.use(errorHandler);

  return app;
}
