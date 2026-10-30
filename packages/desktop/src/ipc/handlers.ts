import { type IpcMain, type IpcMainInvokeEvent, dialog, app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import { printQueue } from './print-queue';
import { MockPrinterAdapter, UsbPrinterAdapter } from './printer-adapters';
import type { Receipt } from './printing-types';
import {
  IpcValidationError,
  parseFileFiltersArgs,
  parseJobIdArgs,
  parseOfflineSaleArgs,
  parseOfflineSaleIdArgs,
  parsePrintReceiptArgs,
  parsePrinterConfigArgs,
  parseReceiptArgs,
  type OfflineSaleRecord,
} from './validation';
import Store from 'electron-store';

/**
 * IPC handler registration.
 *
 * Security model:
 *   - Every handler runs `assertTrustedSender` first: only the main window's
 *     top-level frame on an application URL may invoke privileged operations.
 *   - Every payload is parsed by an explicit validator (`./validation`) and a
 *     malformed argument becomes a rejected promise, never a partially applied
 *     side effect.
 *   - Handlers that cannot be implemented safely (backup/restore) are *not*
 *     registered at all. Previously they returned `{ success: true }` while doing
 *     nothing, which made the UI lie about having taken a backup.
 */

export type SenderGuard = (event: IpcMainInvokeEvent) => void;

/** Upper bound for the durable offline-sale queue (disk safety). */
const MAX_OFFLINE_QUEUE = 5_000;

export interface RegisterIpcOptions {
  serverPort: number;
  /** Throws when the sender is not the trusted application frame. */
  assertTrustedSender: SenderGuard;
}

export function registerIpcHandlers(
  ipcMain: IpcMain,
  { serverPort, assertTrustedSender }: RegisterIpcOptions,
): void {
  /** Wraps a handler with sender verification. */
  const handle = (
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ): void => {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedSender(event);

      try {
        return await handler(event, ...args);
      } catch (error) {
        if (error instanceof IpcValidationError) {
          console.warn(`[IPC] Rejected ${channel}: ${error.message}`);
        }
        throw error;
      }
    });
  };

  // ── System ───────────────────────────────────────────────────────────────

  handle(IPC_CHANNELS.GET_SERVER_PORT, () => serverPort);

  handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion());

  // ── Printing (Phase 6: Hardware) ─────────────────────────────────────────

  handle(IPC_CHANNELS.PRINT_RECEIPT, async (_event, ...args) => {
    const { html } = parsePrintReceiptArgs(args);
    console.log('[IPC] print-receipt called with pre-rendered html');

    return new Promise((resolve, reject) => {
      // Create a hidden window for printing
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: false,
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
          } catch {
            // Ignore if window was already destroyed
          }
          reject(new Error('Printing timed out. Hidden window destroyed to prevent leaks.'));
        }
      }, 15000);

      void printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print(
          { silent: true, printBackground: true },
          (success: boolean, failureReason: string) => {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutId);
            try {
              printWindow.destroy();
            } catch {
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
        } catch {
          // Ignore if window was already destroyed
        }
        reject(new Error('Failed to load printing window context.'));
      });
    });
  });

  handle(IPC_CHANNELS.OPEN_CASH_DRAWER, async () => {
    console.log('[IPC] open-cash-drawer called');
    return printQueue.kickDrawer();
  });

  handle(IPC_CHANNELS.ENQUEUE_PRINT_JOB, async (_event, ...args) => {
    const receipt = parseReceiptArgs(args);
    console.log('[IPC] enqueue-job called for receipt:', receipt.receiptNumber);
    const job = printQueue.enqueue(receipt as Receipt);
    return { success: true, jobId: job.id };
  });

  handle(IPC_CHANNELS.GET_PRINT_JOBS, async () => {
    return printQueue.getJobs();
  });

  handle(IPC_CHANNELS.RETRY_PRINT_JOB, async (_event, ...args) => {
    const jobId = parseJobIdArgs(args);
    console.log('[IPC] retry-job called for:', jobId);
    return printQueue.retryJob(jobId);
  });

  handle(IPC_CHANNELS.CLEAR_PRINT_QUEUE, async () => {
    printQueue.clearQueue();
    return { success: true };
  });

  handle(IPC_CHANNELS.GET_PRINTER_STATUS, async () => {
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

  handle(IPC_CHANNELS.GET_PRINTER_CONFIG, async () => {
    return printQueue.getConfig();
  });

  handle(IPC_CHANNELS.UPDATE_PRINTER_CONFIG, async (_event, ...args) => {
    printQueue.updateConfig(parsePrinterConfigArgs(args));
    return true;
  });

  handle(IPC_CHANNELS.DISCOVER_PRINTERS, async () => {
    if (process.platform === 'win32') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const printers = await win?.webContents.getPrintersAsync();
      return (printers ?? []).map((printer) => printer.name);
    }

    return UsbPrinterAdapter.discover();
  });

  handle(IPC_CHANNELS.TEST_PRINTER, async (_event, ...args) => {
    const config = parsePrinterConfigArgs(args);
    console.log('[IPC] test-printer called for type:', config.type);
    return printQueue.testPrinter(config);
  });

  // ── Backup ───────────────────────────────────────────────────────────────
  //
  // No backup/restore IPC handlers are registered on purpose. The previous
  // implementations returned `{ success: true }` without touching the database,
  // so a "successful" backup could not be restored — the worst possible failure
  // mode for a disaster-recovery feature.
  //
  // Backups are created server-side (Settings → Full Database Backup, or
  // `POST /settings/backups`) and restored offline with
  // `npm run db:restore -- --target <separate database>`. The renderer has no
  // privileged filesystem/database access, so there is nothing safe to expose
  // here. Calling these channels now rejects with a clear error.
  handle(IPC_CHANNELS.CREATE_BACKUP, async () => {
    throw new Error(
      'Backup must be created from the server (Settings → Full Database Backup).',
    );
  });

  handle(IPC_CHANNELS.RESTORE_BACKUP, async () => {
    throw new Error(
      'Restore runs offline on the server host: npm run db:restore -- --file <backup> --target <database>.',
    );
  });

  handle(IPC_CHANNELS.LIST_BACKUPS, async () => {
    throw new Error('List backups from Settings → Full Database Backup (server endpoint).');
  });

  // ── File Dialogs ──────────────────────────────────────────────────────────

  handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event) => {
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

  handle(IPC_CHANNELS.SELECT_FILE, async (event, ...args) => {
    const filters = parseFileFiltersArgs(args);
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(
      win ?? BrowserWindow.getFocusedWindow() ?? undefined!,
      {
        properties: ['openFile'],
        filters,
        title: 'Select File',
      },
    );
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // ── Window Management ─────────────────────────────────────────────────────

  handle(IPC_CHANNELS.MINIMIZE_WINDOW, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  handle(IPC_CHANNELS.MAXIMIZE_WINDOW, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  handle(IPC_CHANNELS.CLOSE_WINDOW, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // ── Durable Offline Storage (C-2) ─────────────────────────────────────────

  const offlineStore = new Store({
    name: 'offline-sales-store',
    defaults: {
      offlineSales: [],
    },
  }) as any;

  handle(IPC_CHANNELS.PERSIST_OFFLINE_SALE, (_event, ...args) => {
    const sale = parseOfflineSaleArgs(args);
    console.log('[IPC] persist-offline-sale called for ID:', sale.id);
    const sales: OfflineSaleRecord[] = offlineStore.get('offlineSales', []);

    // Bound the durable queue so a broken renderer cannot exhaust disk space.
    if (sales.length >= MAX_OFFLINE_QUEUE && !sales.some((entry) => entry['id'] === sale.id)) {
      throw new Error(
        `Offline queue is full (${MAX_OFFLINE_QUEUE} sales). Sync the pending sales before continuing.`,
      );
    }

    const existingIndex = sales.findIndex((entry) => entry['id'] === sale.id);
    if (existingIndex >= 0) {
      sales[existingIndex] = sale;
    } else {
      sales.push(sale);
    }
    offlineStore.set('offlineSales', sales);
    return { success: true };
  });

  handle(IPC_CHANNELS.GET_OFFLINE_SALES, () => {
    console.log('[IPC] get-offline-sales called');
    return offlineStore.get('offlineSales', []);
  });

  handle(IPC_CHANNELS.REMOVE_OFFLINE_SALE, (_event, ...args) => {
    const id = parseOfflineSaleIdArgs(args);
    console.log('[IPC] remove-offline-sale called for ID:', id);
    let sales: OfflineSaleRecord[] = offlineStore.get('offlineSales', []);
    sales = sales.filter((entry) => entry['id'] !== id);
    offlineStore.set('offlineSales', sales);
    return { success: true };
  });
}
