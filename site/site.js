// Shared behaviour for every page of the product site: latest-release links,
// the screenshot tabs, the sticky header colour and the help finder.
const releaseApi = 'https://api.github.com/repos/dawith-ai/dawith-welfare-office/releases/latest';
const assetPatterns = { setup: /-Setup\.exe$/i, portable: /-Portable\.exe$/i };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatSize = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`;
const siteVersion = '0.9.6';
const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function detectOs() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const agent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(agent)) return 'mobile';
  if (platform.includes('win') || agent.includes('windows')) return 'windows';
  if (platform.includes('mac') || agent.includes('mac os')) return 'mac';
  if (platform.includes('linux') || agent.includes('linux')) return 'linux';
  return 'unknown';
}

function showOsNotice() {
  const notice = $('#osNotice');
  if (!notice) return;
  const messages = {
    mac: 'Mac을 쓰고 계시네요. Mac용은 아직 준비 중입니다. 지금은 Windows PC에서 설치해 주세요.',
    linux: 'Linux용은 아직 준비 중입니다. 지금은 Windows PC에서 설치해 주세요.',
    mobile: '휴대폰에서는 설치할 수 없습니다. 기관 PC(Windows)에서 이 페이지를 열어 주세요.',
  };
  const message = messages[detectOs()];
  if (!message) return;
  notice.textContent = message;
  notice.hidden = false;
}

async function loadRelease() {
  try {
    const response = await fetch(releaseApi, { headers: { accept: 'application/vnd.github+json' } });
    if (!response.ok) return;
    const release = await response.json();
    const version = release.tag_name?.replace(/^v/, '');
    // The page text describes siteVersion; never swap in an older release.
    if (!version || compareVersions(version, siteVersion) < 0) return;
    for (const [key, pattern] of Object.entries(assetPatterns)) {
      const asset = release.assets?.find((item) => pattern.test(item.name));
      if (!asset) continue;
      $$(`[data-asset="${key}"]`).forEach((link) => { link.href = asset.browser_download_url; });
      $$(`[data-file="${key}"]`).forEach((cell) => { cell.textContent = `${asset.name} (${formatSize(asset.size)})`; });
      if (key === 'setup') {
        const hero = $('#heroDownload');
        if (hero) hero.href = asset.browser_download_url;
        if ($('#heroSize')) $('#heroSize').textContent = formatSize(asset.size);
        if ($('[data-label="setup"]') && version) $('[data-label="setup"]').textContent = `Windows용 ${version} 내려받기`;
      }
    }
    if (version && $('#heroVersion')) $('#heroVersion').textContent = version;
    if (version && $('#releaseTag')) $('#releaseTag').textContent = `새 버전 ${version}`;
  } catch {
    // Static links already point at the releases page.
  }
}

function setupTabs() {
  const tabs = $$('.tab');
  if (!tabs.length) return;
  const select = (tab) => {
    tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
    $('#tabImage').src = `./assets/${tab.dataset.img}.jpg`;
    $('#tabImage').alt = tab.dataset.alt;
    $('#tabCaption').innerHTML = tab.dataset.caption;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
    new Image().src = `./assets/${tab.dataset.img}.jpg`;
  });
}

function setupNav() {
  const nav = $('#siteNav.on-dark');
  if (!nav) return;
  const hero = $('.hero');
  const update = () => nav.classList.toggle('scrolled', window.scrollY > hero.offsetHeight - 120);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// Answers come only from the help pages below; nothing typed here leaves the
// browser, so there is no server and no AI behind this panel.
const helpEntries = [
  { q: '정말 무료인가요?', k: '무료 비용 가격 요금 결제 유료 돈', a: '<p>네. 앱은 무료이고 기능 제한도 없습니다. AI도 로컬 AI(Ollama)나 이미 쓰는 구독, 무료 AI를 고르면 추가 비용이 없습니다.</p>', link: ['./#cost', '비용 자세히'] },
  { q: 'Mac에서도 쓸 수 있나요?', k: '맥 mac 애플 리눅스 linux 아이패드 휴대폰 모바일', a: '<p>지금은 Windows 10·11(64비트)만 지원합니다. Mac·Linux용은 준비 중이고, 나오면 업데이트 소식에 알립니다.</p>', link: ['./updates.html', '업데이트 소식'] },
  { q: '파란 경고 창이 떠요', k: '경고 pc 보호 smartscreen 스마트스크린 실행 차단 파란', a: '<p>“Windows의 PC 보호” 창에서 <b>추가 정보</b> → <b>실행</b>을 누르면 설치가 이어집니다. 아직 코드 서명 인증서가 없는 새 프로그램이라 나오는 안내입니다.</p>', link: ['./install.html#smartscreen', '그림으로 보기'] },
  { q: 'Edge에서 안 받아져요', k: 'edge 엣지 다운로드 안됨 유지 일반적으로', a: '<p>다운로드 목록에서 파일 옆 <b>…</b> → <b>유지</b>를 누르고, 한 번 더 <b>그래도 유지</b>를 누르세요.</p>', link: ['./install.html#edge', '그림으로 보기'] },
  { q: '스마트 앱 컨트롤이 막았어요', k: '스마트 앱 컨트롤 smart app control 안전하지 않을 차단', a: '<p>Windows 11의 스마트 앱 컨트롤은 서명되지 않은 프로그램을 막습니다. PC 보안 설정을 바꾸는 일이니 기관 PC라면 전산 담당자와 먼저 상의하세요.</p>', link: ['./install.html#smart-app-control', '자세히'] },
  { q: '받은 파일을 못 찾겠어요', k: '파일 찾기 다운로드 폴더 어디', a: '<p>파일 탐색기 왼쪽의 <b>다운로드</b> 폴더를 보세요. 브라우저에서 <kbd>Ctrl</kbd>+<kbd>J</kbd>를 누르면 받은 파일 목록이 열립니다.</p>', link: ['./install.html#find-file', '자세히'] },
  { q: '설치형과 포터블은 뭐가 다른가요?', k: '포터블 설치형 usb 차이 설치 없이', a: '<p>기능은 같습니다. 설치형은 시작 메뉴·바탕화면에 등록되고, 포터블은 설치 없이 파일을 더블클릭해 실행합니다. 설치 권한이 없는 PC에서는 포터블을 쓰세요.</p>', link: ['./install.html#portable', '자세히'] },
  { q: '인터넷이 안 되는 PC에서도 되나요?', k: '인터넷 오프라인 망분리 폐쇄망 내부망', a: '<p>됩니다. 설치 파일만 USB 등으로 옮기면 PDF·한글 양식·이미지·텍스트·계산·기록 초안이 모두 인터넷 없이 작동합니다.</p>', link: ['./faq.html#offline', '자세히'] },
  { q: '상담 기록이 밖으로 나가나요?', k: '개인정보 보안 서버 전송 유출 원문 저장 암호화', a: '<p>나가지 않습니다. 서버와 계정이 없고, 기록은 이 PC에 암호화해 저장합니다. 외부 AI는 직접 고르고 확인창에서 보낼 내용을 확인한 경우에만 그 회사로 보냅니다.</p>', link: ['./#privacy', '개인정보 자세히'] },
  { q: 'AI 없이도 쓸 수 있나요?', k: 'ai 없이 꺼도 안써도 규칙', a: '<p>네. 모든 기본 기능은 AI 없이 동작합니다. 상담 기록 초안도 기본은 규칙으로 만듭니다.</p>', link: ['./connect.html', 'AI 연결하기'] },
  { q: 'Claude·ChatGPT 구독은 어떻게 연결하나요?', k: 'claude 클로드 chatgpt 챗gpt codex 코덱스 gemini 제미나이 구독 연결 openrouter', a: '<p>앱의 <b>AI 보조·연결</b>에서 쓰던 구독을 고르면 됩니다. Claude·Codex는 공식 프로그램으로 로그인하고, ChatGPT·OpenRouter는 브라우저 로그인, Gemini는 키로 연결합니다.</p>', link: ['./connect.html', 'AI 연결하기'] },
  { q: '로컬 AI(Ollama)는 어떻게 쓰나요?', k: 'ollama 올라마 로컬 llm 모델 설치', a: '<p>앱의 <b>AI 보조·연결</b>에서 PC 사양을 확인하고, 안내대로 Ollama를 설치한 뒤 추천 모델을 준비하면 됩니다.</p>', link: ['./connect.html#local', '자세히'] },
  { q: '새 버전은 어떻게 받나요?', k: '업데이트 새 버전 갱신 덮어', a: '<p>이 사이트에서 최신 설치 파일을 받아 덮어 설치하면 됩니다. 저장해 둔 기록은 그대로 남습니다.</p>', link: ['./updates.html', '업데이트 소식'] },
  { q: '프로그램은 어떻게 지우나요?', k: '삭제 제거 언인스톨 지우기', a: '<p>Windows <b>설정 → 앱 → 설치된 앱</b>에서 Dawith Welfare Office를 찾아 <b>제거</b>를 누르세요. 포터블은 파일만 지우면 됩니다.</p>', link: ['./faq.html#uninstall', '자세히'] },
  { q: '한글(HWP) 파일을 고칠 수 있나요?', k: '한글 hwp hwpx 한컴 양식 편집', a: '<p>HWP·HWPX 양식을 열어 내용을 확인하고 {{기관명}} 같은 표식을 바꿀 수 있습니다. 한컴 한글처럼 자유롭게 편집하는 기능은 아직 없습니다.</p>', link: ['./faq.html#hwp', '자세히'] },
];

function setupAsk() {
  const launch = document.createElement('button');
  launch.className = 'ask-launch';
  launch.type = 'button';
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-controls', 'askPanel');
  launch.innerHTML = '<span aria-hidden="true">?</span> 궁금한 점 찾기';
  const panel = document.createElement('section');
  panel.className = 'ask-panel';
  panel.id = 'askPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '도움말에서 찾기');
  panel.innerHTML = `<div class="ask-head"><div><b>도움말에서 찾기</b><small>설치·AI 연결·쓰는 법을 도움말에서 찾아 드려요</small></div><button class="ask-close" type="button" aria-label="닫기">×</button></div><div class="ask-body"><div class="chips">${helpEntries.slice(0, 5).map((entry, index) => `<button type="button" data-help="${index}">${escapeHtml(entry.q)}</button>`).join('')}</div><div id="askAnswer" aria-live="polite"></div></div><form class="ask-form"><input id="askInput" type="text" placeholder="예: 경고 창, 포터블, 맥" autocomplete="off" aria-label="찾을 내용" /><button type="submit">찾기</button></form><p class="ask-foot">입력한 내용은 이 브라우저 밖으로 보내지 않습니다. 개인정보는 적지 마세요.</p>`;
  document.body.append(launch, panel);

  const render = (entries, query) => {
    const target = $('#askAnswer');
    if (!entries.length) {
      target.innerHTML = `<div class="ask-answer"><p>‘${escapeHtml(query)}’에 맞는 도움말을 찾지 못했어요.</p><p><a href="./faq.html">자주 묻는 질문 전체 보기</a> · <a href="https://github.com/dawith-ai/dawith-welfare-office/issues" target="_blank" rel="noreferrer">문제 알리기</a></p></div>`;
      return;
    }
    target.innerHTML = entries.slice(0, 2).map((entry) => `<div class="ask-answer"><b>${escapeHtml(entry.q)}</b>${entry.a}<a href="${entry.link[0]}">${entry.link[1]} →</a></div>`).join('');
  };
  const search = (query) => {
    const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
    const scored = helpEntries.map((entry) => {
      const haystack = `${entry.q} ${entry.k}`.toLowerCase();
      return { entry, score: words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0) };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    render(scored.map((item) => item.entry), query);
  };
  const toggle = (open) => {
    panel.hidden = !open;
    launch.setAttribute('aria-expanded', String(open));
    if (open) $('#askInput').focus();
  };
  launch.addEventListener('click', () => toggle(panel.hidden));
  $('.ask-close', panel).addEventListener('click', () => { toggle(false); launch.focus(); });
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { toggle(false); launch.focus(); } });
  $$('[data-help]', panel).forEach((button) => button.addEventListener('click', () => render([helpEntries[Number(button.dataset.help)]])));
  $('.ask-form', panel).addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#askInput').value.trim();
    if (query) search(query);
  });
}

showOsNotice();
loadRelease();
setupTabs();
setupNav();
setupAsk();
