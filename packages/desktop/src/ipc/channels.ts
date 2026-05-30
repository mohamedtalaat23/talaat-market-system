/**
 * IPC channel name constants.
 *
 * Centralizing channel names here prevents typos and makes it easy
 * to find all IPC touch-points. Both the preload script and ipcMain
 * handlers import from this file.
 *
 * Naming convention: DOMAIN:ACTION (kebab-case)
 */
export const IPC_CHANNELS = {
  // System
  GET_SERVER_PORT: 'system:get-server-port',
  GET_APP_VERSION: 'system:get-app-version',

  // Printing
  PRINT_RECEIPT: 'printer:print-receipt',
  OPEN_CASH_DRAWER: 'printer:open-cash-drawer',
  ENQUEUE_PRINT_JOB: 'printer:enqueue-job',
  GET_PRINT_JOBS: 'printer:get-queue',
  RETRY_PRINT_JOB: 'printer:retry-job',
  CLEAR_PRINT_QUEUE: 'printer:clear-queue',
  GET_PRINTER_STATUS: 'printer:get-status',
  GET_PRINTER_CONFIG: 'printer:get-config',
  UPDATE_PRINTER_CONFIG: 'printer:update-config',
  DISCOVER_PRINTERS: 'printer:discover',
  TEST_PRINTER: 'printer:test-print',

  // Backup
  CREATE_BACKUP: 'backup:create',
  RESTORE_BACKUP: 'backup:restore',
  LIST_BACKUPS: 'backup:list',

  // File dialogs
  SELECT_DIRECTORY: 'dialog:select-directory',
  SELECT_FILE: 'dialog:select-file',

  // Window management
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',

  // Durable Offline Storage (C-2)
  PERSIST_OFFLINE_SALE: 'offline:persist-sale',
  GET_OFFLINE_SALES: 'offline:get-sales',
  REMOVE_OFFLINE_SALE: 'offline:remove-sale',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
