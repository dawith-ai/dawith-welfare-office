import { app, BrowserWindow, safeStorage, shell } from 'electron';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let localServer;
let mainWindow;

async function loadProtectedDatabaseKey(dataDir) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('os_key_storage_unavailable');
  const protectedPath = path.join(dataDir, '.os-protected-key');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(protectedPath)) {
    const decrypted = await safeStorage.decryptStringAsync(fs.readFileSync(protectedPath));
    const encoded = typeof decrypted === 'string' ? decrypted : decrypted.result;
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('protected_database_key_invalid');
    return key;
  }
  const legacyPath = path.join(dataDir, '.local-key');
  const key = fs.existsSync(legacyPath) ? fs.readFileSync(legacyPath) : crypto.randomBytes(32);
  if (key.length !== 32) throw new Error('legacy_database_key_invalid');
  fs.writeFileSync(protectedPath, await safeStorage.encryptStringAsync(key.toString('base64')), { mode: 0o600 });
  return key;
}

async function createWindow() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const encryptionKey = await loadProtectedDatabaseKey(dataDir);
  localServer = await startServer({
    port: 0,
    host: '127.0.0.1',
    authRequired: false,
    dataDir,
    encryptionKey,
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
