import { app, BrowserWindow, net, protocol, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([{ scheme: 'dawith', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

const here = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let shuttingDown = false;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dawith Welfare Office',
    backgroundColor: '#f7f9f6',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL('dawith://app/index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  const publicRoot = path.resolve(here, '..', 'public');
  protocol.handle('dawith', async (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(publicRoot, relativePath);
    if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) return new Response('Not found', { status: 404 });
    try { return await net.fetch(pathToFileURL(filePath).toString()); } catch { return new Response('Not found', { status: 404 }); }
  });
  try {
    await createWindow();
  } catch (error) {
    console.error('Dawith Welfare Office failed to start:', error);
    try {
      const startupLog = path.join(app.getPath('userData'), 'startup-error.log');
      const { appendFileSync, mkdirSync } = await import('node:fs');
      mkdirSync(path.dirname(startupLog), { recursive: true });
      appendFileSync(startupLog, `${new Date().toISOString()}\n${error?.stack ?? error}\n`, 'utf8');
    } catch (logError) {
      console.error('Dawith Welfare Office could not write startup log:', logError);
    }
    app.exit(1);
    return;
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch((error) => console.error('window_create_failed', error)); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (shuttingDown) return;
  shuttingDown = true;
});

void here;
