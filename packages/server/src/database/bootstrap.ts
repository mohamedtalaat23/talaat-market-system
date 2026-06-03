import bcrypt from 'bcryptjs';
import { db, connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../middleware/logger';

async function run(): Promise<void> {
  let exitCode = 0;

  try {
    await connectDatabase();

    const existingAdmin = await db('employees')
      .where({ username: 'admin' })
      .first();

    if (existingAdmin) {
      logger.info('Bootstrap admin account already exists; skipping creation.');
      return;
    }

    const passwordHash = await bcrypt.hash('admin123', 12);
    const pinHash = await bcrypt.hash('1111', 12);

    await db('employees').insert({
      full_name: 'System Administrator',
      username: 'admin',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'admin',
      is_active: true,
    });

    logger.warn('Created default admin account. Change password after first login.', {
      username: 'admin',
    });
  } catch (error) {
    exitCode = 1;
    logger.error('Database bootstrap failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await disconnectDatabase().catch((error) => {
      logger.error('Error closing database connection during bootstrap', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    process.exit(exitCode);
  }
}

void run();
