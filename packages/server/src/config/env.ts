import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const envFiles = [
  process.env['TALAAT_CONFIG_PATH'],
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../.env.production'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.production'),
].filter((value): value is string => Boolean(value));

for (const envFile of envFiles) {
  dotenv.config({ path: envFile, override: false });
}

/**
 * Environment variable schema with validation.
 *
 * All required variables are validated at startup — if any are missing
 * or malformed, the server refuses to start with a clear error message.
 * This prevents hard-to-debug runtime errors caused by missing config.
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('Talaat Market'),

  // Express server
  SERVER_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  SERVER_HOST: z.string().default('localhost'),

  // PostgreSQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),

  // Backup
  BACKUP_DIR: z.string().default('~/TalaatMarket/backups'),

  // SSL Settings (LAN security)
  SSL_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
});

// Validate and parse environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const errors = parseResult.error.flatten().fieldErrors;
  console.error('❌ Invalid environment configuration:');
  Object.entries(errors).forEach(([key, messages]) => {
    console.error(`  ${key}: ${messages?.join(', ') ?? 'unknown error'}`);
  });
  console.error('\nPlease check your .env file against .env.example');
  process.exit(1);
}

export const env = parseResult.data;

// Convenience derived values
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
