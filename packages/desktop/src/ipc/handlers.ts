import { type IpcMain, dialog, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import { printQueue } from './print-queue';
import { MockPrinterAdapter, UsbPrinterAdapter } from './printer-adapters';
import type { Receipt, PrinterConfig } from './printing-types';

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
export function registerIpcHandlers(
  ipcMain: IpcMain,
  serverPort: number,
): void {
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
          contextIsolation: true
        }
      });

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);

      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({ silent: true, printBackground: true }, (success: boolean, failureReason: string) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            console.error('[IPC] Print failed:', failureReason);
            reject(new Error(`Printing failed: ${failureReason}`));
          }
        });
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
    return UsbPrinterAdapter.discover();
  });

  ipcMain.handle(IPC_CHANNELS.TEST_PRINTER, async (_event, config: PrinterConfig) => {
    console.log('[IPC] test-printer called with config:', config);
    return printQueue.testPrinter(config);
  });

  // ── Backup (Phase 5) ──────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.CREATE_BACKUP, async (_event, backupPath: unknown) => {
    // TODO (Phase 5): Run pg_dump via child_process
    console.log('[IPC] create-backup called:', backupPath);
    return { success: true, message: 'Backup not yet implemented (Phase 5)' };
  });

  ipcMain.handle(IPC_CHANNELS.RESTORE_BACKUP, async (_event, backupPath: unknown) => {
    // TODO (Phase 5): Run pg_restore via child_process
    console.log('[IPC] restore-backup called:', backupPath);
    return { success: true, message: 'Restore not yet implemented (Phase 5)' };
  });

  // ── File Dialogs ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow() ?? undefined!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Backup Directory',
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    IPC_CHANNELS.SELECT_FILE,
    async (event, filters: Electron.FileFilter[]) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow() ?? undefined!, {
        properties: ['openFile'],
        filters: filters ?? [],
        title: 'Select File',
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
  );

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
}
