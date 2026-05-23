import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env, isDev } from '../config/env';

/**
 * Winston logger configuration.
 *
 * Two outputs:
 *  1. Console — in development, human-readable colorized output
 *  2. File — daily rotating files (separate error and combined logs)
 *
 * The daily rotation keeps logs manageable without manual cleanup.
 * We keep 30 days of combined logs and 90 days of error logs.
 */

// Human-readable format for development console
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
    return `${String(timestamp)} [${level}] ${String(message)}${metaStr}`;
  }),
);

// Structured JSON format for production / file output
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Directory for log files (resolved relative to the server package root)
const logDir = path.resolve(process.cwd(), env.LOG_DIR);

const transports: winston.transport[] = [
  // Error-only file (long retention — useful for post-mortem investigation)
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '90d',
    zippedArchive: true,
    format: prodFormat,
  }),
  // Combined log (all levels)
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    zippedArchive: true,
    format: prodFormat,
  }),
];

// Add console transport in development
if (isDev) {
  transports.push(
    new winston.transports.Console({
      format: devFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  // Don't exit on uncaught exceptions — let our handler decide
  exitOnError: false,
});

/**
 * Express request logger middleware.
 * Logs method, path, status, and response time for every request.
 */
export function requestLogger(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip ?? req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
    });
  });

  next();
}
