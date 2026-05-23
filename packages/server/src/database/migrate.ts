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
  const command = process.argv[2];
  logger.info('============================================================');
  logger.info(`🚀 Starting Talaat Market Database Tool [Command: ${command || 'migrate'}]`);
  logger.info('============================================================');

  // 1. Verify DB connection and log status
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('❌ Database connection verification failed. Aborting operations.');
    logger.error('Please check that PostgreSQL is installed, running, and credentials in .env are correct.');
    process.exit(1);
  }

  let exitCode = 0;

  try {
    if (command === 'rollback') {
      logger.info('🔍 Querying migration history before rollback...');
      const [completed] = await db.migrate.list();
      logger.info(`Current status: ${completed.length} migration files have been applied.`);

      logger.info('🔄 Rolling back the last migration batch...');
      logger.info('ℹ️ Note: Rollback runs inside a transaction. If it fails, all changes are fully rolled back.');
      
      const [batchNo, log] = await db.migrate.rollback();
      if (log.length === 0) {
        logger.info('✅ No migrations found to rollback.');
      } else {
        logger.info(`✅ Successfully rolled back batch ${batchNo}: ${log.join(', ')}`);
      }
    } else if (command === 'seed') {
      logger.info('🌱 Seeding database...');
      logger.info('ℹ️ Note: Seeds clear tables first and insert fresh realistic supermarket data.');
      
      const [log] = await db.seed.run();
      logger.info(`✅ Seeding completed successfully. Seed files executed: ${log.join(', ')}`);
    } else {
      logger.info('🔍 Querying migrations status...');
      const [completed, pending] = await db.migrate.list();
      logger.info(`Status: ${completed.length} applied, ${pending.length} pending migrations found.`);

      if (pending.length > 0) {
        logger.info(`Pending migrations to apply: ${pending.map((m: any) => m.file).join(', ')}`);
        logger.info('🔄 Applying pending migrations...');
        logger.info('ℹ️ Note: PostgreSQL uses transactional DDL. If any migration fails, the entire batch');
        logger.info('         will roll back atomically, preventing partial schema states.');
        
        const [batchNo, log] = await db.migrate.latest();
        logger.info(`✅ Successfully applied migration batch ${batchNo}: ${log.join(', ')}`);
      } else {
        logger.info('✅ Database schema is already up to date. No migrations to run.');
      }
    }
    logger.info('============================================================');
    logger.info('🎉 Database operation completed successfully.');
    logger.info('============================================================');
  } catch (error) {
    logger.error('============================================================');
    logger.error('❌ DATABASE OPERATION FAILED!');
    logger.error('============================================================');
    logger.error(`Error details: ${error instanceof Error ? error.message : String(error)}`);
    
    if (command !== 'seed') {
      logger.error('ℹ️ Transaction Status: FAILED. PostgreSQL has automatically rolled back');
      logger.error('   all DDL operations in this batch. Your schema remains unmodified.');
    } else {
      logger.error('ℹ️ Seed Failure: Check for foreign key constraints or duplicate data issues.');
    }
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
