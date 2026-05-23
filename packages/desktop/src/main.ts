import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import { ServerManager } from './server-manager';
import { registerIpcHandlers } from './ipc/handlers';

// ── Logger (simple console wrapper for main process) ────────────────────────
export const logger = {
  info:  (msg: string, ...args: unknown[]) => console.log(`[Main] ℹ️  ${msg}`, ...args),
  warn:  (msg: string, ...args: unknown[]) => console.warn(`[Main] ⚠️  ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Main] ❌ ${msg}`, ...args),
};

// ── Development detection ────────────────────────────────────────────────────
const isDev = process.env['NODE_ENV'] === 'development';
const VITE_DEV_SERVER_URL = 'http://localhost:5173';
const SERVER_PORT_DEV = 3001; // Dev server runs on fixed port

// ── App state ────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
const serverManager = new ServerManager();

// ── Force dark mode (supermarket staff prefer it) ────────────────────────────
nativeTheme.themeSource = 'dark';

// ── Create main window ───────────────────────────────────────────────────────

async function createWindow(serverPort: number): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    // Window dimensions — 1280x800 is minimum for the POS layout
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,

    // Title bar
    title: 'Talaat Market — نظام إدارة السوبر ماركت',

    // Background matches our dark theme — prevents white flash on load
    backgroundColor: '#020617',

    // Security — disable the default frame for future custom titlebar
    // frame: false,  // Uncomment in Phase 6 for custom titlebar

    webPreferences: {
      // Preload script runs before renderer, can access limited Node APIs
      preload: path.join(__dirname, 'preload.js'),

      // SECURITY: These MUST remain false
      contextIsolation: true,   // Renderer cannot access Node globals
      nodeIntegration: false,   // Renderer has no Node.js APIs
      sandbox: false,            // Keep false for preload access; true for max security

      // Allow Vite dev server WebSocket for HMR in development
      webSecurity: !isDev,
    },

    // Show window only when content is ready — prevents white flash
    show: false,
  });

  // Show when the page finishes loading
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      // Open DevTools in development for debugging
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server (enables HMR)
    logger.info(`Loading from Vite dev server: ${VITE_DEV_SERVER_URL}`);
    await win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Production: Load from built files
    const indexPath = path.join(__dirname, '../../client/dist/index.html');
    logger.info(`Loading from: ${indexPath}`);
    await win.loadFile(indexPath);
  }

  // Pass the server port to the renderer after load
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(
      `window.__SERVER_PORT__ = ${serverPort};`,
    ).catch(logger.error);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on('ready', async () => {
  logger.info('Electron app ready');
  logger.info(`Platform: ${process.platform}, isDev: ${isDev}`);

  try {
    // In production: start and wait for the Express server
    // In development: Express is already running separately
    const serverPort = isDev ? SERVER_PORT_DEV : await serverManager.start();
    logger.info(`Server port: ${serverPort}`);

    // Register all IPC handlers
    registerIpcHandlers(ipcMain, serverPort);

    // Create the browser window
    mainWindow = await createWindow(serverPort);

    logger.info('Main window created successfully');
  } catch (error) {
    logger.error('Failed to start application', error);
    app.quit();
  }
});

// macOS: re-open window when dock icon is clicked
app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    const serverPort = serverManager.getPort() || SERVER_PORT_DEV;
    mainWindow = await createWindow(serverPort);
  }
});

// Windows/Linux: quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Graceful shutdown — stop the forked server before quitting
app.on('before-quit', async () => {
  logger.info('App quitting — stopping server...');
  await serverManager.stop();
});

// Handle uncaught errors in main process
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', error);
  app.quit();
});
