const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const studio = {
  scenes: [],
  selected: null,
  playing: false,
  urls: new Set(),
  sampleIndex: 0,
};

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

function drawCover(ctx, source, canvas) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) return;
  const scale = Math.max(canvas.width / width, canvas.height / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  ctx.drawImage(source, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
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
  videoTrack.innerHTML = studio.scenes.length ? studio.scenes.map((scene, index) => `<button type="button" class="timeline-clip${scene.id === studio.selected ? ' is-selected' : ''}" data-scene-id="${esc(scene.id)}" style="--clip-width:${Math.max(112, scene.duration * 76 * scale)}px"><span>${index + 1}</span><b>${esc(scene.name || '장면')}</b><small>${Number(scene.duration).toFixed(1)}s</small></button>`).join('') : '<span class="timeline-empty">장면을 넣으면 타임라인에 표시됩니다.</span>';
  captionTrack.innerHTML = studio.scenes.length ? studio.scenes.map((scene) => `<button type="button" class="timeline-caption-clip${scene.id === studio.selected ? ' is-selected' : ''}" data-scene-id="${esc(scene.id)}" style="--clip-width:${Math.max(112, scene.duration * 76 * scale)}px">${esc(scene.caption || '자막 없음')}</button>`).join('') : '';
}

async function sourceForScene(scene, progress = 0) {
  if (!scene?.src) return null;
  if (scene.type !== 'video') {
    const image = new Image();
    image.src = scene.src;
    await new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
    return image;
  }
  const video = document.createElement('video');
  video.src = scene.src;
  video.muted = true;
  video.preload = 'auto';
  await new Promise((resolve) => { video.onloadeddata = resolve; video.onerror = resolve; });
  if (video.duration) {
    const start = Math.max(0, Math.min(.9, Number(scene.trimStart || 0)));
    const end = Math.max(start + .1, Math.min(1, Number(scene.trimEnd || 1)));
    video.currentTime = Math.min(video.duration - .05, video.duration * (start + progress * (end - start)));
  }
  await new Promise((resolve) => { video.onseeked = resolve; setTimeout(resolve, 120); });
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
    if (source) { ctx.save(); ctx.globalAlpha = .92; drawCover(ctx, source, canvas); ctx.restore(); ctx.fillStyle = 'rgba(18, 27, 24, .22)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left'; ctx.font = `700 ${Math.max(18, Math.round(canvas.width / 43))}px sans-serif`;
    ctx.fillText($('#videoOrgName').value.trim() || '우리 기관', 28, 42);
    drawText(ctx, scene.caption || scene.name, canvas.width / 2, canvas.height / 2, canvas.width - 90, scene.captionStyle, canvas);
    if (scene.transition === 'fade' && progress < .18) { ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - progress / .18)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
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
  scene.reviewed = $('#videoSceneReviewed').checked;
  renderSceneList();
}

function selectScene(id) { studio.selected = id; renderSceneList(); }

function addSamples() {
  for (const sample of sampleScenes) addScene(null, sample);
  studio.selected = studio.scenes[studio.scenes.length - sampleScenes.length]?.id;
  renderSceneList();
  window.dispatchEvent(new CustomEvent('dawith-toast', { detail: '예시 장면 3개를 넣었습니다. 문구와 개인정보 검토 상태를 확인하세요.' }));
}

function clearScenes() {
  for (const scene of studio.scenes) if (scene.src.startsWith('blob:')) URL.revokeObjectURL(scene.src);
  studio.urls.clear(); studio.scenes = []; studio.selected = null; renderSceneList(); drawSelected();
}

function reorder(fromId, toId) {
  const from = studio.scenes.findIndex((scene) => scene.id === fromId);
  const to = studio.scenes.findIndex((scene) => scene.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [scene] = studio.scenes.splice(from, 1);
  studio.scenes.splice(to, 0, scene);
  renderSceneList();
}

function moveSelected(delta) {
  const index = studio.scenes.findIndex((scene) => scene.id === studio.selected);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= studio.scenes.length) return;
  [studio.scenes[index], studio.scenes[target]] = [studio.scenes[target], studio.scenes[index]];
  renderSceneList();
}

function splitSelected() {
  const index = studio.scenes.findIndex((scene) => scene.id === studio.selected);
  const scene = studio.scenes[index];
  if (!scene || scene.duration < 2) return toast('2초 이상인 장면만 분할할 수 있어요.');
  const first = { ...scene, id: `${scene.id}-a`, name: `${scene.name} · 앞`, duration: Math.max(1, Number((scene.duration / 2).toFixed(1))), trimEnd: (scene.trimStart + scene.trimEnd) / 2 };
  const second = { ...scene, id: `${scene.id}-b`, name: `${scene.name} · 뒤`, duration: Math.max(1, Number((scene.duration / 2).toFixed(1))), trimStart: (scene.trimStart + scene.trimEnd) / 2 };
  studio.scenes.splice(index, 1, first, second); studio.selected = first.id; renderSceneList(); toast('선택한 장면을 두 개로 분할했습니다.');
}

async function previewAll() {
  if (!studio.scenes.length || studio.playing) return;
  studio.playing = true; $('#videoPlayButton').disabled = true; $('#videoPlayButton').textContent = '■ 재생 중…';
  for (const scene of studio.scenes) {
    if (!studio.playing) break;
    studio.selected = scene.id; renderSceneList();
    const started = performance.now();
    while (studio.playing && performance.now() - started < scene.duration * 1000) {
      await drawScene(scene, (performance.now() - started) / (scene.duration * 1000));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  studio.playing = false; $('#videoPlayButton').disabled = false; $('#videoPlayButton').textContent = '▶ 미리보기';
  drawSelected();
}

function downloadBlob(blob, name) {
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function projectPayload() {
  return { version: 1, title: $('#videoProjectTitle').value, organization: $('#videoOrgName').value, eventDate: $('#videoEventDate').value, aspect: $('#videoAspect').value, theme: $('#videoTheme').value, ending: $('#videoEndingText').value, musicName: $('#videoMusicFile').files[0]?.name || '', scenes: studio.scenes.map(({ file, src, ...scene }) => scene) };
}

function exportProject() {
  downloadBlob(new Blob([JSON.stringify(projectPayload(), null, 2)], { type: 'application/json' }), `${($('#videoProjectTitle').value.trim() || 'dawith-video-project').replace(/[^\w가-힣-]+/g, '-').slice(0, 60)}.json`);
}

async function exportVideo() {
  if (!studio.scenes.length) return toast('사진이나 영상을 하나 이상 넣어 주세요.');
  if (!$('#videoConsentCheck').checked || !$('#videoPrivacyCheck').checked) return toast('동의·개인정보 확인을 마친 뒤 저장해 주세요.');
  if (studio.scenes.some((scene) => !scene.reviewed)) return toast('아직 개인정보를 검토하지 않은 장면이 있어요.');
  const musicFile = $('#videoMusicFile').files[0];
  if (musicFile && !$('#videoCreditCheck').checked) return toast('음악 출처 확인을 체크해 주세요.');
  if (!window.MediaRecorder || !$('#videoCanvas').captureStream) return toast('이 브라우저는 로컬 영상 저장을 지원하지 않습니다. Chrome 또는 Windows EXE에서 다시 시도해 주세요.');
  const button = $('#videoExportButton'); button.disabled = true; button.textContent = '영상 저장 중…';
  const canvas = $('#videoCanvas'); const stream = canvas.captureStream(30); let audioContext; let audio;
  try {
    if (musicFile) {
      audioContext = new AudioContext();
      audio = new Audio(URL.createObjectURL(musicFile)); audio.loop = true; audio.volume = Number($('#videoMusicVolume').value) / 100;
      const source = audioContext.createMediaElementSource(audio); const destination = audioContext.createMediaStreamDestination(); source.connect(destination); source.connect(audioContext.destination); destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      await audioContext.resume(); await audio.play();
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
    downloadBlob(new Blob(chunks, { type: 'video/webm' }), `${title}.webm`); toast('영상을 이 PC에 저장했습니다.');
  } catch (error) { toast(`영상을 저장하지 못했습니다: ${error.message || '알 수 없는 오류'}`); }
  finally { stream.getTracks().forEach((track) => track.stop()); if (audio) { audio.pause(); audio.src = ''; } if (audioContext) await audioContext.close(); button.disabled = false; button.innerHTML = '영상으로 저장하기 <span>→</span>'; }
}

function toast(message) { window.dispatchEvent(new CustomEvent('dawith-toast', { detail: message })); const target = $('#toast'); if (target) { target.textContent = message; target.classList.add('show'); setTimeout(() => target.classList.remove('show'), 2600); } }

function bind() {
  $('#videoMediaFile').addEventListener('change', (event) => { [...event.target.files].slice(0, 200 - studio.scenes.length).forEach((file) => addScene(file)); renderSceneList(); event.target.value = ''; });
  $('#videoMusicFile').addEventListener('change', (event) => { $('#videoMusicName').textContent = event.target.files[0]?.name || '선택하지 않으면 무음으로 저장합니다.'; });
  $('#videoMusicVolume').addEventListener('input', (event) => { $('#videoMusicVolumeValue').textContent = `${event.target.value}%`; });
  $('#videoAspect').addEventListener('change', updateCanvasSize); $('#videoTheme').addEventListener('change', drawSelected);
  $('#videoSampleButton').addEventListener('click', addSamples); $('#videoClearButton').addEventListener('click', clearScenes); $('#videoPlayButton').addEventListener('click', () => { if (studio.playing) studio.playing = false; else previewAll(); });
  $('#videoExportButton').addEventListener('click', exportVideo); $('#videoProjectExportButton').addEventListener('click', exportProject);
  ['videoProjectTitle', 'videoOrgName', 'videoEventDate', 'videoEndingText'].forEach((id) => $(`#${id}`).addEventListener('input', drawSelected));
  ['videoSceneName', 'videoSceneCaption', 'videoSceneDuration', 'videoCaptionStyle', 'videoSceneReviewed'].forEach((id) => $(`#${id}`).addEventListener('input', syncSceneEditor));
  $('#videoMoveUp').addEventListener('click', () => moveSelected(-1)); $('#videoMoveDown').addEventListener('click', () => moveSelected(1)); $('#videoRemoveScene').addEventListener('click', () => { studio.scenes = studio.scenes.filter((scene) => scene.id !== studio.selected); studio.selected = studio.scenes[0]?.id || null; renderSceneList(); });
  const splitButton = document.createElement('button'); splitButton.id = 'videoSplitScene'; splitButton.className = 'secondary-button'; splitButton.type = 'button'; splitButton.textContent = '✂ 분할'; $('#videoRemoveScene').before(splitButton); splitButton.addEventListener('click', splitSelected);
  $('#videoSceneList').addEventListener('click', (event) => { const item = event.target.closest('[data-scene-id]'); if (item) selectScene(item.dataset.sceneId); });
  $('#videoTimeline').addEventListener('click', (event) => { const item = event.target.closest('[data-scene-id]'); if (item) selectScene(item.dataset.sceneId); });
  $('#videoTimelineScale').addEventListener('change', renderTimeline);
  let dragged = null;
  $('#videoSceneList').addEventListener('dragstart', (event) => { dragged = event.target.closest('[data-scene-id]')?.dataset.sceneId || null; });
  $('#videoSceneList').addEventListener('dragover', (event) => { if (dragged) event.preventDefault(); });
  $('#videoSceneList').addEventListener('drop', (event) => { event.preventDefault(); const target = event.target.closest('[data-scene-id]')?.dataset.sceneId; if (dragged && target) reorder(dragged, target); dragged = null; });
  document.addEventListener('click', (event) => { if (event.target.closest('[data-nav="video"]')) { setTimeout(() => { $('.view.active')?.classList.remove('active'); $('#videoView').classList.add('active'); }, 0); } });
  window.addEventListener('dawith-toast', (event) => { const target = $('#toast'); if (target) { target.textContent = event.detail; target.classList.add('show'); setTimeout(() => target.classList.remove('show'), 2600); } });
  document.addEventListener('keydown', (event) => {
    if (!$('#videoView')?.classList.contains('active')) return;
    if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); if (studio.playing) studio.playing = false; else previewAll(); }
    if (event.key === 'Delete' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && selectedScene()) { studio.scenes = studio.scenes.filter((scene) => scene.id !== studio.selected); studio.selected = studio.scenes[0]?.id || null; renderSceneList(); }
    if (event.altKey && event.key === 'ArrowUp') moveSelected(-1);
    if (event.altKey && event.key === 'ArrowDown') moveSelected(1);
  });
  renderSceneList(); updateCanvasSize();
}

bind();
