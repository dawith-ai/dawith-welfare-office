const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const studio = {
  scenes: [],
  selected: null,
  playing: false,
  urls: new Set(),
  sampleIndex: 0,
  currentTime: 0,
  history: [],
  historyIndex: -1,
  historyTimer: null,
  playbackToken: 0,
  audioPreview: null,
  sourceCache: new Map(),
  videoCache: new Map(),
  brandImage: null,
};

const STORAGE_KEY = 'dawith.video-studio.project.v2';

function timelineDuration() {
  return studio.scenes.reduce((sum, scene) => sum + Math.max(0, Number(scene.duration) || 0), 0) + (studio.scenes.length ? 2 : 0);
}

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

function serializableProject() {
  return {
    version: 2,
    title: $('#videoProjectTitle')?.value || '',
    organization: $('#videoOrgName')?.value || '',
    eventDate: $('#videoEventDate')?.value || '',
    aspect: $('#videoAspect')?.value || '16:9',
    theme: $('#videoTheme')?.value || 'warm',
    ending: $('#videoEndingText')?.value || '',
    musicName: $('#videoMusicFile')?.files[0]?.name || '',
    voiceName: $('#videoVoiceFile')?.files[0]?.name || '',
    musicVolume: Number($('#videoMusicVolume')?.value || 35),
    voiceVolume: Number($('#videoVoiceVolume')?.value || 100),
    scenes: studio.scenes.map(({ file, src, ...scene }) => ({ ...scene, src: src?.startsWith('data:') ? src : '' })),
  };
}

function stateSnapshot() {
  return JSON.stringify({ project: serializableProject(), selected: studio.selected, currentTime: studio.currentTime });
}

function updateHistoryButtons() {
  $('#videoUndoButton').disabled = studio.historyIndex <= 0;
  $('#videoRedoButton').disabled = studio.historyIndex < 0 || studio.historyIndex >= studio.history.length - 1;
}

function saveProjectState({ history = true } = {}) {
  const snapshot = stateSnapshot();
  try { localStorage.setItem(STORAGE_KEY, snapshot); } catch { /* storage can be disabled in private browsing */ }
  $('#videoSaveState').textContent = `자동 저장됨 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  if (!history) return;
  if (studio.history[studio.historyIndex] === snapshot) return;
  studio.history = studio.history.slice(0, studio.historyIndex + 1);
  studio.history.push(snapshot);
  if (studio.history.length > 80) studio.history.shift();
  studio.historyIndex = studio.history.length - 1;
  updateHistoryButtons();
}

function scheduleSave() {
  clearTimeout(studio.historyTimer);
  $('#videoSaveState').textContent = '저장 중…';
  studio.historyTimer = setTimeout(() => saveProjectState(), 160);
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return;
  const parsed = JSON.parse(snapshot);
  const project = parsed.project || parsed;
  for (const scene of studio.scenes) if (scene.src?.startsWith('blob:')) URL.revokeObjectURL(scene.src);
  studio.sourceCache.clear();
  studio.videoCache.clear();
  $('#videoProjectTitle').value = project.title || '';
  $('#videoOrgName').value = project.organization || '';
  $('#videoEventDate').value = project.eventDate || '';
  $('#videoAspect').value = project.aspect || '16:9';
  $('#videoTheme').value = project.theme || 'warm';
  $('#videoEndingText').value = project.ending || '';
  studio.scenes = (project.scenes || []).filter((scene) => scene.src).map((scene) => ({ ...scene, file: null }));
  studio.selected = parsed.selected || studio.scenes[0]?.id || null;
  studio.currentTime = Math.min(Number(parsed.currentTime) || 0, timelineDuration());
  updateCanvasSize();
  renderSceneList();
  seekTimeline(studio.currentTime, { draw: true });
}

function undo() {
  if (studio.historyIndex <= 0) return;
  studio.historyIndex -= 1;
  restoreSnapshot(studio.history[studio.historyIndex]);
  updateHistoryButtons();
  $('#videoSaveState').textContent = '되돌린 상태';
}

function redo() {
  if (studio.historyIndex >= studio.history.length - 1) return;
  studio.historyIndex += 1;
  restoreSnapshot(studio.history[studio.historyIndex]);
  updateHistoryButtons();
  $('#videoSaveState').textContent = '다시 실행한 상태';
}

const sampleScenes = [
  { name: '함께 준비한 시간', caption: '함께 준비한 시간이 시작되었습니다.', color: '#ffe7d6' },
  { name: '즐거운 활동', caption: '서로의 이야기를 나누고 즐겁게 참여했어요.', color: '#dff1e8' },
  { name: '고마운 마음', caption: '함께해 주신 모든 분께 고맙습니다.', color: '#e8e2f7' },
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function getAspect() {
  const value = $('#videoAspect')?.value || '16:9';
  const [width, height] = value.split(':').map(Number);
  return { width, height };
}

function canvasSize() {
  const aspect = getAspect();
  const width = aspect.width === 9 ? 540 : 960;
  return { width, height: Math.round(width * aspect.height / aspect.width) };
}

function themeColors() {
  return {
    warm: ['#fff1e5', '#f5c9b7', '#6c3e40'],
    bright: ['#eaf7ff', '#a9dcf4', '#164c67'],
    calm: ['#edf3ef', '#bbd2c5', '#294c43'],
  }[$('#videoTheme')?.value || 'warm'];
}

function getBrandImage() {
  if (!studio.brandImage) {
    studio.brandImage = new Image();
    studio.brandImage.src = './dawith-ci.svg';
  }
  return studio.brandImage;
}

function updateCanvasSize() {
  const canvas = $('#videoCanvas');
  if (!canvas) return;
  const size = canvasSize();
  canvas.width = size.width;
  canvas.height = size.height;
  drawSelected();
}

function makeSampleDataUrl(sample) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${sample.color}"/><circle cx="950" cy="190" r="150" fill="#ffffff" opacity=".45"/><circle cx="250" cy="650" r="220" fill="#ffffff" opacity=".3"/><path d="M0 560 C250 430 350 720 570 560 S950 390 1200 510 V800 H0Z" fill="#ffffff" opacity=".35"/><text x="80" y="150" fill="#2f403a" font-family="sans-serif" font-weight="700" font-size="42">Dawith Welfare Office</text><text x="80" y="250" fill="#2f403a" font-family="sans-serif" font-weight="700" font-size="76">${sample.name}</text><text x="80" y="330" fill="#536861" font-family="sans-serif" font-size="30">${sample.caption}</text><text x="80" y="710" fill="#536861" font-family="sans-serif" font-size="22">로컬 영상 스튜디오 예시 장면</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function addScene(file, sample = null) {
  const src = sample ? makeSampleDataUrl(sample) : URL.createObjectURL(file);
  if (!sample) studio.urls.add(src);
  const scene = {
    id: `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: sample?.name || file.name.replace(/\.[^.]+$/, '').slice(0, 60),
    caption: sample?.caption || '',
    duration: 3,
    trimStart: 0,
    trimEnd: 1,
    transition: 'cut',
    captionStyle: 'bottom',
    effect: 'none',
    effectAmount: 50,
    motion: 'none',
    scale: 100,
    scaleStart: 100,
    scaleEnd: 100,
    positionX: 0,
    positionY: 0,
    framing: 'cover',
    opacity: 100,
    reviewed: false,
    type: sample ? 'image' : (file.type.startsWith('video/') ? 'video' : 'image'),
    src,
    file,
    fileName: sample ? '예시 장면' : file.name,
  };
  studio.scenes.push(scene);
  studio.selected = scene.id;
  return scene;
}

function selectedScene() {
  return studio.scenes.find((scene) => scene.id === studio.selected) || null;
}

function sceneAtTime(time) {
  let cursor = 0;
  for (const scene of studio.scenes) {
    const end = cursor + Number(scene.duration || 0);
    if (time < end || scene === studio.scenes.at(-1)) return { scene, offset: Math.max(0, time - cursor), start: cursor, end };
    cursor = end;
  }
  return null;
}

function updatePlayhead() {
  const timeline = $('#videoTimeline');
  const playhead = $('#videoPlayhead');
  const duration = timelineDuration();
  if (!timeline || !playhead) return;
  playhead.style.left = `${84 + Math.max(0, Math.min(1, studio.currentTime / Math.max(duration, 1))) * Math.max(480, timeline.clientWidth - 100)}px`;
  $('#videoCurrentTime').textContent = formatTime(studio.currentTime);
}

async function seekTimeline(time, { draw = true } = {}) {
  studio.currentTime = Math.max(0, Math.min(timelineDuration(), Number(time) || 0));
  const target = sceneAtTime(studio.currentTime);
  if (target && target.scene.id !== studio.selected) {
    studio.selected = target.scene.id;
    renderSceneList();
  }
  updatePlayhead();
  if (draw && target) await drawScene(target.scene, target.offset / Math.max(Number(target.scene.duration) || 1, .1));
}

function renderSceneList() {
  const list = $('#videoSceneList');
  $('#videoSceneCount').textContent = `${studio.scenes.length} 장면`;
  if (!studio.scenes.length) {
    list.innerHTML = '<div class="empty-record">아직 넣은 사진이나 영상이 없어요.</div>';
    $('#videoStageEmpty').hidden = false;
    $('#videoSceneEditor').classList.add('video-disabled');
    $('#videoSelectedSceneTitle').textContent = '장면을 선택하세요';
    $('#videoDurationSummary').value = '총 0초';
    renderTimeline();
    return;
  }
  $('#videoStageEmpty').hidden = true;
  $('#videoSceneEditor').classList.remove('video-disabled');
  list.innerHTML = studio.scenes.map((scene, index) => `<button class="video-scene-item${scene.id === studio.selected ? ' is-selected' : ''}" type="button" draggable="true" data-scene-id="${esc(scene.id)}"><img class="video-scene-thumb" src="${esc(scene.src)}" alt="" /><span><b>${index + 1}. ${esc(scene.name || '이름 없는 장면')}</b><small>${scene.type === 'video' ? '영상' : '사진'} · ${Number(scene.duration).toFixed(1)}초${scene.caption ? ` · ${esc(scene.caption)}` : ''}</small></span><i class="video-scene-status">${scene.reviewed ? '✓' : '!'}</i></button>`).join('');
  const total = studio.scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
  $('#videoDurationSummary').value = `총 ${total.toFixed(1)}초`;
  renderSceneEditor();
  renderTimeline();
}

function renderSceneEditor() {
  const scene = selectedScene();
  if (!scene) return;
  $('#videoSelectedSceneTitle').textContent = `장면 ${studio.scenes.indexOf(scene) + 1} 편집`;
  $('#videoSceneName').value = scene.name;
  $('#videoSceneCaption').value = scene.caption;
  $('#videoSceneDuration').value = scene.duration;
  $('#videoTrimStart').value = scene.trimStart;
  $('#videoTrimEnd').value = scene.trimEnd;
  $('#videoTransition').value = scene.transition;
  $('#videoCaptionStyle').value = scene.captionStyle;
  $('#videoEffect').value = scene.effect || 'none';
  $('#videoMotion').value = scene.motion || 'none';
  $('#videoEffectAmount').value = Number(scene.effectAmount ?? 50);
  $('#videoEffectAmountValue').textContent = `${Number(scene.effectAmount ?? 50)}%`;
  $('#videoSceneScaleStart').value = Number(scene.scaleStart ?? scene.scale ?? 100);
  $('#videoSceneScaleEnd').value = Number(scene.scaleEnd ?? scene.scale ?? 100);
  $('#videoScenePositionX').value = Number(scene.positionX ?? 0);
  $('#videoScenePositionY').value = Number(scene.positionY ?? 0);
  $('#videoFraming').value = scene.framing || 'cover';
  $('#videoSceneReviewed').checked = scene.reviewed;
  $('#videoMoveUp').disabled = studio.scenes.indexOf(scene) === 0;
  $('#videoMoveDown').disabled = studio.scenes.indexOf(scene) === studio.scenes.length - 1;
  drawSelected();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function sceneFilter(scene) {
  const amount = Math.max(0, Math.min(100, Number(scene.effectAmount ?? 50))) / 100;
  if (scene.effect === 'cinematic') return `contrast(${100 + amount * 28}%) brightness(${100 - amount * 8}%) saturate(${100 + amount * 20}%)`;
  if (scene.effect === 'bright') return `brightness(${100 + amount * 35}%) saturate(${100 + amount * 12}%)`;
  if (scene.effect === 'mono') return `grayscale(${amount * 100}%) contrast(${100 + amount * 12}%)`;
  if (scene.effect === 'soft') return `blur(${amount * 3}px) saturate(${100 - amount * 18}%)`;
  return 'none';
}

function drawCover(ctx, source, canvas, scene, progress = 0) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) return;
  const coverScale = scene.framing === 'contain'
    ? Math.min(canvas.width / width, canvas.height / height)
    : Math.max(canvas.width / width, canvas.height / height);
  const startScale = Number(scene.scaleStart ?? scene.scale ?? 100);
  const endScale = Number(scene.scaleEnd ?? scene.scale ?? startScale);
  let motionScale = Math.max(.5, (startScale + (endScale - startScale) * progress) / 100);
  let offsetX = Number(scene.positionX ?? 0) / 100 * canvas.width;
  let offsetY = Number(scene.positionY ?? 0) / 100 * canvas.height;
  if (scene.motion === 'zoom-in') motionScale *= 1 + progress * .12;
  if (scene.motion === 'zoom-out') motionScale *= 1.12 - progress * .12;
  if (scene.motion === 'pan-left') offsetX += (progress - .5) * canvas.width * .16;
  if (scene.motion === 'pan-right') offsetX += (.5 - progress) * canvas.width * .16;
  const drawWidth = width * coverScale * motionScale;
  const drawHeight = height * coverScale * motionScale;
  ctx.filter = sceneFilter(scene);
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(scene.opacity ?? 100) / 100));
  ctx.drawImage(source, (canvas.width - drawWidth) / 2 + offsetX, (canvas.height - drawHeight) / 2 + offsetY, drawWidth, drawHeight);
  ctx.filter = 'none';
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawText(ctx, text, x, y, maxWidth, style, canvas) {
  if (!text) return;
  const fontSize = Math.max(20, Math.round(canvas.width / 28));
  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  const lines = wrapLines(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.25;
  const boxHeight = lines.length * lineHeight + 28;
  let centerY = style === 'center' ? canvas.height / 2 : canvas.height - boxHeight / 2 - 28;
  if (style === 'box') {
    ctx.fillStyle = 'rgba(17, 24, 22, .70)';
    roundedRect(ctx, 24, centerY - boxHeight / 2, canvas.width - 48, boxHeight, 14);
    ctx.fill();
  } else if (style === 'bottom') {
    ctx.fillStyle = 'rgba(17, 24, 22, .52)';
    ctx.fillRect(0, canvas.height - boxHeight - 28, canvas.width, boxHeight + 52);
  }
  ctx.fillStyle = '#fff';
  lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2, centerY - (lines.length - 1) * lineHeight / 2 + index * lineHeight + fontSize / 3));
}

function renderTimeline() {
  const scale = Number($('#videoTimelineScale')?.value || 100) / 100;
  const videoTrack = $('#videoTimelineVideo');
  const captionTrack = $('#videoTimelineCaption');
  if (!videoTrack || !captionTrack) return;
  const widthFor = (scene) => Math.max(112, scene.duration * 76 * scale);
  videoTrack.innerHTML = studio.scenes.length ? studio.scenes.map((scene, index) => `<button type="button" class="timeline-clip${scene.id === studio.selected ? ' is-selected' : ''}" data-scene-id="${esc(scene.id)}" style="--clip-width:${widthFor(scene)}px"><span>${index + 1}</span><b>${esc(scene.name || '장면')}</b><small>${Number(scene.duration).toFixed(1)}s</small><i class="timeline-handle timeline-handle-start" data-trim="start" aria-label="시작 조절"></i><i class="timeline-handle timeline-handle-end" data-trim="end" aria-label="끝 조절"></i></button>`).join('') : '<span class="timeline-empty">장면을 넣으면 타임라인에 표시됩니다.</span>';
  captionTrack.innerHTML = studio.scenes.length ? studio.scenes.map((scene) => `<button type="button" class="timeline-caption-clip${scene.id === studio.selected ? ' is-selected' : ''}" data-scene-id="${esc(scene.id)}" style="--clip-width:${widthFor(scene)}px">${esc(scene.caption || '자막 없음')}</button>`).join('') : '';
  const ruler = $('#videoTimelineRuler');
  if (ruler) {
    const duration = timelineDuration();
    const marks = Array.from({ length: 6 }, (_, index) => formatTime(duration * index / 5));
    ruler.innerHTML = marks.map((mark) => `<span>${mark}</span>`).join('');
  }
  updatePlayhead();
}

async function sourceForScene(scene, progress = 0) {
  if (!scene?.src) return null;
  if (scene.type !== 'video') {
    if (studio.sourceCache.has(scene.src)) return studio.sourceCache.get(scene.src);
    const image = new Image();
    image.src = scene.src;
    await new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
    studio.sourceCache.set(scene.src, image);
    return image;
  }
  let video = studio.videoCache.get(scene.id);
  if (!video) {
    video = document.createElement('video');
    video.src = scene.src;
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    studio.videoCache.set(scene.id, video);
    await new Promise((resolve) => { video.onloadeddata = resolve; video.onerror = resolve; });
  }
  if (video.duration) {
    const start = Math.max(0, Math.min(.9, Number(scene.trimStart || 0)));
    const end = Math.max(start + .1, Math.min(1, Number(scene.trimEnd || 1)));
    const nextTime = Math.min(video.duration - .05, video.duration * (start + progress * (end - start)));
    if (Math.abs(video.currentTime - nextTime) > .04) {
      await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = nextTime; setTimeout(resolve, 120); });
    }
  }
  return video;
}

async function drawScene(scene, progress = 0) {
  const canvas = $('#videoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const [base, accent, textColor] = themeColors();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, base); gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (scene) {
    const source = await sourceForScene(scene, progress);
    if (source) { ctx.save(); ctx.globalAlpha = .92; drawCover(ctx, source, canvas, scene, progress); ctx.restore(); ctx.fillStyle = 'rgba(18, 27, 24, .22)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left'; ctx.font = `700 ${Math.max(18, Math.round(canvas.width / 43))}px sans-serif`;
    ctx.fillText($('#videoOrgName').value.trim() || '우리 기관', 28, 42);
    const brand = getBrandImage();
    if (brand.complete && brand.naturalWidth) { ctx.save(); ctx.globalAlpha = .92; ctx.drawImage(brand, canvas.width - 74, 18, 48, 48); ctx.restore(); }
    drawText(ctx, scene.caption || scene.name, canvas.width / 2, canvas.height / 2, canvas.width - 90, scene.captionStyle, canvas);
    if (scene.transition === 'fade' && progress < .18) { ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - progress / .18)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (scene.transition === 'wipe' && progress < .18) { ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, 1 - progress / .18)})`; ctx.fillRect(0, 0, canvas.width * Math.max(0, 1 - progress / .18), canvas.height); }
  }
}

async function drawSelected() { await drawScene(selectedScene()); }

function syncSceneEditor() {
  const scene = selectedScene();
  if (!scene) return;
  scene.name = $('#videoSceneName').value.trim().slice(0, 60);
  scene.caption = $('#videoSceneCaption').value.slice(0, 160);
  scene.duration = Math.max(1, Math.min(15, Number($('#videoSceneDuration').value) || 3));
  scene.trimStart = Math.max(0, Math.min(.9, Number($('#videoTrimStart').value) || 0));
  scene.trimEnd = Math.max(scene.trimStart + .1, Math.min(1, Number($('#videoTrimEnd').value) || 1));
  $('#videoTrimEnd').value = scene.trimEnd;
  scene.transition = $('#videoTransition').value;
  scene.captionStyle = $('#videoCaptionStyle').value;
  scene.effect = $('#videoEffect').value;
  scene.motion = $('#videoMotion').value;
  scene.effectAmount = Math.max(0, Math.min(100, Number($('#videoEffectAmount').value) || 0));
  scene.scaleStart = Math.max(50, Math.min(200, Number($('#videoSceneScaleStart').value) || 100));
  scene.scaleEnd = Math.max(50, Math.min(200, Number($('#videoSceneScaleEnd').value) || scene.scaleStart));
  scene.scale = scene.scaleStart;
  scene.positionX = Math.max(-100, Math.min(100, Number($('#videoScenePositionX').value) || 0));
  scene.positionY = Math.max(-100, Math.min(100, Number($('#videoScenePositionY').value) || 0));
  scene.framing = $('#videoFraming').value;
  $('#videoEffectAmountValue').textContent = `${scene.effectAmount}%`;
  scene.reviewed = $('#videoSceneReviewed').checked;
  renderSceneList();
  scheduleSave();
}

function selectScene(id) { studio.selected = id; const target = sceneAtTime(studio.currentTime); if (!target || target.scene.id !== id) studio.currentTime = studio.scenes.slice(0, studio.scenes.findIndex((scene) => scene.id === id)).reduce((sum, scene) => sum + Number(scene.duration || 0), 0); renderSceneList(); seekTimeline(studio.currentTime); scheduleSave(); }

function addSamples() {
  for (const sample of sampleScenes) addScene(null, sample);
  studio.selected = studio.scenes[studio.scenes.length - sampleScenes.length]?.id;
  renderSceneList();
  saveProjectState();
  window.dispatchEvent(new CustomEvent('dawith-toast', { detail: '예시 장면 3개를 넣었습니다. 문구와 개인정보 검토 상태를 확인하세요.' }));
}

function clearScenes() {
  for (const scene of studio.scenes) if (scene.src.startsWith('blob:')) URL.revokeObjectURL(scene.src);
  studio.urls.clear(); studio.sourceCache.clear(); studio.scenes = []; studio.selected = null; studio.currentTime = 0; renderSceneList(); drawSelected(); saveProjectState();
}

function reorder(fromId, toId) {
  const from = studio.scenes.findIndex((scene) => scene.id === fromId);
  const to = studio.scenes.findIndex((scene) => scene.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [scene] = studio.scenes.splice(from, 1);
  studio.scenes.splice(to, 0, scene);
  renderSceneList();
  saveProjectState();
}

function moveSelected(delta) {
  const index = studio.scenes.findIndex((scene) => scene.id === studio.selected);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= studio.scenes.length) return;
  [studio.scenes[index], studio.scenes[target]] = [studio.scenes[target], studio.scenes[index]];
  renderSceneList();
  saveProjectState();
}

function splitSelected() {
  const index = studio.scenes.findIndex((scene) => scene.id === studio.selected);
  const scene = studio.scenes[index];
  if (!scene || scene.duration < 2) return toast('2초 이상인 장면만 분할할 수 있어요.');
  const first = { ...scene, id: `${scene.id}-a`, name: `${scene.name} · 앞`, duration: Math.max(1, Number((scene.duration / 2).toFixed(1))), trimEnd: (scene.trimStart + scene.trimEnd) / 2 };
  const second = { ...scene, id: `${scene.id}-b`, name: `${scene.name} · 뒤`, duration: Math.max(1, Number((scene.duration / 2).toFixed(1))), trimStart: (scene.trimStart + scene.trimEnd) / 2 };
  studio.scenes.splice(index, 1, first, second); studio.selected = first.id; renderSceneList(); toast('선택한 장면을 두 개로 분할했습니다.');
  saveProjectState();
}

async function previewAll() {
  if (!studio.scenes.length || studio.playing) return;
  studio.playing = true; studio.playbackToken += 1; const token = studio.playbackToken; $('#videoPlayButton').disabled = true; $('#videoPlayButton').textContent = '■ 재생 중…';
  const startedAt = performance.now() - studio.currentTime * 1000;
  while (studio.playing && token === studio.playbackToken && studio.currentTime < timelineDuration()) {
    await seekTimeline((performance.now() - startedAt) / 1000);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  studio.playing = false; $('#videoPlayButton').disabled = false; $('#videoPlayButton').textContent = '▶ 미리보기';
  if (studio.currentTime >= timelineDuration()) studio.currentTime = 0;
  seekTimeline(studio.currentTime);
}

function stopPreview() {
  studio.playing = false;
  studio.playbackToken += 1;
  $('#videoPlayButton').disabled = false;
  $('#videoPlayButton').textContent = '▶ 미리보기';
  seekTimeline(0);
}

function downloadBlob(blob, name) {
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function renderAudioWaveform(file, selector = '#videoAudioWaveform') {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  if (!file || !window.AudioContext) return;
  let context;
  try {
    context = new AudioContext();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const bars = 96;
    const step = Math.max(1, Math.floor(channel.length / bars));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < bars; index += 1) {
      let peak = 0;
      for (let offset = 0; offset < step && (index * step + offset) < channel.length; offset += 1) peak = Math.max(peak, Math.abs(channel[index * step + offset]));
      const bar = document.createElement('i');
      bar.style.height = `${Math.max(12, Math.round(peak * 100))}%`;
      fragment.appendChild(bar);
    }
    target.appendChild(fragment);
  } catch {
    target.textContent = '파형을 읽을 수 없는 형식입니다.';
  } finally {
    if (context) await context.close();
  }
}

function projectPayload() {
  return { ...serializableProject(), currentTime: studio.currentTime };
}

function exportProject() {
  downloadBlob(new Blob([JSON.stringify(projectPayload(), null, 2)], { type: 'application/json' }), `${($('#videoProjectTitle').value.trim() || 'dawith-video-project').replace(/[^\w가-힣-]+/g, '-').slice(0, 60)}.json`);
}

async function exportVideo(format = 'webm') {
  if (!studio.scenes.length) return toast('사진이나 영상을 하나 이상 넣어 주세요.');
  if (!$('#videoConsentCheck').checked || !$('#videoPrivacyCheck').checked) return toast('동의·개인정보 확인을 마친 뒤 저장해 주세요.');
  if (studio.scenes.some((scene) => !scene.reviewed)) return toast('아직 개인정보를 검토하지 않은 장면이 있어요.');
  const musicFile = $('#videoMusicFile').files[0];
  const voiceFile = $('#videoVoiceFile').files[0];
  if ((musicFile || voiceFile) && !$('#videoCreditCheck').checked) return toast('음악·음성 출처 확인을 체크해 주세요.');
  if (!window.MediaRecorder || !$('#videoCanvas').captureStream) return toast('이 브라우저는 로컬 영상 저장을 지원하지 않습니다. Chrome 또는 Windows EXE에서 다시 시도해 주세요.');
  const button = format === 'mp4' ? $('#videoMp4Button') : $('#videoExportButton');
  button.disabled = true; button.textContent = format === 'mp4' ? 'MP4 변환 중…' : '영상 저장 중…';
  $('#videoExportStatus').textContent = format === 'mp4' ? '로컬 FFmpeg가 영상을 변환하고 있습니다. 파일은 이 PC 밖으로 전송되지 않습니다.' : '브라우저 렌더러가 프레임을 기록하고 있습니다.';
  const canvas = $('#videoCanvas'); const stream = canvas.captureStream(30); let audioContext; const audioTracks = [];
  try {
    if (musicFile || voiceFile) {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      for (const [file, volume] of [[musicFile, Number($('#videoMusicVolume').value) / 100], [voiceFile, Number($('#videoVoiceVolume').value) / 100]]) {
        if (!file) continue;
        const audio = new Audio(URL.createObjectURL(file));
        audio.loop = true;
        const source = audioContext.createMediaElementSource(audio);
        const gain = audioContext.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(destination);
        audioTracks.push(audio);
      }
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      await audioContext.resume();
      await Promise.all(audioTracks.map((audio) => audio.play()));
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; }); recorder.start(250);
    for (const scene of studio.scenes) {
      const started = performance.now();
      while (performance.now() - started < scene.duration * 1000) { await drawScene(scene, (performance.now() - started) / (scene.duration * 1000)); await new Promise((resolve) => requestAnimationFrame(resolve)); }
    }
    const ending = { name: '끝 화면', caption: $('#videoEndingText').value.trim() || '함께해 주셔서 고맙습니다.', captionStyle: 'center', duration: 2, type: 'image', src: '' };
    await drawScene(ending); await new Promise((resolve) => setTimeout(resolve, ending.duration * 1000)); recorder.stop(); await stopped;
    const title = ($('#videoProjectTitle').value.trim() || 'dawith-welfare-video').replace(/[^\w가-힣-]+/g, '-').slice(0, 60);
    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    if (format === 'mp4') {
      const response = await fetch('/api/video/convert', { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: webmBlob });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error === 'ffmpeg_unavailable' ? '이 PC에 FFmpeg가 설치되어 있지 않습니다.' : detail.error || 'MP4 변환에 실패했습니다.'); }
      downloadBlob(await response.blob(), `${title}.mp4`); toast('MP4 영상을 이 PC에 저장했습니다.');
    } else {
      downloadBlob(webmBlob, `${title}.webm`); toast('WebM 영상을 이 PC에 저장했습니다.');
    }
    $('#videoExportStatus').textContent = `${format.toUpperCase()} 저장 완료 · 로컬 파일로 내려받았습니다.`;
  } catch (error) { toast(`영상을 저장하지 못했습니다: ${error.message || '알 수 없는 오류'}`); }
  finally { stream.getTracks().forEach((track) => track.stop()); audioTracks.forEach((audio) => { audio.pause(); audio.src = ''; }); if (audioContext) await audioContext.close(); button.disabled = false; button.innerHTML = format === 'mp4' ? 'MP4로 변환 저장' : '영상으로 저장하기 · WebM <span>→</span>'; }
}

function toast(message) { window.dispatchEvent(new CustomEvent('dawith-toast', { detail: message })); const target = $('#toast'); if (target) { target.textContent = message; target.classList.add('show'); setTimeout(() => target.classList.remove('show'), 2600); } }

function bind() {
  $('#videoMediaFile').addEventListener('change', (event) => { [...event.target.files].slice(0, 200 - studio.scenes.length).forEach((file) => addScene(file)); renderSceneList(); saveProjectState(); event.target.value = ''; });
  $('#videoMusicFile').addEventListener('change', (event) => { const file = event.target.files[0]; $('#videoMusicName').textContent = file?.name || '선택하지 않으면 무음으로 저장합니다.'; $('#videoAudioTrackLabel').textContent = file ? `배경음악 · ${file.name}` : '배경음악 · 선택한 파일'; renderAudioWaveform(file, '#videoAudioWaveform'); scheduleSave(); });
  $('#videoVoiceFile').addEventListener('change', (event) => { const file = event.target.files[0]; $('#videoVoiceName').textContent = file?.name || '두 번째 오디오 트랙을 추가할 수 있습니다.'; $('#videoVoiceTrackLabel').textContent = file ? `내레이션 · ${file.name}` : '내레이션 · 선택한 파일'; renderAudioWaveform(file, '#videoVoiceWaveform'); scheduleSave(); });
  $('#videoMusicVolume').addEventListener('input', (event) => { $('#videoMusicVolumeValue').textContent = `${event.target.value}%`; if (studio.audioPreview) studio.audioPreview.volume = Number(event.target.value) / 100; scheduleSave(); });
  $('#videoVoiceVolume').addEventListener('input', (event) => { $('#videoVoiceVolumeValue').textContent = `${event.target.value}%`; scheduleSave(); });
  $('#videoAspect').addEventListener('change', () => { updateCanvasSize(); scheduleSave(); }); $('#videoTheme').addEventListener('change', () => { drawSelected(); scheduleSave(); });
  $('#videoSampleButton').addEventListener('click', addSamples); $('#videoClearButton').addEventListener('click', clearScenes);
  $('#videoPlayButton').addEventListener('click', () => { if (studio.playing) stopPreview(); else previewAll(); });
  $('#videoStopButton').addEventListener('click', stopPreview);
  $('#videoPreviousButton').addEventListener('click', () => { const index = Math.max(0, studio.scenes.findIndex((scene) => scene.id === studio.selected) - 1); if (studio.scenes[index]) selectScene(studio.scenes[index].id); });
  $('#videoNextButton').addEventListener('click', () => { const index = Math.min(studio.scenes.length - 1, studio.scenes.findIndex((scene) => scene.id === studio.selected) + 1); if (studio.scenes[index]) selectScene(studio.scenes[index].id); });
  $('#videoStepButton').addEventListener('click', () => seekTimeline(studio.currentTime + 1 / 30));
  $('#videoExportButton').addEventListener('click', () => exportVideo('webm')); $('#videoMp4Button').addEventListener('click', () => exportVideo('mp4')); $('#videoProjectExportButton').addEventListener('click', exportProject);
  $('#videoUndoButton').addEventListener('click', undo); $('#videoRedoButton').addEventListener('click', redo);
  ['videoProjectTitle', 'videoOrgName', 'videoEventDate', 'videoEndingText'].forEach((id) => $(`#${id}`).addEventListener('input', () => { drawSelected(); scheduleSave(); }));
  ['videoConsentCheck', 'videoPrivacyCheck', 'videoCreditCheck'].forEach((id) => $(`#${id}`).addEventListener('change', scheduleSave));
  ['videoSceneName', 'videoSceneCaption', 'videoSceneDuration', 'videoCaptionStyle', 'videoSceneReviewed', 'videoTrimStart', 'videoTrimEnd', 'videoTransition', 'videoEffect', 'videoMotion', 'videoEffectAmount', 'videoSceneScaleStart', 'videoSceneScaleEnd', 'videoScenePositionX', 'videoScenePositionY', 'videoFraming'].forEach((id) => { $(`#${id}`).addEventListener('input', syncSceneEditor); $(`#${id}`).addEventListener('change', syncSceneEditor); });
  $('#videoMoveUp').addEventListener('click', () => moveSelected(-1)); $('#videoMoveDown').addEventListener('click', () => moveSelected(1));
  $('#videoRemoveScene').addEventListener('click', () => { studio.scenes = studio.scenes.filter((scene) => scene.id !== studio.selected); studio.selected = studio.scenes[0]?.id || null; studio.currentTime = 0; renderSceneList(); saveProjectState(); });
  const splitButton = document.createElement('button'); splitButton.id = 'videoSplitScene'; splitButton.className = 'secondary-button'; splitButton.type = 'button'; splitButton.textContent = '✂ 분할'; $('#videoRemoveScene').before(splitButton); splitButton.addEventListener('click', splitSelected);
  $('#videoSceneList').addEventListener('click', (event) => { const item = event.target.closest('[data-scene-id]'); if (item) selectScene(item.dataset.sceneId); });
  $('#videoTimeline').addEventListener('click', (event) => {
    if (event.target.closest('.timeline-handle')) return;
    const item = event.target.closest('[data-scene-id]');
    if (item) return selectScene(item.dataset.sceneId);
    const track = $('#videoTimelineVideo');
    const rect = track.getBoundingClientRect();
    if (rect.width) seekTimeline(((event.clientX - rect.left) / rect.width) * timelineDuration());
  });
  $('#videoTimelineScale').addEventListener('change', renderTimeline);
  let dragged = null;
  $('#videoSceneList').addEventListener('dragstart', (event) => { dragged = event.target.closest('[data-scene-id]')?.dataset.sceneId || null; });
  $('#videoSceneList').addEventListener('dragover', (event) => { if (dragged) event.preventDefault(); });
  $('#videoSceneList').addEventListener('drop', (event) => { event.preventDefault(); const target = event.target.closest('[data-scene-id]')?.dataset.sceneId; if (dragged && target) reorder(dragged, target); dragged = null; });
  let trimDrag = null;
  $('#videoTimeline').addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.timeline-handle');
    if (!handle) return;
    const clip = handle.closest('[data-scene-id]'); const scene = studio.scenes.find((item) => item.id === clip?.dataset.sceneId);
    if (!scene) return;
    trimDrag = { scene, type: handle.dataset.trim, startX: event.clientX, startValue: Number(handle.dataset.trim === 'start' ? scene.trimStart : scene.trimEnd), scale: Number($('#videoTimelineScale').value) / 100 };
    event.preventDefault();
  });
  document.addEventListener('pointermove', (event) => {
    if (!trimDrag) return;
    const delta = (event.clientX - trimDrag.startX) / (76 * trimDrag.scale);
    const value = Math.max(0, Math.min(1, trimDrag.startValue + delta / Math.max(trimDrag.scene.duration, 1)));
    if (trimDrag.type === 'start') trimDrag.scene.trimStart = Math.min(value, trimDrag.scene.trimEnd - .05);
    else trimDrag.scene.trimEnd = Math.max(value, trimDrag.scene.trimStart + .05);
    renderSceneEditor(); renderTimeline();
  });
  document.addEventListener('pointerup', () => { if (trimDrag) { trimDrag = null; saveProjectState(); } });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-nav="video"]')) { setTimeout(() => { $('.view.active')?.classList.remove('active'); $('#videoView').classList.add('active'); }, 0); } });
  window.addEventListener('dawith-toast', (event) => { const target = $('#toast'); if (target) { target.textContent = event.detail; target.classList.add('show'); setTimeout(() => target.classList.remove('show'), 2600); } });
  document.addEventListener('keydown', (event) => {
    if (!$('#videoView')?.classList.contains('active')) return;
    const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (event.code === 'Space' && !editing) { event.preventDefault(); if (studio.playing) stopPreview(); else previewAll(); }
    if (event.key.toLowerCase() === 's' && !editing && selectedScene()) { event.preventDefault(); splitSelected(); }
    if (event.key === 'Delete' && !editing && selectedScene()) { studio.scenes = studio.scenes.filter((scene) => scene.id !== studio.selected); studio.selected = studio.scenes[0]?.id || null; renderSceneList(); saveProjectState(); }
    if (event.altKey && event.key === 'ArrowUp') moveSelected(-1);
    if (event.altKey && event.key === 'ArrowDown') moveSelected(1);
    if (event.key === 'ArrowLeft' && !editing) seekTimeline(studio.currentTime - (event.shiftKey ? 1 : 1 / 30));
    if (event.key === 'ArrowRight' && !editing) seekTimeline(studio.currentTime + (event.shiftKey ? 1 : 1 / 30));
  });
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { restoreSnapshot(saved); } catch { localStorage.removeItem(STORAGE_KEY); } }
  renderSceneList(); updateCanvasSize();
  studio.history = [stateSnapshot()]; studio.historyIndex = 0; updateHistoryButtons();
}

bind();
