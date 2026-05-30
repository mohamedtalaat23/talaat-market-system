import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './middleware/logger';
import fs from 'fs';
import https from 'https';

/**
 * Server entry point.
 *
 * Startup sequence:
 *   1. Validate environment (done in env.ts import)
 *   2. Connect to PostgreSQL
 *   3. Start HTTP server
 *   4. Signal "ready" to parent (Electron) if running as child process
 *
 * Shutdown sequence (SIGTERM / SIGINT):
 *   1. Stop accepting new connections
 *   2. Close existing connections gracefully
 *   3. Disconnect database pool
 *   4. Exit cleanly
 */
async function main(): Promise<void> {
  logger.info(`🚀 Starting ${env.APP_NAME} API Server...`);
  logger.info(`   Environment: ${env.NODE_ENV}`);

  // Step 1: Connect to database (fail fast if DB is unavailable)
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Failed to connect to database. Exiting.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Step 2: Create and start the HTTP or HTTPS server
  const app = createApp();
  let server: any;

  if (env.SSL_ENABLED && env.SSL_KEY_PATH && env.SSL_CERT_PATH) {
    try {
      const key = fs.readFileSync(env.SSL_KEY_PATH);
      const cert = fs.readFileSync(env.SSL_CERT_PATH);
      server = https.createServer({ key, cert }, app).listen(env.SERVER_PORT, env.SERVER_HOST, () => {
        logger.info(`✅ Secure HTTPS Server listening on https://${env.SERVER_HOST}:${env.SERVER_PORT}`);
        logger.info(`   API available at https://${env.SERVER_HOST}:${env.SERVER_PORT}/api/v1`);

        // Signal to parent process (Electron's server-manager) that we're ready
        if (process.send) {
          process.send('ready');
        }
      });
    } catch (sslError: any) {
      logger.error('❌ Failed to load SSL certificates, falling back to HTTP', {
        error: sslError instanceof Error ? sslError.message : String(sslError),
      });
      server = app.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
        logger.info(`✅ Fallback HTTP Server listening on http://${env.SERVER_HOST}:${env.SERVER_PORT}`);
        logger.info(`   API available at http://${env.SERVER_HOST}:${env.SERVER_PORT}/api/v1`);

        if (process.send) {
          process.send('ready');
        }
      });
    }
  } else {
    server = app.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
      const proto = 'http' + '://';
      logger.info(`✅ Server listening on ${proto}${env.SERVER_HOST}:${env.SERVER_PORT}`);
      logger.info(`   API available at ${proto}${env.SERVER_HOST}:${env.SERVER_PORT}/api/v1`);

      // Signal to parent process (Electron's server-manager) that we're ready
      if (process.send) {
        process.send('ready');
      }
    });
  }

  // Step 3: Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (err?: Error) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
        process.exit(1);
      }

      try {
        await disconnectDatabase();
        logger.info('Shutdown complete. Goodbye!');
        process.exit(0);
      } catch (dbErr) {
        logger.error('Error during database disconnect', {
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Graceful shutdown timeout. Forcing exit.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Handle uncaught errors — log and exit cleanly
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    process.exit(1);
  });
}

// Run
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
