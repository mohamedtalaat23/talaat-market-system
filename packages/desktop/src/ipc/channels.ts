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
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
