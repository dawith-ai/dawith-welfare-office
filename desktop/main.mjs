import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let localServer;
let mainWindow;

async function createWindow() {
  localServer = await startServer({
    port: 0,
    dataDir: path.join(app.getPath('userData'), 'data'),
  });

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

  await mainWindow.loadURL(localServer.url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (localServer) localServer.server.close();
});

void here;
