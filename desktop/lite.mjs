// Lightweight runtime for Windows and Linux. Node runs the local server and
// the UI opens in an app window of a browser the PC already has (Edge on
// Windows; Chrome, Chromium, Edge or Brave on Linux) instead of shipping a
// whole Chromium, which keeps the download small.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const windows = process.platform === 'win32';
// Same folder the Electron build used, so existing records carry over.
// Linux follows the XDG convention (~/.config/Dawith Welfare Office).
const userData = windows
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Dawith Welfare Office')
  : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Dawith Welfare Office');
const runtimeFile = path.join(userData, 'runtime.json');
const logFile = path.join(userData, 'runtime.log');
// Linux packages are replaced by installing the new .deb or archive, so the
// updater only tells the user about new versions there, as for the portable exe.
const portable = process.argv.includes('--portable') || !windows;
// Edge throttles timers in hidden windows to about once a minute, so the
// window counts as closed only after several missed heartbeats.
const heartbeatTimeoutMs = 3 * 60 * 1000;

fs.mkdirSync(userData, { recursive: true });
const log = (message) => {
  try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`); } catch { /* logging is best effort */ }
};

// DAWITH_BROWSER picks the app-window browser explicitly (used by tests).
function findBrowser() {
  if (process.env.DAWITH_BROWSER) return process.env.DAWITH_BROWSER;
  if (windows) {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    return roots.map((root) => path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find((file) => fs.existsSync(file));
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'];
  const dirs = (process.env.PATH || '').split(path.delimiter).concat('/snap/bin');
  for (const name of names) {
    const file = dirs.map((dir) => path.join(dir, name)).find((candidate) => fs.existsSync(candidate));
    if (file) return file;
  }
  return null;
}

function openDefaultBrowser(url) {
  if (windows) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).on('error', (error) => log(`xdg-open failed: ${error.message}`)).unref();
}

function openWindow(url, { detached = false } = {}) {
  const browser = findBrowser();
  if (!browser) {
    // Firefox and other browsers have no app-window mode; a normal tab works
    // and the heartbeat still ends the server when it is closed.
    log('no app-window browser found; opening the default browser');
    openDefaultBrowser(url);
    return null;
  }
  const child = spawn(browser, [
    `--app=${url}`,
    `--user-data-dir=${path.join(userData, 'window')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    '--window-size=1440,940',
  ], { detached, stdio: 'ignore' });
  child.on('error', (error) => {
    log(`could not start ${browser}: ${error.message}; opening the default browser`);
    openDefaultBrowser(url);
  });
  if (detached) child.unref();
  return child;
}

async function runningInstance() {
  try {
    const { url } = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok ? url : null;
  } catch {
    return null;
  }
}

async function main() {
  // Loaded here so a broken install is logged and reported instead of failing silently.
  const { startDesktopServer } = await import('../server.mjs');
  const { createLiteUpdater } = await import('./lite-updater.mjs');
  const existing = await runningInstance();
  if (existing) {
    openWindow(`${existing}/?desktop=1`, { detached: true });
    return;
  }

  let windowProcess = null;
  let runtime = null;
  let lastHeartbeat = Date.now();
  const shutdown = (code = 0) => {
    try { fs.rmSync(runtimeFile, { force: true }); } catch { /* already gone */ }
    try { windowProcess?.kill(); } catch { /* window already closed */ }
    runtime?.server.close();
    setTimeout(() => process.exit(code), 200).unref();
  };

  // DAWITH_UPDATE_FEED lets a test point the updater at a local feed.
  const updater = createLiteUpdater({ version, portable, log, quit: () => shutdown(0), ...(process.env.DAWITH_UPDATE_FEED ? { feedUrl: process.env.DAWITH_UPDATE_FEED } : {}) });
  runtime = await startDesktopServer({
    host: '127.0.0.1',
    dataDir: path.join(userData, 'data'),
    updater,
    onHeartbeat: () => { lastHeartbeat = Date.now(); },
  });
  fs.writeFileSync(runtimeFile, JSON.stringify({ url: runtime.url, pid: process.pid, version }));
  log(`started ${version} at ${runtime.url}${portable ? ' (portable)' : ''}`);

  const openedAt = Date.now();
  windowProcess = openWindow(`${runtime.url}/?desktop=1`);
  windowProcess?.on('exit', () => {
    // If Edge handed the window to an already running Edge process, the
    // child exits at once; the heartbeat then decides when we are done.
    if (Date.now() - openedAt > 10_000) shutdown(0);
    windowProcess = null;
  });
  setInterval(() => {
    if (Date.now() - lastHeartbeat > heartbeatTimeoutMs) {
      log('no window heartbeat; shutting down');
      shutdown(0);
    }
  }, 30_000);
}

main().catch((error) => {
  log(`failed to start: ${error?.stack || error}`);
  // There is no window yet, so report the failure in a plain system dialog.
  const message = `프로그램을 시작하지 못했습니다. 설치 파일을 다시 받아 설치해 주세요. (기록: ${logFile})`;
  console.error(message);
  if (windows) spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', 'Dawith Welfare Office')`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  else spawn('zenity', ['--error', '--title=Dawith Welfare Office', `--text=${message}`], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  setTimeout(() => process.exit(1), 300);
});
