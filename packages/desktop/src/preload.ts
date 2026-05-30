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

// Expose the electron API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  getServerPort: (): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_PORT) as Promise<number>,

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION) as Promise<string>,

  // Printing (Phase 6)
  printReceipt: (data: { html: string }): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PRINT_RECEIPT, data) as Promise<void>,

  openCashDrawer: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_CASH_DRAWER) as Promise<void>,

  // Native ESC/POS Hardware printing (Phase 12)
  enqueuePrintJob: (receipt: any): Promise<{ success: boolean; jobId: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ENQUEUE_PRINT_JOB, receipt) as Promise<{ success: boolean; jobId: string }>,

  getPrintJobs: (): Promise<any[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PRINT_JOBS) as Promise<any[]>,

  retryPrintJob: (jobId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.RETRY_PRINT_JOB, jobId) as Promise<boolean>,

  clearPrintQueue: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_PRINT_QUEUE) as Promise<void>,

  getPrinterStatus: (): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PRINTER_STATUS) as Promise<any>,

  getPrinterConfig: (): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PRINTER_CONFIG) as Promise<any>,

  updatePrinterConfig: (config: any): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PRINTER_CONFIG, config) as Promise<boolean>,

  discoverPrinters: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCOVER_PRINTERS) as Promise<string[]>,

  testPrinter: (config: any): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_PRINTER, config) as Promise<{ success: boolean; message: string }>,

  // Backup (Phase 5)
  createBackup: (backupPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_BACKUP, backupPath) as Promise<void>,

  restoreBackup: (backupPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_BACKUP, backupPath) as Promise<void>,

  // File dialogs
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY) as Promise<string | null>,

  selectFile: (filters: Electron.FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_FILE, filters) as Promise<string | null>,

  // Window management
  minimizeWindow: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW) as Promise<void>,

  maximizeWindow: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MAXIMIZE_WINDOW) as Promise<void>,

  closeWindow: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW) as Promise<void>,

  // Durable Offline Storage (C-2)
  persistOfflineSale: (sale: any): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PERSIST_OFFLINE_SALE, sale) as Promise<void>,

  getOfflineSales: (): Promise<any[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OFFLINE_SALES) as Promise<any[]>,

  removeOfflineSale: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_OFFLINE_SALE, id) as Promise<void>,
});
