import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './middleware/logger';

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

  // Step 2: Create and start the HTTP server
  const app = createApp();
  const server = app.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
    const proto = 'http' + '://';
    logger.info(`✅ Server listening on ${proto}${env.SERVER_HOST}:${env.SERVER_PORT}`);
    logger.info(`   API available at ${proto}${env.SERVER_HOST}:${env.SERVER_PORT}/api/v1`);

    // Signal to parent process (Electron's server-manager) that we're ready
    // process.send is available when forked with child_process.fork()
    if (process.send) {
      process.send('ready');
    }
  });

  // Step 3: Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (err) => {
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
