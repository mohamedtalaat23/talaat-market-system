import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import * as net from 'net';
import { logger } from './main';

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

/**
 * ServerManager — manages the lifecycle of the Express.js server
 * as a forked child process.
 *
 * Why fork instead of running in the same process?
 *   1. Isolation: Express crashes don't bring down the Electron window
 *   2. Performance: Express runs in its own V8 context, no UI blocking
 *   3. Recovery: Main process can detect child crash and restart it
 *   4. Cleanup: Child is killed cleanly on app quit
 *
 * In development, the server is started separately (via npm run dev:server),
 * so ServerManager is only active in production Electron builds.
 */
export class ServerManager {
  private process: ChildProcess | null = null;
  private port: number = 3001;

  /**
   * Find an available port and start the Express server.
   * Returns the port number once the server signals 'ready'.
   */
  async start(): Promise<number> {
    // Find an available port (prefer 3001, fall back to others)
    this.port = await findAvailablePort(3001);

    // In development, assume the server is already running on 3001
    if (process.env['NODE_ENV'] === 'development') {
      logger.info(`[ServerManager] Development mode — using external server on port ${this.port}`);
      return this.port;
    }

    return this.startProductionServer();
  }

  private async startProductionServer(): Promise<number> {
    const serverPath = path.join(__dirname, '../../server/dist/index.js');

    logger.info(`[ServerManager] Starting Express server from: ${serverPath}`);

    return new Promise<number>((resolve, reject) => {
      this.process = fork(serverPath, [], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          SERVER_PORT: String(this.port),
          SERVER_HOST: 'localhost',
        },
        silent: false, // Let server logs flow to Electron's console
      });

      // Resolve when the server sends the 'ready' signal
      this.process.on('message', (message) => {
        if (message === 'ready') {
          logger.info(`[ServerManager] Express server ready on port ${this.port}`);
          resolve(this.port);
        }
      });

      this.process.on('error', (err) => {
        logger.error(`[ServerManager] Failed to start server: ${err.message}`);
        reject(err);
      });

      this.process.on('exit', (code, signal) => {
        logger.warn(`[ServerManager] Server exited (code=${code}, signal=${signal})`);
        this.process = null;

        // TODO (Phase 6): Implement auto-restart logic for production
      });

      // Timeout — if server doesn't signal ready in 30s, reject
      setTimeout(() => {
        if (this.process) {
          reject(new Error('Server failed to start within 30 seconds'));
        }
      }, 30_000);
    });
  }

  /**
   * Gracefully stop the forked server process.
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    return new Promise<void>((resolve) => {
      this.process!.on('exit', () => {
        this.process = null;
        resolve();
      });

      this.process!.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        this.process?.kill('SIGKILL');
        this.process = null;
        resolve();
      }, 5_000);
    });
  }

  getPort(): number {
    return this.port;
  }
}
