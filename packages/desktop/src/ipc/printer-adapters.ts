import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { PrinterStatus } from './printing-types';

export interface PrinterAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  getStatus(): Promise<PrinterStatus>;
}

/**
 * MOCK / DEV Printer Adapter.
 *
 * Decodes the raw binary buffer back to text, strips out ESC/POS commands,
 * and appends the resulting receipt visual slip into a local log file
 * for offline inspection and verification.
 */
export class MockPrinterAdapter implements PrinterAdapter {
  private online = false;
  private logPath: string;

  constructor() {
    // Save receipts inside the user's App Data directory
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
      throw new Error('Mock printer is offline');
    }

    // Convert raw bytes back to string
    const fullText = Buffer.from(bytes).toString('utf8');

    // Strip basic ESC/POS formatting command bytes to log clean readable text
    // Handles Escape (\x1b) and Group Separator (\x1d) sequences
    const cleanText = fullText
      .replace(/\x1b\x40/g, '') // Initialize
      .replace(/\x1b\x61[\x00-\x02]/g, '') // Alignments
      .replace(/\x1b\x45[\x00-\x01]/g, '') // Bold on/off
      .replace(/\x1d\x21[\x00-\xff]/g, '') // Size changes
      .replace(/\x1d\x56\x42\x00/g, '\n[PAPER CUT]\n') // Paper cut marker
      .replace(/\x1b\x70\x00\x19\xfa/g, '[CASH DRAWER KICK]\n') // Drawer kick
      .replace(/\x0a/g, '\n'); // Normal line feeds

    const logEntry = `\n================================================\n[PRINT JOB LOGGED: ${new Date().toISOString()}]\n================================================\n${cleanText}\n`;

    // Append atomically to local log file
    fs.appendFileSync(this.logPath, logEntry, 'utf8');
    console.log('[Mock Printer] Receipt printed to:', this.logPath);
  }

  public async getStatus(): Promise<PrinterStatus> {
    return { online: true, message: `Mock mode active. Log path: ${this.logPath}` };
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
    return new Promise((resolve, reject) => {
      // Open in write-only mode
      fs.open(this.devicePath, 'w', (err, fd) => {
        if (err) {
          reject(new Error(`Failed to connect to printer port "${this.devicePath}": ${err.message}`));
        } else {
          this.fd = fd;
          resolve();
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (this.fd !== null) {
      const activeFd = this.fd;
      this.fd = null;
      return new Promise((resolve) => {
        fs.close(activeFd, () => {
          resolve();
        });
      });
    }
  }

  public async write(bytes: Uint8Array): Promise<void> {
    if (this.fd === null) {
      throw new Error('Printer write stream is closed. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      fs.write(this.fd!, Buffer.from(bytes), 0, bytes.length, null, (err) => {
        if (err) {
          reject(new Error(`Hardware write failure: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async getStatus(): Promise<PrinterStatus> {
    try {
      await this.connect();
      await this.disconnect();
      return { online: true, message: `Ready to print on ${this.devicePath}` };
    } catch (err: any) {
      return { online: false, message: err.message || `Offline on ${this.devicePath}` };
    }
  }

  /**
   * Scans and auto-discovers potential thermal printer paths on Unix architectures.
   */
  public static discover(): string[] {
    const ports: string[] = [];

    if (process.platform === 'linux') {
      try {
        // Look in /dev/usb/
        if (fs.existsSync('/dev/usb')) {
          const files = fs.readdirSync('/dev/usb');
          files.forEach(f => {
            if (f.startsWith('lp')) {
              ports.push(`/dev/usb/${f}`);
            }
          });
        }

        // Look directly under /dev/ for usblp*
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
