let PDFDocument;
let pdfLibPromise;

const toolCatalog = [
  { id: 'pdf-merge', category: 'document', mark: 'PDF', name: 'PDF 합치기', description: '여러 개의 PDF를 한 파일로 묶습니다.', keywords: 'pdf 병합 붙임서류 합치기', label: 'DOCUMENT' },
  { id: 'pdf-split', category: 'document', mark: 'PDF', name: 'PDF 나누기', description: '필요한 페이지만 추출하거나 낱장으로 나눕니다.', keywords: 'pdf 분할 페이지 추출', label: 'DOCUMENT' },
  { id: 'hwp-inspector', category: 'document', mark: 'HWP', name: '한글 양식 확인', description: 'HWP·HWPX 기관 양식을 이 기기에서 열고 내용을 확인합니다.', keywords: '한글 hwp hwpx hml 양식 문서 텍스트 추출', label: 'DOCUMENT' },
  { id: 'template-studio', category: 'document', mark: 'FORM', name: '기관 양식 작업공간', description: '기관 정보를 저장하고 회의록·사업 문서 초안을 만듭니다.', keywords: '기관 양식 사업계획서 결과보고서 회의록 문서 초안 템플릿', label: 'WORKSPACE' },
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
  { id: 'ai-setup', category: 'ai', mark: 'AI', name: 'AI 보조·연결 센터', description: '로컬 모델과 사용자의 Claude·Codex 구독을 구분해 연결합니다.', keywords: 'ollama 로컬 llm ai 모델 다운로드 상담 회의록 문서 claude codex 구독', label: 'AI CONTROL' },
];

const state = { category: 'all', search: '', activeTool: null, pdfFiles: [], imageFile: null, imageUrl: '', imageInfo: null, textMode: 'mask' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const formatBytes = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`;
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

function toolHeader(tool, title = tool.name, description = tool.description) {
  return `<div class="workspace-nav"><button class="back-button" data-action="home" type="button">← 도구 목록</button><span class="local-note">● 이 기기에서만 처리</span></div><header class="workspace-header"><div><p class="overline">${tool.label}</p><h1>${title}</h1><p>${description}</p></div><div class="workspace-mark"><b>${tool.mark}</b>외부 전송 없음</div></header>`;
}

function renderToolGrid() {
  const query = state.search.trim().toLowerCase();
  const visible = toolCatalog.filter((tool) => (state.category === 'all' || tool.category === state.category) && (!query || `${tool.name} ${tool.description} ${tool.keywords}`.toLowerCase().includes(query)));
  $('#toolCount').textContent = `도구 ${visible.length}개`;
  $('#toolGrid').innerHTML = visible.length ? visible.map((tool) => `<button class="tool-card" data-tool="${tool.id}" data-category="${tool.category}" type="button"><span class="tool-card-mark">${tool.mark}</span><span><b>${tool.name}</b><small>${tool.description}</small></span><span class="tool-card-arrow">→</span></button>`).join('') : '<p class="muted-text" style="grid-column:1/-1;padding:24px 0">찾는 도구가 없습니다. 다른 단어로 검색해보세요.</p>';
}

function showHome() {
  state.activeTool = null;
  $('#homeView').classList.remove('hidden');
  $('#workspaceView').classList.add('hidden');
  $('#workspaceMount').innerHTML = '';
  renderToolGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTool(toolId) {
  const tool = toolCatalog.find((item) => item.id === toolId);
  if (!tool) return;
  state.activeTool = toolId;
  saveRecent(toolId);
  $('#homeView').classList.add('hidden');
  $('#workspaceView').classList.remove('hidden');
  $('#workspaceMount').innerHTML = renderWorkspace(tool);
  bindWorkspace(toolId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderWorkspace(tool) {
  if (tool.id === 'pdf-merge') return `${toolHeader(tool, 'PDF를 한 파일로 묶기', '붙임 서류 순서를 확인하고 하나의 PDF로 저장합니다.')}<div class="tool-layout pdf-layout"><section class="tool-panel"><div class="panel-heading"><div><h2>파일 순서</h2><p>위에서 아래 순서로 합쳐집니다.</p></div><span id="pdfSummary" class="muted-text">0개</span></div><div id="pdfDropzone" class="dropzone" data-pdf-drop><div><span class="dropzone-mark">+</span><b>PDF 파일을 놓으세요</b><p>여러 파일을 한 번에 선택해도 됩니다.</p><label class="file-button"><input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple />파일 선택</label></div></div><div id="pdfFileList" class="file-list"></div><div id="pdfNotice"></div></section><aside class="tool-panel"><div class="panel-heading"><div><h2>저장</h2><p>원본은 바뀌지 않습니다.</p></div></div><div class="side-list"><div><span>필요한 파일</span><b>2개 이상</b></div><div><span>처리 위치</span><b>이 기기</b></div><div><span>결과 형식</span><b>PDF</b></div></div><div class="control-group" style="margin-top:24px"><label for="pdfOutputName">저장할 이름</label><input id="pdfOutputName" class="wide-input" value="복지관_붙임서류" /></div><div class="tool-actions"><button id="pdfMergeButton" class="primary-button" type="button" disabled>PDF 합치기 →</button></div><div class="side-tip"><b>작업 팁</b><p>파일 이름 앞에 01, 02를 붙여두면 순서를 확인하기 쉽습니다.</p></div></aside></div>`;
  if (tool.id === 'pdf-split') return `${toolHeader(tool, 'PDF에서 필요한 페이지만 꺼내기', '페이지 번호를 입력하면 새 PDF로 저장합니다.')}<div class="tool-layout pdf-layout"><section class="tool-panel"><div class="panel-heading"><div><h2>원본 PDF</h2><p>한 파일만 선택합니다.</p></div><span id="splitPdfSummary" class="muted-text">선택 전</span></div><div id="splitDropzone" class="dropzone" data-split-drop><div><span class="dropzone-mark">↓</span><b>PDF 파일을 놓으세요</b><p>예: 1-3, 5, 8-10</p><label class="file-button"><input id="splitPdfInput" type="file" accept="application/pdf,.pdf" />파일 선택</label></div></div><div id="splitFileList" class="file-list"></div><div id="splitNotice"></div></section><aside class="tool-panel"><div class="panel-heading"><div><h2>페이지 선택</h2><p>원본 페이지 번호 기준입니다.</p></div></div><div class="control-group" style="margin-top:22px"><label for="splitRange">추출할 페이지</label><input id="splitRange" class="wide-input" placeholder="예: 1-3, 5" /></div><div class="control-group" style="margin-top:16px"><label for="splitOutputName">저장할 이름</label><input id="splitOutputName" class="wide-input" value="필요페이지_추출" /></div><div class="tool-actions"><button id="splitButton" class="primary-button" type="button" disabled>페이지 추출 →</button></div><div class="side-tip"><b>작업 팁</b><p>페이지를 비워두면 전체 페이지를 새 파일로 다시 저장합니다.</p></div></aside></div>`;
  if (tool.id === 'hwp-inspector') return renderHwpWorkspace(tool);
  if (tool.id === 'template-studio') return renderTemplateStudio(tool);
  if (tool.id === 'image-resize' || tool.id === 'image-compress' || tool.id === 'image-privacy' || tool.id === 'image-rotate') return renderImageWorkspace(tool);
  if (tool.id === 'text-tools') return renderTextWorkspace(tool);
  if (tool.id === 'age-calculator') return renderAgeWorkspace(tool);
  if (tool.id === 'money-converter') return renderMoneyWorkspace(tool);
  if (tool.id === 'date-calculator') return renderDateWorkspace(tool);
  if (tool.id === 'attendance') return renderAttendanceWorkspace(tool);
  if (tool.id === 'duty-schedule') return renderDutyWorkspace(tool);
  if (tool.id === 'ai-setup') return renderAiSetup(tool);
  return '';
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
  return `${toolHeader(tool, 'AI 보조 연결 센터', '원문을 어디에서 처리할지 먼저 고르고, 선택한 방식만 사용합니다.')}<div class="ai-control-layout"><section class="tool-panel ai-setup-main"><div class="panel-heading"><div><h2>이 PC 안에서 처리</h2><p>Ollama 로컬 모델은 상담 원문을 외부로 보내지 않습니다.</p></div><span id="aiSetupStatus" class="local-note">확인 전</span></div><div class="ai-device-summary"><div><span>현재 기기</span><b id="aiSystemSpec">확인 중…</b></div><div><span>추천 모델</span><b id="aiRecommendation">확인 중…</b></div></div><ol class="ai-setup-steps"><li><span>1</span><div><b>Ollama 설치</b><small>공식 설치 파일을 한 번 설치하고 실행합니다.</small></div><a id="aiInstallLink" href="https://ollama.com/download" target="_blank" rel="noreferrer">공식 설치 열기 ↗</a></li><li><span>2</span><div><b>연결 확인</b><small>현재 PC의 RAM·CPU를 읽어 모델을 추천합니다.</small></div><button id="aiRefresh" class="secondary-button" type="button">상태 다시 확인</button></li><li><span>3</span><div><b>추천 모델 준비</b><small id="aiModelHelp">모델이 없으면 규칙 기반 기능만으로도 계속 사용할 수 있습니다.</small></div><div class="ai-model-action"><select id="aiModelSelect" class="wide-input" aria-label="로컬 AI 모델 선택"></select><button id="aiPullModel" class="primary-button" type="button" disabled>모델 준비</button></div></li></ol><div id="aiSetupNotice" class="notice" hidden></div><div class="ai-privacy-note"><b>처리 경계</b><span>상담 원문·문서 내용은 Dawith 서버나 클라우드로 보내지 않습니다.</span><span>모델 다운로드 때만 Ollama 공식 저장소와 통신합니다.</span><span>AI 결과는 초안이며 담당자가 원문과 대조해 확정해야 합니다.</span></div></section><section class="tool-panel subscription-panel"><div class="panel-heading"><div><h2>내 구독 AI 연결</h2><p>설치되어 로그인된 Claude 또는 Codex 프로그램을 직접 사용합니다.</p></div><button id="subscriptionRefresh" class="secondary-button" type="button">상태 확인</button></div><div class="subscription-warning"><b>중요: 이 경로는 외부 전송입니다.</b><span>버튼을 눌러 동의한 텍스트만 선택한 회사의 구독 프로그램으로 전달됩니다. Dawith 서버에는 저장하지 않습니다.</span></div><div id="subscriptionCards" class="subscription-cards"><p class="muted-text">상태를 확인하는 중…</p></div><div class="subscription-test"><label for="subscriptionText">선택 전송 테스트</label><textarea id="subscriptionText" class="subscription-input" placeholder="개인정보가 없는 짧은 문장으로 먼저 테스트하세요."></textarea><div class="subscription-actions"><select id="subscriptionProvider" class="wide-input" aria-label="구독 provider"><option value="claude-code">Claude</option><option value="codex">Codex</option></select><button id="subscriptionAssist" class="primary-button" type="button">선택한 구독으로 정리</button></div><p id="subscriptionNotice" class="field-hint">상태 확인만으로는 원문이 전송되지 않습니다.</p></div></section></div>`;
}

function renderHwpWorkspace(tool) {
  return `${toolHeader(tool, '한글 기관 양식을 확인하고 채우기', 'HWP·HWPX 파일을 외부로 보내지 않고 이 기기에서 읽고 표식을 치환해 저장합니다.')}<div class="hwp-layout"><section class="tool-panel hwp-entry"><div class="panel-heading"><div><h2>양식 파일</h2><p>기관에서 받은 .hwp 또는 .hwpx 파일을 선택하세요.</p></div><span id="hwpEngineStatus" class="local-note">엔진 준비 전</span></div><div id="hwpDropzone" class="dropzone"><div><span class="dropzone-mark">H</span><b>HWP·HWPX 파일을 놓으세요</b><p>파일은 이 브라우저에서만 읽습니다.</p><label class="file-button"><input id="hwpInput" type="file" accept=".hwp,.hwpx,.hml,application/x-hwp,application/haansofthwp" />파일 선택</label></div></div><div id="hwpNotice" class="notice" hidden></div><div id="hwpMeta" class="hwp-meta hidden"><div><span>파일</span><b id="hwpFileName"></b></div><div><span>페이지</span><b id="hwpPageCount">-</b></div><div><span>처리</span><b>이 기기</b></div></div><div id="hwpReplacePanel" class="hwp-replace hidden"><b>양식 표식 치환</b><p><code>{{기관명}}</code>처럼 양식에 넣은 표식을 찾아 바꿉니다.</p><div class="replace-grid"><label>찾을 표식<input id="hwpQuery" class="wide-input" placeholder="예: {{기관명}}" /></label><label>바꿀 내용<input id="hwpReplacement" class="wide-input" placeholder="예: 다위복지관" /></label></div><button id="hwpReplaceSave" class="primary-button" type="button" disabled>치환한 HWPX 저장 →</button></div></section><section class="tool-panel hwp-result"><div class="panel-heading"><div><h2>양식 내용</h2><p id="hwpResultLabel">파일을 선택하면 텍스트를 추출합니다.</p></div><button id="hwpCopy" class="secondary-button" type="button" disabled>복사</button></div><pre id="hwpPreview" class="hwp-preview">HWP·HWPX 파일을 선택하면 양식 안의 텍스트가 여기에 표시됩니다.</pre><div class="tool-actions"><button id="hwpUseAsSource" class="primary-button" type="button" disabled>내용을 텍스트 도구로 보내기 →</button></div></section></div><aside class="hwp-safety"><b>지원 범위</b><span>HWP 5.0 · HWPX · 일부 HML</span><span>표·문단 텍스트 추출</span><span>rhwp MIT 엔진을 필요할 때만 불러옵니다</span></aside>`;
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
  return `${toolHeader(tool, '기관 양식 작업공간', '기관 정보와 자주 쓰는 문장을 이 PC에 저장하고 행정문서 초안을 만듭니다.')}<div class="template-layout"><aside class="tool-panel template-sidebar"><div class="panel-heading"><div><h2>내 양식</h2><p>저장한 양식은 이 기기에만 남습니다.</p></div></div><div class="control-group template-select-group"><label for="templateSelect">사용할 문서</label><select id="templateSelect" class="wide-input">${options}</select></div><div class="template-save-box"><label for="templateName">내 양식으로 저장</label><input id="templateName" class="wide-input" placeholder="예: 우리 기관 회의록" /><textarea id="templateBody" class="template-body-input" placeholder="{{기관명}}, {{사업명}} 같은 항목을 사용할 수 있습니다."></textarea><button id="templateSave" class="secondary-button" type="button">내 양식 저장</button><p id="templateNotice" class="field-hint">양식 안의 개인정보는 저장하지 마세요.</p></div><div class="template-help"><b>사용 가능한 항목</b><p>{{기관명}} · {{문서일}} · {{사업명}} · {{작성자}} · {{참석자}} · {{목적}} · {{내용}} · {{결정사항}} · {{후속조치}}</p></div></aside><section class="tool-panel template-editor-panel"><div class="panel-heading"><div><h2>초안 작성</h2><p>입력하는 즉시 오른쪽 결과에 반영됩니다.</p></div><span class="local-note">● 자동 저장 안 함</span></div><div class="profile-strip"><div><b>기관 기본정보</b><span>다음 작업에 다시 입력하지 않도록 이 PC에 저장합니다.</span></div><div class="profile-fields"><input id="profileOrganization" class="wide-input" placeholder="기관명" /><input id="profileManager" class="wide-input" placeholder="기본 작성자" /><button id="profileSave" class="secondary-button" type="button">저장</button></div></div><div class="template-fields"><div class="control-group"><label for="templateDate">문서일</label><input id="templateDate" type="date" class="wide-input" /></div><div class="control-group"><label for="templateProject">사업명·회의명</label><input id="templateProject" class="wide-input" placeholder="예: 2026년 주거취약가구 지원사업" /></div><div class="control-group"><label for="templateAuthor">작성자</label><input id="templateAuthor" class="wide-input" placeholder="담당자 이름" /></div><div class="control-group"><label for="templateAttendees">참석자</label><input id="templateAttendees" class="wide-input" placeholder="예: 김○○, 이○○" /></div><div class="control-group full-field"><label for="templatePurpose">목적·추진 배경</label><textarea id="templatePurpose" placeholder="왜 이 문서를 작성하는지 입력하세요."></textarea></div><div class="control-group full-field"><label for="templateContent">주요 내용</label><textarea id="templateContent" placeholder="논의 내용·추진 내용·상담 내용을 입력하세요."></textarea></div><div class="control-group"><label for="templateDecisions">성과·결정사항</label><textarea id="templateDecisions" placeholder="확인된 성과나 결정사항"></textarea></div><div class="control-group"><label for="templateActions">후속 조치·향후 계획</label><textarea id="templateActions" placeholder="담당자와 다음 일정을 입력하세요."></textarea></div></div><div class="template-preview-heading"><div><b>결과 미리보기</b><span>원문은 외부로 전송되지 않습니다.</span></div><div class="template-actions"><button id="templateAiAssist" class="secondary-button" type="button">로컬 AI로 초안 다듬기</button><button id="templateCopy" class="secondary-button" type="button">복사</button><button id="templateDownload" class="primary-button" type="button">문서용 HTML 저장 →</button></div></div><pre id="templatePreview" class="template-preview">내용을 입력하면 초안이 여기에 표시됩니다.</pre></section></div>`;
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

function bindWorkspace(toolId) {
  if (toolId === 'pdf-merge') bindPdfMerge();
  if (toolId === 'pdf-split') bindPdfSplit();
  if (toolId === 'hwp-inspector') bindHwpInspector();
  if (toolId === 'image-resize' || toolId === 'image-compress' || toolId === 'image-privacy' || toolId === 'image-rotate') bindImage(toolId);
  if (toolId === 'text-tools') bindText();
  if (toolId === 'age-calculator') bindAge();
  if (toolId === 'money-converter') bindMoney();
  if (toolId === 'date-calculator') bindDate();
  if (toolId === 'attendance') bindAttendance();
  if (toolId === 'duty-schedule') bindDutySchedule();
  if (toolId === 'template-studio') bindTemplateStudio();
  if (toolId === 'ai-setup') bindAiSetup();
}

let rhwpRuntimePromise;
async function loadRhwpRuntime() {
  if (!rhwpRuntimePromise) {
    rhwpRuntimePromise = (async () => {
      const module = await import('./vendor/rhwp/rhwp.js');
      const response = await fetch('./vendor/rhwp/rhwp_bg.wasm');
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
  const input = $('#hwpInput'); const zone = $('#hwpDropzone'); const preview = $('#hwpPreview'); const copy = $('#hwpCopy'); const useAsSource = $('#hwpUseAsSource'); const replacePanel = $('#hwpReplacePanel'); const replaceSave = $('#hwpReplaceSave'); let extracted = ''; let loadedDocument = null;
  const notice = (message, error = false) => { $('#hwpNotice').hidden = false; $('#hwpNotice').className = `notice${error ? ' error-notice' : ''}`; $('#hwpNotice').textContent = message; };
  const readFile = async (file) => {
    $('#hwpEngineStatus').textContent = '엔진 준비 중…'; notice('HWP 엔진을 처음 불러오는 중입니다. 파일은 외부로 전송하지 않습니다.');
    try {
      const { HwpDocument } = await loadRhwpRuntime(); if (loadedDocument) loadedDocument.free(); loadedDocument = new HwpDocument(new Uint8Array(await file.arrayBuffer()));
      extracted = hwpTextFromEngine(loadedDocument).replace(/\r\n/g, '\n').trim(); const pages = loadedDocument.pageCount(); $('#hwpFileName').textContent = file.name; $('#hwpPageCount').textContent = `${pages}페이지`; $('#hwpMeta').classList.remove('hidden'); replacePanel.classList.remove('hidden'); replaceSave.disabled = false; preview.textContent = extracted || '텍스트를 찾지 못했습니다. 표·그림 중심 양식일 수 있습니다.'; $('#hwpResultLabel').textContent = `${formatBytes(file.size)} · ${pages}페이지 · 로컬 추출 완료`; copy.disabled = !extracted; useAsSource.disabled = !extracted; $('#hwpEngineStatus').textContent = '엔진 준비됨'; notice('양식 내용을 이 기기에서 읽었습니다.');
    } catch (error) { if (loadedDocument) { loadedDocument.free(); loadedDocument = null; } extracted = ''; replacePanel.classList.add('hidden'); replaceSave.disabled = true; preview.textContent = '파일을 읽지 못했습니다.'; copy.disabled = true; useAsSource.disabled = true; $('#hwpEngineStatus').textContent = '확인 필요'; notice(error?.message?.includes('rhwp_wasm') ? 'HWP 엔진 파일을 불러오지 못했습니다. 앱을 최신 버전으로 업데이트해 주세요.' : '지원하지 않는 형식이거나 암호가 걸린 파일입니다.', true); }
  };
  bindDropzone(zone, input, (files) => { if (files[0]) readFile(files[0]); });
  copy.addEventListener('click', async () => { await navigator.clipboard?.writeText(extracted); notice('추출한 내용을 클립보드에 복사했습니다.'); });
  replaceSave.addEventListener('click', () => { const query = $('#hwpQuery').value; const replacement = $('#hwpReplacement').value; if (!loadedDocument || !query) return notice('찾을 표식을 입력해 주세요.', true); try { const result = JSON.parse(loadedDocument.replaceAll(query, replacement, true)); if (!result.count) return notice('찾은 표식이 없습니다.', true); extracted = hwpTextFromEngine(loadedDocument).replace(/\r\n/g, '\n').trim(); preview.textContent = extracted; notice(`${result.count}곳을 치환했습니다. 원본은 바뀌지 않았습니다.`); const bytes = loadedDocument.exportHwpx(); downloadBlob(new Blob([bytes], { type: 'application/vnd.hancom.hwpx' }), `다위복지관_양식_작성본_${compactDate(new Date())}.hwpx`); } catch { notice('치환한 HWPX를 저장하지 못했습니다.', true); } });
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
    if (options.account !== false) result = result.replace(/\b\d{3,6}[-\s]?\d{2,6}[-\s]?\d{2,6}\b/g, (match) => `${match.replace(/\D/g, '').slice(0, 4)}-****-****`);
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
    if (!available.length) return showNotice('#textPrivacy', '로그인된 Claude·Codex 구독을 찾지 못했습니다. AI 보조·연결 센터에서 상태를 확인하세요.', true);
    const provider = available[0].provider;
    const providerLabel = provider === 'codex' ? 'Codex' : 'Claude';
    if (!window.confirm(`${providerLabel} 구독으로 원문을 외부 전송합니다. 기관 승인과 개인정보 보호 기준을 확인했습니까?`)) return;
    const button = $('#textSubscriptionAssist');
    button.disabled = true;
    button.textContent = '구독 AI 처리 중…';
    try {
      aiResult = await runSubscriptionAi({ provider, task: 'text-clean', text: input.value });
      output.textContent = aiResult;
      output.classList.remove('empty');
      $('#textResultLabel').textContent = `${providerLabel} 구독 AI 결과 · 외부 전송 · 검토 필요`;
      $('#textResultCount').textContent = `결과 ${aiResult.length.toLocaleString()}자`;
      $('#textResultBytes').textContent = `UTF-8 ${new TextEncoder().encode(aiResult).length.toLocaleString()} byte`;
      $('#textDownload').disabled = false;
      $('#textAiApply').classList.remove('hidden');
      showNotice('#textPrivacy', `${providerLabel} 구독 AI 초안입니다. 외부 전송 결과이므로 원문과 대조한 뒤 적용하세요.`);
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
  return { ready: '사용 가능', 'not-installed': '설치 필요', 'signed-out': '로그인 필요', unknown: '확인 필요', error: '확인 실패' }[state] || '확인 중';
}

function renderSubscriptionCards(payload) {
  const providers = Object.values(payload?.providers || {});
  $('#subscriptionCards').innerHTML = providers.length ? providers.map((item) => `<div class="subscription-card"><div><b>${escapeHtml(item.label)}</b><span>${item.installed ? '프로그램 발견' : '프로그램 없음'}</span></div><strong class="subscription-state-${escapeHtml(item.state)}">${subscriptionStateLabel(item.state)}</strong><small>${item.state === 'ready' ? '이 PC의 로그인 상태를 확인했습니다.' : item.state === 'not-installed' ? '공식 설치 후 다시 상태를 확인하세요.' : '구독 프로그램에서 로그인 상태를 확인하세요.'}</small>${item.state === 'not-installed' ? `<a href="${escapeHtml(item.installUrl)}" target="_blank" rel="noreferrer">공식 설치 안내 ↗</a>` : ''}</div>`).join('') : '<p class="muted-text">구독 상태를 읽지 못했습니다.</p>';
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
  if (message.includes('timeout')) return '구독 프로그램 응답 시간이 초과되었습니다.';
  if (message.includes('signed')) return '구독 프로그램에 로그인한 뒤 다시 시도하세요.';
  return '구독 AI 결과를 받지 못했습니다. 프로그램 로그인 상태와 설치를 확인하세요.';
}

function bindTemplateStudio() {
  const templateSelect = $('#templateSelect'); const templateBody = $('#templateBody'); const profileKey = 'dawith-institution-profile-v1';
  const fields = { organization: $('#profileOrganization'), manager: $('#profileManager'), date: $('#templateDate'), project: $('#templateProject'), author: $('#templateAuthor'), attendees: $('#templateAttendees'), purpose: $('#templatePurpose'), content: $('#templateContent'), decisions: $('#templateDecisions'), actions: $('#templateActions') };
  const today = compactDate(new Date()).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  fields.date.value = today;
  try { const profile = JSON.parse(localStorage.getItem(profileKey) || '{}'); fields.organization.value = profile.organization || ''; fields.manager.value = profile.manager || ''; fields.author.value = profile.manager || ''; } catch { /* localStorage may be unavailable */ }
  const currentTemplate = () => getTemplateCatalog().find((template) => template.id === templateSelect.value) || builtInTemplates[0];
  const loadTemplate = () => { const template = currentTemplate(); templateBody.value = template.body; $('#templateName').value = template.id.startsWith('custom-') ? template.title : ''; update(); };
  const values = () => ({ '기관명': fields.organization.value.trim() || '기관명 입력 필요', '문서일': fields.date.value ? formatDate(new Date(`${fields.date.value}T00:00:00`)) : '문서일 입력 필요', '사업명': fields.project.value.trim() || '사업명 입력 필요', '작성자': fields.author.value.trim() || fields.manager.value.trim() || '작성자 입력 필요', '참석자': fields.attendees.value.trim() || '참석자 입력 필요', '목적': fields.purpose.value.trim() || '내용 입력 필요', '내용': fields.content.value.trim() || '내용 입력 필요', '결정사항': fields.decisions.value.trim() || '내용 입력 필요', '후속조치': fields.actions.value.trim() || '내용 입력 필요' });
  const update = () => { let output = templateBody.value; for (const [key, value] of Object.entries(values())) output = output.split(`{{${key}}}`).join(value); $('#templatePreview').textContent = output || '양식 내용을 입력하세요.'; };
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
      $('#templatePreview').textContent = result;
      showNotice('#templateNotice', '로컬 AI 초안을 만들었습니다. 원문과 대조해 검토하세요.');
    } catch (error) {
      showNotice('#templateNotice', aiErrorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = '로컬 AI로 초안 다듬기';
    }
  });
  loadTemplate();
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

function showNotice(target, message, error = false) { const element = typeof target === 'string' ? $(target) : target; if (!element) return; element.classList.remove('hidden'); element.className = error ? 'notice error-notice' : 'notice'; element.textContent = message; }

document.addEventListener('click', (event) => { const toolButton = event.target.closest('[data-tool]'); if (toolButton) return openTool(toolButton.dataset.tool); const action = event.target.closest('[data-action]')?.dataset.action; if (action === 'home') showHome(); });
$('#homeButton').addEventListener('click', showHome);
$('#privacyButton').addEventListener('click', () => $('#privacyDialog').showModal());
$('#closePrivacy').addEventListener('click', () => $('#privacyDialog').close());
$('#toolSearch').addEventListener('input', (event) => { state.search = event.target.value; renderToolGrid(); });
$$('.category-button').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; state.search = ''; $('#toolSearch').value = ''; $$('.category-button').forEach((item) => item.classList.toggle('active', item === button)); showHome(); }));
renderToolGrid();

const initialTool = new URLSearchParams(window.location.search).get('tool');
if (initialTool && toolCatalog.some((tool) => tool.id === initialTool)) openTool(initialTool);

let deferredInstallPrompt;
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; $('#installButton')?.classList.remove('hidden'); });
$('#installButton')?.addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('#installButton').classList.add('hidden'); });
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(window.location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is optional */ });
