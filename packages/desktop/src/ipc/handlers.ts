import { type IpcMain, dialog, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import { printQueue } from './print-queue';
import { MockPrinterAdapter, UsbPrinterAdapter } from './printer-adapters';
import type { Receipt, PrinterConfig } from './printing-types';
import Store from 'electron-store';

/**
 * IPC handler registration.
 *
 * All ipcMain.handle() calls are registered here, then called once from main.ts.
 * Keeping handlers separate from main.ts prevents it from becoming a monolith.
 *
 * Pattern: ipcMain.handle(channel, async (event, ...args) => result)
 *   - The result is returned to the renderer as a resolved promise value
 *   - Throw an Error to reject the promise on the renderer side
 */
export function registerIpcHandlers(ipcMain: IpcMain, serverPort: number): void {
  // ── System ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.GET_SERVER_PORT, () => {
    return serverPort;
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  // ── Printing (Phase 6: Hardware) ─────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_event, data: { html: string }) => {
    console.log('[IPC] print-receipt called with pre-rendered html');
    return new Promise((resolve, reject) => {
      // Create a hidden window for printing
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let isFinished = false;

      // 15-second safety timeout to prevent memory leaks if printing hangs
      const timeoutId = setTimeout(() => {
        if (!isFinished) {
          isFinished = true;
          console.error('[IPC] Printing timed out after 15 seconds. Destroying window.');
          try {
            printWindow.destroy();
          } catch (e) {
            // Ignore if window was already destroyed
          }
          reject(new Error('Printing timed out. Hidden window destroyed to prevent leaks.'));
        }
      }, 15000);

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);

      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print(
          { silent: true, printBackground: true },
          (success: boolean, failureReason: string) => {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutId);
            try {
              printWindow.destroy();
            } catch (e) {
              // Ignore if window was already destroyed
            }
            if (success) {
              resolve({ success: true });
            } else {
              console.error('[IPC] Print failed:', failureReason);
              reject(new Error(`Printing failed: ${failureReason}`));
            }
          },
        );
      });

      printWindow.webContents.on('did-fail-load', () => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timeoutId);
        try {
          printWindow.destroy();
        } catch (e) {
          // Ignore if window was already destroyed
        }
        reject(new Error('Failed to load printing window context.'));
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_CASH_DRAWER, async () => {
    console.log('[IPC] open-cash-drawer called');
    return printQueue.kickDrawer();
  });

  ipcMain.handle(IPC_CHANNELS.ENQUEUE_PRINT_JOB, async (_event, receipt: Receipt) => {
    console.log('[IPC] enqueue-job called for receipt:', receipt.receiptNumber);
    const job = printQueue.enqueue(receipt);
    return { success: true, jobId: job.id };
  });

  ipcMain.handle(IPC_CHANNELS.GET_PRINT_JOBS, async () => {
    return printQueue.getJobs();
  });

  ipcMain.handle(IPC_CHANNELS.RETRY_PRINT_JOB, async (_event, jobId: string) => {
    console.log('[IPC] retry-job called for:', jobId);
    return printQueue.retryJob(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_PRINT_QUEUE, async () => {
    printQueue.clearQueue();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_PRINTER_STATUS, async () => {
    const config = printQueue.getConfig();
    if (config.type === 'system') {
      return {
        online: true,
        message: config.deviceName
          ? `Windows system printer selected: ${config.deviceName}`
          : 'Windows system printer mode active. Default printer will be used.',
      };
    }

    let adapter;
    if (config.type === 'mock') {
      adapter = new MockPrinterAdapter();
    } else {
      adapter = new UsbPrinterAdapter(config.devicePath);
    }
    return adapter.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.GET_PRINTER_CONFIG, async () => {
    return printQueue.getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_PRINTER_CONFIG, async (_event, config: PrinterConfig) => {
    printQueue.updateConfig(config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DISCOVER_PRINTERS, async () => {
    if (process.platform === 'win32') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const printers = await win?.webContents.getPrintersAsync();
      return (printers ?? []).map((printer) => printer.name);
    }

    return UsbPrinterAdapter.discover();
  });

  ipcMain.handle(IPC_CHANNELS.TEST_PRINTER, async (_event, config: PrinterConfig) => {
    console.log('[IPC] test-printer called with config:', config);
    return printQueue.testPrinter(config);
  });

  // ── Backup (Phase 5) ──────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.CREATE_BACKUP, async (_event, backupPath: unknown) => {
    // Phase 5 implementation note: Run pg_dump via child_process
    console.log('[IPC] create-backup called:', backupPath);
    return { success: true, message: 'Backup not yet implemented (Phase 5)' };
  });

  ipcMain.handle(IPC_CHANNELS.RESTORE_BACKUP, async (_event, backupPath: unknown) => {
    // Phase 5 implementation note: Run pg_restore via child_process
    console.log('[IPC] restore-backup called:', backupPath);
    return { success: true, message: 'Restore not yet implemented (Phase 5)' };
  });

  // ── File Dialogs ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(
      win ?? BrowserWindow.getFocusedWindow() ?? undefined!,
      {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Backup Directory',
      },
    );
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_FILE, async (event, filters: Electron.FileFilter[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(
      win ?? BrowserWindow.getFocusedWindow() ?? undefined!,
      {
        properties: ['openFile'],
        filters: filters ?? [],
        title: 'Select File',
      },
    );
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // ── Window Management ─────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // ── Durable Offline Storage (C-2) ─────────────────────────────────────────

  const offlineStore = new Store({
    name: 'offline-sales-store',
    defaults: {
      offlineSales: [],
    },
  }) as any;

  ipcMain.handle(IPC_CHANNELS.PERSIST_OFFLINE_SALE, (_event, sale: any) => {
    console.log('[IPC] persist-offline-sale called for ID:', sale.id);
    const sales = offlineStore.get('offlineSales', []);
    const existingIndex = sales.findIndex((s: any) => s.id === sale.id);
    if (existingIndex >= 0) {
      sales[existingIndex] = sale;
    } else {
      sales.push(sale);
    }
    offlineStore.set('offlineSales', sales);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_OFFLINE_SALES, () => {
    console.log('[IPC] get-offline-sales called');
    return offlineStore.get('offlineSales', []);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_OFFLINE_SALE, (_event, id: string) => {
    console.log('[IPC] remove-offline-sale called for ID:', id);
    let sales = offlineStore.get('offlineSales', []);
    sales = sales.filter((s: any) => s.id !== id);
    offlineStore.set('offlineSales', sales);
    return { success: true };
  });
}
