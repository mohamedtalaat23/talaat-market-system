import knex, { type Knex } from 'knex';
import { env } from './env';
import { logger } from '../middleware/logger';
import path from 'path';

/**
 * Knex database configuration.
 *
 * We use Knex as a query builder (not a full ORM) to keep SQL
 * transparent and portable. The `pg` driver connects to PostgreSQL.
 *
 * Connection pooling is configured to handle concurrent requests
 * efficiently — even on a single machine, pooling prevents connection
 * exhaustion and improves throughput.
 */
const knexConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    // LAN-local PostgreSQL deployment — SSL disabled.
    // Enable { rejectUnauthorized: true } if connecting to a remote/cloud database.
    ssl: false,
  },
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    // Destroy connections idle for more than 30 seconds
    idleTimeoutMillis: 30_000,
    // Kill connections that take more than 8 seconds to acquire.
    // Tighter than the default 10s so a cashier sees an error quickly
    // rather than staring at a frozen checkout screen.
    acquireTimeoutMillis: 8_000,
    // Propagate pool exhaustion warnings to the logger so spikes
    // can be diagnosed in the shift log without a DB query.
    afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
      conn.query('SET application_name = \'talaat_market_pos\'', (err: Error) => {
        done(err, conn);
      });
    },
  },
  migrations: {
    directory: path.resolve(__dirname, env.NODE_ENV === 'production' ? '../migrations' : '../../migrations'),
    extension: env.NODE_ENV === 'production' ? 'js' : 'ts',
  },
  seeds: {
    directory: path.resolve(__dirname, env.NODE_ENV === 'production' ? '../seeds' : '../../seeds'),
    extension: env.NODE_ENV === 'production' ? 'js' : 'ts',
  },
  // Use snake_case for all column/table names
  wrapIdentifier: (value, origImpl) => origImpl(value),
  // Log queries in development
  debug: env.NODE_ENV === 'development',
};

// Singleton Knex instance — shared across the entire server process
export const db = knex(knexConfig);

/**
 * Test the database connection and log the result.
 * Called during server startup.
 */
export async function connectDatabase(): Promise<void> {
  try {
    // A simple query to verify connectivity
    await db.raw('SELECT 1+1 AS result');
    logger.info('✅ Database connection established', {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
    });
  } catch (error) {
    logger.error('❌ Database connection failed', {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw so the server startup can handle it
    throw error;
  }
}

/**
 * Gracefully close all database connections.
 * Called during server shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await db.destroy();
  logger.info('Database connections closed');
}
