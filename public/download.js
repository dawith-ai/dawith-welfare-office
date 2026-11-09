// Fills download links from the latest GitHub release so this page never needs
// editing per version. Without network access the static links to the releases
// page still work.
const releaseApi = 'https://api.github.com/repos/dawith-ai/dawith-welfare-office/releases/latest';
const assetPatterns = { setup: /-Setup\.exe$/i, portable: /-Portable\.exe$/i, mac: /\.dmg$/i };

function detectOs() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const agent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(agent)) return 'mobile';
  if (platform.includes('win') || agent.includes('windows')) return 'windows';
  if (platform.includes('mac') || agent.includes('mac os')) return 'mac';
  if (platform.includes('linux') || agent.includes('linux')) return 'linux';
  return 'unknown';
}

const formatSize = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`;

function applyOs(os) {
  const primary = document.querySelector('#primaryDownload');
  const notice = document.querySelector('#osNotice');
  const messages = {
    mac: 'Mac을 쓰고 계시네요. Mac용 설치 파일은 준비 중이라 지금은 웹 버전을 권합니다.',
    linux: 'Linux용 설치 파일은 아직 없습니다. 웹 버전에서 같은 도구를 쓸 수 있습니다.',
    mobile: '휴대폰에서는 설치할 수 없습니다. PC에서 이 페이지를 열거나 웹 버전을 쓰세요.',
  };
  if (!messages[os]) return;
  primary.textContent = '웹 버전 바로 열기';
  primary.href = './';
  const secondary = document.querySelector('#secondaryDownload');
  secondary.textContent = 'Windows용 파일 보기';
  secondary.href = '#platforms';
  notice.textContent = messages[os];
  notice.hidden = false;
  document.querySelector(`.dl-card[data-platform="${os === 'mac' ? 'mac' : 'web'}"]`)?.classList.add('dl-card-main');
  document.querySelector('.dl-card[data-platform="windows"] .dl-tag')?.remove();
  document.querySelector('.dl-card-main[data-platform="windows"]')?.classList.remove('dl-card-main');
}

async function loadRelease(os) {
  const meta = document.querySelector('#primaryMeta');
  try {
    const response = await fetch(releaseApi, { headers: { accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`release_${response.status}`);
    const release = await response.json();
    const assets = {};
    for (const [key, pattern] of Object.entries(assetPatterns)) assets[key] = release.assets?.find((asset) => pattern.test(asset.name));
    for (const [key, asset] of Object.entries(assets)) {
      if (!asset) continue;
      document.querySelectorAll(`[data-asset="${key}"]`).forEach((link) => { link.href = asset.browser_download_url; });
      document.querySelectorAll(`[data-size="${key}"]`).forEach((cell) => { cell.textContent = formatSize(asset.size); });
    }
    if (assets.mac) {
      document.querySelector('[data-asset="mac"]').textContent = 'Mac용 내려받기';
      document.querySelector('[data-size="mac"]').closest('div').querySelector('dt').textContent = '크기';
    }
    const version = release.tag_name?.replace(/^v/, '') || '';
    if (os === 'windows' || os === 'unknown') {
      if (assets.setup) document.querySelector('#primaryDownload').href = assets.setup.browser_download_url;
      meta.innerHTML = `<span class="dot"></span> Windows 10·11 (64비트) · 버전 ${version}${assets.setup ? ` · ${formatSize(assets.setup.size)}` : ''}`;
    } else {
      meta.innerHTML = `<span class="dot"></span> 최신 버전 ${version} · 설치 없이 웹에서도 사용 가능`;
    }
  } catch {
    meta.innerHTML = '<span class="dot"></span> Windows 10·11 (64비트) · 버튼을 누르면 최신 버전 목록으로 이동합니다';
    if (os === 'windows' || os === 'unknown') document.querySelector('#primaryDownload').href = 'https://github.com/dawith-ai/dawith-welfare-office/releases/latest';
  }
}

const os = detectOs();
applyOs(os);
loadRelease(os);
