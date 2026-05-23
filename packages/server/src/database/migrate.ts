import { db, connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../middleware/logger';

/**
 * Programmatic Database Migration and Seeding Runner
 * 
 * Verifies database connection, runs Knex migrations or seeds based
 * on command-line arguments, and handles connection teardown.
 * 
 * Usage:
 *   - Migrate:  tsx src/database/migrate.ts
 *   - Rollback: tsx src/database/migrate.ts rollback
 *   - Seed:     tsx src/database/migrate.ts seed
 */
async function run() {
  logger.info('Starting database operations...');
  
  // 1. Verify DB connection before performing operations
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Database connection test failed. Aborting database migrations/seeds.');
    process.exit(1);
  }

  const command = process.argv[2];
  let exitCode = 0;

  try {
    if (command === 'rollback') {
      logger.info('Rolling back last migration batch...');
      const [batchNo, log] = await db.migrate.rollback();
      if (log.length === 0) {
        logger.info('No migrations found to rollback.');
      } else {
        logger.info(`Successfully rolled back batch ${batchNo}: ${log.join(', ')}`);
      }
    } else if (command === 'seed') {
      logger.info('Running database seeds...');
      const [log] = await db.seed.run();
      logger.info(`Seeding completed successfully. Seed files: ${log.join(', ')}`);
    } else {
      logger.info('Running database migrations...');
      const [batchNo, log] = await db.migrate.latest();
      if (log.length === 0) {
        logger.info('Database is already up to date.');
      } else {
        logger.info(`Successfully applied migration batch ${batchNo}: ${log.join(', ')}`);
      }
    }
    logger.info('Database operation completed successfully.');
  } catch (error) {
    logger.error('Database operation failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    exitCode = 1;
  } finally {
    try {
      await disconnectDatabase();
    } catch (err) {
      logger.error('Error closing database connection:', err);
    }
    process.exit(exitCode);
  }
}

run();
