import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadPageUrl, isNewerVersion, releaseNotesUrl, updateFeedUrl } from './version.mjs';

// Reads the same latest.yml electron-builder writes: version, installer path,
// base64 sha512 and size.
export function parseFeed(text) {
  const field = (name) => new RegExp(`^${name}:\\s*'?([^'\\n]+)'?\\s*$`, 'm').exec(text)?.[1]?.trim();
  return { version: field('version'), path: field('path'), sha512: field('sha512'), size: Number(/^\s+size:\s*(\d+)/m.exec(text)?.[1] || 0) };
}

// The bullet points of a GitHub release body, as plain text, for the update dialog.
export function parseReleaseNotes(body) {
  return String(body || '').split(/\r?\n/)
    .map((line) => /^\s*[-*]\s+(.+)$/.exec(line)?.[1])
    .filter(Boolean)
    .map((line) => line.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim())
    .filter((line) => line && !/generated with/i.test(line))
    .slice(0, 8);
}

// Same contract as the Electron updater (status/check/download/install) so the
// UI does not care which runtime it runs in. The installer is downloaded,
// checked against the feed's sha512, then run silently with --force-run so the
// new version opens by itself.
export function createLiteUpdater({ version, portable, log = () => {}, quit, feedUrl = updateFeedUrl, notesUrl = releaseNotesUrl, fetchImpl = fetch, launch = spawn }) {
  const state = {
    supported: true,
    runtime: 'lite',
    mode: portable ? 'portable' : 'installer',
    platform: process.platform,
    currentVersion: version,
    latestVersion: null,
    status: 'idle',
    progress: 0,
    received: 0,
    total: 0,
    notes: [],
    lastCheckedAt: null,
    error: null,
    downloadPage: downloadPageUrl,
  };
  let feed = null;
  let installerPath = null;
  const snapshot = () => ({ ...state });
  const fail = (error) => {
    state.status = 'error';
    state.error = String(error?.message || error).slice(0, 240);
    log(`update error: ${state.error}`);
  };

  async function check() {
    if (['checking', 'downloading', 'installing'].includes(state.status)) return snapshot();
    state.status = 'checking';
    state.error = null;
    try {
      const response = await fetchImpl(`${feedUrl}latest.yml`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`update_feed_${response.status}`);
      feed = parseFeed(await response.text());
      state.latestVersion = feed.version || null;
      state.status = feed.version && isNewerVersion(feed.version, version) ? 'available' : 'latest';
      state.total = feed.size || 0;
      state.lastCheckedAt = new Date().toISOString();
      if (state.status === 'available') {
        // Notes are a nice-to-have; a missing or rate-limited API never blocks the update.
        try {
          const release = await fetchImpl(notesUrl(feed.version), { headers: { accept: 'application/vnd.github+json' } });
          state.notes = release.ok ? parseReleaseNotes((await release.json()).body) : [];
        } catch { state.notes = []; }
      }
    } catch (error) {
      fail(error);
    }
    return snapshot();
  }

  async function fetchInstaller() {
    const response = await fetchImpl(new URL(feed.path, feedUrl).href, { cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error(`update_download_${response.status}`);
    const total = Number(response.headers.get('content-length')) || feed.size || 0;
    const dir = path.join(os.tmpdir(), 'dawith-update');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, path.basename(feed.path));
    const hash = crypto.createHash('sha512');
    const out = fs.createWriteStream(target);
    let received = 0;
    for await (const chunk of response.body) {
      hash.update(chunk);
      received += chunk.length;
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
      state.received = received;
      state.total = total;
      if (total) state.progress = Math.min(99, Math.round((received / total) * 100));
    }
    await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
    if (feed.sha512 && hash.digest('base64') !== feed.sha512) {
      fs.rmSync(target, { force: true });
      throw new Error('update_checksum_mismatch');
    }
    return target;
  }

  function download() {
    if (portable || state.status !== 'available' || !feed?.path) return snapshot();
    state.status = 'downloading';
    state.progress = 0;
    state.received = 0;
    fetchInstaller().then((file) => {
      installerPath = file;
      state.status = 'downloaded';
      state.progress = 100;
      log(`update ${feed.version} downloaded`);
    }).catch(fail);
    return snapshot();
  }

  function install() {
    if (state.status !== 'downloaded' || !installerPath) return snapshot();
    state.status = 'installing';
    log(`installing ${feed.version}`);
    launch(installerPath, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => quit?.(), 300);
    return snapshot();
  }

  return { status: snapshot, check, download, install };
}
