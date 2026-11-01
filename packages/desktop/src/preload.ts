import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';

/**
 * Preload script — runs in a privileged context but has access to both
 * Node.js and the DOM. The contextBridge exposes a narrow, typed API
 * to the renderer process without enabling full Node.js access.
 *
 * Security model:
 *   - contextIsolation: true → renderer and preload have separate JS worlds
 *   - nodeIntegration: false → renderer has NO Node.js access
 *   - The bridge (window.electronAPI) is the ONLY way the renderer can
 *     communicate with the main process or native APIs
 *
 * Only expose what is absolutely necessary. Every method here is a
 * potential attack surface if a malicious page were loaded.
 */

declare const window: { localStorage: { getItem(key: string): string | null } };
function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args, {
    token: window.localStorage.getItem('talaat_token'),
    requestId: crypto.randomUUID(),
  });
}

// Expose the electron API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  getServerPort: (): Promise<number> => invoke(IPC_CHANNELS.GET_SERVER_PORT) as Promise<number>,

  getAppVersion: (): Promise<string> => invoke(IPC_CHANNELS.GET_APP_VERSION) as Promise<string>,

  // Printing (Phase 6)
  printReceipt: (data: { html: string }): Promise<void> =>
    invoke(IPC_CHANNELS.PRINT_RECEIPT, data) as Promise<void>,

  openCashDrawer: (approval?: { manager_id: number; pin: string }): Promise<void> =>
    invoke(IPC_CHANNELS.OPEN_CASH_DRAWER, approval) as Promise<void>,

  // Native ESC/POS Hardware printing (Phase 12)
  enqueuePrintJob: (receipt: any, approval?: { manager_id: number; pin: string }): Promise<{ success: boolean; jobId: string }> =>
    invoke(IPC_CHANNELS.ENQUEUE_PRINT_JOB, receipt, approval) as Promise<{
      success: boolean;
      jobId: string;
    }>,

  getPrintJobs: (): Promise<any[]> => invoke(IPC_CHANNELS.GET_PRINT_JOBS) as Promise<any[]>,

  retryPrintJob: (jobId: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.RETRY_PRINT_JOB, jobId) as Promise<boolean>,

  clearPrintQueue: (): Promise<void> => invoke(IPC_CHANNELS.CLEAR_PRINT_QUEUE) as Promise<void>,

  getPrinterStatus: (): Promise<any> => invoke(IPC_CHANNELS.GET_PRINTER_STATUS) as Promise<any>,

  getPrinterConfig: (): Promise<any> => invoke(IPC_CHANNELS.GET_PRINTER_CONFIG) as Promise<any>,

  updatePrinterConfig: (config: any): Promise<boolean> =>
    invoke(IPC_CHANNELS.UPDATE_PRINTER_CONFIG, config) as Promise<boolean>,

  discoverPrinters: (): Promise<string[]> =>
    invoke(IPC_CHANNELS.DISCOVER_PRINTERS) as Promise<string[]>,

  testPrinter: (config: any): Promise<{ success: boolean; message: string }> =>
    invoke(IPC_CHANNELS.TEST_PRINTER, config) as Promise<{
      success: boolean;
      message: string;
    }>,

  // Backup
  //
  // Intentionally not exposed. Backups are created by the server
  // (`POST /settings/backups`, surfaced in Settings → Full Database Backup) and
  // restored offline with `npm run db:restore`. The previous bridge methods
  // resolved successfully while doing nothing.
  createBackup: (): Promise<never> =>
    Promise.reject(
      new Error('Backups are created by the server: Settings → Full Database Backup.'),
    ),

  restoreBackup: (): Promise<never> =>
    Promise.reject(
      new Error('Restore runs offline: npm run db:restore -- --file <backup> --target <database>.'),
    ),

  // File dialogs
  selectDirectory: (): Promise<string | null> =>
    invoke(IPC_CHANNELS.SELECT_DIRECTORY) as Promise<string | null>,

  selectFile: (filters: Electron.FileFilter[]): Promise<string | null> =>
    invoke(IPC_CHANNELS.SELECT_FILE, filters) as Promise<string | null>,

  // Window management
  minimizeWindow: (): Promise<void> => invoke(IPC_CHANNELS.MINIMIZE_WINDOW) as Promise<void>,

  maximizeWindow: (): Promise<void> => invoke(IPC_CHANNELS.MAXIMIZE_WINDOW) as Promise<void>,

  closeWindow: (): Promise<void> => invoke(IPC_CHANNELS.CLOSE_WINDOW) as Promise<void>,

  // Durable Offline Storage (C-2)
  persistOfflineSale: (sale: any): Promise<void> =>
    invoke(IPC_CHANNELS.PERSIST_OFFLINE_SALE, sale) as Promise<void>,

  getOfflineSales: (): Promise<any[]> => invoke(IPC_CHANNELS.GET_OFFLINE_SALES) as Promise<any[]>,

  removeOfflineSale: (id: string): Promise<void> =>
    invoke(IPC_CHANNELS.REMOVE_OFFLINE_SALE, id) as Promise<void>,
});
