import updaterPackage from 'electron-updater';

import { downloadPageUrl, isNewerVersion, updateFeedUrl } from './version.mjs';

export { downloadPageUrl, isNewerVersion, updateFeedUrl };

// The NSIS install updates itself through electron-updater. A portable exe
// cannot replace the file it runs from, so it only reports the new version
// and points to the download page.
export function createUpdater({ app }) {
  // Resolved lazily: touching autoUpdater constructs it against Electron's app.
  const { autoUpdater } = updaterPackage;
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  const state = {
    supported: app.isPackaged,
    mode: portable ? 'portable' : 'installer',
    currentVersion: app.getVersion(),
    latestVersion: null,
    status: 'idle',
    progress: 0,
    error: null,
    downloadPage: downloadPageUrl,
  };
  const snapshot = () => ({ ...state });
  const fail = (error) => {
    state.status = 'error';
    state.error = String(error?.message || error).slice(0, 240);
  };

  if (state.supported && !portable) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.setFeedURL({ provider: 'generic', url: updateFeedUrl });
    autoUpdater.on('download-progress', (progress) => { state.progress = Math.round(progress.percent || 0); });
    autoUpdater.on('update-downloaded', () => { state.status = 'downloaded'; state.progress = 100; });
    autoUpdater.on('error', fail);
  }

  async function check() {
    if (!state.supported || ['checking', 'downloading', 'installing'].includes(state.status)) return snapshot();
    state.status = 'checking';
    state.error = null;
    try {
      let latest;
      if (portable) {
        const response = await fetch(`${updateFeedUrl}latest.yml`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`update_feed_${response.status}`);
        latest = /^version:\s*(.+)$/m.exec(await response.text())?.[1]?.trim();
      } else {
        latest = (await autoUpdater.checkForUpdates())?.updateInfo?.version;
      }
      state.latestVersion = latest || null;
      state.status = latest && isNewerVersion(latest, state.currentVersion) ? 'available' : 'latest';
    } catch (error) {
      fail(error);
    }
    return snapshot();
  }

  function download() {
    if (portable || state.status !== 'available') return snapshot();
    state.status = 'downloading';
    state.progress = 0;
    autoUpdater.downloadUpdate().catch(fail);
    return snapshot();
  }

  function install() {
    if (state.status !== 'downloaded') return snapshot();
    state.status = 'installing';
    // Silent install, then start the new version.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 300);
    return snapshot();
  }

  return { status: snapshot, check, download, install };
}
