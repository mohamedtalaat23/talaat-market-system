import { type IpcMain, dialog, app } from 'electron';
import { IPC_CHANNELS } from './channels';

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

  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_event, data: unknown) => {
    // TODO (Phase 6): Implement receipt printing via node-thermal-printer
    console.log('[IPC] print-receipt called with:', data);
    return { success: true, message: 'Printing not yet implemented (Phase 6)' };
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_CASH_DRAWER, async () => {
    // TODO (Phase 6): Send ESC/POS cash drawer kick command
    console.log('[IPC] open-cash-drawer called');
    return { success: true, message: 'Cash drawer not yet implemented (Phase 6)' };
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
    const win = event.sender.getOwnerBrowserWindow();
    const result = await dialog.showOpenDialog(win ?? app.focusedWindow() ?? undefined!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Backup Directory',
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    IPC_CHANNELS.SELECT_FILE,
    async (event, filters: Electron.FileFilter[]) => {
      const win = event.sender.getOwnerBrowserWindow();
      const result = await dialog.showOpenDialog(win ?? app.focusedWindow() ?? undefined!, {
        properties: ['openFile'],
        filters: filters ?? [],
        title: 'Select File',
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
  );

  // ── Window Management ─────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, (event) => {
    event.sender.getOwnerBrowserWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (event) => {
    event.sender.getOwnerBrowserWindow()?.close();
  });
}
