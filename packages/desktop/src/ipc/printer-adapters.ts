import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { PrinterStatus } from './printing-types';

export type PrinterErrorCode =
  | 'PRINTER_OFFLINE'
  | 'PERMISSION_DENIED'
  | 'OUT_OF_PAPER'
  | 'PRINTER_TIMEOUT'
  | 'HARDWARE_ERROR';

/**
 * Maps system and library errors to clean, standardized, frontend-friendly error codes.
 */
export function mapHardwareError(err: any): PrinterErrorCode {
  const code = err?.code;
  const msg = (err?.message || '').toLowerCase();

  if (
    code === 'ENOENT' ||
    code === 'ENODEV' ||
    code === 'ENXIO' ||
    msg.includes('offline') ||
    msg.includes('not connected') ||
    msg.includes('no such file')
  ) {
    return 'PRINTER_OFFLINE';
  }
  if (
    code === 'EACCES' ||
    code === 'EPERM' ||
    msg.includes('permission') ||
    msg.includes('access denied')
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    code === 'ENOSPC' ||
    msg.includes('paper') ||
    msg.includes('out of paper') ||
    msg.includes('no space')
  ) {
    return 'OUT_OF_PAPER';
  }
  if (
    code === 'ETIMEDOUT' ||
    msg.includes('timeout') ||
    msg.includes('timed out')
  ) {
    return 'PRINTER_TIMEOUT';
  }
  return 'HARDWARE_ERROR';
}

/**
 * Executes a promise with a strict timeout rejection.
 * Ensures the event loop is never blocked by hanging hardware integration tasks.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error: any = new Error(`${operationName} timed out after ${timeoutMs}ms`);
      error.code = 'ETIMEDOUT';
      reject(error);
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export interface PrinterAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  getStatus(): Promise<PrinterStatus>;
  reset(): Promise<void>;
}

/**
 * MOCK / DEV Printer Adapter.
 *
 * Decodes the raw binary buffer back to text, strips out ESC/POS commands,
 * and appends the resulting receipt visual slip into a local log file.
 */
export class MockPrinterAdapter implements PrinterAdapter {
  private online = false;
  private logPath: string;

  constructor() {
    const userData = app.getPath('userData');
    this.logPath = path.join(userData, 'talaat-mock-print.log');
  }

  public async connect(): Promise<void> {
    this.online = true;
  }

  public async disconnect(): Promise<void> {
    this.online = false;
  }

  public async write(bytes: Uint8Array): Promise<void> {
    if (!this.online) {
      throw new Error('PRINTER_OFFLINE: Mock printer is offline');
    }

    const fullText = Buffer.from(bytes).toString('utf8');

    const cleanText = fullText
      .replace(/\x1b\x40/g, '') // Initialize
      .replace(/\x1b\x61[\x00-\x02]/g, '') // Alignments
      .replace(/\x1b\x45[\x00-\x01]/g, '') // Bold on/off
      .replace(/\x1d\x21[\x00-\xff]/g, '') // Size changes
      .replace(/\x1d\x56\x42\x00/g, '\n[PAPER CUT]\n') // Paper cut marker
      .replace(/\x1b\x70\x00\x19\xfa/g, '[CASH DRAWER KICK]\n'); // Drawer kick

    const logEntry = `\n================================================\n[PRINT JOB LOGGED: ${new Date().toISOString()}]\n================================================\n${cleanText}\n`;

    fs.appendFileSync(this.logPath, logEntry, 'utf8');
    console.log('[Mock Printer] Receipt printed to:', this.logPath);
  }

  public async getStatus(): Promise<PrinterStatus> {
    return { online: true, message: `Mock mode active. Log path: ${this.logPath}` };
  }

  public async reset(): Promise<void> {
    this.online = true;
    const logEntry = `\n================================================\n[PRINTER RESET / INITIALIZED: ${new Date().toISOString()}]\n================================================\n`;
    fs.appendFileSync(this.logPath, logEntry, 'utf8');
    console.log('[Mock Printer] Buffer cleared and re-initialized');
  }
}

/**
 * NATIVE USB Printer Adapter.
 *
 * Implements high-performance native write streams targeting standard Unix character
 * device file endpoints (like `/dev/usb/lp0` or `/dev/usblp0`) on Linux POS terminals.
 */
export class UsbPrinterAdapter implements PrinterAdapter {
  private devicePath: string;
  private fd: number | null = null;

  constructor(devicePath: string) {
    this.devicePath = devicePath;
  }

  public async connect(): Promise<void> {
    if (this.fd !== null) {
      return; // Already open
    }

    const openPromise = new Promise<void>((resolve, reject) => {
      fs.open(this.devicePath, 'w', (err, fd) => {
        if (err) {
          reject(err);
        } else {
          this.fd = fd;
          resolve();
        }
      });
    });

    try {
      await withTimeout(openPromise, 5000, `Connection to ${this.devicePath}`);
    } catch (err: any) {
      const errCode = mapHardwareError(err);
      throw new Error(`${errCode}: Failed to open printer port "${this.devicePath}": ${err.message}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.fd !== null) {
      const activeFd = this.fd;
      this.fd = null;
      
      const closePromise = new Promise<void>((resolve) => {
        fs.close(activeFd, () => {
          resolve();
        });
      });

      await withTimeout(closePromise, 2000, 'Disconnecting printer').catch((err) => {
        console.error('[PrinterAdapter] Non-blocking disconnect timeout:', err);
      });
    }
  }

  public async write(bytes: Uint8Array): Promise<void> {
    if (this.fd === null) {
      throw new Error('PRINTER_OFFLINE: Printer write stream is closed. Call connect() first.');
    }

    const writePromise = new Promise<void>((resolve, reject) => {
      fs.write(this.fd!, Buffer.from(bytes), 0, bytes.length, null, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    try {
      await withTimeout(writePromise, 5000, 'Writing data to printer');
    } catch (err: any) {
      const errCode = mapHardwareError(err);
      throw new Error(`${errCode}: Hardware write failure: ${err.message}`);
    }
  }

  public async getStatus(): Promise<PrinterStatus> {
    try {
      await this.connect();
      await this.disconnect();
      return { online: true, message: `Ready to print on ${this.devicePath}` };
    } catch (err: any) {
      const errCode = mapHardwareError(err);
      return { online: false, message: `${errCode}: ${err.message || `Offline on ${this.devicePath}`}` };
    }
  }

  public async reset(): Promise<void> {
    const initCmd = new Uint8Array([0x1B, 0x40]); // ESC @
    try {
      await this.connect();
      await this.write(initCmd);
      await this.disconnect();
      console.log(`[UsbPrinterAdapter] Hardware buffer reset successfully on ${this.devicePath}`);
    } catch (err: any) {
      await this.disconnect();
      const errCode = mapHardwareError(err);
      throw new Error(`${errCode}: Reset failed: ${err.message}`);
    }
  }

  /**
   * Scans and auto-discovers potential thermal printer paths on Unix architectures.
   */
  public static discover(): string[] {
    const ports: string[] = [];

    if (process.platform === 'linux') {
      try {
        if (fs.existsSync('/dev/usb')) {
          const files = fs.readdirSync('/dev/usb');
          files.forEach(f => {
            if (f.startsWith('lp')) {
              ports.push(`/dev/usb/${f}`);
            }
          });
        }

        const rootDevFiles = fs.readdirSync('/dev');
        rootDevFiles.forEach(f => {
          if (f.startsWith('usblp')) {
            ports.push(`/dev/${f}`);
          }
        });
      } catch (err) {
        console.error('[Discovery] Error searching printer endpoints:', err);
      }
    }

    return ports;
  }
}
