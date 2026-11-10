let PDFDocument;
let pdfLibPromise;

const toolCatalog = [
  { id: 'pdf-merge', category: 'document', mark: 'PDF', name: 'PDF 합치기', description: '여러 개의 PDF를 한 파일로 묶습니다.', keywords: 'pdf 병합 붙임서류 합치기', label: 'DOCUMENT' },
  { id: 'pdf-split', category: 'document', mark: 'PDF', name: 'PDF 나누기', description: '필요한 페이지만 추출하거나 낱장으로 나눕니다.', keywords: 'pdf 분할 페이지 추출', label: 'DOCUMENT' },
  { id: 'document-convert', category: 'document', mark: 'CONV', name: '문서 형식 변환', description: 'TXT·Markdown·HTML·CSV 파일을 서로 바꿔 저장합니다.', keywords: '변환 확장자 txt markdown md html csv 문서 파일 형식', label: 'CONVERSION' },
  { id: 'hwp-inspector', category: 'document', mark: 'HWP', name: '한글 양식 확인', description: 'HWP·HWPX 기관 양식을 이 기기에서 열고 내용을 확인합니다.', keywords: '한글 hwp hwpx hml 양식 문서 텍스트 추출', label: 'DOCUMENT' },
  { id: 'template-studio', category: 'document', mark: 'FORM', name: '기관 문서 양식', description: '기관명·담당자를 저장해 회의록·계획서 머리말을 자동으로 채웁니다.', keywords: '기관 양식 사업계획서 결과보고서 회의록 문서 초안 템플릿 머리말 기관명 담당자', label: 'DOCUMENT TEMPLATE' },
  { id: 'image-resize', category: 'image', mark: 'IMG', name: '이미지 크기 조절', description: '게시판·보고서 규격에 맞춰 크기를 바꿉니다.', keywords: '이미지 사진 크기 리사이즈', label: 'IMAGE' },
  { id: 'image-compress', category: 'image', mark: 'IMG', name: '이미지 용량 줄이기', description: '화질을 보면서 파일 크기를 줄입니다.', keywords: '이미지 사진 압축 용량', label: 'IMAGE' },
  { id: 'image-privacy', category: 'image', mark: 'SAFE', name: '사진 정보 지우기', description: '사진 속 위치·촬영정보를 제거해 새 파일로 저장합니다.', keywords: '이미지 사진 개인정보 exif 메타데이터 보안', label: 'IMAGE' },
  { id: 'image-rotate', category: 'image', mark: '↻', name: '이미지 회전·자르기', description: '가로세로 방향을 바꾸고 필요한 영역만 남깁니다.', keywords: '이미지 사진 회전 자르기 crop', label: 'IMAGE' },
  { id: 'text-tools', category: 'text', mark: 'TXT', name: '텍스트 정리', description: '공백 정리와 개인정보 가리기를 처리합니다.', keywords: '텍스트 개인정보 마스킹 정규식 문장', label: 'TEXT' },
  { id: 'age-calculator', category: 'calculator', mark: 'AGE', name: '만나이 계산기', description: '서비스 기준 확인에 필요한 만나이를 계산합니다.', keywords: '만나이 생년월일 연령 아동 청소년', label: 'CALCULATOR' },
  { id: 'money-converter', category: 'calculator', mark: '₩', name: '금액 한글 변환', description: '지출결의서 금액을 한글 표기로 바꿉니다.', keywords: '금액 숫자 한글 원 지출결의서', label: 'CALCULATOR' },
  { id: 'date-calculator', category: 'calculator', mark: 'D+', name: '날짜·기간 계산', description: '두 날짜 사이 기간과 기준일을 계산합니다.', keywords: '날짜 기간 일수 d-day', label: 'CALCULATOR' },
  { id: 'attendance', category: 'field', mark: '✓', name: '인원 체크', description: '식사·프로그램 명단을 로컬에서 체크하고 CSV로 저장합니다.', keywords: '인원 출석 신규 종결 대기 수령 명단 현황 csv', label: 'FIELD' },
  { id: 'duty-schedule', category: 'field', mark: 'CAL', name: '당직 일정', description: '직원 순서를 기준으로 당직표를 만들고 CSV로 저장합니다.', keywords: '당직 근무 일정 스케줄 직원 배치 csv', label: 'FIELD' },
  { id: 'case-record', category: 'field', mark: 'LOG', name: '상담 기록·회의록 정리', description: '메모를 상담 기록(개요·호소·사정·개입·계획)과 회의록(결정 사항·할 일)으로 정리합니다.', keywords: '상담기록 상담일지 상담 내용 정리 회의록 사례회의 사례관리 기록 요약 결정사항 할일 조치사항 로컬 ai ollama 클라우드 claude chatgpt gemini codex openrouter', label: 'RECORD · MINUTES', aiMode: 'choice' },
  { id: 'genogram', category: 'diagram', mark: 'GENO', name: '가계도 편집', description: '생성형 결과에 의존하지 않고 직접 수정하는 가계도 편집기입니다.', keywords: '가계도 genogram 가족관계 mcgoldrick svg pdf json 개인정보', label: 'RELATIONSHIP MAP', aiMode: 'local-optional' },
  { id: 'ecomap', category: 'diagram', mark: 'ECO', name: '생태도 편집', description: '가구와 기관·자원을 직접 배치하고 관계 강도를 표시합니다.', keywords: '생태도 ecomap 자원망 사회적지지 기관관계 svg json', label: 'RELATIONSHIP MAP', aiMode: 'local-optional' },
  { id: 'ai-setup', category: 'ai', mark: 'AI', name: 'AI 보조·연결 센터', description: '로컬·구독·무료 AI를 직접 고르고 연결합니다.', keywords: 'ollama 로컬 llm ai 모델 다운로드 상담 회의록 문서 claude codex chatgpt openrouter gemini 구독', label: 'AI CONTROL' },
];

const categoryInfo = {
  document: { label: 'DOCUMENT · CONVERSION', title: '문서·변환', copy: 'PDF 합치기·나누기, 한글(HWP) 양식 확인, 파일 형식 변환과 기관 문서 초안을 한곳에서 처리합니다.' },
  image: { label: 'IMAGE', title: '이미지', copy: '게시판·보고서용 사진의 크기와 용량을 맞추고, 위치·촬영 정보 같은 개인정보를 지웁니다.' },
  text: { label: 'TEXT', title: '텍스트', copy: '상담 기록의 공백과 줄바꿈을 정리하고, 이름·연락처 같은 개인정보를 가립니다.' },
  calculator: { label: 'CALCULATOR', title: '계산·변환', copy: '만나이, 금액 한글 표기, 날짜·기간을 바로 계산합니다.' },
  field: { label: 'FIELD', title: '현장 관리', copy: '인원 체크, 당직 일정, 상담·회의 기록처럼 매일 반복되는 현장 업무를 정리합니다.' },
  diagram: { label: 'RELATIONSHIP MAP', title: '관계도', copy: '가계도와 생태도를 직접 그리고 고쳐 사례회의 자료로 씁니다.' },
  ai: { label: 'AI CONTROL', title: 'AI 보조·연결', copy: '로컬 LLM이나 구독형 AI를 직접 골라 연결하고, 연결 상태를 확인합니다.' },
};

const state = { category: 'all', search: '', activeTool: null, pdfFiles: [], imageFile: null, imageUrl: '', imageInfo: null, textMode: 'mask' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const providerLabel = (provider) => ({ 'claude-code': 'Claude', codex: 'Codex', 'gemini-cli': 'Gemini CLI', chatgpt: 'ChatGPT', openrouter: 'OpenRouter', gemini: 'Gemini' }[provider] || provider);
const formatBytes = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`;
const aiModeLabel = (tool, fallback) => tool.aiMode === 'choice' ? '규칙 · 로컬 AI · 클라우드 AI 선택' : tool.aiMode === 'local-optional' ? '로컬 AI 선택' : fallback;
const formatDate = (date) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(date);

function ensurePdfLib() {
  if (PDFDocument) return Promise.resolve(PDFDocument);
  if (!pdfLibPromise) pdfLibPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/pdf-lib.min.js';
    script.onload = () => { PDFDocument = globalThis.PDFLib?.PDFDocument; PDFDocument ? resolve(PDFDocument) : reject(new Error('PDF 모듈을 불러오지 못했습니다.')); };
    script.onerror = () => reject(new Error('PDF 모듈을 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
  return pdfLibPromise;
}

function saveRecent(toolId) {
  try {
    const recent = JSON.parse(localStorage.getItem('dawith-tool-recent') || '[]').filter((id) => id !== toolId);
    localStorage.setItem('dawith-tool-recent', JSON.stringify([toolId, ...recent].slice(0, 5)));
    renderRecentTools();
  } catch { /* localStorage may be unavailable in private mode */ }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function toolHeader(tool, title = tool.name, description = tool.description, { nav = '● 이 기기에서만 처리', mark = '외부 전송 없음' } = {}) {
  return `<div class="workspace-nav"><button class="back-button" data-action="home" type="button">← 도구 목록</button><span class="local-note">${nav}</span></div><header class="workspace-header"><div><p class="overline">${tool.label}</p><h1>${title}</h1><p>${description}</p></div><div class="workspace-mark"><b>${tool.mark}</b>${mark}</div></header>`;
}

function renderToolGrid() {
  const query = state.search.trim().toLowerCase();
  const visible = toolCatalog.filter((tool) => (state.category === 'all' || tool.category === state.category) && (!query || `${tool.name} ${tool.description} ${tool.keywords}`.toLowerCase().includes(query)));
  $('#toolCount').textContent = `도구 ${visible.length}개`;
  renderHomeLayout(visible.length);
  $('#toolGrid').innerHTML = visible.length ? visible.map((tool) => `<button class="tool-card" data-tool="${tool.id}" data-category="${tool.category}" type="button"><span class="tool-card-mark">${tool.mark}</span><span><b>${tool.name}</b><small>${tool.description}</small><em class="tool-card-ai">${aiModeLabel(tool, 'AI 불필요')}</em></span><span class="tool-card-arrow">→</span></button>`).join('') : '<p class="muted-text" style="grid-column:1/-1;padding:24px 0">찾는 도구가 없습니다. 다른 단어로 검색해보세요.</p>';
}

// The landing blocks only make sense on the start screen; a category or search
// should put the matching tools directly under the header so the change is visible.
function renderHomeLayout(count) {
  const info = categoryInfo[state.category];
  const query = state.search.trim();
  const isLanding = !info && !query;
  $$('[data-home-only]').forEach((element) => { element.hidden = Boolean(info) || (Boolean(query) && !element.classList.contains('hero-row')); });
  $('#categoryHeader').hidden = !info;
  if (info) {
    $('#categoryOverline').textContent = info.label;
    $('#categoryTitle').textContent = info.title;
    $('#categoryCopy').textContent = info.copy;
  }
  $('#toolSearch').placeholder = info ? `${info.title} 도구 안에서 찾기…` : '상담 기록, PDF 변환, 개인정보…';
  $('#directoryHeading').hidden = Boolean(info) && !query;
  $('#directoryTitle').textContent = query ? `‘${query}’ 검색 결과 ${count}개` : '필요한 것만 골라 쓰세요.';
  $('#directoryNote').hidden = !isLanding;
  if (!isLanding) $('#recentToolsSection').hidden = true;
}

function syncCategoryNav(category) {
  $$('.category-button').forEach((item) => {
    const active = item.dataset.category === category;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
}

function renderRecentTools() {
  const section = $('#recentToolsSection');
  const target = $('#recentTools');
  if (!section || !target) return;
  if (state.category !== 'all' || state.search.trim()) { section.hidden = true; return; }
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem('dawith-tool-recent') || '[]'); } catch { recent = []; }
  const tools = recent.map((id) => toolCatalog.find((tool) => tool.id === id)).filter(Boolean);
  section.hidden = !tools.length;
  target.innerHTML = tools.map((tool) => `<button class="recent-tool" data-tool="${tool.id}" type="button"><span>${tool.mark}</span><b>${tool.name}</b><small>${aiModeLabel(tool, '기기 안에서 처리')}</small></button>`).join('');
}

function showHome() {
  state.activeTool = null;
  $('#homeView').classList.remove('hidden');
  $('#workspaceView').classList.add('hidden');
  $('#workspaceMount').innerHTML = '';
  syncCategoryNav(state.category);
  renderToolGrid();
  renderRecentTools();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTool(toolId) {
  const tool = toolCatalog.find((item) => item.id === toolId);
  if (!tool) return;
  state.activeTool = toolId;
  saveRecent(toolId);
  syncCategoryNav(tool.category);
  $('#homeView').classList.add('hidden');
  $('#workspaceView').classList.remove('hidden');
  $('#workspaceMount').innerHTML = renderWorkspace(tool);
  bindWorkspace(toolId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderWorkspace(tool) {
  if (tool.id === 'pdf-merge') return `${toolHeader(tool, 'PDF를 한 파일로 묶기', '붙임 서류 순서를 확인하고 하나의 PDF로 저장합니다.')}<div class="tool-layout pdf-layout"><section class="tool-panel"><div class="panel-heading"><div><h2>파일 순서</h2><p>위에서 아래 순서로 합쳐집니다.</p></div><span id="pdfSummary" class="muted-text">0개</span></div><div id="pdfDropzone" class="dropzone" data-pdf-drop><div><span class="dropzone-mark">+</span><b>PDF 파일을 놓으세요</b><p>여러 파일을 한 번에 선택해도 됩니다.</p><label class="file-button"><input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple />파일 선택</label></div></div><div id="pdfFileList" class="file-list"></div><div id="pdfNotice"></div></section><aside class="tool-panel"><div class="panel-heading"><div><h2>저장</h2><p>원본은 바뀌지 않습니다.</p></div></div><div class="side-list"><div><span>필요한 파일</span><b>2개 이상</b></div><div><span>처리 위치</span><b>이 기기</b></div><div><span>결과 형식</span><b>PDF</b></div></div><div class="control-group" style="margin-top:24px"><label for="pdfOutputName">저장할 이름</label><input id="pdfOutputName" class="wide-input" value="복지관_붙임서류" /></div><div class="tool-actions"><button id="pdfMergeButton" class="primary-button" type="button" disabled>PDF 합치기 →</button></div><div class="side-tip"><b>작업 팁</b><p>파일 이름 앞에 01, 02를 붙여두면 순서를 확인하기 쉽습니다.</p></div></aside></div>`;
  if (tool.id === 'pdf-split') return `${toolHeader(tool, 'PDF에서 필요한 페이지만 꺼내기', '페이지 번호를 입력하면 새 PDF로 저장합니다.')}<div class="tool-layout pdf-layout"><section class="tool-panel"><div class="panel-heading"><div><h2>원본 PDF</h2><p>한 파일만 선택합니다.</p></div><span id="splitPdfSummary" class="muted-text">선택 전</span></div><div id="splitDropzone" class="dropzone" data-split-drop><div><span class="dropzone-mark">↓</span><b>PDF 파일을 놓으세요</b><p>예: 1-3, 5, 8-10</p><label class="file-button"><input id="splitPdfInput" type="file" accept="application/pdf,.pdf" />파일 선택</label></div></div><div id="splitFileList" class="file-list"></div><div id="splitNotice"></div></section><aside class="tool-panel"><div class="panel-heading"><div><h2>페이지 선택</h2><p>원본 페이지 번호 기준입니다.</p></div></div><div class="control-group" style="margin-top:22px"><label for="splitRange">추출할 페이지</label><input id="splitRange" class="wide-input" placeholder="예: 1-3, 5" /></div><div class="control-group" style="margin-top:16px"><label for="splitOutputName">저장할 이름</label><input id="splitOutputName" class="wide-input" value="필요페이지_추출" /></div><div class="tool-actions"><button id="splitButton" class="primary-button" type="button" disabled>페이지 추출 →</button></div><div class="side-tip"><b>작업 팁</b><p>페이지를 비워두면 전체 페이지를 새 파일로 다시 저장합니다.</p></div></aside></div>`;
  if (tool.id === 'document-convert') return renderDocumentConvertWorkspace(tool);
  if (tool.id === 'hwp-inspector') return renderHwpWorkspace(tool);
  if (tool.id === 'template-studio') return renderTemplateStudio(tool);
  if (tool.id === 'image-resize' || tool.id === 'image-compress' || tool.id === 'image-privacy' || tool.id === 'image-rotate') return renderImageWorkspace(tool);
  if (tool.id === 'text-tools') return renderTextWorkspace(tool);
  if (tool.id === 'age-calculator') return renderAgeWorkspace(tool);
  if (tool.id === 'money-converter') return renderMoneyWorkspace(tool);
  if (tool.id === 'date-calculator') return renderDateWorkspace(tool);
  if (tool.id === 'attendance') return renderAttendanceWorkspace(tool);
  if (tool.id === 'duty-schedule') return renderDutyWorkspace(tool);
  if (tool.id === 'case-record') return renderCaseRecordWorkspace(tool);
  if (tool.id === 'genogram' || tool.id === 'ecomap') return renderDiagramWorkspace(tool);
  if (tool.id === 'ai-setup') return renderAiSetup(tool);
  return '';
}

function renderDocumentConvertWorkspace(tool) {
  return `${toolHeader(tool, '문서 형식을 바꿔 저장하기', '간단한 문서 파일은 이 PC에서 바로 변환합니다. 원본 파일은 바뀌지 않습니다.')}<div class="tool-layout convert-layout"><section class="tool-panel"><div class="panel-heading"><div><h2>변환할 파일</h2><p>TXT·Markdown·HTML·CSV·JSON 텍스트 파일을 지원합니다.</p></div><span id="convertFileSummary" class="muted-text">선택 전</span></div><div id="convertDropzone" class="dropzone"><div><span class="dropzone-mark">↔</span><b>파일을 놓으세요</b><p>파일 내용은 브라우저 메모리에서만 읽습니다.</p><label class="file-button"><input id="convertInput" type="file" accept=".txt,.md,.markdown,.html,.htm,.csv,.json,text/plain,text/markdown,text/html,text/csv,application/json" />파일 선택</label></div></div><div id="convertNotice"></div><label class="preview-label" for="convertPreview">미리보기</label><pre id="convertPreview" class="convert-preview">파일을 선택하면 변환 전 내용이 표시됩니다.</pre></section><aside class="tool-panel"><div class="panel-heading"><div><h2>저장 형식</h2><p>기관 내부 공유에 맞는 확장자를 고르세요.</p></div></div><div class="control-group"><label for="convertFormat">변환 형식</label><select id="convertFormat" class="wide-input"><option value="txt">일반 텍스트 (.txt)</option><option value="md">Markdown (.md)</option><option value="html">웹 문서 (.html)</option><option value="csv">표 데이터 (.csv)</option></select></div><div class="control-group"><label for="convertOutputName">저장할 이름</label><input id="convertOutputName" class="wide-input" placeholder="예: 사례회의_공유본" /></div><div class="side-list"><div><span>처리 위치</span><b>이 기기</b></div><div><span>원본 파일</span><b>변경하지 않음</b></div><div><span>지원 범위</span><b>텍스트 계열</b></div></div><div class="tool-actions"><button id="convertButton" class="primary-button" type="button" disabled>변환해 저장 →</button></div><div class="side-tip"><b>HWPX·DOCX·PDF</b><p>기관 양식과 PDF는 각각 한글 양식 확인, PDF 도구에서 원본 구조를 보존해 처리하세요.</p></div></aside></div>`;
}

function renderImageWorkspace(tool) {
  const resize = tool.id === 'image-resize';
  const compress = tool.id === 'image-compress';
  const privacy = tool.id === 'image-privacy';
  const rotate = tool.id === 'image-rotate';
  const title = resize ? '이미지 크기를 맞추기' : compress ? '이미지 용량을 가볍게' : privacy ? '사진 속 정보를 지우기' : '이미지 방향과 영역 정리';
  const description = resize ? '기관 게시판과 보고서에 맞는 픽셀 크기로 저장합니다.' : compress ? '파일을 올리지 않고 이 기기에서 바로 압축합니다.' : privacy ? '사진을 다시 그려 위치·촬영정보 같은 메타데이터를 제거합니다.' : '사진을 90도 단위로 돌리고 필요한 영역만 남깁니다.';
  const controls = resize ? '<div class="control-inline"><div class="control-group"><label for="imageWidth">가로 px</label><input id="imageWidth" type="number" min="1" /></div><div class="control-group"><label for="imageHeight">세로 px</label><input id="imageHeight" type="number" min="1" /></div></div><label class="option-line"><input id="imageKeepRatio" type="checkbox" checked /> 비율 유지</label>' : compress ? '<div class="control-group"><label for="imageQuality">품질 <output id="imageQualityValue">80%</output></label><div class="range-line"><input id="imageQuality" type="range" min="10" max="100" value="80" /><output id="imageQualityValue2">80</output></div></div>' : rotate ? '<div class="control-group"><label for="imageRotation">회전 방향</label><select id="imageRotation"><option value="90">오른쪽 90°</option><option value="180">180°</option><option value="270">왼쪽 90°</option></select></div><div class="control-group"><label for="imageCrop">자르기 여백(px)</label><input id="imageCrop" type="number" min="0" value="0" /><small class="field-hint">네 방향에서 같은 만큼 잘라냅니다.</small></div>' : '<div class="privacy-check"><b>제거되는 정보</b><span>GPS 위치 · 촬영일시 · 기기명 · 카메라 설정</span></div><p class="field-hint">사진 안에 보이는 이름표·얼굴·주소는 별도 편집이 필요합니다.</p>';
  return `${toolHeader(tool, title, description)}<div class="tool-layout image-layout"><section class="tool-panel flush"><div id="imagePreview" class="image-preview empty">이미지를 선택하면 여기에 미리보기가 나타납니다.</div><div class="tool-actions image-actions"><label class="file-button"><input id="imageInput" type="file" accept="image/*" />이미지 선택</label><button id="imageReset" class="secondary-button" type="button">다시 선택</button><button id="imageDownload" class="primary-button" type="button" disabled>${privacy ? '정보 제거 후 저장 →' : '다운로드 →'}</button></div></section><aside class="tool-panel"><div class="panel-heading"><div><h2>${resize ? '크기 설정' : compress ? '압축 설정' : privacy ? '개인정보 보호' : '편집 설정'}</h2><p id="imageMeta">먼저 이미지를 선택하세요.</p></div></div><div class="image-controls">${controls}${!privacy && !rotate ? '<div class="control-group"><label for="imageFormat">저장 형식</label><select id="imageFormat"><option value="image/jpeg">JPG · 작은 용량</option><option value="image/png">PNG · 선명한 선</option><option value="image/webp">WEBP · 웹 게시</option></select></div>' : privacy ? '<div class="control-group"><label for="imageFormat">저장 형식</label><select id="imageFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></div>' : '<div class="control-group"><label for="imageFormat">저장 형식</label><select id="imageFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WEBP</option></select></div>'}</div><div id="imageNotice" class="notice" hidden>이미지를 선택하면 처리할 수 있습니다.</div></aside></div>`;
}

function renderTextWorkspace(tool) {
  return `${toolHeader(tool, '텍스트를 정리하고 가리기', '치환·마스킹·목록 정리를 이 기기에서 바로 처리합니다.')}<div class="tool-layout text-layout text-tool-layout"><section class="tool-panel text-editor"><div class="panel-heading"><div><h2>원문</h2><p>상담 메모나 문장을 붙여 넣으세요.</p></div><span id="textCount" class="muted-text">0자</span></div><div class="text-toolbar"><button class="tool-chip active" data-text-mode="mask" type="button">개인정보 마스킹</button><button class="tool-chip" data-text-mode="replace" type="button">찾아 바꾸기</button><button class="tool-chip" data-text-mode="clean" type="button">공백 정리</button><button class="tool-chip" data-text-mode="number" type="button">목록 정리</button><button class="tool-chip" data-text-mode="plain" type="button">서식 지우기</button></div><div id="maskOptions" class="text-options"><div class="text-options-heading"><b>가릴 항목</b><span>필요한 것만 선택</span></div><div class="text-option-list"><label><input id="maskResident" type="checkbox" checked /> 주민등록번호</label><label><input id="maskPhone" type="checkbox" checked /> 전화번호</label><label><input id="maskEmail" type="checkbox" checked /> 이메일</label><label><input id="maskAccount" type="checkbox" checked /> 계좌번호</label></div></div><div id="replaceOptions" class="text-options hidden"><div class="text-options-heading"><b>찾아 바꾸기</b><span>입력 즉시 적용</span></div><div class="replace-grid"><label>찾을 내용<input id="replaceFind" type="text" placeholder="예: 홍길동" /></label><label>바꿀 내용<input id="replaceWith" type="text" placeholder="예: 대상자" /></label></div><label class="text-check"><input id="replaceIgnoreCase" type="checkbox" /> 대소문자 구분 없이 바꾸기</label></div><textarea id="textInput" placeholder="여기에 텍스트를 붙여 넣으세요."></textarea><div class="text-footer"><span id="textPrivacy">입력 내용은 이 기기 안에서만 처리됩니다.</span><button id="textClear" class="icon-text-button" type="button">지우기</button></div></section><section class="tool-panel text-result"><div class="panel-heading"><div><h2>결과</h2><p id="textResultLabel">개인정보 마스킹 결과</p></div><div class="panel-actions"><button id="textAiAssist" class="secondary-button" type="button">로컬 AI로 다듬기</button><button id="textSubscriptionAssist" class="secondary-button external-ai-button" type="button">구독 AI 사용</button><button id="textCopy" class="secondary-button" type="button">복사</button></div></div><div id="textOutput" class="result-content empty">원문을 입력하면 결과가 여기에 표시됩니다.</div><div class="text-result-meta"><span id="textResultCount">결과 0자</span><span id="textResultBytes">UTF-8 0 byte</span></div><div class="tool-actions"><button id="textAiApply" class="secondary-button hidden" type="button">AI 결과를 원문에 적용</button><button id="textDownload" class="primary-button" type="button" disabled>TXT로 저장 →</button></div></section></div>`;
}

function renderAgeWorkspace(tool) {
  return `${toolHeader(tool, '만나이를 바로 확인하기', '생년월일 8자리만 입력하면 마우스 없이 즉시 계산합니다.')}<div class="tool-layout calculator-layout"><section class="calculator-card"><h2>기준일의 나이</h2><p>날짜를 <b>YYYYMMDD</b> 형식으로 입력하세요. 입력하는 즉시 결과가 바뀝니다.</p><div class="control-group"><label for="birthDate">생년월일</label><input id="birthDate" type="text" inputmode="numeric" autocomplete="bday" maxlength="10" class="wide-input date-typing-input" placeholder="예: 20100510" /></div><div class="control-group" style="margin-top:14px"><label for="asOfDate">기준일</label><div class="input-with-action"><input id="asOfDate" type="text" inputmode="numeric" maxlength="10" class="wide-input date-typing-input" /><button id="ageToday" class="secondary-button" type="button">오늘</button></div></div><p class="field-hint">하이픈·점 없이 숫자 8자리만 입력해도 됩니다.</p><div class="tool-actions"><button id="ageCalculate" class="secondary-button" type="button">다시 계산</button></div><div id="ageResult" class="calculator-result"><span class="result-label">생년월일을 입력하면 결과가 표시됩니다.</span></div></section><section class="calculator-reference"><h3>현장에서 자주 확인하는 구간</h3><div class="reference-row"><b>만 0–6세</b><span>영유아 돌봄·양육 지원 기준을 확인할 때</span></div><div class="reference-row"><b>만 7–12세</b><span>초등 방과후·학습 지원 대상 확인</span></div><div class="reference-row"><b>만 13–18세</b><span>청소년 상담·자립 준비 지원 확인</span></div><div class="reference-row"><b>만 19세 이상</b><span>성인 서비스 및 자립 지원 기준 확인</span></div><p class="muted-text" style="margin-top:16px">기관별 사업 지침이 우선입니다. 계산 결과는 대상 여부를 판단하는 참고값으로 사용하세요.</p></section></div>`;
}

function renderMoneyWorkspace(tool) {
  return `${toolHeader(tool, '금액을 한글로 바꾸기', '지출결의서와 공문서에 들어갈 금액 표기를 확인합니다.')}<div class="tool-layout calculator-layout"><section class="calculator-card"><h2>금액 입력</h2><p>숫자만 입력해도 천 단위 구분과 한글 표기를 함께 보여줍니다.</p><div class="control-group"><label for="moneyInput">금액</label><input id="moneyInput" class="wide-input" inputmode="numeric" placeholder="예: 1250000" /></div><div id="moneyResult" class="calculator-result"><span class="result-label">결과가 여기에 표시됩니다.</span></div><div class="tool-actions"><button id="moneyCopy" class="secondary-button" type="button" disabled>결과 복사</button></div></section><section class="calculator-reference"><h3>표기 예시</h3><div class="reference-row"><b>1,250,000원</b><span>금 일백이십오만원정</span></div><div class="reference-row"><b>30,000원</b><span>금 삼만원정</span></div><div class="reference-row"><b>0원</b><span>금 영원정</span></div><p class="muted-text" style="margin-top:16px">최종 결재 문서의 기관 양식과 숫자를 한 번 더 대조하세요.</p></section></div>`;
}

function renderDateWorkspace(tool) {
  return `${toolHeader(tool, '날짜와 기간을 계산하기', '상담 후속일, 사업 기간, 마감일을 빠르게 확인합니다.')}<div class="tool-layout calculator-layout"><section class="calculator-card"><h2>두 날짜 사이</h2><p>시작일과 종료일을 입력하면 기간을 계산합니다.</p><div class="control-group"><label for="dateStart">시작일</label><input id="dateStart" type="date" class="wide-input" /></div><div class="control-group" style="margin-top:14px"><label for="dateEnd">종료일</label><input id="dateEnd" type="date" class="wide-input" /></div><div id="dateResult" class="calculator-result"><span class="result-label">결과가 여기에 표시됩니다.</span></div></section><section class="calculator-reference"><h3>후속 일정에 활용하세요</h3><div class="reference-row"><b>상담 후 7일</b><span>초기 안부 확인·서류 보완 일정</span></div><div class="reference-row"><b>상담 후 30일</b><span>서비스 연계 및 변화 점검 일정</span></div><div class="reference-row"><b>사업 기간</b><span>시작일과 종료일을 모두 포함할지 기관 기준을 확인</span></div></section></div>`;
}

function renderAiSetup(tool) {
  return `${toolHeader(tool, 'AI 보조 연결 센터', '로컬·내 구독·무료 연결 중 처리 위치를 먼저 고릅니다.')}<div class="ai-control-layout"><section class="tool-panel ai-setup-main"><div class="panel-heading"><div><h2>이 PC 안에서 처리</h2><p>Ollama 로컬 모델은 상담 원문을 외부로 보내지 않습니다.</p></div><span id="aiSetupStatus" class="local-note">확인 전</span></div><div class="ai-device-summary"><div><span>현재 기기</span><b id="aiSystemSpec">확인 중…</b></div><div><span>추천 모델</span><b id="aiRecommendation">확인 중…</b></div></div><ol class="ai-setup-steps"><li><span>1</span><div><b>Ollama 설치</b><small>공식 설치 파일을 한 번 설치하고 실행합니다.</small></div><a id="aiInstallLink" href="https://ollama.com/download" target="_blank" rel="noreferrer">공식 설치 열기 ↗</a></li><li><span>2</span><div><b>연결 확인</b><small>현재 PC의 RAM·CPU를 읽어 모델을 추천합니다.</small></div><button id="aiRefresh" class="secondary-button" type="button">상태 다시 확인</button></li><li><span>3</span><div><b>추천 모델 준비</b><small id="aiModelHelp">모델이 없으면 규칙 기반 기능만으로도 계속 사용할 수 있습니다.</small></div><div class="ai-model-action"><select id="aiModelSelect" class="wide-input" aria-label="로컬 AI 모델 선택"></select><button id="aiPullModel" class="primary-button" type="button" disabled>모델 준비</button></div></li></ol><div id="aiSetupNotice" class="notice" hidden></div><div class="ai-privacy-note"><b>처리 경계</b><span>상담 원문·문서 내용은 Dawith 서버나 외부 AI로 자동 전송하지 않습니다.</span><span>모델 다운로드 때만 Ollama 공식 저장소와 통신합니다.</span><span>외부 provider는 연결·전송 버튼을 누른 경우에만 사용합니다.</span></div></section><section class="tool-panel subscription-panel"><div class="panel-heading"><div><h2>내 AI 연결</h2><p>Claude·Codex·ChatGPT 구독과 OpenRouter·Gemini 무료 연결을 직접 선택합니다.</p></div><button id="subscriptionRefresh" class="secondary-button" type="button">상태 확인</button></div><div class="subscription-warning"><b>외부 전송은 별도 연결 동의가 필요합니다.</b><span>선택한 텍스트만 해당 provider로 전달하며, Dawith 서버에는 저장하지 않습니다. 개인정보가 포함된 원문은 로컬 처리 후 담당자가 전송 여부를 결정하세요.</span></div><div id="subscriptionCards" class="subscription-cards"><p class="muted-text">상태를 확인하는 중…</p></div><div class="subscription-test"><label for="subscriptionText">선택 전송 테스트</label><textarea id="subscriptionText" class="subscription-input" placeholder="개인정보가 없는 짧은 문장으로 먼저 테스트하세요."></textarea><div class="subscription-actions"><select id="subscriptionProvider" class="wide-input" aria-label="외부 AI provider"><option value="claude-code">Claude</option><option value="codex">Codex</option></select><button id="subscriptionAssist" class="primary-button" type="button">선택한 AI로 정리</button></div><p id="subscriptionNotice" class="field-hint">상태 확인만으로는 원문이 전송되지 않습니다.</p></div></section></div>`;
}

function renderHwpWorkspace(tool) {
  return `${toolHeader(tool, '한글 기관 양식을 확인하고 채우기', 'HWP·HWPX 파일을 외부로 보내지 않고 이 기기에서 읽고 표식을 치환해 저장합니다.')}<div class="hwp-layout"><section class="tool-panel hwp-entry"><div class="panel-heading"><div><h2>양식 파일</h2><p>기관에서 받은 .hwp 또는 .hwpx 파일을 선택하세요.</p></div><span id="hwpEngineStatus" class="local-note">엔진 준비 전</span></div><div id="hwpDropzone" class="dropzone"><div><span class="dropzone-mark">H</span><b>HWP·HWPX 파일을 놓으세요</b><p>파일은 이 브라우저에서만 읽습니다.</p><label class="file-button"><input id="hwpInput" type="file" accept=".hwp,.hwpx,.hml,application/x-hwp,application/haansofthwp" />파일 선택</label></div></div><div id="hwpNotice" class="notice" hidden></div><div id="hwpMeta" class="hwp-meta hidden"><div><span>파일</span><b id="hwpFileName"></b></div><div><span>페이지</span><b id="hwpPageCount">-</b></div><div><span>처리</span><b>이 기기</b></div></div><div id="hwpReplacePanel" class="hwp-replace hidden"><b>양식 표식 치환</b><p><code>{{기관명}}</code>처럼 양식에 넣은 표식을 찾아 바꿉니다.</p><div class="replace-grid"><label>찾을 표식<input id="hwpQuery" class="wide-input" placeholder="예: {{기관명}}" /></label><label>바꿀 내용<input id="hwpReplacement" class="wide-input" placeholder="예: 다위복지관" /></label></div><button id="hwpReplaceSave" class="primary-button" type="button" disabled>치환한 HWPX 저장 →</button></div></section><section class="tool-panel hwp-result"><div class="panel-heading"><div><h2>양식 내용</h2><p id="hwpResultLabel">파일을 선택하면 텍스트를 추출합니다.</p></div><div class="panel-actions"><button id="hwpCopy" class="secondary-button" type="button" disabled>복사</button><button id="hwpLocalAi" class="secondary-button" type="button" disabled>로컬 AI 요약</button><button id="hwpSubscriptionAi" class="secondary-button external-ai-button" type="button" disabled>구독 AI 요약</button><button id="hwpAiRevert" class="secondary-button hidden" type="button">되돌리기</button></div></div><pre id="hwpPreview" class="hwp-preview">HWP·HWPX 파일을 선택하면 양식 안의 텍스트가 여기에 표시됩니다.</pre><div class="tool-actions"><button id="hwpUseAsSource" class="primary-button" type="button" disabled>내용을 텍스트 도구로 보내기 →</button></div></section></div><aside class="hwp-safety"><b>지원 범위</b><span>HWP 5.0 · HWPX · 일부 HML</span><span>표·문단 텍스트 추출</span><span>AI 버튼은 선택한 텍스트를 초안으로 요약합니다</span><span>rhwp MIT 엔진을 필요할 때만 불러옵니다</span></aside>`;
}

const builtInTemplates = [
  { id: 'meeting-minutes', title: '사례회의·회의록', body: '회의명: {{사업명}}\n일시: {{문서일}}\n기관: {{기관명}}\n작성자: {{작성자}}\n참석자: {{참석자}}\n\n1. 회의 목적\n{{목적}}\n\n2. 주요 논의\n{{내용}}\n\n3. 결정사항\n{{결정사항}}\n\n4. 후속 조치\n{{후속조치}}' },
  { id: 'business-plan', title: '사업계획서 초안', body: '사업명: {{사업명}}\n기관명: {{기관명}}\n작성일: {{문서일}}\n작성자: {{작성자}}\n\n1. 추진 배경 및 필요성\n{{목적}}\n\n2. 사업 내용\n{{내용}}\n\n3. 기대 결과\n{{결정사항}}\n\n4. 추진 일정 및 담당\n{{후속조치}}' },
  { id: 'result-report', title: '사업결과보고서 초안', body: '사업명: {{사업명}}\n기관명: {{기관명}}\n작성일: {{문서일}}\n작성자: {{작성자}}\n\n1. 사업 개요\n{{목적}}\n\n2. 추진 내용 및 실적\n{{내용}}\n\n3. 주요 성과와 보완점\n{{결정사항}}\n\n4. 향후 계획\n{{후속조치}}' },
  { id: 'counseling-log', title: '상담일지 초안', body: '상담일: {{문서일}}\n기관명: {{기관명}}\n작성자: {{작성자}}\n\n1. 상담 목적\n{{목적}}\n\n2. 상담 내용\n{{내용}}\n\n3. 확인된 사항\n{{결정사항}}\n\n4. 다음 상담 및 연계 계획\n{{후속조치}}' },
];

function getTemplateCatalog() {
  try { return [...builtInTemplates, ...JSON.parse(localStorage.getItem('dawith-custom-templates-v1') || '[]')]; } catch { return [...builtInTemplates]; }
}

function renderTemplateStudio(tool) {
  const templates = getTemplateCatalog();
  const options = templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.title)}</option>`).join('');
  return `${toolHeader(tool, '기관 문서 양식', '기관명·담당자를 한 번 저장하면 회의록·사업계획서·결과보고서 머리말이 자동으로 채워집니다. 회의 메모 정리는 상담 기록·회의록 정리에서 먼저 하세요.')}<div class="template-layout"><aside class="tool-panel template-sidebar"><div class="panel-heading"><div><h2>내 양식</h2><p>저장한 양식은 이 기기에만 남습니다.</p></div></div><div class="control-group template-select-group"><label for="templateSelect">사용할 문서</label><select id="templateSelect" class="wide-input">${options}</select></div><div class="template-save-box"><label for="templateName">내 양식으로 저장</label><input id="templateName" class="wide-input" placeholder="예: 우리 기관 회의록" /><textarea id="templateBody" class="template-body-input" placeholder="{{기관명}}, {{사업명}} 같은 항목을 사용할 수 있습니다."></textarea><button id="templateSave" class="secondary-button" type="button">내 양식 저장</button><p id="templateNotice" class="field-hint">양식 안의 개인정보는 저장하지 마세요.</p></div><div class="template-help"><b>사용 가능한 항목</b><p>{{기관명}} · {{문서일}} · {{사업명}} · {{작성자}} · {{참석자}} · {{목적}} · {{내용}} · {{결정사항}} · {{후속조치}}</p></div><div class="template-help"><b>회의 메모가 있나요?</b><p>상담 기록·회의록 정리에서 결정 사항·할 일을 먼저 나눈 뒤 이 양식으로 보내면 칸이 채워집니다.</p><button class="link-button" data-tool="case-record" type="button">회의록 정리 열기 →</button></div></aside><section class="tool-panel template-editor-panel"><div class="panel-heading"><div><h2>초안 작성</h2><p>입력하는 즉시 결과에 반영됩니다. AI 결과는 검토 전 초안입니다.</p></div><span class="local-note">● 로컬 우선</span></div><div class="profile-strip"><div><b>기관 기본정보</b><span>다음 작업에 다시 입력하지 않도록 이 PC에 저장합니다.</span></div><div class="profile-fields"><input id="profileOrganization" class="wide-input" placeholder="기관명" /><input id="profileManager" class="wide-input" placeholder="기본 작성자" /><button id="profileSave" class="secondary-button" type="button">저장</button></div></div><div class="template-fields"><div class="control-group"><label for="templateDate">문서일</label><input id="templateDate" type="date" class="wide-input" /></div><div class="control-group"><label for="templateProject">사업명·회의명</label><input id="templateProject" class="wide-input" placeholder="예: 2026년 주거취약가구 지원사업" /></div><div class="control-group"><label for="templateAuthor">작성자</label><input id="templateAuthor" class="wide-input" placeholder="담당자 이름" /></div><div class="control-group"><label for="templateAttendees">참석자</label><input id="templateAttendees" class="wide-input" placeholder="예: 김○○, 이○○" /></div><div class="control-group full-field"><label for="templatePurpose">목적·추진 배경</label><textarea id="templatePurpose" placeholder="왜 이 문서를 작성하는지 입력하세요."></textarea></div><div class="control-group full-field"><label for="templateContent">주요 내용</label><textarea id="templateContent" placeholder="논의 내용·추진 내용·상담 내용을 입력하세요."></textarea></div><div class="control-group"><label for="templateDecisions">성과·결정사항</label><textarea id="templateDecisions" placeholder="확인된 성과나 결정사항"></textarea></div><div class="control-group"><label for="templateActions">후속 조치·향후 계획</label><textarea id="templateActions" placeholder="담당자와 다음 일정을 입력하세요."></textarea></div></div><div class="template-preview-heading"><div><b>결과 미리보기</b><span>기본은 로컬 처리 · 구독 AI 사용 시 선택한 문서가 외부로 전송됩니다.</span></div><div class="template-actions"><button id="templateAiAssist" class="secondary-button" type="button">로컬 AI로 초안 다듬기</button><button id="templateSubscriptionAssist" class="secondary-button external-ai-button" type="button">구독 AI 사용</button><button id="templateAiRevert" class="secondary-button hidden" type="button">AI 결과 되돌리기</button><button id="templateCopy" class="secondary-button" type="button">복사</button><button id="templateDownload" class="primary-button" type="button">문서용 HTML 저장 →</button></div></div><pre id="templatePreview" class="template-preview">내용을 입력하면 초안이 여기에 표시됩니다.</pre></section></div>`;
}

function renderAttendanceWorkspace(tool) {
  return `${toolHeader(tool, '오늘의 인원 현황 정리하기', '명단을 붙여 넣고 상태를 체크하면 현황과 CSV 파일을 바로 만듭니다.')}<div class="attendance-layout"><section class="tool-panel attendance-entry"><div class="panel-heading"><div><h2>명단 불러오기</h2><p>한 줄에 한 명씩 입력하세요. 이름 대신 관리번호를 써도 됩니다.</p></div></div><textarea id="attendanceInput" class="attendance-input" placeholder="예:\n대상자 A\n대상자 B\n관리번호 24-018"></textarea><div class="tool-actions"><button id="attendanceLoad" class="primary-button" type="button">명단 불러오기 →</button><button id="attendanceClear" class="secondary-button" type="button">전체 비우기</button></div><p class="field-hint">명단과 체크 결과는 이 PC의 브라우저 저장소에만 보관됩니다. 공용 PC에서는 작업 후 전체 비우기를 사용하세요.</p></section><section class="tool-panel attendance-board"><div class="panel-heading"><div><h2>상태 체크</h2><p>상태를 바꾸면 자동 저장됩니다.</p></div><span id="attendanceSummary" class="muted-text">0명</span></div><div class="attendance-counts" id="attendanceCounts"></div><div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>명단</th><th>상태</th><th aria-label="삭제"></th></tr></thead><tbody id="attendanceRows"><tr><td colspan="3" class="empty-table">명단을 불러오면 여기에 표시됩니다.</td></tr></tbody></table></div><div class="tool-actions attendance-actions"><button id="attendanceCsv" class="primary-button" type="button" disabled>CSV 저장 →</button></div></section></div>`;
}

function renderDutyWorkspace(tool) {
  const today = compactDate(new Date()).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 6);
  const end = compactDate(nextWeek).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  return `${toolHeader(tool, '당직 일정을 빠르게 편성하기', '직원 순서와 기간을 넣으면 날짜별 당직표를 만들고 수정할 수 있습니다.')}<div class="duty-layout"><section class="tool-panel duty-entry"><div class="panel-heading"><div><h2>편성 조건</h2><p>한 줄에 한 명씩 입력하면 순서대로 반복 배치합니다.</p></div></div><div class="control-group duty-staff"><label for="dutyStaff">직원 순서</label><textarea id="dutyStaff" placeholder="예:\n김담당\n이사회복지사\n박선생"></textarea></div><div class="control-inline"><div class="control-group"><label for="dutyStart">시작일</label><input id="dutyStart" type="date" value="${today}" /></div><div class="control-group"><label for="dutyEnd">종료일</label><input id="dutyEnd" type="date" value="${end}" /></div></div><div class="tool-actions"><button id="dutyMake" class="primary-button" type="button">당직표 만들기 →</button></div><p class="field-hint">편성 결과는 이 화면에서만 사용하며 외부로 전송하지 않습니다.</p></section><section class="tool-panel duty-board"><div class="panel-heading"><div><h2>당직표</h2><p>담당자는 표에서 직접 바꿀 수 있습니다.</p></div><span id="dutySummary" class="muted-text">편성 전</span></div><div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>날짜</th><th>요일</th><th>담당자</th></tr></thead><tbody id="dutyRows"><tr><td colspan="3" class="empty-table">조건을 입력하고 당직표를 만들어 주세요.</td></tr></tbody></table></div><div class="tool-actions attendance-actions"><button id="dutyCsv" class="primary-button" type="button" disabled>CSV 저장 →</button></div></section></div>`;
}

function renderQrWorkspace(tool) {
  return `${toolHeader(tool, '링크를 QR 코드로 저장하기', '외부 서비스를 호출하지 않고 이 기기에서 QR 이미지를 만듭니다.')}<div class="tool-layout calculator-layout"><section class="calculator-card"><h2>주소 입력</h2><p>신청 링크, 안내 페이지 주소를 입력하세요.</p><div class="control-group"><label for="qrText">링크 또는 짧은 문구</label><input id="qrText" class="wide-input" placeholder="https://" /></div><div class="tool-actions"><button id="qrMake" class="primary-button" type="button">QR 만들기 →</button></div><div id="qrResult" class="calculator-result hidden"></div></section><section class="calculator-reference"><h3>사용 예</h3><div class="reference-row"><b>프로그램 신청</b><span>게시판·문자에 QR을 붙여 신청 페이지로 연결</span></div><div class="reference-row"><b>만족도 조사</b><span>행사 안내문에 설문 링크를 함께 제공</span></div></section></div>`;
}

const summaryModes = {
  counseling: {
    title: '상담 기록',
    contextLabel: '상담 맥락 (선택)',
    contextPlaceholder: '예: 3월 12일 가정방문 / 주거지원 사례 2회기',
    rawLabel: '상담 메모·녹취 원문',
    rawPlaceholder: '상담 중 적은 메모나 녹취 전사문을 붙여 넣으세요.\n예: 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 주거급여 신청 절차를 안내함. 다음 주에 주민센터와 연계하기로 함.',
    sample: { context: '주거지원 사례 2회기 · 가정방문', raw: '3월 12일 가정방문 상담. 내담자는 월세가 두 달 밀려 퇴거가 걱정된다고 호소함. 자녀 양육은 꾸준히 하고 있으며 취업 의지가 있음. 연락처 010-1234-5678. 주거급여 신청 절차와 필요 서류를 안내하였음. 다음 주에 주민센터와 연계하여 신청서류를 확인하기로 함.' },
  },
  meeting: {
    title: '회의록',
    contextLabel: '회의명 (선택)',
    contextPlaceholder: '예: 11월 통합사례회의',
    rawLabel: '회의 메모 원문',
    rawPlaceholder: '회의 중 적은 메모를 붙여 넣으세요. "일시:", "장소:", "참석자:", "안건:" 줄이 있으면 개요에 바로 들어갑니다.\n예: 방문 횟수를 주 2회로 늘리기로 결정함. 이사회복지사가 11월 15일까지 명단을 정리함.',
    sample: { context: '11월 통합사례회의', raw: '일시: 11월 10일 오후 2시\n장소: 2층 회의실\n참석자: 김팀장, 이사회복지사, 박간호사\n안건: 독거 어르신 겨울철 안부 확인\n어르신 12가구의 난방 상태를 점검함. 방문 횟수를 주 2회로 늘리기로 결정함. 이사회복지사가 11월 15일까지 대상 명단을 정리함. 박간호사는 다음 주에 건강 상태를 확인하기로 함.' },
  },
};

function renderCaseRecordWorkspace(tool) {
  return `${toolHeader(tool, '상담 기록·회의록 정리', '메모나 녹취 전사문을 붙여 넣으면 정해진 항목으로 나눠 정리합니다. 기본은 AI 없이 이 PC에서 처리하고, 원할 때만 로컬 AI나 클라우드 AI를 고릅니다.', { nav: '● 기본은 이 기기에서 처리', mark: '외부 전송은 확인 후' })}<div class="summary-layout"><section class="tool-panel summary-input"><div class="summary-modes" role="tablist" aria-label="정리 종류"><button class="summary-mode active" role="tab" aria-selected="true" data-summary-mode="counseling" type="button"><b>상담 기록 정리</b><small>호소 · 사정 · 개입 · 계획</small></button><button class="summary-mode" role="tab" aria-selected="false" data-summary-mode="meeting" type="button"><b>회의록 정리</b><small>개요 · 논의 · 결정 사항 · 할 일</small></button></div><div class="control-group"><label for="recordContext" id="recordContextLabel">${summaryModes.counseling.contextLabel}</label><input id="recordContext" class="wide-input" placeholder="${escapeHtml(summaryModes.counseling.contextPlaceholder)}" /></div><div class="control-group"><div class="label-row"><label for="recordRaw" id="recordRawLabel">${summaryModes.counseling.rawLabel}</label><span id="recordRawCount" class="muted-text">0자</span></div><textarea id="recordRaw" class="record-source" rows="11" placeholder="${escapeHtml(summaryModes.counseling.rawPlaceholder)}"></textarea></div><fieldset class="engine-picker"><legend>정리 방식</legend><label class="engine-option"><input type="radio" name="recordEngine" value="rules" checked /><span><b>규칙 · AI 없음 <i>기본</i></b><small>이 PC에서 바로 처리합니다. 문장을 항목별로 나누기만 합니다.</small></span></label><label class="engine-option"><input type="radio" name="recordEngine" value="ollama" /><span><b>로컬 AI · Ollama</b><small>PC 밖으로 나가지 않습니다. <em id="engineOllamaStatus">상태 확인 중…</em></small></span></label><label class="engine-option"><input type="radio" name="recordEngine" value="cloud" /><span><b>클라우드 AI</b><small>보내기 전에 전송할 내용을 보여 드립니다. <em id="engineCloudStatus">연결 확인 중…</em></small></span></label><div id="engineCloudPicker" class="engine-cloud-picker" hidden><label for="recordCloudProvider">사용할 클라우드 AI</label><select id="recordCloudProvider" class="wide-input"></select></div><p id="engineCloudEmpty" class="engine-empty" hidden>연결된 클라우드 AI가 없습니다. <button type="button" class="link-button" data-tool="ai-setup">AI 보조·연결에서 연결하기 →</button></p></fieldset><div class="tool-actions"><button id="recordProcess" class="primary-button" type="button">정리하기 →</button><button id="recordSample" class="secondary-button" type="button">예시 넣기</button></div><p id="recordNotice" class="notice" hidden></p></section><section class="tool-panel summary-output"><div class="panel-heading"><div><h2 id="summaryTitle">상담 기록</h2><p>결과는 바로 고칠 수 있습니다. 확정 전 원문과 대조하세요.</p></div><span id="recordTransfer" class="engine-badge">정리 전</span></div><div id="summaryBody" class="summary-body"><div class="summary-empty"><b>왼쪽에 원문을 넣고 정리하기를 누르세요.</b><span id="summaryEmptyHint">상담 개요 · 주요 호소 · 사정(욕구·강점·위험) · 개입 내용 · 향후 계획·후속 조치로 나눠 드립니다.</span></div></div><div class="summary-actions"><button id="recordCopy" class="secondary-button" type="button" disabled>복사</button><button id="recordSave" class="secondary-button" type="button" disabled>이 PC에 저장</button><button id="recordExport" class="secondary-button" type="button" disabled>Markdown 저장</button><button id="recordDocx" class="primary-button" type="button" disabled>Word(DOCX) 저장 →</button><button id="recordToTemplate" class="secondary-button hidden" type="button" disabled>기관 문서 양식으로 보내기</button></div><div class="summary-saved"><label for="recordSavedList">저장한 기록 불러오기</label><select id="recordSavedList" class="wide-input"><option value="">저장한 기록 없음</option></select></div></section></div><dialog id="cloudConfirmDialog" class="privacy-dialog cloud-confirm" aria-labelledby="cloudConfirmTitle"><p class="overline">EXTERNAL TRANSFER · 외부 전송 확인</p><h2 id="cloudConfirmTitle"><span id="cloudConfirmProvider"></span>에 아래 내용을 보냅니다</h2><label class="option-line cloud-mask-option"><input id="cloudMask" type="checkbox" checked /> 보내기 전에 개인정보 가리기 <small>주민등록번호 · 전화번호 · 이메일 · 계좌번호</small></label><p class="field-hint">이름·주소·기관명은 자동으로 가려지지 않습니다. 아래 내용을 끝까지 확인하세요.</p><pre id="cloudPreview" class="cloud-preview" tabindex="0"></pre><p class="dialog-footnote">위 내용과 정리 지시문(개인정보 없음)만 전송됩니다. 결과는 이 PC로 돌아오며 Dawith 서버에는 저장되지 않습니다. 기관의 외부 전송 기준을 확인한 뒤 보내세요.</p><div class="dialog-actions"><button id="cloudCancel" class="secondary-button" type="button">취소</button><button id="cloudSend" class="primary-button" type="button">이 내용으로 보내기</button></div></dialog>`;
}

function renderDiagramWorkspace(tool) {
  const mode = tool.id === 'genogram' ? 'genogram' : 'ecomap';
  const nodeLabel = mode === 'genogram' ? '사람 추가' : '자원·기관 추가';
  return `${toolHeader(tool, mode === 'genogram' ? '가계도 직접 편집' : '생태도 직접 편집', '생성형 이미지가 아니라 편집 가능한 SVG 데이터로 작성합니다. 프로젝트와 원문은 이 PC의 localStorage에만 저장됩니다.')}<div class="diagram-layout"><section class="tool-panel diagram-canvas-panel"><div class="diagram-toolbar"><label>프로젝트 이름<input id="diagramTitle" class="wide-input" value="새 ${mode === 'genogram' ? '가계도' : '생태도'}" /></label><div class="tool-actions"><button id="diagramAddNode" class="primary-button" type="button">${nodeLabel}</button><button id="diagramUndo" class="secondary-button" type="button" disabled>되돌리기</button><button id="diagramRedo" class="secondary-button" type="button" disabled>다시 하기</button></div></div><div class="diagram-canvas-wrap"><svg id="diagramCanvas" class="diagram-canvas" viewBox="0 0 1000 620" role="img" aria-label="${mode === 'genogram' ? '가계도' : '생태도'} 편집 캔버스"><g id="diagramLinks"></g><g id="diagramNodes"></g></svg></div><div class="tool-actions diagram-export-actions"><button id="diagramSave" class="secondary-button" type="button">로컬 저장</button><button id="diagramExportJson" class="secondary-button" type="button">JSON 백업</button><button id="diagramExportSvg" class="secondary-button" type="button">SVG 저장</button><button id="diagramExportHtml" class="secondary-button" type="button">HTML 저장</button><label class="file-button">JSON 불러오기<input id="diagramImport" type="file" accept="application/json,.json" /></label></div><div id="diagramNotice" class="notice" hidden></div></section><aside class="tool-panel diagram-inspector"><div class="panel-heading"><div><h2>선택한 항목</h2><p>캔버스의 항목을 끌어 놓거나 속성을 수정하세요.</p></div></div><div id="diagramEmptyInspector" class="muted-text">항목을 선택하면 이름과 메모를 편집할 수 있습니다.</div><div id="diagramNodeInspector" class="hidden"><div class="control-group"><label for="diagramNodeLabel">표시 이름</label><input id="diagramNodeLabel" class="wide-input" /></div><div class="control-group"><label for="diagramNodeKind">항목 종류</label><select id="diagramNodeKind" class="wide-input"><option value="person">사람</option><option value="resource">기관·자원</option><option value="center">중심 가구</option></select></div><div class="control-group"><label for="diagramNodeNote">메모 (선택)</label><textarea id="diagramNodeNote" rows="4"></textarea></div><div class="tool-actions"><button id="diagramDeleteNode" class="secondary-button" type="button">항목 삭제</button></div></div><div class="diagram-link-editor"><h3>관계 연결</h3><div class="control-group"><label for="diagramLinkFrom">시작 항목</label><select id="diagramLinkFrom" class="wide-input"></select></div><div class="control-group"><label for="diagramLinkTo">대상 항목</label><select id="diagramLinkTo" class="wide-input"></select></div><div class="control-group"><label for="diagramLinkType">관계 종류</label><select id="diagramLinkType" class="wide-input">${mode === 'genogram' ? '<option value="partner">배우자·동반자</option><option value="child">부모·자녀</option><option value="adopted">입양·위탁</option><option value="close">정서적 가까움</option><option value="cutoff">단절·거리</option><option value="hostile">갈등</option>' : '<option value="support-strong">강한 지지</option><option value="support-weak">약한 지지</option><option value="stress">긴장·부담</option><option value="cutoff">단절·접근 어려움</option>'}</select></div><button id="diagramAddLink" class="secondary-button" type="button">관계 연결 추가</button></div><div class="diagram-source"><h3>원문에서 후보 찾기</h3><p>규칙 기반 추출은 원문을 외부로 보내지 않습니다. 후보를 확인한 뒤 직접 적용하세요.</p><textarea id="diagramSourceText" rows="5" placeholder="예: 내담자는 친모와 살고 있으며 주민센터와 학교의 지원을 받고 있다."></textarea><div class="tool-actions"><button id="diagramExtract" class="secondary-button" type="button">로컬 규칙으로 찾기</button><button id="diagramLocalAi" class="secondary-button" type="button">로컬 LLM 보조</button></div><div id="diagramCandidates" class="diagram-candidates"></div></div></aside></div>`;
}

function bindWorkspace(toolId) {
  if (toolId === 'pdf-merge') bindPdfMerge();
  if (toolId === 'pdf-split') bindPdfSplit();
  if (toolId === 'document-convert') bindDocumentConvert();
  if (toolId === 'hwp-inspector') bindHwpInspector();
  if (toolId === 'image-resize' || toolId === 'image-compress' || toolId === 'image-privacy' || toolId === 'image-rotate') bindImage(toolId);
  if (toolId === 'text-tools') bindText();
  if (toolId === 'age-calculator') bindAge();
  if (toolId === 'money-converter') bindMoney();
  if (toolId === 'date-calculator') bindDate();
  if (toolId === 'attendance') bindAttendance();
  if (toolId === 'duty-schedule') bindDutySchedule();
  if (toolId === 'case-record') bindCaseRecord();
  if (toolId === 'genogram' || toolId === 'ecomap') bindDiagram(toolId);
  if (toolId === 'template-studio') bindTemplateStudio();
  if (toolId === 'ai-setup') bindAiSetup();
}

let rhwpRuntimePromise;
async function loadRhwpRuntime() {
  if (!rhwpRuntimePromise) {
    rhwpRuntimePromise = (async () => {
      const module = await import('./vendor/rhwp/rhwp.js');
      const localUrl = './vendor/rhwp/rhwp_bg.wasm';
      const remoteUrl = 'https://raw.githubusercontent.com/dawith-ai/dawith-welfare-office/main/public/vendor/rhwp/rhwp_bg.wasm';
      let response = await fetch(localUrl);
      if (!response.ok) {
        const cache = await caches.open('dawith-optional-runtime-v1');
        response = await cache.match(remoteUrl);
        if (!response) {
          response = await fetch(remoteUrl, { cache: 'no-store' });
          if (response.ok) await cache.put(remoteUrl, response.clone());
        }
      }
      if (!response.ok) throw new Error(`rhwp_wasm_${response.status}`);
      await module.default({ module_or_path: await response.arrayBuffer() });
      return module;
    })().catch((error) => { rhwpRuntimePromise = null; throw error; });
  }
  return rhwpRuntimePromise;
}

function hwpTextFromEngine(doc) {
  const raw = doc.getTextFileUnicode?.() || doc.getTextFileText();
  const parsed = JSON.parse(raw);
  if (typeof parsed === 'string') return parsed;
  return parsed.text || parsed.value || '';
}

function bindHwpInspector() {
  const input = $('#hwpInput'); const zone = $('#hwpDropzone'); const preview = $('#hwpPreview'); const copy = $('#hwpCopy'); const useAsSource = $('#hwpUseAsSource'); const replacePanel = $('#hwpReplacePanel'); const replaceSave = $('#hwpReplaceSave'); let extracted = ''; let loadedDocument = null; let aiPreviousPreview = '';
  const notice = (message, error = false) => { $('#hwpNotice').hidden = false; $('#hwpNotice').className = `notice${error ? ' error-notice' : ''}`; $('#hwpNotice').textContent = message; };
  const readFile = async (file) => {
    $('#hwpEngineStatus').textContent = '엔진 준비 중…'; notice('HWP 엔진을 처음 불러오는 중입니다. 파일은 외부로 전송하지 않습니다.');
    try {
      const { HwpDocument } = await loadRhwpRuntime(); if (loadedDocument) loadedDocument.free(); loadedDocument = new HwpDocument(new Uint8Array(await file.arrayBuffer()));
      extracted = hwpTextFromEngine(loadedDocument).replace(/\r\n/g, '\n').trim(); const pages = loadedDocument.pageCount(); $('#hwpFileName').textContent = file.name; $('#hwpPageCount').textContent = `${pages}페이지`; $('#hwpMeta').classList.remove('hidden'); replacePanel.classList.remove('hidden'); replaceSave.disabled = false; preview.textContent = extracted || '텍스트를 찾지 못했습니다. 표·그림 중심 양식일 수 있습니다.'; $('#hwpResultLabel').textContent = `${formatBytes(file.size)} · ${pages}페이지 · 로컬 추출 완료`; copy.disabled = !extracted; useAsSource.disabled = !extracted; $('#hwpLocalAi').disabled = !extracted; $('#hwpSubscriptionAi').disabled = !extracted; $('#hwpEngineStatus').textContent = '엔진 준비됨'; notice('양식 내용을 이 기기에서 읽었습니다.');
    } catch (error) { if (loadedDocument) { loadedDocument.free(); loadedDocument = null; } extracted = ''; replacePanel.classList.add('hidden'); replaceSave.disabled = true; preview.textContent = '파일을 읽지 못했습니다.'; copy.disabled = true; useAsSource.disabled = true; $('#hwpLocalAi').disabled = true; $('#hwpSubscriptionAi').disabled = true; $('#hwpEngineStatus').textContent = '확인 필요'; notice(error?.message?.includes('rhwp_wasm') ? 'HWP 엔진 파일을 불러오지 못했습니다. 앱을 최신 버전으로 업데이트해 주세요.' : '지원하지 않는 형식이거나 암호가 걸린 파일입니다.', true); }
  };
  bindDropzone(zone, input, (files) => { if (files[0]) readFile(files[0]); });
  copy.addEventListener('click', async () => { await navigator.clipboard?.writeText(extracted); notice('추출한 내용을 클립보드에 복사했습니다.'); });
  replaceSave.addEventListener('click', () => { const query = $('#hwpQuery').value; const replacement = $('#hwpReplacement').value; if (!loadedDocument || !query) return notice('찾을 표식을 입력해 주세요.', true); try { const result = JSON.parse(loadedDocument.replaceAll(query, replacement, true)); if (!result.count) return notice('찾은 표식이 없습니다.', true); extracted = hwpTextFromEngine(loadedDocument).replace(/\r\n/g, '\n').trim(); preview.textContent = extracted; notice(`${result.count}곳을 치환했습니다. 원본은 바뀌지 않았습니다.`); const bytes = loadedDocument.exportHwpx(); downloadBlob(new Blob([bytes], { type: 'application/vnd.hancom.hwpx' }), `다위복지관_양식_작성본_${compactDate(new Date())}.hwpx`); } catch { notice('치환한 HWPX를 저장하지 못했습니다.', true); } });
  $('#hwpLocalAi').addEventListener('click', async () => {
    if (!extracted) return;
    const button = $('#hwpLocalAi'); button.disabled = true; button.textContent = '로컬 AI 처리 중…';
    try { aiPreviousPreview = preview.textContent; preview.textContent = await runLocalAi('hwp-summary', extracted); $('#hwpAiRevert').classList.remove('hidden'); notice('로컬 AI 요약 초안입니다. 원문과 대조해 검토하세요.'); }
    catch (error) { notice(aiErrorMessage(error), true); }
    finally { button.disabled = false; button.textContent = '로컬 AI 요약'; }
  });
  $('#hwpSubscriptionAi').addEventListener('click', async () => {
    if (!extracted) return;
    const status = await fetchSubscriptionStatus().catch(() => null);
    const available = Object.values(status?.providers || {}).filter((item) => item.state === 'ready');
    if (!available.length) return notice('연결된 외부 AI가 없습니다. AI 보조·연결 센터에서 먼저 연결하세요.', true);
    const provider = available[0].provider; const label = providerLabel(provider);
    if (!window.confirm(`${label} 구독으로 HWP 원문을 외부 전송해 요약합니다. 기관 승인과 개인정보 보호 기준을 확인했습니까?`)) return;
    const button = $('#hwpSubscriptionAi'); button.disabled = true; button.textContent = '구독 AI 처리 중…';
    try { aiPreviousPreview = preview.textContent; preview.textContent = await runSubscriptionAi({ provider, task: 'hwp-summary', text: extracted }); $('#hwpAiRevert').classList.remove('hidden'); notice(`${label} 구독 AI 요약 초안입니다. 외부 전송 결과이므로 원문과 대조하세요.`); }
    catch (error) { notice(subscriptionErrorMessage(error), true); }
    finally { button.disabled = false; button.textContent = '구독 AI 요약'; }
  });
  $('#hwpAiRevert').addEventListener('click', () => { if (!aiPreviousPreview) return; preview.textContent = aiPreviousPreview; aiPreviousPreview = ''; $('#hwpAiRevert').classList.add('hidden'); notice('AI 요약을 적용 전 원문으로 되돌렸습니다.'); });
  useAsSource.addEventListener('click', () => { localStorage.setItem('dawith-hwp-source-v1', extracted); openTool('text-tools'); $('#textInput').value = extracted; $('#textInput').dispatchEvent(new Event('input', { bubbles: true })); });
}

function bindDropzone(zone, input, callback) {
  zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('dragover'); callback([...event.dataTransfer.files]); });
  input.addEventListener('change', () => callback([...input.files]));
}

async function readPdfPageCount(file) {
  await ensurePdfLib();
  const document = await PDFDocument.load(await file.arrayBuffer());
  return document.getPageCount();
}

function renderPdfFileList(target, files, summaryId) {
  $(summaryId).textContent = `${files.length}개`;
  target.innerHTML = files.length ? files.map((item, index) => `<div class="file-row"><span class="file-row-mark">${index + 1}</span><span><b>${escapeHtml(item.file.name)}</b><small>${formatBytes(item.file.size)} · ${item.pages ? `${item.pages}페이지` : '페이지 읽는 중'}</small></span><button class="icon-text-button" data-remove-pdf="${index}" type="button">삭제</button></div>`).join('') : '';
  $$('[data-remove-pdf]', target).forEach((button) => button.addEventListener('click', () => { files.splice(Number(button.dataset.removePdf), 1); renderPdfFileList(target, files, summaryId); if (summaryId === '#pdfSummary') $('#pdfMergeButton').disabled = files.length < 2; else $('#splitButton').disabled = !files.length; }));
}

function bindPdfMerge() {
  const files = state.pdfFiles = [];
  const list = $('#pdfFileList');
  const add = async (incoming) => { files.push(...incoming.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')).map((file) => ({ file, pages: null }))); renderPdfFileList(list, files, '#pdfSummary'); $('#pdfMergeButton').disabled = files.length < 2; for (const item of files.filter((entry) => entry.pages === null)) { try { item.pages = await readPdfPageCount(item.file); } catch { item.pages = 0; } } renderPdfFileList(list, files, '#pdfSummary'); };
  bindDropzone($('#pdfDropzone'), $('#pdfInput'), add);
  $('#pdfMergeButton').addEventListener('click', async () => { if (files.length < 2) return; const button = $('#pdfMergeButton'); button.disabled = true; button.textContent = '합치는 중…'; try { await ensurePdfLib(); const output = await PDFDocument.create(); for (const item of files) { const source = await PDFDocument.load(await item.file.arrayBuffer()); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach((page) => output.addPage(page)); } const bytes = await output.save(); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${($('#pdfOutputName').value.trim() || '복지관_붙임서류')}.pdf`); showNotice('#pdfNotice', '완료했습니다. 원본 파일은 바뀌지 않았습니다.'); } catch (error) { showNotice('#pdfNotice', `PDF를 합치지 못했습니다: ${error.message}`, true); } finally { button.disabled = files.length < 2; button.textContent = 'PDF 합치기 →'; } });
}

function parsePageRange(value, pageCount) {
  if (!value.trim()) return Array.from({ length: pageCount }, (_, index) => index);
  const pages = new Set();
  for (const part of value.split(',')) { const trimmed = part.trim(); if (!trimmed) continue; const [startRaw, endRaw] = trimmed.split('-').map((piece) => Number(piece.trim())); const start = Math.max(1, startRaw); const end = Math.min(pageCount, Number.isFinite(endRaw) ? endRaw : start); if (!Number.isFinite(start) || start > end) throw new Error('페이지 번호를 확인해 주세요.'); for (let page = start; page <= end; page += 1) pages.add(page - 1); }
  return [...pages].sort((a, b) => a - b);
}

function bindPdfSplit() {
  const files = state.pdfFiles = [];
  const list = $('#splitFileList');
  const add = async (incoming) => { files.splice(0, files.length, ...incoming.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')).slice(0, 1).map((file) => ({ file, pages: null }))); renderPdfFileList(list, files, '#splitPdfSummary'); $('#splitButton').disabled = !files.length; if (files[0]) { try { files[0].pages = await readPdfPageCount(files[0].file); } catch { files[0].pages = 0; } renderPdfFileList(list, files, '#splitPdfSummary'); } };
  bindDropzone($('#splitDropzone'), $('#splitPdfInput'), add);
  $('#splitButton').addEventListener('click', async () => { if (!files[0]) return; const button = $('#splitButton'); button.disabled = true; button.textContent = '추출 중…'; try { await ensurePdfLib(); const source = await PDFDocument.load(await files[0].file.arrayBuffer()); const indices = parsePageRange($('#splitRange').value, source.getPageCount()); const output = await PDFDocument.create(); const pages = await output.copyPages(source, indices); pages.forEach((page) => output.addPage(page)); const bytes = await output.save(); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${($('#splitOutputName').value.trim() || '필요페이지_추출')}.pdf`); showNotice('#splitNotice', `${indices.length}페이지를 새 PDF로 저장했습니다.`); } catch (error) { showNotice('#splitNotice', error.message, true); } finally { button.disabled = !files.length; button.textContent = '페이지 추출 →'; } });
}

function extensionOf(fileName) {
  return String(fileName || '').toLowerCase().split('.').pop() || 'txt';
}

function markdownToHtml(value) {
  return escapeHtml(value)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (items) => `<ul>${items}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />');
}

function convertTextContent(source, from, to) {
  let text = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (from === 'html' || from === 'htm') {
    const document = new DOMParser().parseFromString(text, 'text/html');
    text = document.body?.textContent || text;
  }
  if (to === 'txt') return text.replace(/^#{1,6}\s+/gm, '').replace(/[*_`]/g, '').replace(/^[-*]\s+/gm, '• ').trim() + '\n';
  if (to === 'md') {
    if (from === 'html' || from === 'htm') return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).join('\n\n') + '\n';
    return text.trim() + '\n';
  }
  if (to === 'html') {
    const body = from === 'md' || from === 'markdown' ? markdownToHtml(text) : escapeHtml(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br />');
    return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Dawith 변환 문서</title><style>body{font-family:"Malgun Gothic",Arial,sans-serif;max-width:820px;margin:40px auto;line-height:1.8;color:#26382f}h1,h2,h3{color:#236a4e}pre{white-space:pre-wrap}p{margin:0 0 1em}</style><main><p>${body}</p></main></html>`;
  }
  if (to === 'csv') {
    if (from === 'csv') return text.endsWith('\n') ? text : `${text}\n`;
    return text.split(/\n+/).filter(Boolean).map((line) => `"${line.replaceAll('"', '""')}"`).join('\n') + '\n';
  }
  return text;
}

function bindDocumentConvert() {
  const input = $('#convertInput');
  const preview = $('#convertPreview');
  const format = $('#convertFormat');
  const button = $('#convertButton');
  let selected = null;
  let content = '';
  const read = async (file) => {
    if (!file) return;
    const sourceExtension = extensionOf(file.name);
    if (!['txt', 'md', 'markdown', 'html', 'htm', 'csv', 'json'].includes(sourceExtension)) return showNotice('#convertNotice', 'TXT·Markdown·HTML·CSV·JSON 파일만 변환할 수 있습니다.', true);
    selected = file;
    content = await file.text();
    $('#convertFileSummary').textContent = `${file.name} · ${formatBytes(file.size)}`;
    preview.textContent = content.slice(0, 20_000) || '(내용 없음)';
    $('#convertOutputName').value = file.name.replace(/\.[^.]+$/, '');
    button.disabled = false;
    showNotice('#convertNotice', '파일을 읽었습니다. 저장 형식을 선택하세요.');
  };
  bindDropzone($('#convertDropzone'), input, (files) => { void read(files[0]); });
  format.addEventListener('change', () => { if (selected) preview.textContent = convertTextContent(content, extensionOf(selected.name), format.value).slice(0, 20_000); });
  button.addEventListener('click', () => {
    if (!selected) return;
    try {
      const target = format.value;
      const output = convertTextContent(content, extensionOf(selected.name), target);
      const mime = target === 'html' ? 'text/html;charset=utf-8' : target === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
      const name = ($('#convertOutputName').value.trim() || selected.name.replace(/\.[^.]+$/, ''));
      downloadBlob(new Blob([target === 'csv' ? `\ufeff${output}` : output], { type: mime }), `${name}.${target}`);
      showNotice('#convertNotice', `.${target} 파일로 저장했습니다. 원본은 바뀌지 않았습니다.`);
    } catch (error) { showNotice('#convertNotice', `변환하지 못했습니다: ${error.message}`, true); }
  });
}

function bindImage(toolId) {
  const input = $('#imageInput');
  const load = (file) => { if (!file?.type.startsWith('image/')) return; if (state.imageUrl) URL.revokeObjectURL(state.imageUrl); state.imageFile = file; state.imageUrl = URL.createObjectURL(file); const image = new Image(); image.onload = () => { state.imageInfo = { width: image.naturalWidth, height: image.naturalHeight }; $('#imagePreview').classList.remove('empty'); $('#imagePreview').innerHTML = `<img src="${state.imageUrl}" alt="선택한 이미지" />`; $('#imageMeta').textContent = `${image.naturalWidth} × ${image.naturalHeight}px · ${formatBytes(file.size)}`; $('#imageDownload').disabled = false; if (toolId === 'image-resize') { $('#imageWidth').value = image.naturalWidth; $('#imageHeight').value = image.naturalHeight; } }; image.src = state.imageUrl; };
  input.addEventListener('change', () => load(input.files[0]));
  $('#imageReset').addEventListener('click', () => { input.value = ''; state.imageFile = null; $('#imagePreview').classList.add('empty'); $('#imagePreview').textContent = '이미지를 선택하면 여기에 미리보기가 나타납니다.'; $('#imageDownload').disabled = true; $('#imageMeta').textContent = '먼저 이미지를 선택하세요.'; });
  if (toolId === 'image-resize') { $('#imageWidth').addEventListener('input', () => { if ($('#imageKeepRatio').checked && state.imageInfo) $('#imageHeight').value = Math.max(1, Math.round(Number($('#imageWidth').value) * state.imageInfo.height / state.imageInfo.width)); }); $('#imageHeight').addEventListener('input', () => { if ($('#imageKeepRatio').checked && state.imageInfo) $('#imageWidth').value = Math.max(1, Math.round(Number($('#imageHeight').value) * state.imageInfo.width / state.imageInfo.height)); }); }
  if (toolId === 'image-compress') $('#imageQuality').addEventListener('input', () => { $('#imageQualityValue').textContent = `${$('#imageQuality').value}%`; $('#imageQualityValue2').textContent = $('#imageQuality').value; });
  $('#imageDownload').addEventListener('click', async () => { if (!state.imageFile || !state.imageInfo) return; const image = new Image(); image.src = state.imageUrl; await new Promise((resolve) => { image.onload = resolve; }); const crop = toolId === 'image-rotate' ? Math.min(Math.max(0, Number($('#imageCrop').value) || 0), Math.floor(Math.min(state.imageInfo.width, state.imageInfo.height) / 2)) : 0; const angle = toolId === 'image-rotate' ? Number($('#imageRotation').value) : 0; const radians = angle * Math.PI / 180; const sourceWidth = state.imageInfo.width - crop * 2; const sourceHeight = state.imageInfo.height - crop * 2; const rotated = angle === 90 || angle === 270; const width = toolId === 'image-resize' ? Math.max(1, Number($('#imageWidth').value)) : rotated ? sourceHeight : sourceWidth; const height = toolId === 'image-resize' ? Math.max(1, Number($('#imageHeight').value)) : rotated ? sourceWidth : sourceHeight; const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); if (toolId === 'image-rotate') { context.translate(width / 2, height / 2); context.rotate(radians); context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight); } else context.drawImage(image, 0, 0, width, height); const mime = $('#imageFormat').value; const quality = toolId === 'image-compress' ? Number($('#imageQuality').value) / 100 : .92; canvas.toBlob((blob) => { if (blob) { const suffix = toolId === 'image-resize' ? 'resized' : toolId === 'image-compress' ? 'compressed' : toolId === 'image-privacy' ? 'privacy-clean' : 'edited'; downloadBlob(blob, `${state.imageFile.name.replace(/\.[^.]+$/, '')}_${suffix}.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`); showNotice('#imageNotice', toolId === 'image-privacy' ? '새 이미지로 저장했습니다. 원본의 메타데이터는 결과 파일에 포함되지 않습니다.' : '처리한 파일을 저장했습니다.'); } }, mime, quality); });
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function transformText(value, mode, options = {}) {
  if (mode === 'mask') {
    let result = value;
    if (options.resident !== false) result = result.replace(/\b(\d{6})[-\s]?\d{7}\b/g, '$1-*******');
    if (options.phone !== false) result = result.replace(/\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, (match) => `${match.slice(0, 3)}-****-${match.replace(/\D/g, '').slice(-4)}`);
    if (options.email !== false) result = result.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 가림]');
    if (options.account !== false) result = result.replace(/\b\d{3,6}[-\s]?\d{2,6}[-\s]?\d{2,6}\b/g, (match) => `${match.split(/[-\s]/)[0].slice(0, 4)}-****-****`);
    return result;
  }
  if (mode === 'replace') {
    const find = String(options.find || '');
    if (!find) return value;
    if (options.ignoreCase) return value.replace(new RegExp(escapeRegExp(find), 'gi'), String(options.replaceWith || ''));
    return value.split(find).join(String(options.replaceWith || ''));
  }
  if (mode === 'clean') return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map((line) => line.trim()).join('\n').trim();
  if (mode === 'number') return value.split('\n').map((line, index) => { const clean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim(); return clean ? `${index + 1}. ${clean}` : ''; }).join('\n');
  return value.replace(/[*_`#>]/g, '');
}

function aiErrorMessage(error) {
  const message = String(error?.message || error || '');
  if (message.includes('ollama_unavailable') || message.includes('Failed to fetch')) return 'Ollama가 실행 중인지 확인하세요. 로컬 AI 보조 설정에서 설치·연결 상태를 먼저 확인해 주세요.';
  if (message.includes('ollama_http_404')) return '선택한 모델이 아직 이 PC에 없습니다. 로컬 AI 보조 설정에서 모델을 준비해 주세요.';
  if (message.includes('ollama_timeout')) return '모델 응답 시간이 초과되었습니다. 더 작은 모델을 선택하거나 입력을 줄여 다시 시도해 주세요.';
  return message || '로컬 AI 작업을 완료하지 못했습니다.';
}

async function fetchLocalAiCapabilities() {
  const response = await fetch('./api/capabilities', { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? '기관 로그인 후 로컬 AI 상태를 확인할 수 있습니다.' : `capabilities_http_${response.status}`);
  const capabilities = await response.json();
  state.aiCapabilities = capabilities;
  return capabilities;
}

function preferredAiModel() {
  return state.aiCapabilities?.ollama?.recommendation?.installedModel
    || state.aiCapabilities?.ollama?.recommendation?.model
    || 'qwen2.5:7b';
}

async function runLocalAi(task, text, contextText = '') {
  if (!String(text || '').trim()) throw new Error('AI에 보낼 내용을 먼저 입력해 주세요.');
  const capabilities = state.aiCapabilities || await fetchLocalAiCapabilities();
  if (!capabilities.ollama?.available) throw new Error('ollama_unavailable');
  const response = await fetch('./api/ai/assist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, text, contextText, model: preferredAiModel() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `ai_assist_http_${response.status}`);
  return payload.result;
}

function bindText() {
  const input = $('#textInput');
  const output = $('#textOutput');
  let aiResult = '';
  const update = () => {
    const value = transformText(input.value, state.textMode, { resident: $('#maskResident')?.checked, phone: $('#maskPhone')?.checked, email: $('#maskEmail')?.checked, account: $('#maskAccount')?.checked, find: $('#replaceFind')?.value, replaceWith: $('#replaceWith')?.value, ignoreCase: $('#replaceIgnoreCase')?.checked });
    $('#textCount').textContent = `${input.value.length.toLocaleString()}자`;
    $('#textResultCount').textContent = `결과 ${value.length.toLocaleString()}자`;
    $('#textResultBytes').textContent = `UTF-8 ${new TextEncoder().encode(value).length.toLocaleString()} byte`;
    output.textContent = value || '원문을 입력하면 결과가 여기에 표시됩니다.';
    output.classList.toggle('empty', !value);
    $('#textDownload').disabled = !value;
    if (!aiResult || value !== aiResult) $('#textAiApply').classList.add('hidden');
  };
  const updateOptions = () => { $('#maskOptions').classList.toggle('hidden', state.textMode !== 'mask'); $('#replaceOptions').classList.toggle('hidden', state.textMode !== 'replace'); };
  input.addEventListener('input', update);
  $$('.text-options input').forEach((control) => control.addEventListener('input', update));
  $$('.tool-chip').forEach((button) => button.addEventListener('click', () => { state.textMode = button.dataset.textMode; $$('.tool-chip').forEach((item) => item.classList.toggle('active', item === button)); $('#textResultLabel').textContent = button.textContent + ' 결과'; updateOptions(); update(); }));
  $('#textClear').addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  $('#textCopy').addEventListener('click', async () => { if (!input.value) return; await navigator.clipboard?.writeText(output.textContent); showNotice('#textPrivacy', '결과를 클립보드에 복사했습니다.'); });
  $('#textDownload').addEventListener('click', () => downloadBlob(new Blob([output.textContent], { type: 'text/plain;charset=utf-8' }), 'dawith-정리된-텍스트.txt'));
  $('#textAiAssist').addEventListener('click', async () => {
    if (!input.value.trim()) return showNotice('#textPrivacy', '원문을 먼저 입력해 주세요.', true);
    const button = $('#textAiAssist');
    button.disabled = true;
    button.textContent = '로컬 AI 처리 중…';
    try {
      aiResult = await runLocalAi('text-clean', input.value);
      output.textContent = aiResult;
      output.classList.remove('empty');
      $('#textResultLabel').textContent = '로컬 AI 문장 정리 결과 · 검토 필요';
      $('#textResultCount').textContent = `결과 ${aiResult.length.toLocaleString()}자`;
      $('#textResultBytes').textContent = `UTF-8 ${new TextEncoder().encode(aiResult).length.toLocaleString()} byte`;
      $('#textDownload').disabled = false;
      $('#textAiApply').classList.remove('hidden');
      showNotice('#textPrivacy', '로컬 모델이 만든 초안입니다. 원문과 대조한 뒤 적용하세요.');
    } catch (error) {
      showNotice('#textPrivacy', aiErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '로컬 AI로 다듬기';
    }
  });
  $('#textSubscriptionAssist').addEventListener('click', async () => {
    if (!input.value.trim()) return showNotice('#textPrivacy', '원문을 먼저 입력해 주세요.', true);
    const status = await fetchSubscriptionStatus().catch(() => null);
    const available = Object.values(status?.providers || {}).filter((item) => item.state === 'ready');
    if (!available.length) return showNotice('#textPrivacy', '연결된 외부 AI가 없습니다. AI 보조·연결 센터에서 먼저 연결하세요.', true);
    const provider = available[0].provider;
    const providerName = providerLabel(provider);
    if (!window.confirm(`${providerName} 연결로 원문을 외부 전송합니다. 기관 승인과 개인정보 보호 기준을 확인했습니까?`)) return;
    const button = $('#textSubscriptionAssist');
    button.disabled = true;
    button.textContent = '구독 AI 처리 중…';
    try {
      aiResult = await runSubscriptionAi({ provider, task: 'text-clean', text: input.value });
      output.textContent = aiResult;
      output.classList.remove('empty');
      $('#textResultLabel').textContent = `${providerName} 결과 · 외부 전송 · 검토 필요`;
      $('#textResultCount').textContent = `결과 ${aiResult.length.toLocaleString()}자`;
      $('#textResultBytes').textContent = `UTF-8 ${new TextEncoder().encode(aiResult).length.toLocaleString()} byte`;
      $('#textDownload').disabled = false;
      $('#textAiApply').classList.remove('hidden');
      showNotice('#textPrivacy', `${providerName} 결과입니다. 외부 전송 결과이므로 원문과 대조한 뒤 적용하세요.`);
    } catch (error) {
      showNotice('#textPrivacy', subscriptionErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '구독 AI 사용';
    }
  });
  $('#textAiApply').addEventListener('click', () => { if (!aiResult) return; input.value = aiResult; aiResult = ''; update(); input.focus(); showNotice('#textPrivacy', 'AI 결과를 원문에 적용했습니다.'); });
  updateOptions();
  update();
}

function parseLocalDate(value) { const digits = String(value || '').replace(/\D/g, ''); if (digits.length !== 8) return null; const year = Number(digits.slice(0, 4)); const month = Number(digits.slice(4, 6)); const day = Number(digits.slice(6, 8)); const date = new Date(year, month - 1, day); return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null; }
function compactDate(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(''); }
function bindAge() {
  const today = new Date();
  $('#asOfDate').value = compactDate(today);
  const update = () => {
    const birth = parseLocalDate($('#birthDate').value);
    const asOf = parseLocalDate($('#asOfDate').value);
    const result = $('#ageResult');
    result.className = 'calculator-result';
    if (!birth || !asOf) { result.innerHTML = '<span class="result-label">생년월일과 기준일을 YYYYMMDD 8자리로 입력하세요.</span>'; return; }
    if (birth > asOf) { result.classList.add('error-notice'); result.innerHTML = '<span class="result-label">생년월일은 기준일보다 늦을 수 없습니다.</span>'; return; }
    let years = asOf.getFullYear() - birth.getFullYear();
    let months = asOf.getMonth() - birth.getMonth();
    let days = asOf.getDate() - birth.getDate();
    if (days < 0) { months -= 1; days += new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate(); }
    if (months < 0) { years -= 1; months += 12; }
    const category = years < 7 ? '영유아' : years < 13 ? '초등 연령' : years < 19 ? '청소년' : '성인';
    result.innerHTML = `<span class="result-label">${formatDate(asOf)} 기준</span><strong>만 ${years}세</strong><small>${months}개월 ${days}일 · ${category}</small><div class="calculator-facts"><div><span>생년월일</span><b>${compactDate(birth).replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}</b></div><div><span>다음 생일</span><b>${birth.getMonth() + 1}월 ${birth.getDate()}일</b></div></div>`;
  };
  $('#birthDate').addEventListener('input', update);
  $('#asOfDate').addEventListener('input', update);
  $('#ageToday').addEventListener('click', () => { $('#asOfDate').value = compactDate(new Date()); update(); });
  $('#ageCalculate').addEventListener('click', update);
  update();
}

const koreanDigits = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const smallUnits = ['', '십', '백', '천'];
const largeUnits = ['', '만', '억', '조', '경'];
function fourDigitToKorean(value) { let text = ''; String(value).padStart(4, '0').split('').map(Number).forEach((digit, index) => { if (!digit) return; const position = 3 - index; text += (digit === 1 && position > 0 ? '' : koreanDigits[digit]) + smallUnits[position]; }); return text; }
function numberToKorean(value) { if (value === 0) return '영'; let number = Math.floor(value); let index = 0; let result = ''; while (number > 0) { const part = number % 10000; if (part) result = `${fourDigitToKorean(part)}${largeUnits[index]}${result}`; number = Math.floor(number / 10000); index += 1; } return result; }
function bindMoney() { const input = $('#moneyInput'); const update = () => { const number = Number(input.value.replace(/[^\d]/g, '')); const result = $('#moneyResult'); if (!input.value || !Number.isFinite(number)) { result.innerHTML = '<span class="result-label">결과가 여기에 표시됩니다.</span>'; $('#moneyCopy').disabled = true; return; } const text = `금 ${numberToKorean(number)}원정`; result.innerHTML = `<span class="result-label">한글 표기</span><strong style="font-size:26px">${text}</strong><small>${number.toLocaleString('ko-KR')}원</small>`; $('#moneyCopy').disabled = false; $('#moneyCopy').dataset.copy = text; }; input.addEventListener('input', update); $('#moneyCopy').addEventListener('click', async () => { await navigator.clipboard?.writeText($('#moneyCopy').dataset.copy || ''); showNotice('#moneyResult', '결과를 복사했습니다.'); }); }
function bindDate() { const start = $('#dateStart'); const end = $('#dateEnd'); const update = () => { if (!start.value || !end.value) return; const first = parseLocalDate(start.value); const last = parseLocalDate(end.value); const days = Math.round((last - first) / 86400000); const result = $('#dateResult'); result.innerHTML = days < 0 ? '<span class="result-label">종료일을 확인해 주세요.</span>' : `<span class="result-label">두 날짜 사이</span><strong>${days + 1}일</strong><small>날짜 차이 ${days}일 · 시작일과 종료일을 모두 포함한 기간</small>`; }; start.addEventListener('change', update); end.addEventListener('change', update); }

function bindAiSetup() {
  const status = $('#aiSetupStatus');
  const notice = $('#aiSetupNotice');
  const modelSelect = $('#aiModelSelect');
  const refresh = async () => {
    status.textContent = '확인 중…';
    $('#aiRefresh').disabled = true;
    $('#aiPullModel').disabled = true;
    try {
      const capabilities = await fetchLocalAiCapabilities();
      const system = capabilities.system || {};
      const ollama = capabilities.ollama || {};
      const recommendation = ollama.recommendation || {};
      $('#aiSystemSpec').textContent = `${system.platformLabel || system.platform || '이 PC'} · RAM ${system.memoryGB || '?'}GB · CPU ${system.cpuCores || '?'}코어`;
      $('#aiRecommendation').textContent = `${recommendation.model || '확인 필요'} · ${recommendation.label || '사양 확인 필요'}`;
      const names = [...new Set([recommendation.model, ...(ollama.models || []).map((model) => typeof model === 'string' ? model : model.name)].filter(Boolean))];
      modelSelect.innerHTML = names.length ? names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}${name === recommendation.model ? ' · 추천' : ''}</option>`).join('') : '<option value="">모델 정보 없음</option>';
      if (recommendation.model) modelSelect.value = recommendation.model;
      $('#aiModelHelp').textContent = ollama.available
        ? recommendation.installedModel ? `${recommendation.installedModel}이 준비되어 있습니다. 다른 모델을 고르면 내려받을 수 있습니다.` : 'Ollama 연결됨. 추천 모델을 준비하면 기능 화면에서 사용할 수 있습니다.'
        : 'Ollama를 설치하고 실행한 뒤 상태 다시 확인을 누르세요.';
      status.textContent = ollama.available ? (recommendation.installedModel ? '모델 준비됨' : 'Ollama 연결됨') : 'Ollama 연결 필요';
      $('#aiPullModel').disabled = !ollama.available || !modelSelect.value;
      notice.hidden = true;
    } catch (error) {
      state.aiCapabilities = null;
      $('#aiSystemSpec').textContent = '로컬 서버 또는 EXE에서 확인 가능';
      $('#aiRecommendation').textContent = '설정 상태를 읽지 못했습니다.';
      modelSelect.innerHTML = '<option value="qwen2.5:7b">qwen2.5:7b · 기본 추천</option>';
      status.textContent = '연결 확인 필요';
      notice.hidden = false;
      notice.className = 'notice error-notice';
      notice.textContent = aiErrorMessage(error);
    } finally {
      $('#aiRefresh').disabled = false;
    }
  };
  $('#aiRefresh').addEventListener('click', refresh);
  $('#aiPullModel').addEventListener('click', async () => {
    const model = modelSelect.value;
    if (!model) return;
    const button = $('#aiPullModel');
    button.disabled = true;
    button.textContent = '모델 준비 중…';
    notice.hidden = false;
    notice.className = 'notice';
    notice.textContent = `${model}을 준비하는 중입니다. 모델 크기에 따라 시간이 걸릴 수 있습니다.`;
    try {
      const response = await fetch('./api/ollama/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `ollama_pull_http_${response.status}`);
      notice.textContent = `${model} 준비가 끝났습니다. 텍스트·기관 양식 화면에서 로컬 AI를 사용할 수 있습니다.`;
      await refresh();
    } catch (error) {
      notice.className = 'notice error-notice';
      notice.textContent = aiErrorMessage(error);
      button.disabled = false;
    } finally {
      button.textContent = '모델 준비';
    }
  });
  $('#subscriptionRefresh').addEventListener('click', refreshSubscriptionCards);
  $('#subscriptionCards').addEventListener('click', async (event) => {
    const connectButton = event.target.closest('[data-ai-connect]');
    const disconnectButton = event.target.closest('[data-ai-disconnect]');
    const cliLoginButton = event.target.closest('[data-ai-cli-login]');
    const provider = connectButton?.dataset.aiConnect || disconnectButton?.dataset.aiDisconnect || cliLoginButton?.dataset.aiCliLogin;
    if (!provider) return;
    if (cliLoginButton) {
      cliLoginButton.disabled = true;
      try {
        const response = await fetch('./api/ai/subscription/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || 'subscription_login_failed');
        showSubscriptionNotice(`${providerLabel(provider)} 로그인 창을 열었습니다. 브라우저 또는 터미널에서 로그인을 끝낸 뒤 상태를 다시 확인하세요.`);
      } catch (error) { showSubscriptionNotice(error.message || '로그인 창을 열지 못했습니다.', true); }
      finally { cliLoginButton.disabled = false; }
      return;
    }
    if (disconnectButton) {
      if (!window.confirm('이 기기에서 저장한 AI 연결 정보를 삭제할까요?')) return;
      await fetch('./api/ai/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider }) });
      return refreshSubscriptionCards();
    }
    let apiKey = '';
    if (provider === 'gemini') {
      apiKey = window.prompt('Google AI Studio에서 만든 Gemini API 키를 붙여 넣으세요. 키는 암호화해 이 기기에만 저장합니다.') || '';
      if (!apiKey) return;
    }
    if (!window.confirm(`${provider === 'chatgpt' ? 'ChatGPT' : provider === 'openrouter' ? 'OpenRouter 무료' : 'Google Gemini'} 연결을 시작합니다. 선택한 서비스로 인증 정보 또는 API 요청이 전달됩니다. 계속할까요?`)) return;
    connectButton.disabled = true;
    connectButton.textContent = '연결 중…';
    try {
      const response = await fetch('./api/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, apiKey, confirmExternal: true }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || 'ai_connect_failed');
      showSubscriptionNotice(`${provider} 연결을 완료했습니다. 문서 화면에서 사용할 AI를 선택하세요.`);
    } catch (error) {
      showSubscriptionNotice(error.message || 'AI 연결에 실패했습니다.', true);
    } finally {
      await refreshSubscriptionCards();
    }
  });
  $('#subscriptionAssist').addEventListener('click', async () => {
    const text = $('#subscriptionText').value.trim();
    if (!text) return showSubscriptionNotice('개인정보가 없는 짧은 문장으로 먼저 테스트하세요.', true);
    if (!window.confirm('입력한 텍스트를 선택한 구독 AI 회사로 전송합니다. 계속할까요?')) return;
    const button = $('#subscriptionAssist');
    button.disabled = true;
    button.textContent = '처리 중…';
    try {
      const result = await runSubscriptionAi({ provider: $('#subscriptionProvider').value, task: 'text-clean', text });
      showSubscriptionNotice(`결과를 받았습니다. ${result.slice(0, 240)}${result.length > 240 ? '…' : ''}`);
    } catch (error) {
      showSubscriptionNotice(subscriptionErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '선택한 구독으로 정리';
    }
  });
  void refresh();
  void refreshSubscriptionCards();
}

async function fetchSubscriptionStatus() {
  const response = await fetch('./api/ai/subscription/status', { cache: 'no-store' });
  if (!response.ok) throw new Error(`subscription_status_http_${response.status}`);
  return response.json();
}

function subscriptionStateLabel(state) {
  return { ready: '사용 가능', 'not-installed': '설치 필요', 'not-connected': '연결 필요', 'signed-out': '로그인 필요', unknown: '확인 필요', error: '확인 실패' }[state] || '확인 중';
}

function renderSubscriptionCards(payload) {
  const providers = Object.values(payload?.providers || {});
  $('#subscriptionCards').innerHTML = providers.length ? providers.map((item) => {
    const connected = item.state === 'ready';
    const action = ['openrouter', 'gemini', 'chatgpt'].includes(item.provider)
      ? connected ? `<button class="icon-text-button" type="button" data-ai-disconnect="${escapeHtml(item.provider)}">연결 해제</button>` : `<button class="secondary-button" type="button" data-ai-connect="${escapeHtml(item.provider)}">${item.provider === 'chatgpt' ? 'ChatGPT로 계속' : item.provider === 'openrouter' ? '브라우저로 무료 연결' : 'Gemini 키 연결'}</button>`
      : ['claude-code', 'codex', 'gemini-cli'].includes(item.provider) && item.state !== 'not-installed' ? `<button class="secondary-button" type="button" data-ai-cli-login="${escapeHtml(item.provider)}">${item.provider === 'gemini-cli' ? 'Google 로그인 시작' : 'CLI 로그인 시작'}</button>` : '';
    const detail = connected ? `${item.model ? `${escapeHtml(item.model)} · ` : ''}이 기기에서 연결됨` : item.state === 'not-installed' ? '공식 프로그램을 설치한 뒤 연결하세요.' : item.state === 'not-connected' ? '연결 버튼을 누르면 공식 인증 화면이 열립니다.' : '공식 프로그램의 로그인 상태를 확인하세요.';
    const source = item.kind === 'oauth' ? '브라우저 인증' : item.kind === 'key' ? '키는 이 기기에 암호화 저장' : item.installed ? '프로그램 발견' : '프로그램 없음';
    return `<div class="subscription-card"><div><b>${escapeHtml(item.label)}</b><span>${source}</span></div><strong class="subscription-state-${escapeHtml(item.state)}">${subscriptionStateLabel(item.state)}</strong><small>${detail}</small>${action}${item.state === 'not-installed' ? `<a href="${escapeHtml(item.installUrl)}" target="_blank" rel="noreferrer">공식 설치 안내 ↗</a>` : ''}</div>`;
  }).join('') : '<p class="muted-text">구독 상태를 읽지 못했습니다.</p>';
  const select = $('#subscriptionProvider');
  if (select) {
    const selected = select.value;
    const usable = providers.filter((item) => item.state === 'ready');
    select.innerHTML = usable.length ? usable.map((item) => `<option value="${escapeHtml(item.provider)}">${escapeHtml(item.label)}</option>`).join('') : '<option value="">연결된 외부 AI 없음</option>';
    if (usable.some((item) => item.provider === selected)) select.value = selected;
  }
}

async function refreshSubscriptionCards() {
  const button = $('#subscriptionRefresh');
  if (!button) return;
  button.disabled = true;
  try { renderSubscriptionCards(await fetchSubscriptionStatus()); }
  catch { $('#subscriptionCards').innerHTML = '<p class="muted-text">로컬 EXE 또는 localhost에서만 구독 상태를 확인할 수 있습니다.</p>'; }
  finally { button.disabled = false; }
}

async function runSubscriptionAi(input) {
  const response = await fetch('./api/ai/subscription/assist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, confirmExternal: true }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `subscription_assist_http_${response.status}`);
  return payload.result;
}

function showSubscriptionNotice(message, error = false) {
  const target = $('#subscriptionNotice');
  if (!target) return;
  target.textContent = message;
  target.className = error ? 'field-hint error-text' : 'field-hint';
}

function subscriptionErrorMessage(error) {
  const message = String(error?.message || error || '');
  if (message.includes('not_installed')) return '선택한 구독 프로그램이 설치되어 있지 않습니다.';
  if (message.includes('not_connected')) return '먼저 AI 보조·연결 센터에서 해당 provider를 연결하세요.';
  if (message.includes('chatgpt')) return 'ChatGPT 연결이 만료되었거나 요금제 사용 권한이 없습니다. 연결을 다시 확인하세요.';
  if (message.includes('openrouter')) return 'OpenRouter 무료 연결 상태와 무료 모델 한도를 확인하세요.';
  if (message.includes('gemini')) return 'Gemini 키가 만료되었거나 모델 요청이 거절되었습니다.';
  if (message.includes('timeout')) return '구독 프로그램 응답 시간이 초과되었습니다.';
  if (message.includes('signed')) return '구독 프로그램에 로그인한 뒤 다시 시도하세요.';
  return '구독 AI 결과를 받지 못했습니다. 프로그램 로그인 상태와 설치를 확인하세요.';
}

function bindTemplateStudio() {
  const templateSelect = $('#templateSelect'); const templateBody = $('#templateBody'); const profileKey = 'dawith-institution-profile-v1';
  let aiPreviousPreview = '';
  const fields = { organization: $('#profileOrganization'), manager: $('#profileManager'), date: $('#templateDate'), project: $('#templateProject'), author: $('#templateAuthor'), attendees: $('#templateAttendees'), purpose: $('#templatePurpose'), content: $('#templateContent'), decisions: $('#templateDecisions'), actions: $('#templateActions') };
  const today = compactDate(new Date()).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  fields.date.value = today;
  try { const profile = JSON.parse(localStorage.getItem(profileKey) || '{}'); fields.organization.value = profile.organization || ''; fields.manager.value = profile.manager || ''; fields.author.value = profile.manager || ''; } catch { /* localStorage may be unavailable */ }
  const currentTemplate = () => getTemplateCatalog().find((template) => template.id === templateSelect.value) || builtInTemplates[0];
  const loadTemplate = () => { const template = currentTemplate(); templateBody.value = template.body; $('#templateName').value = template.id.startsWith('custom-') ? template.title : ''; update(); };
  const values = () => ({ '기관명': fields.organization.value.trim() || '기관명 입력 필요', '문서일': fields.date.value ? formatDate(new Date(`${fields.date.value}T00:00:00`)) : '문서일 입력 필요', '사업명': fields.project.value.trim() || '사업명 입력 필요', '작성자': fields.author.value.trim() || fields.manager.value.trim() || '작성자 입력 필요', '참석자': fields.attendees.value.trim() || '참석자 입력 필요', '목적': fields.purpose.value.trim() || '내용 입력 필요', '내용': fields.content.value.trim() || '내용 입력 필요', '결정사항': fields.decisions.value.trim() || '내용 입력 필요', '후속조치': fields.actions.value.trim() || '내용 입력 필요' });
  const update = () => { let output = templateBody.value; for (const [key, value] of Object.entries(values())) output = output.split(`{{${key}}}`).join(value); $('#templatePreview').textContent = output || '양식 내용을 입력하세요.'; $('#templateAiRevert').classList.add('hidden'); aiPreviousPreview = ''; };
  const applyAiPreview = (result, providerLabel) => { aiPreviousPreview = $('#templatePreview').textContent; $('#templatePreview').textContent = result; $('#templateAiRevert').classList.remove('hidden'); showNotice('#templateNotice', `${providerLabel} 초안을 미리보기에 적용했습니다. 원문과 대조한 뒤 확정하세요.`); };
  $('#profileSave').addEventListener('click', () => { try { localStorage.setItem(profileKey, JSON.stringify({ organization: fields.organization.value.trim(), manager: fields.manager.value.trim() })); showNotice('#templateNotice', '기관 기본정보를 이 PC에 저장했습니다.'); } catch { showNotice('#templateNotice', '이 브라우저에서는 저장할 수 없습니다.', true); } });
  templateSelect.addEventListener('change', loadTemplate);
  Object.values(fields).forEach((field) => field.addEventListener('input', update));
  templateBody.addEventListener('input', update);
  $('#templateSave').addEventListener('click', () => { const title = $('#templateName').value.trim(); const body = templateBody.value.trim(); if (!title || !body) return showNotice('#templateNotice', '양식 이름과 본문을 모두 입력해 주세요.', true); let custom = []; try { custom = JSON.parse(localStorage.getItem('dawith-custom-templates-v1') || '[]'); } catch { custom = []; } const saved = { id: `custom-${Date.now()}`, title, body }; custom.push(saved); try { localStorage.setItem('dawith-custom-templates-v1', JSON.stringify(custom)); } catch { return showNotice('#templateNotice', '저장 공간을 사용할 수 없습니다.', true); } templateSelect.innerHTML = getTemplateCatalog().map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.title)}</option>`).join(''); templateSelect.value = saved.id; showNotice('#templateNotice', '내 양식으로 저장했습니다.'); });
  $('#templateCopy').addEventListener('click', async () => { await navigator.clipboard?.writeText($('#templatePreview').textContent || ''); showNotice('#templateNotice', '초안을 클립보드에 복사했습니다.'); });
  $('#templateDownload').addEventListener('click', () => { const title = currentTemplate().title || '기관문서'; const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:Arial,sans-serif;line-height:1.75;white-space:pre-wrap">${escapeHtml($('#templatePreview').textContent || '').replace(/\n/g, '<br>')}</body>`; downloadBlob(new Blob([html], { type: 'application/msword;charset=utf-8' }), `${title}_${compactDate(new Date())}.doc`); });
  $('#templateAiAssist').addEventListener('click', async () => {
    const text = $('#templatePreview').textContent.trim();
    if (!text || text === '내용을 입력하면 초안이 여기에 표시됩니다.') return showNotice('#templateNotice', '먼저 문서 내용을 입력해 주세요.', true);
    const button = $('#templateAiAssist');
    button.disabled = true;
    button.textContent = '로컬 AI 처리 중…';
    try {
      const result = await runLocalAi('document-draft', text, `${fields.organization.value.trim()} ${fields.project.value.trim()}`.trim());
      applyAiPreview(result, '로컬 AI');
    } catch (error) {
      showNotice('#templateNotice', aiErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '로컬 AI로 초안 다듬기';
    }
  });
  $('#templateSubscriptionAssist').addEventListener('click', async () => {
    const text = $('#templatePreview').textContent.trim();
    if (!text || text === '내용을 입력하면 초안이 여기에 표시됩니다.') return showNotice('#templateNotice', '먼저 문서 내용을 입력해 주세요.', true);
    const status = await fetchSubscriptionStatus().catch(() => null);
    const available = Object.values(status?.providers || {}).filter((item) => item.state === 'ready');
    if (!available.length) return showNotice('#templateNotice', '연결된 외부 AI가 없습니다. AI 보조·연결 센터에서 먼저 연결하세요.', true);
    const provider = available[0].provider;
    const providerName = providerLabel(provider);
    if (!window.confirm(`${providerName} 연결로 문서 초안을 외부 전송합니다. 기관 승인과 개인정보 보호 기준을 확인했습니까?`)) return;
    const button = $('#templateSubscriptionAssist');
    button.disabled = true;
    button.textContent = '구독 AI 처리 중…';
    try {
      const result = await runSubscriptionAi({ provider, task: 'document-draft', text, contextText: `${fields.organization.value.trim()} ${fields.project.value.trim()}`.trim() });
      applyAiPreview(result, `${providerName} 결과`);
      showNotice('#templateNotice', `${providerName} 결과입니다. 외부 전송 결과이므로 원문과 대조하세요.`);
    } catch (error) {
      showNotice('#templateNotice', subscriptionErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '구독 AI 사용';
    }
  });
  const consumeHandoff = () => {
    let handoff = null;
    try { handoff = JSON.parse(sessionStorage.getItem('dawith-template-handoff-v1') || 'null'); sessionStorage.removeItem('dawith-template-handoff-v1'); } catch { handoff = null; }
    if (!handoff) return;
    if (getTemplateCatalog().some((template) => template.id === handoff.templateId)) templateSelect.value = handoff.templateId;
    loadTemplate();
    if (handoff.organization) fields.organization.value = handoff.organization;
    if (handoff.author) fields.author.value = handoff.author;
    fields.project.value = handoff.project || '';
    fields.attendees.value = handoff.attendees || '';
    fields.purpose.value = handoff.purpose || '';
    fields.content.value = handoff.content || '';
    fields.decisions.value = handoff.decisions || '';
    fields.actions.value = handoff.actions || '';
    update();
    showNotice('#templateNotice', '정리한 회의록을 양식에 채웠습니다. 기관명·작성자를 확인하세요.');
  };
  $('#templateAiRevert').addEventListener('click', () => { if (!aiPreviousPreview) return; $('#templatePreview').textContent = aiPreviousPreview; aiPreviousPreview = ''; $('#templateAiRevert').classList.add('hidden'); showNotice('#templateNotice', 'AI 결과를 적용 전 미리보기로 되돌렸습니다.'); });
  loadTemplate();
  consumeHandoff();
}
function bindAttendance() {
  const storageKey = 'dawith-attendance-v1';
  const statuses = ['미체크', '이용', '대기', '종결', '결석'];
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { rows = []; }
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { /* storage may be unavailable */ } };
  const render = () => {
    $('#attendanceSummary').textContent = `${rows.length}명`;
    $('#attendanceCounts').innerHTML = statuses.map((status) => `<span><b>${rows.filter((row) => row.status === status).length}</b>${status}</span>`).join('');
    $('#attendanceRows').innerHTML = rows.length ? rows.map((row, index) => `<tr><td><input class="attendance-name" data-index="${index}" value="${escapeHtml(row.name)}" aria-label="명단 ${index + 1}" /></td><td><select class="attendance-status" data-index="${index}" aria-label="${escapeHtml(row.name)} 상태">${statuses.map((status) => `<option value="${status}" ${row.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></td><td><button class="icon-text-button attendance-remove" data-index="${index}" type="button">삭제</button></td></tr>`).join('') : '<tr><td colspan="3" class="empty-table">명단을 불러오면 여기에 표시됩니다.</td></tr>';
    $('#attendanceCsv').disabled = !rows.length;
  };
  $('#attendanceLoad').addEventListener('click', () => { rows = $('#attendanceInput').value.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name, status: '미체크' })); persist(); render(); });
  $('#attendanceClear').addEventListener('click', () => { rows = []; $('#attendanceInput').value = ''; persist(); render(); });
  $('#attendanceRows').addEventListener('input', (event) => { const index = Number(event.target.dataset.index); if (event.target.classList.contains('attendance-name') && rows[index]) { rows[index].name = event.target.value; persist(); } });
  $('#attendanceRows').addEventListener('change', (event) => { const index = Number(event.target.dataset.index); if (event.target.classList.contains('attendance-status') && rows[index]) { rows[index].status = event.target.value; persist(); render(); } });
  $('#attendanceRows').addEventListener('click', (event) => { const button = event.target.closest('.attendance-remove'); if (!button) return; rows.splice(Number(button.dataset.index), 1); persist(); render(); });
  $('#attendanceCsv').addEventListener('click', () => { const csv = `명단,상태\n${rows.map((row) => [row.name, row.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')}`; downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `인원현황_${compactDate(new Date())}.csv`); });
  render();
}
function bindDutySchedule() {
  let rows = [];
  const render = () => {
    $('#dutySummary').textContent = rows.length ? `${rows.length}일 편성` : '편성 전';
    $('#dutyRows').innerHTML = rows.length ? rows.map((row, index) => `<tr><td>${row.date}</td><td>${row.weekday}</td><td><select class="duty-assignee" data-index="${index}" aria-label="${row.date} 담당자">${row.staff.map((person) => `<option value="${escapeHtml(person)}" ${row.assignee === person ? 'selected' : ''}>${escapeHtml(person)}</option>`).join('')}</select></td></tr>`).join('') : '<tr><td colspan="3" class="empty-table">조건을 입력하고 당직표를 만들어 주세요.</td></tr>';
    $('#dutyCsv').disabled = !rows.length;
  };
  $('#dutyMake').addEventListener('click', () => {
    const staff = $('#dutyStaff').value.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean);
    const start = parseLocalDate($('#dutyStart').value); const end = parseLocalDate($('#dutyEnd').value);
    if (!staff.length) return showNotice('.duty-entry .field-hint', '직원 이름을 한 명 이상 입력해 주세요.', true);
    if (!start || !end || start > end) return showNotice('.duty-entry .field-hint', '시작일과 종료일을 확인해 주세요.', true);
    rows = []; const cursor = new Date(start);
    while (cursor <= end && rows.length < 366) { rows.push({ date: compactDate(cursor).replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3'), weekday: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(cursor), assignee: staff[rows.length % staff.length], staff }); cursor.setDate(cursor.getDate() + 1); }
    render();
  });
  $('#dutyRows').addEventListener('change', (event) => { const index = Number(event.target.dataset.index); if (event.target.classList.contains('duty-assignee') && rows[index]) rows[index].assignee = event.target.value; });
  $('#dutyCsv').addEventListener('click', () => { const csv = `날짜,요일,담당자\n${rows.map((row) => [row.date, row.weekday, row.assignee].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')}`; downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `당직표_${compactDate(new Date())}.csv`); });
  render();
}
function bindQr() { $('#qrMake').addEventListener('click', () => { const value = $('#qrText').value.trim(); const result = $('#qrResult'); if (!value) return showNotice('#qrResult', '링크나 문구를 입력해 주세요.', true); result.classList.remove('hidden'); result.innerHTML = `<span class="result-label">입력한 내용</span><strong style="font-size:18px;word-break:break-all">${escapeHtml(value)}</strong><small>QR 생성 모듈 연결 준비됨 · 현재는 링크를 복사해 사용할 수 있습니다.</small><div class="tool-actions"><button id="qrCopy" class="secondary-button" type="button">내용 복사</button></div>`; $('#qrCopy').addEventListener('click', async () => { await navigator.clipboard?.writeText(value); showNotice('#qrResult', '내용을 복사했습니다.'); }); }); }

const recordStorageKey = 'dawith-record-drafts-v1';
const institutionProfileKey = 'dawith-institution-profile-v1';
const templateHandoffKey = 'dawith-template-handoff-v1';
const cloudProviderOrder = ['claude-code', 'codex', 'chatgpt', 'gemini-cli', 'gemini', 'openrouter'];

function readInstitutionProfile() {
  try { return JSON.parse(localStorage.getItem(institutionProfileKey) || '{}'); } catch { return {}; }
}

function readSavedRecords() {
  try { const saved = JSON.parse(localStorage.getItem(recordStorageKey) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

// Browser-only fallback for the static web build where /api is unavailable.
function buildBrowserSummary(kind, rawText, contextText = '') {
  const source = String(rawText).trim();
  const lines = source.split(/(?<=[.!?。！？])\s+|\n+/).map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  const label = (name) => source.match(new RegExp(`^\\s*(?:${name})\\s*[:：]\\s*(.+)$`, 'm'))?.[1]?.trim() || '';
  const pick = (pattern, exclude = []) => lines.filter((line) => pattern.test(line) && !exclude.includes(line) && !/^\s*(?:일시|장소|참석자?|안건)\s*[:：]/.test(line));
  const list = (items, empty = '[확인 필요]') => items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : empty;
  if (kind === 'meeting') {
    const decisions = pick(/결정|합의|확정|하기로|승인/);
    return { kind, overview: { datetime: label('일시|날짜') || '[확인 필요]', place: label('장소') || '[확인 필요]', attendees: label('참석자?') || '[확인 필요]', agenda: label('안건|회의명') || contextText || '[확인 필요]' }, discussion: list(pick(/./, decisions)), decisions: list(decisions), actions: pick(/담당|연락|신청|확인|방문|연계|예정|하기로|까지/).map((task) => ({ task, owner: '', due: task.match(/\d{1,2}월\s*\d{1,2}일(?:까지)?|다음\s*주|이번\s*주/)?.[0] || '' })) };
  }
  const future = pick(/하기로|예정|다음|계획/);
  return { kind: 'counseling', overview: contextText ? `맥락: ${contextText}` : '[확인 필요]', complaint: list(pick(/어렵|불안|걱정|힘들|호소|부담|문제|부족/)), assessment: { needs: list(pick(/필요|원함|원하|희망|요청/)), strengths: list(pick(/의지|노력|꾸준|가능|지지|참여/)), risks: list(pick(/위험|위기|폭력|학대|자해|자살|체납|퇴거|중독/), '원문에서 위험 단서를 찾지 못했습니다. 담당자 [확인 필요]') }, intervention: list(pick(/안내|설명|연계|제공|공감|격려|교육/, future)), plan: list(future) };
}

function summaryToMarkdown(summary, header = {}) {
  const title = summary.kind === 'meeting' ? '회의록' : '상담 기록';
  const meta = [header.organization && `- 기관: ${header.organization}`, header.author && `- 작성자: ${header.author}`, `- 작성일: ${formatDate(new Date())}`].filter(Boolean).join('\n');
  const cellText = (value) => String(value || '-').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  if (summary.kind === 'meeting') {
    const o = summary.overview;
    const actions = summary.actions.length ? summary.actions.map((item) => `| ${cellText(item.task)} | ${cellText(item.owner)} | ${cellText(item.due)} |`).join('\n') : '| (할 일 없음) | - | - |';
    return `# ${title}\n\n${meta}\n\n## 회의 개요\n\n- 일시: ${o.datetime || '-'}\n- 장소: ${o.place || '-'}\n- 참석자: ${o.attendees || '-'}\n- 안건: ${o.agenda || '-'}\n\n## 논의 내용\n\n${summary.discussion || '-'}\n\n## 결정 사항\n\n${summary.decisions || '-'}\n\n## 할 일\n\n| 할 일 | 담당 | 기한 |\n| --- | --- | --- |\n${actions}\n`;
  }
  const a = summary.assessment;
  return `# ${title}\n\n${meta}\n\n## 상담 개요\n\n${summary.overview || '-'}\n\n## 주요 호소\n\n${summary.complaint || '-'}\n\n## 사정\n\n### 욕구\n\n${a.needs || '-'}\n\n### 강점\n\n${a.strengths || '-'}\n\n### 위험\n\n${a.risks || '-'}\n\n## 개입 내용\n\n${summary.intervention || '-'}\n\n## 향후 계획·후속 조치\n\n${summary.plan || '-'}\n`;
}

function summaryRows(value, min) { return Math.min(12, Math.max(min, String(value || '').split('\n').length + 1)); }
function summaryField(id, label, value, rows = 4) {
  return `<div class="summary-section"><label for="${id}">${label}</label><textarea id="${id}" rows="${summaryRows(value, rows)}">${escapeHtml(value)}</textarea></div>`;
}

function actionRow(item = {}) {
  return `<tr><td><input class="action-task" aria-label="할 일" value="${escapeHtml(item.task || '')}" /></td><td><input class="action-owner" aria-label="담당" placeholder="담당" value="${escapeHtml(item.owner || '')}" /></td><td><input class="action-due" aria-label="기한" placeholder="기한" value="${escapeHtml(item.due || '')}" /></td><td><button class="icon-text-button action-remove" type="button" aria-label="이 할 일 지우기">삭제</button></td></tr>`;
}

function renderSummaryBody(summary, header = {}) {
  if (summary.kind === 'meeting') {
    const o = summary.overview;
    return `<div class="summary-header-strip"><div class="control-group"><label for="sumOrg">기관명</label><input id="sumOrg" class="wide-input" value="${escapeHtml(header.organization || '')}" placeholder="기관 문서 양식에 저장하면 자동 입력" /></div><div class="control-group"><label for="sumAuthor">작성자</label><input id="sumAuthor" class="wide-input" value="${escapeHtml(header.author || '')}" placeholder="담당자 이름" /></div><button id="sumRememberProfile" class="icon-text-button" type="button">기관명·작성자 기억하기</button></div><fieldset class="summary-section summary-grid"><legend>회의 개요</legend><label>일시<input id="sumDatetime" class="wide-input" value="${escapeHtml(o.datetime)}" /></label><label>장소<input id="sumPlace" class="wide-input" value="${escapeHtml(o.place)}" /></label><label>참석자<input id="sumAttendees" class="wide-input" value="${escapeHtml(o.attendees)}" /></label><label>안건<input id="sumAgenda" class="wide-input" value="${escapeHtml(o.agenda)}" /></label></fieldset>${summaryField('sumDiscussion', '논의 내용', summary.discussion, 6)}${summaryField('sumDecisions', '결정 사항', summary.decisions, 4)}<div class="summary-section"><div class="label-row"><span class="summary-label">할 일 (담당·기한)</span><button id="sumAddAction" class="icon-text-button" type="button">+ 할 일 추가</button></div><div class="attendance-table-wrap"><table class="attendance-table action-table"><thead><tr><th>할 일</th><th>담당</th><th>기한</th><th aria-label="삭제"></th></tr></thead><tbody id="sumActions">${summary.actions.map(actionRow).join('')}</tbody></table></div></div>`;
  }
  const a = summary.assessment;
  return `${summaryField('sumOverview', '상담 개요', summary.overview, 3)}${summaryField('sumComplaint', '주요 호소', summary.complaint, 4)}<fieldset class="summary-section summary-assessment"><legend>사정</legend><label for="sumNeeds">욕구</label><textarea id="sumNeeds" rows="${summaryRows(a.needs, 2)}">${escapeHtml(a.needs)}</textarea><label for="sumStrengths">강점</label><textarea id="sumStrengths" rows="${summaryRows(a.strengths, 2)}">${escapeHtml(a.strengths)}</textarea><label for="sumRisks">위험</label><textarea id="sumRisks" rows="${summaryRows(a.risks, 2)}">${escapeHtml(a.risks)}</textarea></fieldset>${summaryField('sumIntervention', '개입 내용', summary.intervention, 4)}${summaryField('sumPlan', '향후 계획·후속 조치', summary.plan, 4)}`;
}

function collectSummary(kind) {
  const value = (id) => $(`#${id}`)?.value.trim() || '';
  if (kind === 'meeting') {
    return { kind, overview: { datetime: value('sumDatetime'), place: value('sumPlace'), attendees: value('sumAttendees'), agenda: value('sumAgenda') }, discussion: value('sumDiscussion'), decisions: value('sumDecisions'), actions: $$('#sumActions tr').map((row) => ({ task: $('.action-task', row).value.trim(), owner: $('.action-owner', row).value.trim(), due: $('.action-due', row).value.trim() })).filter((item) => item.task || item.owner || item.due) };
  }
  return { kind: 'counseling', overview: value('sumOverview'), complaint: value('sumComplaint'), assessment: { needs: value('sumNeeds'), strengths: value('sumStrengths'), risks: value('sumRisks') }, intervention: value('sumIntervention'), plan: value('sumPlan') };
}

function engineErrorMessage(payload, status) {
  if (payload?.message) return payload.message;
  if (status === 401) return '기관 로그인 후 사용할 수 있습니다.';
  if (status === 403) return '이 계정에는 기록을 만들 권한이 없습니다.';
  return '정리하지 못했습니다. 잠시 뒤 다시 시도하세요.';
}

function bindCaseRecord() {
  let mode = 'counseling';
  let result = null; // { summary, provider, engine, rawText, contextText }
  const notice = (message, error = false) => { const target = $('#recordNotice'); target.hidden = !message; target.className = error ? 'notice error-notice' : 'notice'; target.textContent = message; };
  const engine = () => $('input[name="recordEngine"]:checked')?.value || 'rules';
  const header = () => mode === 'meeting' ? { organization: $('#sumOrg')?.value.trim() || '', author: $('#sumAuthor')?.value.trim() || '' } : {};
  const setActions = (enabled) => { ['#recordCopy', '#recordSave', '#recordExport', '#recordDocx', '#recordToTemplate'].forEach((id) => { $(id).disabled = !enabled; }); $('#recordToTemplate').classList.toggle('hidden', mode !== 'meeting'); };
  const badge = (text, external = false) => { const target = $('#recordTransfer'); target.textContent = text; target.classList.toggle('external', external); };
  const showEmpty = () => {
    result = null;
    $('#summaryTitle').textContent = summaryModes[mode].title;
    $('#summaryBody').innerHTML = `<div class="summary-empty"><b>왼쪽에 원문을 넣고 정리하기를 누르세요.</b><span>${mode === 'meeting' ? '회의 개요(일시·장소·참석자·안건) · 논의 내용 · 결정 사항 · 할 일(담당·기한)로 나눠 드립니다.' : '상담 개요 · 주요 호소 · 사정(욕구·강점·위험) · 개입 내용 · 향후 계획·후속 조치로 나눠 드립니다.'}</span></div>`;
    badge('정리 전');
    setActions(false);
  };
  const showResult = (summary, meta) => {
    const profile = readInstitutionProfile();
    result = { ...meta, summary };
    $('#summaryTitle').textContent = summaryModes[summary.kind].title;
    $('#summaryBody').innerHTML = renderSummaryBody(summary, meta.header || { organization: profile.organization || '', author: profile.manager || '' });
    setActions(true);
  };
  const setMode = (next) => {
    mode = next === 'meeting' ? 'meeting' : 'counseling';
    $$('.summary-mode').forEach((button) => { const active = button.dataset.summaryMode === mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
    const info = summaryModes[mode];
    $('#recordContextLabel').textContent = info.contextLabel; $('#recordContext').placeholder = info.contextPlaceholder;
    $('#recordRawLabel').textContent = info.rawLabel; $('#recordRaw').placeholder = info.rawPlaceholder;
    showEmpty();
  };
  const updateCount = () => { $('#recordRawCount').textContent = `${$('#recordRaw').value.length.toLocaleString()}자`; };
  const syncEngine = () => { const cloud = engine() === 'cloud'; const hasProviders = $('#recordCloudProvider').options.length > 0; $('#engineCloudPicker').hidden = !cloud || !hasProviders; $('#engineCloudEmpty').hidden = !cloud || hasProviders; $('#recordProcess').textContent = cloud ? '보낼 내용 확인 →' : '정리하기 →'; };
  const loadEngineStatus = async () => {
    fetchLocalAiCapabilities().then((capabilities) => {
      const ollama = capabilities.ollama || {};
      $('#engineOllamaStatus').textContent = ollama.available ? `연결됨 · ${preferredAiModel()}` : '꺼져 있음 · 고르면 규칙으로 대신 정리';
      $('#engineOllamaStatus').classList.toggle('ok', Boolean(ollama.available));
    }).catch(() => { $('#engineOllamaStatus').textContent = '확인할 수 없음 · PC용 앱에서 사용'; });
    try {
      const status = await fetchSubscriptionStatus();
      const ready = Object.values(status.providers || {}).filter((item) => item.state === 'ready' || item.connected === true)
        .sort((a, b) => cloudProviderOrder.indexOf(a.provider) - cloudProviderOrder.indexOf(b.provider));
      $('#recordCloudProvider').innerHTML = ready.map((item) => `<option value="${escapeHtml(item.provider)}">${escapeHtml(item.label || providerLabel(item.provider))}</option>`).join('');
      $('#engineCloudStatus').textContent = ready.length ? `연결됨: ${ready.map((item) => providerLabel(item.provider)).join(', ')}` : '연결된 AI 없음';
      $('#engineCloudStatus').classList.toggle('ok', ready.length > 0);
    } catch {
      $('#recordCloudProvider').innerHTML = '';
      $('#engineCloudStatus').textContent = '연결된 AI 없음';
    }
    syncEngine();
  };
  const confirmCloud = (provider, rawText, contextText) => new Promise((resolve) => {
    const dialog = $('#cloudConfirmDialog');
    const outgoing = () => { const mask = $('#cloudMask').checked; const apply = (text) => mask ? transformText(text, 'mask') : text; return { rawText: apply(rawText), contextText: apply(contextText) }; };
    const render = () => { const value = outgoing(); $('#cloudPreview').textContent = `${value.contextText ? `[${mode === 'meeting' ? '회의명' : '상담 맥락'}]\n${value.contextText}\n\n` : ''}[원문]\n${value.rawText}`; };
    $('#cloudConfirmProvider').textContent = providerLabel(provider);
    $('#cloudMask').checked = true;
    render();
    const finish = (value) => { $('#cloudMask').removeEventListener('change', render); $('#cloudSend').removeEventListener('click', onSend); $('#cloudCancel').removeEventListener('click', onCancel); dialog.removeEventListener('cancel', onCancel); if (dialog.open) dialog.close(); resolve(value); };
    const onSend = () => finish(outgoing());
    const onCancel = (event) => { event?.preventDefault?.(); finish(null); };
    $('#cloudMask').addEventListener('change', render);
    $('#cloudSend').addEventListener('click', onSend);
    $('#cloudCancel').addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);
    dialog.showModal();
    $('#cloudCancel').focus();
  });
  const process = async () => {
    const rawText = $('#recordRaw').value.trim();
    const contextText = $('#recordContext').value.trim();
    if (!rawText) { notice(mode === 'meeting' ? '회의 메모를 먼저 붙여 넣으세요.' : '상담 메모를 먼저 붙여 넣으세요.', true); $('#recordRaw').focus(); return; }
    const choice = engine();
    const request = { kind: mode, rawText, contextText, provider: 'rules' };
    if (choice === 'ollama') { request.provider = 'ollama-local'; request.model = preferredAiModel(); }
    if (choice === 'cloud') {
      const provider = $('#recordCloudProvider').value;
      if (!provider) { notice('연결된 클라우드 AI가 없습니다. AI 보조·연결에서 먼저 연결하거나 다른 정리 방식을 고르세요.', true); return; }
      const outgoing = await confirmCloud(provider, rawText, contextText);
      if (!outgoing) { notice('전송을 취소했습니다. 아무것도 보내지 않았습니다.'); return; }
      Object.assign(request, outgoing, { provider: `cloud:${provider}`, confirmExternal: true });
    }
    const button = $('#recordProcess');
    button.disabled = true;
    button.textContent = choice === 'rules' ? '정리하는 중…' : choice === 'ollama' ? '로컬 AI가 정리하는 중…' : `${providerLabel(request.provider.slice(6))}에서 정리하는 중…`;
    notice('');
    try {
      let response;
      try { response = await fetch('./api/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }); }
      catch { response = null; }
      if (!response && choice === 'rules') {
        showResult(buildBrowserSummary(mode, rawText, contextText), { provider: 'browser-rules', engine: 'rules', rawText, contextText });
        badge('규칙 · 이 브라우저');
        notice('로컬 서버에 연결되지 않아 브라우저 규칙으로 정리했습니다. 원문과 대조하세요.');
        return;
      }
      if (!response) throw Object.assign(new Error('offline'), { userMessage: 'PC용 앱의 로컬 서버에 연결되지 않았습니다. 규칙 방식은 계속 사용할 수 있습니다.' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.summary) throw Object.assign(new Error(payload.error || `http_${response.status}`), { userMessage: engineErrorMessage(payload, response.status) });
      showResult(payload.summary, { provider: payload.provider, engine: payload.engine, rawText: request.rawText, contextText: request.contextText });
      if (payload.fallback?.used) { badge(payload.transfer?.external ? '규칙으로 대체 · 원문은 전송됨' : '규칙으로 대체', Boolean(payload.transfer?.external)); notice(payload.fallback.message, true); }
      else if (payload.engine === 'ollama') { badge(`로컬 AI · ${payload.model || 'Ollama'}`); notice('로컬 AI가 만든 초안입니다. PC 밖으로 나가지 않았습니다. 원문과 대조한 뒤 확정하세요.'); }
      else if (payload.engine === 'cloud') { badge(`클라우드 AI · ${providerLabel(payload.transfer?.destination)}`, true); notice(`${providerLabel(payload.transfer?.destination)} 결과입니다. 확인한 내용만 전송했습니다. 원문과 대조한 뒤 확정하세요.`); }
      else { badge('규칙 · 이 PC'); notice('규칙으로 항목을 나눴습니다. [확인 필요] 표시는 직접 채워 주세요.'); }
    } catch (error) {
      notice(error.userMessage || '정리하지 못했습니다. 잠시 뒤 다시 시도하세요.', true);
    } finally {
      button.disabled = false;
      syncEngine();
    }
  };
  const currentSummary = () => result ? collectSummary(result.summary.kind) : null;
  const refreshSavedList = () => {
    const saved = readSavedRecords().filter((item) => item.summary);
    $('#recordSavedList').innerHTML = saved.length ? `<option value="">저장한 기록 ${saved.length}건 · 선택해 불러오기</option>${saved.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(new Date(item.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }))} · ${item.summary.kind === 'meeting' ? '회의록' : '상담 기록'} · ${escapeHtml(String(item.rawText || '').slice(0, 24))}</option>`).join('')}` : '<option value="">저장한 기록 없음</option>';
  };
  $$('.summary-mode').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.summaryMode)));
  $$('input[name="recordEngine"]').forEach((input) => input.addEventListener('change', syncEngine));
  $('#recordRaw').addEventListener('input', updateCount);
  $('#recordSample').addEventListener('click', () => { const sample = summaryModes[mode].sample; $('#recordContext').value = sample.context; $('#recordRaw').value = sample.raw; updateCount(); notice('합성 예시를 넣었습니다. 실제 개인정보가 아닙니다.'); });
  $('#recordProcess').addEventListener('click', process);
  $('#summaryBody').addEventListener('click', (event) => {
    if (event.target.closest('#sumAddAction')) { $('#sumActions').insertAdjacentHTML('beforeend', actionRow()); $$('#sumActions .action-task').at(-1)?.focus(); }
    const remove = event.target.closest('.action-remove'); if (remove) remove.closest('tr').remove();
    if (event.target.closest('#sumRememberProfile')) { try { localStorage.setItem(institutionProfileKey, JSON.stringify({ ...readInstitutionProfile(), organization: $('#sumOrg').value.trim(), manager: $('#sumAuthor').value.trim() })); notice('기관명·작성자를 이 PC에 저장했습니다. 기관 문서 양식에서도 같은 정보를 씁니다.'); } catch { notice('이 브라우저에서는 저장할 수 없습니다.', true); } }
  });
  $('#recordCopy').addEventListener('click', async () => { const summary = currentSummary(); if (!summary) return; try { await navigator.clipboard.writeText(summaryToMarkdown(summary, header())); notice('정리 결과를 클립보드에 복사했습니다.'); } catch { notice('클립보드를 사용할 수 없습니다. Markdown 저장을 이용하세요.', true); } });
  $('#recordSave').addEventListener('click', () => {
    const summary = currentSummary(); if (!summary) return;
    const entry = { id: `record_${Date.now()}`, createdAt: new Date().toISOString(), kind: summary.kind, provider: result.provider, engine: result.engine, summary, header: header(), rawText: result.rawText, contextText: result.contextText };
    try { localStorage.setItem(recordStorageKey, JSON.stringify([entry, ...readSavedRecords()].slice(0, 30))); } catch { notice('이 PC의 저장 공간을 사용할 수 없습니다. Markdown이나 Word로 저장하세요.', true); return; }
    refreshSavedList();
    notice('이 PC의 로컬 저장소에 저장했습니다. 공용 PC라면 Word로 내려받은 뒤 지우세요.');
  });
  $('#recordExport').addEventListener('click', () => { const summary = currentSummary(); if (!summary) return; downloadBlob(new Blob([summaryToMarkdown(summary, header())], { type: 'text/markdown;charset=utf-8' }), `${summary.kind === 'meeting' ? '회의록' : '상담기록'}_${compactDate(new Date())}.md`); });
  $('#recordDocx').addEventListener('click', async () => {
    const summary = currentSummary(); if (!summary) return;
    const button = $('#recordDocx'); button.disabled = true;
    try {
      const response = await fetch('./api/summary/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: summary.kind, summary, header: header() }) });
      if (!response.ok) throw new Error(`docx_http_${response.status}`);
      downloadBlob(await response.blob(), `${summary.kind === 'meeting' ? '회의록' : '상담기록'}_${compactDate(new Date())}.docx`);
    } catch { notice('Word 파일은 PC용 앱(로컬 서버)에서 만들 수 있습니다. 지금은 Markdown 저장을 이용하세요.', true); }
    finally { button.disabled = false; }
  });
  $('#recordToTemplate').addEventListener('click', () => {
    const summary = currentSummary(); if (!summary || summary.kind !== 'meeting') return;
    const actions = summary.actions.map((item, index) => { const meta = [item.owner && `담당: ${item.owner}`, item.due && `기한: ${item.due}`].filter(Boolean).join(', '); return `${index + 1}. ${item.task}${meta ? ` (${meta})` : ''}`; }).join('\n');
    try { sessionStorage.setItem(templateHandoffKey, JSON.stringify({ templateId: 'meeting-minutes', organization: header().organization, author: header().author, project: summary.overview.agenda, attendees: summary.overview.attendees, purpose: [summary.overview.datetime && `일시: ${summary.overview.datetime}`, summary.overview.place && `장소: ${summary.overview.place}`, summary.overview.agenda && `안건: ${summary.overview.agenda}`].filter(Boolean).join('\n'), content: summary.discussion, decisions: summary.decisions, actions })); } catch { notice('이 브라우저에서는 양식으로 보낼 수 없습니다.', true); return; }
    openTool('template-studio');
  });
  $('#recordSavedList').addEventListener('change', (event) => {
    const entry = readSavedRecords().find((item) => item.id === event.target.value); if (!entry?.summary) return;
    setMode(entry.summary.kind);
    $('#recordRaw').value = entry.rawText || ''; $('#recordContext').value = entry.contextText || ''; updateCount();
    showResult(entry.summary, { provider: entry.provider, engine: entry.engine, rawText: entry.rawText, contextText: entry.contextText, header: entry.header?.organization || entry.header?.author ? entry.header : null });
    badge(`저장본 · ${new Date(entry.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}`);
    notice('저장한 기록을 불러왔습니다.');
  });
  setMode('counseling');
  refreshSavedList();
  syncEngine();
  loadEngineStatus();
}

function diagramStorageKey(mode) { return `dawith-${mode}-projects-v1`; }
function newDiagramProject(mode) { return { version: 1, id: `${mode}_${Date.now()}`, type: mode, title: `새 ${mode === 'genogram' ? '가계도' : '생태도'}`, nodes: [{ id: 'center', x: 500, y: 310, label: mode === 'genogram' ? '내담자' : '중심 가구', kind: mode === 'genogram' ? 'person' : 'center', note: '' }], links: [] }; }
function loadDiagramProject(mode) { try { const projects = JSON.parse(localStorage.getItem(diagramStorageKey(mode)) || '[]'); if (projects[0]?.nodes?.length) return projects[0]; } catch { /* ignore malformed local data */ } return newDiagramProject(mode); }
function diagramNode(project, id) { return project.nodes.find((node) => node.id === id); }
function diagramLinkStyle(type) { if (type === 'hostile' || type === 'stress') return 'stroke:#b34e3b;stroke-width:3;stroke-dasharray:7 4'; if (type === 'cutoff') return 'stroke:#8b5361;stroke-width:3;stroke-dasharray:2 8'; if (type === 'close' || type === 'support-strong') return 'stroke:#2c7654;stroke-width:5'; if (type === 'support-weak' || type === 'adopted') return 'stroke:#547d9e;stroke-width:2;stroke-dasharray:8 5'; return 'stroke:#39453f;stroke-width:3'; }
function diagramCandidates(text, mode) { const terms = mode === 'genogram' ? ['친모', '친부', '배우자', '자녀', '형제', '자매', '보호자'] : ['주민센터', '복지관', '학교', '병원', '보건소', '고용센터', '주거복지센터', '가족']; return terms.filter((label) => text.includes(label)).map((label) => ({ label, kind: mode === 'genogram' ? 'person' : 'resource' })); }

function bindDiagram(toolId) {
  const mode = toolId === 'genogram' ? 'genogram' : 'ecomap'; let project = loadDiagramProject(mode); let selectedId = null; let candidates = []; const history = []; const redo = []; const canvas = $('#diagramCanvas');
  const snapshot = () => JSON.stringify(project); const restore = (value) => { project = JSON.parse(value); selectedId = null; render(); }; const mutate = (change) => { history.push(snapshot()); redo.length = 0; change(); render(); };
  const render = () => {
    $('#diagramTitle').value = project.title || '';
    $('#diagramLinks').innerHTML = project.links.map((link) => { const from = diagramNode(project, link.from); const to = diagramNode(project, link.to); return from && to ? `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" style="${diagramLinkStyle(link.type)}" />` : ''; }).join('');
    $('#diagramNodes').innerHTML = project.nodes.map((node) => { const selected = node.id === selectedId ? ' selected' : ''; const shape = mode === 'ecomap' && node.kind === 'center' ? '<ellipse cx="0" cy="0" rx="72" ry="38"></ellipse>' : node.kind === 'resource' ? '<rect x="-62" y="-28" width="124" height="56" rx="9"></rect>' : '<rect x="-48" y="-38" width="96" height="76" rx="4"></rect>'; return `<g class="diagram-node${selected}" data-node-id="${escapeHtml(node.id)}" transform="translate(${node.x} ${node.y})" tabindex="0">${shape}<text class="diagram-node-label" x="0" y="4">${escapeHtml(node.label || '이름 없음')}</text>${node.note ? `<title>${escapeHtml(node.note)}</title>` : ''}</g>`; }).join('');
    const options = project.nodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.label || '이름 없음')}</option>`).join(''); ['#diagramLinkFrom', '#diagramLinkTo'].forEach((selector) => { const select = $(selector); const before = select.value; select.innerHTML = options; if (project.nodes.some((node) => node.id === before)) select.value = before; });
    $('#diagramUndo').disabled = !history.length; $('#diagramRedo').disabled = !redo.length; const node = diagramNode(project, selectedId); $('#diagramEmptyInspector').classList.toggle('hidden', Boolean(node)); $('#diagramNodeInspector').classList.toggle('hidden', !node); if (node) { $('#diagramNodeLabel').value = node.label || ''; $('#diagramNodeKind').value = node.kind || 'person'; $('#diagramNodeNote').value = node.note || ''; }
    $('#diagramCandidates').innerHTML = candidates.map((candidate, index) => `<button class="diagram-candidate" type="button" data-candidate-index="${index}"><span>${escapeHtml(candidate.label)}</span><small>${candidate.kind === 'resource' ? '기관·자원' : '사람'} · 추가</small></button>`).join('');
  };
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: Math.max(30, Math.min(970, (event.clientX - rect.left) * 1000 / rect.width)), y: Math.max(35, Math.min(585, (event.clientY - rect.top) * 620 / rect.height)) }; }; let dragging = null;
  canvas.addEventListener('pointerdown', (event) => { const node = event.target.closest('[data-node-id]'); if (!node) return; selectedId = node.dataset.nodeId; dragging = { id: selectedId, before: snapshot() }; canvas.setPointerCapture(event.pointerId); render(); });
  canvas.addEventListener('pointermove', (event) => { if (!dragging) return; const node = diagramNode(project, dragging.id); if (!node) return; Object.assign(node, point(event)); render(); }); canvas.addEventListener('pointerup', () => { if (dragging) { history.push(dragging.before); redo.length = 0; dragging = null; render(); } });
  $('#diagramTitle').addEventListener('input', (event) => { project.title = event.target.value; });
  $('#diagramAddNode').addEventListener('click', () => mutate(() => { const index = project.nodes.length; project.nodes.push({ id: `node_${Date.now()}`, x: 220 + ((index * 145) % 650), y: 150 + (Math.floor(index / 5) * 125), label: mode === 'genogram' ? '새 가족 구성원' : '새 기관·자원', kind: mode === 'genogram' ? 'person' : 'resource', note: '' }); }));
  $('#diagramDeleteNode').addEventListener('click', () => { if (!selectedId || selectedId === 'center') return showNotice('#diagramNotice', '중심 항목은 삭제할 수 없습니다.', true); mutate(() => { project.nodes = project.nodes.filter((node) => node.id !== selectedId); project.links = project.links.filter((link) => link.from !== selectedId && link.to !== selectedId); selectedId = null; }); });
  ['diagramNodeLabel', 'diagramNodeKind', 'diagramNodeNote'].forEach((id) => $(`#${id}`).addEventListener('input', (event) => { const node = diagramNode(project, selectedId); if (!node) return; node[id === 'diagramNodeLabel' ? 'label' : id === 'diagramNodeKind' ? 'kind' : 'note'] = event.target.value; render(); }));
  $('#diagramAddLink').addEventListener('click', () => { const from = $('#diagramLinkFrom').value; const to = $('#diagramLinkTo').value; if (!from || !to || from === to) return showNotice('#diagramNotice', '서로 다른 항목 두 개를 선택하세요.', true); mutate(() => project.links.push({ id: `link_${Date.now()}`, from, to, type: $('#diagramLinkType').value })); });
  $('#diagramUndo').addEventListener('click', () => { if (!history.length) return; redo.push(snapshot()); restore(history.pop()); }); $('#diagramRedo').addEventListener('click', () => { if (!redo.length) return; history.push(snapshot()); restore(redo.pop()); });
  $('#diagramSave').addEventListener('click', () => { localStorage.setItem(diagramStorageKey(mode), JSON.stringify([project])); showNotice('#diagramNotice', '프로젝트를 이 PC의 로컬 저장소에 저장했습니다.'); }); $('#diagramExportJson').addEventListener('click', () => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${mode}-${compactDate(new Date())}.json`));
  $('#diagramExportSvg').addEventListener('click', () => { const copy = canvas.cloneNode(true); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); downloadBlob(new Blob([copy.outerHTML], { type: 'image/svg+xml;charset=utf-8' }), `${mode}-${compactDate(new Date())}.svg`); }); $('#diagramExportHtml').addEventListener('click', () => { const copy = canvas.cloneNode(true); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(project.title)}</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#29372f}svg{max-width:100%;border:1px solid #ccd6ce;background:#fafcf9}.diagram-node rect,.diagram-node ellipse{fill:#fff;stroke:#29372f;stroke-width:2}.diagram-node-label{text-anchor:middle;font-size:16px;dominant-baseline:middle}</style><h1>${escapeHtml(project.title)}</h1>${copy.outerHTML}`; downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${mode}-${compactDate(new Date())}.html`); });
  $('#diagramImport').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const loaded = JSON.parse(await file.text()); if (!Array.isArray(loaded.nodes) || !Array.isArray(loaded.links)) throw new Error('invalid'); history.push(snapshot()); project = { ...loaded, type: mode, version: 1 }; render(); showNotice('#diagramNotice', 'JSON 프로젝트를 불러왔습니다.'); } catch { showNotice('#diagramNotice', '가계도·생태도 JSON 형식을 확인해 주세요.', true); } event.target.value = ''; });
  const runCandidates = (items, message) => { candidates = [...new Map(items.map((item) => [item.label, item])).values()]; render(); showNotice('#diagramNotice', message); }; $('#diagramExtract').addEventListener('click', () => { const text = $('#diagramSourceText').value.trim(); if (!text) return showNotice('#diagramNotice', '후보를 찾을 원문을 입력하세요.', true); runCandidates(diagramCandidates(text, mode), '로컬 규칙으로 후보를 찾았습니다. 추가할 항목을 선택하세요.'); });
  $('#diagramLocalAi').addEventListener('click', async () => { const text = $('#diagramSourceText').value.trim(); if (!text) return showNotice('#diagramNotice', '후보를 찾을 원문을 입력하세요.', true); const button = $('#diagramLocalAi'); button.disabled = true; try { const response = await fetch('/api/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'counseling', provider: 'ollama-local', rawText: text }) }); if (!response.ok) throw new Error('local_ai_unavailable'); const payload = await response.json(); const facts = payload.draft?.facts || {}; const combined = [...(facts.relations || []), ...(facts.topics || [])].map((label) => ({ label, kind: mode === 'genogram' ? 'person' : 'resource' })); runCandidates([...diagramCandidates(text, mode), ...combined], '로컬 Ollama 결과를 후보로 표시했습니다. 사실관계를 확인하세요.'); } catch { runCandidates(diagramCandidates(text, mode), '로컬 LLM을 사용할 수 없어 규칙 기반 후보를 표시했습니다.'); } finally { button.disabled = false; } });
  $('#diagramCandidates').addEventListener('click', (event) => { const button = event.target.closest('[data-candidate-index]'); if (!button) return; const candidate = candidates[Number(button.dataset.candidateIndex)]; if (!candidate) return; mutate(() => { const node = { id: `node_${Date.now()}`, x: 170 + ((project.nodes.length * 157) % 700), y: 120 + ((project.nodes.length * 83) % 400), label: candidate.label, kind: candidate.kind, note: '원문 후보에서 추가 · 담당자 확인 필요' }; project.nodes.push(node); project.links.push({ id: `link_${Date.now() + 1}`, from: 'center', to: node.id, type: mode === 'genogram' ? 'child' : 'support-weak' }); }); candidates = candidates.filter((item) => item !== candidate); render(); }); render();
}

function showNotice(target, message, error = false) { const element = typeof target === 'string' ? $(target) : target; if (!element) return; element.classList.remove('hidden'); element.className = error ? 'notice error-notice' : 'notice'; element.textContent = message; }

document.addEventListener('click', (event) => { const toolButton = event.target.closest('[data-tool]'); if (toolButton) return openTool(toolButton.dataset.tool); const action = event.target.closest('[data-action]')?.dataset.action; if (action === 'home') showHome(); });
if (navigator.userAgent.includes('Electron')) $('#downloadLink')?.remove();

// Desktop-only update flow. The local server proxies the Electron updater;
// in the browser build /api/update/status reports supported: false.
let updateState = null;
let updatePoll = null;
async function updateRequest(action) {
  const response = await fetch(`/api/update/${action}`, { method: action === 'status' ? 'GET' : 'POST' });
  if (!response.ok) throw new Error(`update_${response.status}`);
  return response.json();
}
function renderUpdate(next) {
  updateState = next;
  const button = $('#updateButton');
  button.classList.toggle('has-update', ['available', 'downloading', 'downloaded'].includes(next.status));
  button.textContent = next.status === 'available' ? `새 버전 ${next.latestVersion}` : next.status === 'downloaded' ? '업데이트 설치 준비됨' : '업데이트 확인';
  const message = $('#updateMessage');
  const action = $('#updateAction');
  const progress = $('#updateProgress');
  progress.classList.toggle('hidden', next.status !== 'downloading');
  progress.setAttribute('aria-valuenow', String(next.progress || 0));
  progress.firstElementChild.style.width = `${next.progress || 0}%`;
  action.classList.add('hidden');
  $('#updateVersion').textContent = `지금 쓰는 버전 ${next.currentVersion}${next.mode === 'portable' ? ' · 포터블' : ''}`;
  const show = (label, handler) => { action.textContent = label; action.onclick = handler; action.classList.remove('hidden'); };
  if (next.status === 'checking' || next.status === 'idle') message.textContent = '새 버전을 확인하는 중입니다…';
  else if (next.status === 'latest') message.textContent = '최신 버전을 쓰고 있습니다.';
  else if (next.status === 'available' && next.mode === 'portable') {
    message.textContent = `새 버전 ${next.latestVersion}이 나왔습니다. 포터블은 새 파일을 받아 바꿔 쓰면 됩니다. 저장한 기록은 그대로 남습니다.`;
    show('새 버전 내려받기', () => window.open(next.downloadPage || 'https://welfare-office.vercel.app/#download', '_blank'));
  } else if (next.status === 'available') {
    message.textContent = `새 버전 ${next.latestVersion}이 나왔습니다. 내려받은 뒤 앱을 다시 시작하면 설치됩니다. 저장한 기록은 그대로 남습니다.`;
    show('지금 업데이트', async () => { renderUpdate(await updateRequest('download')); watchUpdate(); });
  } else if (next.status === 'downloading') message.textContent = `새 버전을 내려받는 중입니다… ${next.progress || 0}%`;
  else if (next.status === 'downloaded') {
    message.textContent = '내려받기를 마쳤습니다. 작업 중인 내용을 저장한 뒤 다시 시작하세요.';
    show('다시 시작해서 설치', async () => renderUpdate(await updateRequest('install')));
  } else if (next.status === 'installing') message.textContent = '설치를 시작합니다. 잠시 뒤 새 버전이 열립니다.';
  else if (next.status === 'error') {
    message.textContent = '업데이트를 확인하지 못했습니다. 인터넷 연결을 확인하거나 내려받기 페이지에서 새 버전을 받아 설치하세요.';
    show('내려받기 페이지 열기', () => window.open(next.downloadPage || 'https://welfare-office.vercel.app/#download', '_blank'));
  }
}
function watchUpdate() {
  clearInterval(updatePoll);
  updatePoll = setInterval(async () => {
    try {
      const next = await updateRequest('status');
      renderUpdate(next);
      if (next.status !== 'downloading') clearInterval(updatePoll);
    } catch { clearInterval(updatePoll); }
  }, 1000);
}
async function setupUpdates() {
  try {
    const status = await updateRequest('status');
    if (!status.supported) return;
    $('#downloadLink')?.remove();
    $('#updateButton').classList.remove('hidden');
    renderUpdate(status);
    renderUpdate(await updateRequest('check'));
  } catch { /* updates are optional; the app works offline */ }
}
$('#updateButton').addEventListener('click', async () => {
  $('#updateDialog').showModal();
  if (!updateState || ['latest', 'error', 'idle'].includes(updateState.status)) {
    renderUpdate({ ...(updateState || {}), status: 'checking' });
    try { renderUpdate(await updateRequest('check')); } catch { renderUpdate({ ...(updateState || {}), status: 'error' }); }
  }
});
$('#closeUpdate').addEventListener('click', () => $('#updateDialog').close());
setupUpdates();
$('#homeButton').addEventListener('click', () => { state.category = 'all'; state.search = ''; $('#toolSearch').value = ''; showHome(); });
$('#privacyButton').addEventListener('click', () => $('#privacyDialog').showModal());
$('#closePrivacy').addEventListener('click', () => $('#privacyDialog').close());
$('#toolSearch').addEventListener('input', (event) => { state.search = event.target.value; renderToolGrid(); renderRecentTools(); });
$$('.category-button').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; state.search = ''; $('#toolSearch').value = ''; showHome(); }));
renderToolGrid();

const initialTool = new URLSearchParams(window.location.search).get('tool');
if (initialTool && toolCatalog.some((tool) => tool.id === initialTool)) openTool(initialTool);

let deferredInstallPrompt;
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); if (sessionStorage.getItem('dawith-desktop') === '1') return; deferredInstallPrompt = event; $('#installButton')?.classList.remove('hidden'); });
$('#installButton')?.addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('#installButton').classList.add('hidden'); });
// The desktop app serves files locally; an offline cache would only pile up.
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(window.location.protocol) && sessionStorage.getItem('dawith-desktop') !== '1') navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is optional */ });
