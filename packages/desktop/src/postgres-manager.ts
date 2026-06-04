import { app } from 'electron';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { logger } from './main';

interface PostgresRuntime {
  initdb: string;
  pgCtl: string;
  createdb: string;
  psql: string;
  postgres: string;
}

interface ManagedPostgresConfig {
  configPath: string;
  env: Record<string, string>;
}

const DB_NAME = 'talaat_market';
const DB_USER = 'talaat_app';
const SUPERUSER = 'talaat_postgres';

function quoteSql(value: string): string {
  return value.replace(/'/g, "''");
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const values: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^"(.*)"$/, '$1');
  }
  return values;
}

function writeEnvFile(filePath: string, values: Record<string, string>): void {
  const lines = [
    '# Talaat Market generated production configuration',
    '# This file is managed by the desktop app. Keep it private.',
    ...Object.entries(values).map(([key, value]) => {
      const normalizedValue = value.replace(/\\/g, '/').replace(/"/g, '\\"');
      return `${key}="${normalizedValue}"`;
    }),
    '',
  ];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = 60_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(command, args, {
      env,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out: ${path.basename(command)} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited with code ${code}: ${output.trim()}`));
      }
    });
  });
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      server.close(() => resolve(address.port));
    });
    server.on('error', () => {
      findAvailablePort(startPort + 1)
        .then(resolve)
        .catch(reject);
    });
  });
}

export class PostgresManager {
  private configPath = '';
  private dataDir = '';
  private logPath = '';
  private isStarted = false;

  async start(): Promise<ManagedPostgresConfig | null> {
    if (process.platform !== 'win32' || process.env['NODE_ENV'] === 'development') {
      return null;
    }

    const userData = app.getPath('userData');
    fs.mkdirSync(userData, { recursive: true });

    this.dataDir = path.join(userData, 'postgres-data');
    this.configPath = path.join(userData, 'config.env');
    this.logPath = path.join(userData, 'postgres.log');

    const existingConfig = readEnvFile(this.configPath);

    // If external database hook is active, bypass local binary resolution and server startup
    if (existingConfig['DB_EXTERNAL'] === 'true') {
      logger.info(
        '[PostgresManager] External database hook active. Skipping local PostgreSQL startup.',
      );
      return {
        configPath: this.configPath,
        env: {
          TALAAT_CONFIG_PATH: this.configPath,
        },
      };
    }

    const runtime = this.getRuntime();
    const firstRun = !fs.existsSync(path.join(this.dataDir, 'PG_VERSION'));
    const port = await findAvailablePort(55432);

    if (!firstRun && !existingConfig['DB_PASSWORD']) {
      throw new Error(`Bundled database exists, but ${this.configPath} is missing DB_PASSWORD.`);
    }

    if (firstRun) {
      logger.info('[PostgresManager] Initializing bundled PostgreSQL data directory');
      fs.mkdirSync(this.dataDir, { recursive: true });
      await runCommand(
        runtime.initdb,
        ['-D', this.dataDir, '-U', SUPERUSER, '--encoding=UTF8', '--locale=C', '--auth=trust'],
        this.runtimeEnv(runtime),
        120_000,
      );
    }

    // Stop any orphaned PostgreSQL process that might be locking the data directory
    try {
      logger.info('[PostgresManager] Stopping any orphaned PostgreSQL server instance...');
      await runCommand(
        runtime.pgCtl,
        ['stop', '-D', this.dataDir, '-m', 'immediate', '-w'],
        this.runtimeEnv(runtime),
        15_000,
      );
    } catch {
      // Ignore if no instance was running or if it failed to stop
    }

    await this.startServer(runtime, port);

    const dbPassword = existingConfig['DB_PASSWORD'] || crypto.randomBytes(24).toString('hex');
    const sessionSecret =
      existingConfig['SESSION_SECRET'] || crypto.randomBytes(48).toString('hex');
    const jwtSecret = existingConfig['JWT_SECRET'] || crypto.randomBytes(48).toString('hex');

    if (firstRun) {
      await this.createApplicationDatabase(runtime, port, dbPassword);
    }

    const preservedConfig = Object.fromEntries(
      Object.entries(existingConfig).filter(([key]) => !['DB_PORT', 'SERVER_PORT'].includes(key)),
    );
    const env = {
      ...preservedConfig,
      NODE_ENV: 'production',
      APP_NAME: 'Talaat Market',
      SERVER_HOST: 'localhost',
      SERVER_PORT: '3001',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(port),
      DB_NAME,
      DB_USER,
      DB_PASSWORD: dbPassword,
      DB_POOL_MIN: '1',
      DB_POOL_MAX: '10',
      SESSION_SECRET: sessionSecret,
      JWT_SECRET: jwtSecret,
      JWT_EXPIRES_IN: '12h',
      LOG_LEVEL: 'info',
      LOG_DIR: path.join(userData, 'logs'),
      BACKUP_DIR: path.join(userData, 'backups'),
      PGDUMP_PATH: runtime.psql.replace(/psql\.exe$/i, 'pg_dump.exe'),
    };

    writeEnvFile(this.configPath, env);

    return {
      configPath: this.configPath,
      env: {
        TALAAT_CONFIG_PATH: this.configPath,
      },
    };
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;

    const runtime = this.getRuntime();
    await runCommand(
      runtime.pgCtl,
      ['stop', '-D', this.dataDir, '-m', 'fast', '-w'],
      this.runtimeEnv(runtime),
      30_000,
    ).catch((error) => {
      logger.warn(`[PostgresManager] pg_ctl stop failed: ${error.message}`);
    });

    this.isStarted = false;
  }

  private getRuntime(): PostgresRuntime {
    const baseDir = app.isPackaged
      ? path.join(process.resourcesPath, 'postgres', 'win-x64')
      : path.resolve(__dirname, '../../../vendor/postgres/win-x64');

    const runtime = {
      initdb: path.join(baseDir, 'bin', 'initdb.exe'),
      pgCtl: path.join(baseDir, 'bin', 'pg_ctl.exe'),
      createdb: path.join(baseDir, 'bin', 'createdb.exe'),
      psql: path.join(baseDir, 'bin', 'psql.exe'),
      postgres: path.join(baseDir, 'bin', 'postgres.exe'),
    };

    for (const binary of Object.values(runtime)) {
      if (!fs.existsSync(binary)) {
        throw new Error(`Bundled PostgreSQL runtime is missing: ${binary}`);
      }
    }

    return runtime;
  }

  private runtimeEnv(runtime: PostgresRuntime): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: `${path.dirname(runtime.postgres)}${path.delimiter}${process.env['PATH'] ?? ''}`,
      PGUSER: SUPERUSER,
    };
  }

  private async startServer(runtime: PostgresRuntime, port: number): Promise<void> {
    await runCommand(
      runtime.pgCtl,
      ['start', '-D', this.dataDir, '-l', this.logPath, '-o', `-p ${port} -h 127.0.0.1`, '-w'],
      this.runtimeEnv(runtime),
      120_000,
    );
    this.isStarted = true;
  }

  private async createApplicationDatabase(
    runtime: PostgresRuntime,
    port: number,
    dbPassword: string,
  ): Promise<void> {
    const env = this.runtimeEnv(runtime);
    const connectionArgs = ['-h', '127.0.0.1', '-p', String(port), '-U', SUPERUSER];

    await runCommand(
      runtime.psql,
      [
        ...connectionArgs,
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        `CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${quoteSql(dbPassword)}';`,
      ],
      env,
    );

    await runCommand(runtime.createdb, [...connectionArgs, '-O', DB_USER, DB_NAME], env);

    await runCommand(
      runtime.psql,
      [
        ...connectionArgs,
        '-d',
        DB_NAME,
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        'CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;',
      ],
      env,
    );
  }
}
