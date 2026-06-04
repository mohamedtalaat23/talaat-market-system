import type { Receipt, PrinterConfig, PrintJob, PrinterStatus } from './printing-types';
import { ReceiptRenderer } from './receipt-renderer';
import { EscPosFormatter } from './escpos-formatter';
import { MockPrinterAdapter, UsbPrinterAdapter, type PrinterAdapter } from './printer-adapters';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';

const store = new Store() as any;

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  type: 'mock',
  paperWidth: 80,
  devicePath: '/dev/usb/lp0',
  deviceName: '',
  autoPrint: true,
  retries: 3,
};

export class PrintQueue {
  private queue: PrintJob[] = [];
  private isProcessing = false;
  private config: PrinterConfig;

  constructor() {
    this.config = (store.get('printerConfig') as PrinterConfig) || { ...DEFAULT_PRINTER_CONFIG };
  }

  public getConfig(): PrinterConfig {
    return this.config;
  }

  public updateConfig(newConfig: PrinterConfig): void {
    this.config = { ...newConfig };
    store.set('printerConfig', this.config);
    console.log('[PrintQueue] Configuration updated:', this.config);
  }

  public getJobs(): PrintJob[] {
    // Return only non-completed jobs or jobs completed within the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.queue.filter(
      (j) => j.status !== 'completed' || new Date(j.createdAt).getTime() > fiveMinutesAgo,
    );
  }

  public clearQueue(): void {
    this.queue = [];
    console.log('[PrintQueue] Queue cleared by administrative request');
  }

  /**
   * Enqueues a new receipt for asynchronous print queue processing.
   */
  public enqueue(receipt: Receipt): PrintJob {
    const job: PrintJob = {
      id: Math.random().toString(36).substring(2, 11),
      receipt,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      error: null,
    };

    this.queue.push(job);
    console.log(`[PrintQueue] Enqueued job: ${job.id} for receipt: ${receipt.receiptNumber}`);

    this.triggerProcessing();

    return job;
  }

  /**
   * Retries a specific failed job inside the queue.
   */
  public retryJob(jobId: string): boolean {
    const job = this.queue.find((j) => j.id === jobId);
    if (!job) return false;

    if (job.status === 'failed') {
      job.status = 'pending';
      job.attempts = 0;
      job.error = null;
      console.log(`[PrintQueue] Retrying job: ${jobId} via user override`);
      this.triggerProcessing();
      return true;
    }

    return false;
  }

  /**
   * Sends high-priority cash drawer kick commands directly to the hardware,
   * bypassing the standard print queue entirely so jams/failures do not block opening the drawer.
   */
  public async kickDrawer(): Promise<{ success: boolean; message: string }> {
    console.log('[PrintQueue] High-priority cash drawer kick requested. Bypassing print queue.');

    if (this.config.type === 'system') {
      return {
        success: false,
        message: 'Cash drawer kick is not supported by Windows system printer mode',
      };
    }

    let adapter: PrinterAdapter;
    if (this.config.type === 'mock') {
      adapter = new MockPrinterAdapter();
    } else {
      adapter = new UsbPrinterAdapter(this.config.devicePath);
    }

    try {
      const drawerCmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]); // ESC p 0 25 250
      await adapter.connect();
      await adapter.write(drawerCmd);
      await adapter.disconnect();
      console.log('[PrintQueue] Priority cash drawer kick completed successfully.');
      return { success: true, message: 'Cash drawer opened successfully' };
    } catch (err: any) {
      console.error('[PrintQueue] Priority cash drawer kick failed:', err);
      const parsedError = err.message || 'Unknown printer hardware error';

      let errorCode = 'CASH_DRAWER_FAILED';
      if (parsedError.includes(':')) {
        errorCode = parsedError.split(':')[0];
      }

      this.broadcastPrinterError(errorCode, `Cash drawer failed: ${parsedError}`);
      return { success: false, message: `Failed to open cash drawer: ${parsedError}` };
    }
  }

  /**
   * Safe Administrative Recovery Mechanism.
   * Clears physical buffers, resets connection handlers, recovers from hung processes
   * and unlocks print execution without restarting the desktop application.
   */
  public async recover(): Promise<{ success: boolean; message: string }> {
    console.log('[PrintQueue] Administrative printer recovery sequence initiated...');

    // 1. Force-fail any jobs stuck in processing state to unblock execution flows
    const stuckJob = this.queue.find((j) => j.status === 'processing');
    if (stuckJob) {
      stuckJob.status = 'failed';
      stuckJob.error = 'PRINTER_TIMEOUT: Execution aborted by administrative recovery sequence';
      console.log(`[PrintQueue] Aborted hanging job ${stuckJob.id} during recovery.`);
    }

    this.isProcessing = false;

    // 2. Perform connection re-initialization and flush physical hardware buffers
    try {
      if (this.config.type === 'system') {
        return {
          success: false,
          message: 'Printer recovery is not required for Windows system printer mode.',
        };
      }

      let adapter: PrinterAdapter;
      if (this.config.type === 'mock') {
        adapter = new MockPrinterAdapter();
      } else {
        adapter = new UsbPrinterAdapter(this.config.devicePath);
      }

      await adapter.reset();

      // 3. Resume the print queue processing loop
      this.triggerProcessing();

      console.log('[PrintQueue] Printer recovery sequence completed successfully.');
      return { success: true, message: 'Printer re-initialized and buffer cleared successfully.' };
    } catch (err: any) {
      console.error('[PrintQueue] Hardware reset failed during recovery:', err);
      return { success: false, message: `Recovery hardware reset failed: ${err.message}` };
    }
  }

  private triggerProcessing(): void {
    if (this.isProcessing) return;

    setImmediate(() => {
      this.processNext().catch((err) => {
        console.error('[PrintQueue] Critical processor error:', err);
      });
    });
  }

  private async processNext(): Promise<void> {
    const nextJob = this.queue.find((j) => j.status === 'pending');
    if (!nextJob) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    nextJob.status = 'processing';
    console.log(`[PrintQueue] Processing job: ${nextJob.id} (Attempt ${nextJob.attempts + 1})`);

    try {
      if (this.config.type === 'system') {
        await this.printWithSystemPrinter(nextJob.receipt, this.config);
        nextJob.status = 'completed';
        nextJob.error = null;
        console.log(`[PrintQueue] Printed successfully via system printer: Job ${nextJob.id}`);
        this.isProcessing = false;
        this.triggerProcessing();
        return;
      }

      let adapter: PrinterAdapter;
      if (this.config.type === 'mock') {
        adapter = new MockPrinterAdapter();
      } else {
        adapter = new UsbPrinterAdapter(this.config.devicePath);
      }

      const lines = ReceiptRenderer.render(nextJob.receipt, this.config.paperWidth);
      const kickDrawer = nextJob.receipt.paymentMethod.toLowerCase() === 'cash';
      const bytes = EscPosFormatter.format(lines, kickDrawer);

      await adapter.connect();
      await adapter.write(bytes);
      await adapter.disconnect();

      nextJob.status = 'completed';
      nextJob.error = null;
      console.log(`[PrintQueue] Printed successfully: Job ${nextJob.id}`);

      // Immediately truncate completed jobs from the in-memory array, keeping only the last 10 completed jobs
      const completedJobs = this.queue.filter((j) => j.status === 'completed');
      if (completedJobs.length > 10) {
        const jobsToRemove = completedJobs.slice(0, completedJobs.length - 10);
        const idsToRemove = new Set(jobsToRemove.map((j) => j.id));
        this.queue = this.queue.filter((j) => !idsToRemove.has(j.id));
      }

      this.isProcessing = false;
      this.triggerProcessing();
    } catch (err: any) {
      nextJob.attempts += 1;
      const errorMsg = err.message || 'Unknown printer hardware error';
      nextJob.error = errorMsg;

      let errorCode = 'HARDWARE_ERROR';
      if (errorMsg.includes(':')) {
        errorCode = errorMsg.split(':')[0];
      }

      this.broadcastPrinterError(errorCode, errorMsg, nextJob.id);
      console.error(`[PrintQueue] Print job failed: ${nextJob.id}. Error: ${errorMsg}`);

      // Enforce strict limit of maximum 3 attempts per job
      const maxRetries = Math.min(this.config.retries || 3, 3);

      if (nextJob.attempts < maxRetries) {
        nextJob.status = 'retrying';
        console.log(
          `[PrintQueue] Rescheduling job: ${nextJob.id} for retry ${nextJob.attempts}/${maxRetries} in 5 seconds...`,
        );

        const runLater = setTimeout;
        runLater(() => {
          if (nextJob.status === 'retrying') {
            nextJob.status = 'pending';
            this.triggerProcessing();
          }
        }, 5000);

        // Resume other pending queue operations immediately
        this.isProcessing = false;
        this.triggerProcessing();
      } else {
        nextJob.status = 'failed';
        console.error(
          `[PrintQueue] Job ${nextJob.id} reached maximum attempts (${maxRetries}). Print job failed.`,
        );

        this.isProcessing = false;
        this.triggerProcessing();
      }
    }
  }

  /**
   * Verifies printer hardware status on demand.
   */
  public async testPrinter(tempConfig: PrinterConfig): Promise<PrinterStatus> {
    try {
      if (tempConfig.type === 'system') {
        await this.printLinesWithSystemPrinter(
          [
            'TALAAT MARKET SYSTEM',
            'WINDOWS SYSTEM PRINTER TEST',
            '--------------------------------',
            `Time: ${new Date().toLocaleString()}`,
            `Printer: ${tempConfig.deviceName || 'Default printer'}`,
            `Width: ${tempConfig.paperWidth}mm`,
            '--------------------------------',
            'PRINTER TEST SUCCESSFUL!',
          ],
          tempConfig,
        );
        return { online: true, message: 'Windows system printer test completed successfully' };
      }

      let adapter: PrinterAdapter;
      if (tempConfig.type === 'mock') {
        adapter = new MockPrinterAdapter();
      } else {
        adapter = new UsbPrinterAdapter(tempConfig.devicePath);
      }

      await adapter.connect();

      const testLines = [
        'TALAAT MARKET SYSTEM',
        'HARDWARE TEST PRINTER',
        '--------------------------------',
        `Time: ${new Date().toLocaleString()}`,
        `Port: ${tempConfig.devicePath}`,
        `Width: ${tempConfig.paperWidth}mm`,
        '--------------------------------',
        'PRINTER TEST SUCCESSFUL!',
        'جاهز للعمل',
      ];

      const bytes = EscPosFormatter.format(testLines, false);
      await adapter.write(bytes);
      await adapter.disconnect();

      return { online: true, message: 'Printer write test completed successfully' };
    } catch (err: any) {
      return { online: false, message: err.message || 'Verification test failed' };
    }
  }

  /**
   * Broadcasts real-time hardware error events over the Electron IPC bridge
   * to keep the React frontend dynamically notified.
   */
  private broadcastPrinterError(errorCode: string, message: string, jobId?: string): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('printer:error-event', { errorCode, message, jobId });
        }
      });
    } catch (err) {
      console.error('[PrintQueue] Error broadcasting events to windows:', err);
    }
  }

  private async printWithSystemPrinter(receipt: Receipt, config: PrinterConfig): Promise<void> {
    const lines = ReceiptRenderer.render(receipt, config.paperWidth);
    await this.printLinesWithSystemPrinter(lines, config);
  }

  private printLinesWithSystemPrinter(lines: string[], config: PrinterConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      const timeout = setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        reject(new Error('PRINTER_TIMEOUT: Windows system printer did not respond in time'));
      }, 20_000);

      const escapedLines = lines.map((line) =>
        line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      );
      const widthPx = config.paperWidth === 58 ? 219 : 302;
      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { margin: 0; background: white; }
              pre {
                width: ${widthPx}px;
                margin: 0;
                padding: 8px;
                color: black;
                font-family: Consolas, "Courier New", monospace;
                font-size: 11px;
                line-height: 1.3;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body><pre>${escapedLines.join('\n')}</pre></body>
        </html>
      `;

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      printWindow.webContents.once('did-finish-load', () => {
        const printOptions: import('electron').WebContentsPrintOptions = {
          silent: Boolean(config.deviceName),
          printBackground: true,
          margins: {
            marginType: 'none',
          },
        };
        if (config.deviceName) {
          printOptions.deviceName = config.deviceName;
        }

        printWindow.webContents.print(printOptions, (success, failureReason) => {
          clearTimeout(timeout);
          if (!printWindow.isDestroyed()) {
            printWindow.destroy();
          }
          if (success) {
            resolve();
          } else {
            reject(new Error(`HARDWARE_ERROR: ${failureReason || 'Windows system print failed'}`));
          }
        });
      });
      printWindow.webContents.once('did-fail-load', (_event, _code, description) => {
        clearTimeout(timeout);
        if (!printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        reject(new Error(`HARDWARE_ERROR: Failed to load print document: ${description}`));
      });
    });
  }
}

export const printQueue = new PrintQueue();
