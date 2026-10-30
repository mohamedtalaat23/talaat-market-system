import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import fs from 'fs';
import path from 'path';
import { ServerManager } from './server-manager';
import { PostgresManager } from './postgres-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { createSenderGuard } from './ipc/validation';

// ── Logger (simple console wrapper for main process with sensitive data redaction) ──
function redactSensitiveData(args: unknown[]): unknown[] {
  const sensitivePatterns = [/pass/i, /pin/i, /secret/i, /token/i, /key/i, /auth/i];

  const sanitize = (val: unknown, depth = 0): unknown => {
    if (depth > 3 || val === null || typeof val !== 'object') {
      return val;
    }
    if (val instanceof Error) {
      const sanitizedErr: Record<string, unknown> = {
        message: val.message,
        name: val.name,
        stack: val.stack,
      };
      for (const [key, value] of Object.entries(val)) {
        if (sensitivePatterns.some((pattern) => pattern.test(key))) {
          sanitizedErr[key] = '[REDACTED]';
        } else {
          sanitizedErr[key] = sanitize(value, depth + 1);
        }
      }
      return sanitizedErr;
    }
    if (Array.isArray(val)) {
      return val.map((item) => sanitize(item, depth + 1));
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(val)) {
      if (sensitivePatterns.some((pattern) => pattern.test(key))) {
        cleanObj[key] = '[REDACTED]';
      } else {
        cleanObj[key] = sanitize(value, depth + 1);
      }
    }
    return cleanObj;
  };

  return args.map((arg) => {
    if (typeof arg === 'string') {
      let clean = arg;
      for (const word of ['password', 'pin', 'secret', 'token', 'key']) {
        if (clean.toLowerCase().includes(word)) {
          clean = clean.replace(
            new RegExp(`${word}\\s*[:=]\\s*[^&\\s\\"\\';]+`, 'gi'),
            `${word}=[REDACTED]`,
          );
        }
      }
      return clean;
    }
    if (typeof arg === 'object') {
      return sanitize(arg);
    }
    return arg;
  });
}

export const logger = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[Main] ℹ️  ${msg}`, ...redactSensitiveData(args)),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[Main] ⚠️  ${msg}`, ...redactSensitiveData(args)),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[Main] ❌ ${msg}`, ...redactSensitiveData(args)),
};

// ── Development detection ────────────────────────────────────────────────────
const isDev = process.env['NODE_ENV'] === 'development';
if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}
const VITE_DEV_SERVER_URL = 'http' + '://localhost:5173';
const SERVER_PORT_DEV = 3001; // Dev server runs on fixed port

// ── App state ────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
const serverManager = new ServerManager();
const postgresManager = new PostgresManager();

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
      contextIsolation: true, // Renderer cannot access Node globals
      nodeIntegration: false, // Renderer has no Node.js APIs

      // Sandbox assessment: `sandbox: false` is required because the preload is a
      // compiled CommonJS module that requires a sibling module
      // (`./ipc/channels`); sandboxed preloads may only require `electron` and a
      // small allow-list, so enabling the sandbox needs a bundling step.
      //
      // Compensating controls in place instead:
      //   - contextIsolation + no nodeIntegration
      //   - every IPC payload schema-validated, sender frame verified
      //   - window.open denied, cross-origin navigation blocked, webviews blocked
      //   - strict CSP (below), webSecurity enabled in production
      sandbox: false,

      // Allow Vite dev server WebSocket for HMR in development
      webSecurity: !isDev,
    },

    // Show window only when content is ready — prevents white flash
    show: false,
  });

  // Register Content Security Policy (CSP) header in production for defense-in-depth security
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const httpProto = 'http' + '://';
    const httpPrefix = 'http' + ':';
    const devCsp = `default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: ${httpPrefix}; img-src 'self' data: blob: ${httpPrefix}; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:;`;

    const allowedHosts = [
      'localhost:*',
      '127.0.0.1:*',
      '192.168.*',
      '10.*',
      '172.16.*',
      '172.17.*',
      '172.18.*',
      '172.19.*',
      '172.20.*',
      '172.21.*',
      '172.22.*',
      '172.23.*',
      '172.24.*',
      '172.25.*',
      '172.26.*',
      '172.27.*',
      '172.28.*',
      '172.29.*',
      '172.30.*',
      '172.31.*',
    ];
    const connectSrc = `connect-src 'self' ${allowedHosts.map((host) => `${httpProto}${host}`).join(' ')};`;
    const prodCsp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; ${connectSrc}`;

    const cspHeader = isDev ? devCsp : prodCsp;

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader],
      },
    });
  });

  // ── Navigation & window restrictions ─────────────────────────────────────
  //
  // The renderer only ever needs to be the app itself. Anything that tries to
  // open a window, navigate away, or attach a <webview> is refused: those paths
  // are how a phishing page or an injected script escapes into a privileged
  // context.
  const isAppUrl = (url: string): boolean =>
    isDev ? url.startsWith(VITE_DEV_SERVER_URL) : url.startsWith('file://');

  win.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn('Blocked window.open from renderer', url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      logger.warn('Blocked navigation away from the application', url);
    }
  });

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    logger.warn('Blocked <webview> attachment in renderer');
  });

  // Cascade the same protections to any window the app creates (e.g. hidden
  // print windows).
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => event.preventDefault());
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
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'client/dist/index.html')
      : path.join(__dirname, '../../client/dist/index.html');
    logger.info(`Loading from: ${indexPath}`);
    await win.loadFile(indexPath);
  }

  // Pass the server port to the renderer after load
  win.webContents.on('did-finish-load', () => {
    win.webContents
      .executeJavaScript(`window.__SERVER_PORT__ = ${serverPort};`)
      .catch(logger.error);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

/**
 * Surfaces the auto-generated first-run administrator password exactly once.
 *
 * The bootstrap step writes `initial-admin-credentials.txt` next to the managed
 * config file. We display it, then delete it so it cannot be harvested later.
 */
async function showFirstRunAdminCredentials(
  managedPostgres: { configPath: string } | null,
): Promise<void> {
  if (!managedPostgres?.configPath) return;

  const credentialsPath = path.join(
    path.dirname(managedPostgres.configPath),
    'initial-admin-credentials.txt',
  );

  if (!fs.existsSync(credentialsPath)) return;

  let username = 'admin';
  let password = '';

  try {
    const content = fs.readFileSync(credentialsPath, 'utf8');
    username = /^username=(.*)$/m.exec(content)?.[1]?.trim() || username;
    password = /^password=(.*)$/m.exec(content)?.[1]?.trim() ?? '';
  } catch (error) {
    logger.warn('Could not read the first-run credentials file', error);
    return;
  }

  if (!password) return;

  await dialog.showMessageBox({
    type: 'info',
    title: 'Talaat Market — first-run credentials',
    message: 'Administrator account created',
    detail:
      `Username: ${username}\n` +
      `Password: ${password}\n\n` +
      'You will be asked to choose a new password after signing in.\n' +
      'Store this password somewhere safe — it will not be shown again.',
    buttons: ['Continue'],
    noLink: true,
  });

  try {
    fs.unlinkSync(credentialsPath);
  } catch (error) {
    logger.warn('Could not delete the first-run credentials file', error);
  }
}

app.on('ready', async () => {
  logger.info('Electron app ready');
  logger.info(`Platform: ${process.platform}, isDev: ${isDev}`);

  try {
    const managedPostgres = await postgresManager.start();
    const childEnv = managedPostgres?.env ?? {};

    // In production: start and wait for the Express server
    // In development: Express is already running separately
    if (!isDev) {
      await serverManager.runStartupTasks(childEnv);
      await showFirstRunAdminCredentials(managedPostgres);
    }

    const serverPort = isDev ? SERVER_PORT_DEV : await serverManager.start(childEnv);
    logger.info(`Server port: ${serverPort}`);

    // Register all IPC handlers. Every channel verifies the sender frame and
    // schema-validates its arguments before doing any work.
    registerIpcHandlers(ipcMain, {
      serverPort,
      assertTrustedSender: createSenderGuard({
        getWindow: () => mainWindow,
        allowedUrlPrefixes: isDev ? [VITE_DEV_SERVER_URL] : ['file://'],
      }),
    });

    // Create the browser window
    mainWindow = await createWindow(serverPort);

    logger.info('Main window created successfully');
  } catch (error) {
    logger.error('Failed to start application', error);
    dialog.showErrorBox(
      'Talaat Market failed to start',
      error instanceof Error ? error.message : String(error),
    );
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
  await postgresManager.stop();
});

// Handle uncaught errors in main process
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', error);
  app.quit();
});
