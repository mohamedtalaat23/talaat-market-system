import type { Receipt, PrinterConfig, PrintJob, PrinterStatus } from './printing-types';
import { ReceiptRenderer } from './receipt-renderer';
import { EscPosFormatter } from './escpos-formatter';
import { MockPrinterAdapter, UsbPrinterAdapter, type PrinterAdapter } from './printer-adapters';
import Store from 'electron-store';

const store = new Store() as any;

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  type: 'mock',
  paperWidth: 80,
  devicePath: '/dev/usb/lp0',
  autoPrint: true,
  retries: 3,
};

export class PrintQueue {
  private queue: PrintJob[] = [];
  private isProcessing = false;
  private config: PrinterConfig;

  constructor() {
    // Load config from persistent electron-store or use defaults
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
    return this.queue;
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
      id: Math.random().toString(36).substring(2, 11), // Simple random UUID
      receipt,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      error: null,
    };

    this.queue.push(job);
    console.log(`[PrintQueue] Enqueued job: ${job.id} for receipt: ${receipt.receiptNumber}`);

    // Process next job asynchronously
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

  private triggerProcessing(): void {
    if (this.isProcessing) return;
    
    // Defer processing to a background execution tick
    setImmediate(() => {
      this.processNext().catch((err) => {
        console.error('[PrintQueue] Critical processor error:', err);
      });
    });
  }

  private async processNext(): Promise<void> {
    const nextJob = this.queue.find((j) => j.status === 'pending' || j.status === 'retrying');
    if (!nextJob) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    nextJob.status = 'processing';
    console.log(`[PrintQueue] Processing job: ${nextJob.id} (Attempt ${nextJob.attempts + 1})`);

    try {
      // 1. Create the hardware adapter based on active settings
      let adapter: PrinterAdapter;
      if (this.config.type === 'mock') {
        adapter = new MockPrinterAdapter();
      } else {
        adapter = new UsbPrinterAdapter(this.config.devicePath);
      }

      // 2. Render receipt lines (width-aware)
      const lines = ReceiptRenderer.render(nextJob.receipt, this.config.paperWidth);

      // 3. Format lines to standard ESC/POS binary stream
      // We automatically kick the cash drawer if the checkout payment method is Cash
      const kickDrawer = nextJob.receipt.paymentMethod.toLowerCase() === 'cash';
      const bytes = EscPosFormatter.format(lines, kickDrawer);

      // 4. Connect, write, and disconnect from hardware
      await adapter.connect();
      await adapter.write(bytes);
      await adapter.disconnect();

      // Mark as successfully printed
      nextJob.status = 'completed';
      nextJob.error = null;
      console.log(`[PrintQueue] Printed successfully: Job ${nextJob.id}`);
      
      // Cleanup completed jobs if queue gets too large (keep last 50)
      if (this.queue.length > 50) {
        this.queue = this.queue.filter(j => j.status !== 'completed' || Date.now() - new Date(j.createdAt).getTime() < 3600000);
      }
    } catch (err: any) {
      nextJob.attempts += 1;
      const errorMsg = err.message || 'Unknown printer hardware error';
      nextJob.error = errorMsg;
      console.error(`[PrintQueue] Print job failed: ${nextJob.id}. Error: ${errorMsg}`);

      if (nextJob.attempts < this.config.retries) {
        nextJob.status = 'retrying';
        console.log(`[PrintQueue] Retrying job: ${nextJob.id} in 5 seconds...`);
        // Backoff delay of 5 seconds before making the next attempt
        await new Promise((resolve) => setTimeout(resolve, 5000));
        nextJob.status = 'pending';
      } else {
        nextJob.status = 'failed';
        console.error(`[PrintQueue] Job ${nextJob.id} reached maximum retries. Print job failed.`);
      }
    }

    // Continue processing remaining jobs
    this.isProcessing = false;
    this.triggerProcessing();
  }

  /**
   * Verifies printer hardware status on demand.
   */
  public async testPrinter(tempConfig: PrinterConfig): Promise<PrinterStatus> {
    try {
      let adapter: PrinterAdapter;
      if (tempConfig.type === 'mock') {
        adapter = new MockPrinterAdapter();
      } else {
        adapter = new UsbPrinterAdapter(tempConfig.devicePath);
      }

      await adapter.connect();
      
      // Print a short double-sided test slip to verify connection
      const testLines = [
        'TALAAT MARKET SYSTEM',
        'HARDWARE TEST PRINTER',
        '--------------------------------',
        `Time: ${new Date().toLocaleString()}`,
        `Port: ${tempConfig.devicePath}`,
        `Width: ${tempConfig.paperWidth}mm`,
        '--------------------------------',
        'PRINTER TEST SUCCESSFUL!',
        'جاهز للعمل'
      ];
      
      const bytes = EscPosFormatter.format(testLines, false);
      await adapter.write(bytes);
      await adapter.disconnect();

      return { online: true, message: 'Printer write test completed successfully' };
    } catch (err: any) {
      return { online: false, message: err.message || 'Verification test failed' };
    }
  }
}

// Single active instance in Electron main process
export const printQueue = new PrintQueue();
