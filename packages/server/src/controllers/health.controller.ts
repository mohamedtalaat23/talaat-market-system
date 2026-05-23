import type { Request, Response } from 'express';
import { db } from '../config/database';
import { env } from '../config/env';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /api/v1/health
 *
 * Health check endpoint — used by:
 *  - Electron's server-manager to know when Express is ready
 *  - Future load balancers / monitoring systems
 *  - Developers to quickly verify the server is running
 *
 * Returns a 200 with system status info when healthy,
 * or a 503 with error details when the DB is unreachable.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  // Check database connectivity
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatencyMs: number | null = null;

  try {
    const dbStart = Date.now();
    await db.raw('SELECT 1');
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch {
    // DB is down — server is degraded but still responding
  }

  const isHealthy = dbStatus === 'connected';
  const statusCode = isHealthy ? HTTP_STATUS.OK : 503;

  res.status(statusCode).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '1.0.0',
      environment: env.NODE_ENV,
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
      responseTimeMs: Date.now() - startTime,
    },
  });
}
