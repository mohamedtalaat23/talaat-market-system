import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env, isDev } from './config/env';
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

  // ── Security Headers ──────────────────────────────────────────────────────
  // helmet sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
  // In dev, CSP is relaxed to allow Vite's HMR websocket
  app.use(
    helmet({
      contentSecurityPolicy: isDev ? false : undefined,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  // In production Electron mode, the renderer loads from file:// protocol.
  // In dev mode, it loads from the Vite dev server (localhost:5173).
  // We restrict origins tightly — this API should never be public.
  app.use(
    cors({
      origin: isDev
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : false, // In prod, Electron renderer fetches same-origin (no CORS needed)
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
