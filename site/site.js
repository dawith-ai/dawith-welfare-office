// Fills download links from the latest GitHub release so the site never needs
// editing per version. If GitHub is unreachable the static links to the
// releases page still work.
const releaseApi = 'https://api.github.com/repos/dawith-ai/dawith-welfare-office/releases/latest';
const webApp = 'https://dawith-ai.github.io/dawith-welfare-office/';
const assetPatterns = { setup: /-Setup\.exe$/i, portable: /-Portable\.exe$/i, mac: /\.dmg$/i };
const $ = (selector) => document.querySelector(selector);
const formatSize = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`;

function detectOs() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const agent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(agent)) return 'mobile';
  if (platform.includes('win') || agent.includes('windows')) return 'windows';
  if (platform.includes('mac') || agent.includes('mac os')) return 'mac';
  if (platform.includes('linux') || agent.includes('linux')) return 'linux';
  return 'unknown';
}

function applyOs(os) {
  const messages = {
    mac: 'Mac을 쓰고 계시네요. Mac용 설치 파일은 준비 중이라 지금은 웹 버전을 권합니다.',
    linux: 'Linux용 설치 파일은 아직 없습니다. 웹 버전에서 같은 도구를 쓸 수 있습니다.',
    mobile: '휴대폰에서는 설치할 수 없습니다. PC에서 이 페이지를 열거나 웹 버전을 쓰세요.',
  };
  if (!messages[os]) return;
  const primary = $('#heroDownload');
  primary.textContent = '웹 버전 바로 열기 ↗';
  primary.href = webApp;
  primary.target = '_blank';
  primary.rel = 'noreferrer';
  const notice = $('#osNotice');
  notice.textContent = messages[os];
  notice.hidden = false;
  $('.dl-card.main')?.classList.remove('main');
  $('.dl-tag')?.remove();
  $(`.dl-card[data-platform="${os === 'mac' ? 'mac' : 'web'}"]`)?.classList.add('main');
}

async function loadRelease(os) {
  try {
    const response = await fetch(releaseApi, { headers: { accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`release_${response.status}`);
    const release = await response.json();
    const assets = {};
    for (const [key, pattern] of Object.entries(assetPatterns)) assets[key] = release.assets?.find((asset) => pattern.test(asset.name));
    for (const [key, asset] of Object.entries(assets)) {
      if (!asset) continue;
      document.querySelectorAll(`[data-asset="${key}"]`).forEach((link) => { link.href = asset.browser_download_url; link.removeAttribute('target'); });
      document.querySelectorAll(`[data-size="${key}"]`).forEach((cell) => { cell.textContent = formatSize(asset.size); });
    }
    if (assets.mac) $('[data-asset="mac"]').textContent = 'Mac용 내려받기';
    const version = release.tag_name?.replace(/^v/, '');
    if (version) $('#releaseBadge').textContent = `최신 버전 ${version} · 무료`;
    if ((os === 'windows' || os === 'unknown') && assets.setup) {
      $('#heroDownload').href = assets.setup.browser_download_url;
      $('#heroMeta').textContent = `Windows 10·11 (64비트) · 설치 파일 ${formatSize(assets.setup.size)} · 계정 필요 없음`;
    }
  } catch {
    // Static fallbacks already point at the releases page.
  }
}

const os = detectOs();
applyOs(os);
loadRelease(os);
