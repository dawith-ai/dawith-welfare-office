// Structured 상담 기록 / 회의록 summaries shared by the rule engine, the local
// Ollama path and the cloud providers. Every engine returns the same shape so
// the UI, export and save paths never care which engine produced the result.

export const SUMMARY_KINDS = ['counseling', 'meeting'];
export const CLOUD_PROVIDERS = ['claude-code', 'codex', 'gemini-cli', 'chatgpt', 'openrouter', 'gemini'];
export const MAX_SUMMARY_INPUT = 60_000;

const NEEDS_CHECK = '[확인 필요]';
const DATE_PATTERN = /(?:20\d{2}\s*[년.\-/]\s*)?\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?|\d{1,2}월(?:\s*\d{1,2}일)?|다음\s*주(?:\s*[월화수목금토일]요일)?|이번\s*주(?:\s*[월화수목금토일]요일)?|다음\s*달|이번\s*달|월말|\d+\s*개월\s*(?:후|내)/;
const TIME_PATTERN = /(?:오전|오후)\s*\d{1,2}시(?:\s*\d{1,2}분)?|\d{1,2}:\d{2}|\d{1,2}시(?:\s*\d{1,2}분)?/;
const ROLE_WORDS = '팀장|사회복지사|복지사|선생님|과장|센터장|관장|주임|대리|간호사|상담사|사례관리자|담당자|실장|부장';
const RELATIONS = ['친모', '친부', '배우자', '자녀', '아동', '어머니', '아버지', '형제', '자매', '보호자', '내담자', '이용자', '대상자', '어르신'];
const TOPICS = ['이혼', '주거', '경제', '생계', '취업', '건강', '정신건강', '양육', '면접교섭', '학교', '폭력', '학대', '중독', '돌봄', '서비스', '고립', '부채', '의료'];

const clean = (value = '') => String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const unique = (items) => [...new Set(items.filter(Boolean))];
const numbered = (items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');
const bounded = (value, limit) => String(value ?? '').slice(0, limit);

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

// "일시: 3월 12일" style labelled lines are common in hand-typed meeting notes.
function labelled(text, labels) {
  const pattern = new RegExp(`^\\s*(?:${labels})\\s*[:：]\\s*(.+)$`, 'm');
  return clean(text.match(pattern)?.[1] || '');
}

const LABEL_LINE = /^\s*(?:일시|날짜|시간|장소|참석자?|참석 인원|안건|회의명|주제)\s*[:：]/;

function pick(lines, pattern, exclude = []) {
  return unique(lines.filter((line) => pattern.test(line) && !exclude.includes(line)));
}

function dueOf(line) {
  const match = line.match(new RegExp(`(?:${DATE_PATTERN.source})(?:\\s*까지)?`));
  return match ? clean(match[0]) : '';
}

function ownerOf(line) {
  const explicit = line.match(new RegExp(`담당(?:자)?\\s*[:：]\\s*([가-힣A-Za-z○]{1,10}(?:\\s?(?:${ROLE_WORDS}))?)`));
  if (explicit) return clean(explicit[1]);
  const titled = line.match(new RegExp(`([가-힣○]{1,4}\\s?(?:${ROLE_WORDS}))`));
  if (titled) return clean(titled[1]);
  const subject = line.match(/(?:^|\s)([가-힣○]{2,4})(?:이|가|은|는)\s/);
  if (subject && !RELATIONS.includes(subject[1]) && !/회의|논의|결정|다음|이번|사례/.test(subject[1])) return subject[1];
  return '';
}

function counselingRules(rawText, contextText) {
  const text = clean(rawText);
  const lines = sentences(text);
  const all = `${text}\n${contextText}`;
  const relations = unique(RELATIONS.filter((term) => all.includes(term)));
  const topics = unique(TOPICS.filter((term) => all.includes(term)));
  const date = all.match(DATE_PATTERN)?.[0] || '';
  const complaint = pick(lines, /어렵|어려움|불안|걱정|힘들|호소|부담|문제|부족|막막|고민|원한다|원함|싶다|싶어/);
  const risks = pick(lines, /위험|위기|폭력|학대|방임|자해|자살|극단|체납|연체|단전|단수|퇴거|중독|응급|고립/);
  const strengths = pick(lines, /의지|노력|꾸준|가능|지지|도움을 받|돕고|참여|잘 하|잘하|강점|유지하고/);
  const plan = pick(lines, /예정|계획|하기로|다음\s*(?:주|달|상담|회기|방문|에)|후속|재상담|모니터링|할 것|까지/);
  const intervention = pick(lines, /안내|설명|연계|제공|정보|공감|격려|교육|지지하였|지지함|상담하였|상담함|의뢰/, plan);
  const needs = pick(lines, /필요|원함|원한다|원하|희망|요청|싶/, [...intervention, ...plan]);
  if (!needs.length && topics.length) needs.push(`${topics.join(', ')} 관련 지원 욕구 ${NEEDS_CHECK}`);
  return {
    kind: 'counseling',
    overview: [
      `일시: ${date || NEEDS_CHECK}`,
      `대상: ${relations.join(', ') || '내담자'}`,
      `주요 영역: ${topics.join(', ') || NEEDS_CHECK}`,
      contextText ? `맥락: ${contextText}` : '',
    ].filter(Boolean).join('\n'),
    complaint: complaint.length ? numbered(complaint) : (lines[0] || NEEDS_CHECK),
    assessment: {
      needs: needs.length ? numbered(needs) : NEEDS_CHECK,
      strengths: strengths.length ? numbered(strengths) : `원문에서 강점 단서를 찾지 못했습니다. ${NEEDS_CHECK}`,
      risks: risks.length ? numbered(risks) : `원문에서 위험 단서를 찾지 못했습니다. 담당자 ${NEEDS_CHECK}`,
    },
    intervention: intervention.length ? numbered(intervention) : NEEDS_CHECK,
    plan: plan.length ? numbered(plan) : `후속 조치를 담당자와 협의합니다. ${NEEDS_CHECK}`,
  };
}

function meetingRules(rawText, contextText) {
  const text = clean(rawText);
  const all = `${text}\n${contextText}`;
  const lines = sentences(text).filter((line) => !LABEL_LINE.test(line));
  const datetime = labelled(all, '일시|날짜') || unique([all.match(DATE_PATTERN)?.[0], all.match(TIME_PATTERN)?.[0]].map((item) => clean(item || ''))).join(' ');
  const place = labelled(all, '장소') || clean(all.match(/[가-힣A-Za-z0-9]*(?:회의실|상담실|교육실|사무실|주민센터|복지관|센터)\b/)?.[0] || '');
  const attendeesLine = labelled(all, '참석자?|참석 인원');
  const attendees = attendeesLine || unique(all.match(new RegExp(`[가-힣○]{1,4}\\s?(?:${ROLE_WORDS})`, 'g')) || []).join(', ');
  const agenda = labelled(all, '안건|회의명|주제') || clean(contextText) || unique(TOPICS.filter((term) => text.includes(term))).join(', ');
  const decisions = pick(lines, /결정|합의|확정|하기로|승인|의결|정함|정했다/);
  const actionLines = pick(lines, /담당|연락|신청|확인|방문|연계|예정|하기로|까지|준비|제출|공유/);
  const actions = actionLines.map((line) => ({ task: line, owner: ownerOf(line), due: dueOf(line) }));
  const discussion = lines.filter((line) => !decisions.includes(line));
  return {
    kind: 'meeting',
    overview: {
      datetime: datetime || NEEDS_CHECK,
      place: place || NEEDS_CHECK,
      attendees: attendees || NEEDS_CHECK,
      agenda: agenda || NEEDS_CHECK,
    },
    discussion: discussion.length ? numbered(discussion) : NEEDS_CHECK,
    decisions: decisions.length ? numbered(decisions) : `확정된 결정 사항을 찾지 못했습니다. ${NEEDS_CHECK}`,
    actions,
  };
}

export function buildRuleSummary({ kind = 'counseling', rawText = '', contextText = '' } = {}) {
  return kind === 'meeting' ? meetingRules(rawText, clean(contextText)) : counselingRules(rawText, clean(contextText));
}

const SCHEMAS = {
  counseling: {
    overview: '상담 개요: 일시·대상·상담 방식·주요 영역 (모르면 [확인 필요])',
    complaint: '주요 호소: 내담자가 직접 말한 어려움과 요청',
    assessment: {
      needs: '사정-욕구: 확인된 욕구',
      strengths: '사정-강점: 내담자·가족·환경의 강점과 자원',
      risks: '사정-위험: 위험 요인 단서 (확정 판단 금지, 없으면 "확인된 위험 단서 없음")',
    },
    intervention: '개입 내용: 이번 상담에서 담당자가 한 안내·연계·지지',
    plan: '향후 계획·후속 조치: 다음 일정, 연계, 확인할 사항',
  },
  meeting: {
    overview: { datetime: '일시', place: '장소', attendees: '참석자 (쉼표로 구분)', agenda: '안건' },
    discussion: '논의 내용: 안건별 주요 의견 요약',
    decisions: '결정 사항: 회의에서 확정된 내용만',
    actions: [{ task: '할 일', owner: '담당 (원문에 없으면 빈 문자열)', due: '기한 (원문에 없으면 빈 문자열)' }],
  },
};

export function buildSummaryPrompt({ kind = 'counseling', rawText = '', contextText = '' } = {}) {
  const meeting = kind === 'meeting';
  return [
    '당신은 한국 사회복지기관의 기록 정리 보조자입니다.',
    meeting ? '아래 회의 메모를 회의록으로 정리하세요.' : '아래 상담 메모를 상담 기록으로 정리하세요.',
    '규칙:',
    '- 원문에 있는 사실만 사용하고, 없는 사실·이름·수치·날짜를 만들지 마세요.',
    '- 원문에서 확인할 수 없는 내용은 "[확인 필요]"로 적으세요.',
    '- 진단·법률 판단·위험도 확정을 하지 말고 관찰된 단서로만 적으세요.',
    '- 사회복지 기록 문체(~함, ~하였음)로 간결하게 쓰고, 여러 항목은 줄바꿈과 "1. " 번호로 나누세요.',
    '- 반드시 아래 형식의 JSON 객체 하나만 반환하세요. 설명 문장이나 코드블록(```)을 붙이지 마세요.',
    `형식:\n${JSON.stringify(SCHEMAS[meeting ? 'meeting' : 'counseling'], null, 2)}`,
    `${meeting ? '회의 맥락' : '상담 맥락'}:\n${bounded(contextText, 4_000) || '(없음)'}`,
    `원문:\n${bounded(rawText, MAX_SUMMARY_INPUT) || '(없음)'}`,
  ].join('\n\n');
}

function asText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(asText).filter(Boolean);
    return items.length > 1 && !items.some((item) => /^\d+[.)]\s/.test(item)) ? numbered(items) : items.join('\n');
  }
  if (typeof value === 'object') return Object.values(value).map(asText).filter(Boolean).join('\n');
  return '';
}

function asActions(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : value && typeof value === 'object' ? [value] : [];
  return list.map((item) => {
    if (typeof item === 'string') {
      const task = item.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim();
      return task ? { task, owner: ownerOf(task), due: dueOf(task) } : null;
    }
    if (!item || typeof item !== 'object') return null;
    const task = asText(item.task ?? item.todo ?? item.item ?? item.할일 ?? item['할 일'] ?? item.content);
    const owner = asText(item.owner ?? item.assignee ?? item.담당 ?? item.담당자);
    const due = asText(item.due ?? item.deadline ?? item.기한);
    return task ? { task, owner, due } : null;
  }).filter(Boolean).slice(0, 50);
}

// Normalizes any engine's object into the canonical shape and bounds sizes.
export function normalizeSummary(value, kind = 'counseling') {
  const input = value && typeof value === 'object' ? value : {};
  const cap = (text) => bounded(text, 20_000);
  if (kind === 'meeting') {
    const overview = input.overview && typeof input.overview === 'object' && !Array.isArray(input.overview) ? input.overview : {};
    return {
      kind: 'meeting',
      overview: {
        datetime: cap(asText(overview.datetime ?? overview.date ?? overview.일시 ?? input.datetime)),
        place: cap(asText(overview.place ?? overview.location ?? overview.장소 ?? input.place)),
        attendees: cap(asText(overview.attendees ?? overview.participants ?? overview.참석자 ?? input.attendees)).replace(/\n+/g, ', ').replace(/(^|,\s*)\d+\.\s*/g, '$1'),
        agenda: cap(asText(overview.agenda ?? overview.안건 ?? input.agenda ?? (typeof input.overview === 'string' ? input.overview : ''))),
      },
      discussion: cap(asText(input.discussion ?? input.논의내용 ?? input['논의 내용'])),
      decisions: cap(asText(input.decisions ?? input.결정사항 ?? input['결정 사항'])),
      actions: asActions(input.actions ?? input.todos ?? input.할일 ?? input['할 일']),
    };
  }
  const assessment = input.assessment && typeof input.assessment === 'object' && !Array.isArray(input.assessment) ? input.assessment : {};
  return {
    kind: 'counseling',
    overview: cap(asText(input.overview ?? input.상담개요 ?? input['상담 개요'])),
    complaint: cap(asText(input.complaint ?? input.presentingProblem ?? input.주요호소 ?? input['주요 호소'])),
    assessment: {
      needs: cap(asText(assessment.needs ?? assessment.욕구 ?? input.needs)),
      strengths: cap(asText(assessment.strengths ?? assessment.강점 ?? input.strengths)),
      risks: cap(asText(assessment.risks ?? assessment.위험 ?? input.risks ?? (typeof input.assessment === 'string' ? input.assessment : ''))),
    },
    intervention: cap(asText(input.intervention ?? input.개입내용 ?? input['개입 내용'])),
    plan: cap(asText(input.plan ?? input.followUp ?? input.향후계획 ?? input['향후 계획'])),
  };
}

function hasContent(summary) {
  if (summary.kind === 'meeting') return Boolean(summary.discussion || summary.decisions || summary.actions.length || Object.values(summary.overview).some(Boolean));
  return Boolean(summary.overview || summary.complaint || summary.intervention || summary.plan || Object.values(summary.assessment).some(Boolean));
}

function jsonCandidates(text) {
  const candidates = [];
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  candidates.push(...fenced, text);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  return candidates.map((item) => item.trim()).filter(Boolean);
}

// Model replies are untrusted: they may wrap JSON in prose or code fences, use
// Korean keys, or (Codex output schema) nest the JSON string under "text".
// Returns null when nothing usable was found so callers can fall back.
export function parseSummaryReply(reply, kind = 'counseling', depth = 0) {
  const text = String(reply ?? '').trim();
  if (!text || depth > 2) return null;
  for (const candidate of jsonCandidates(text)) {
    let parsed;
    try { parsed = JSON.parse(candidate); } catch { continue; }
    if (typeof parsed === 'string') { const inner = parseSummaryReply(parsed, kind, depth + 1); if (inner) return inner; continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    for (const key of ['text', 'result', 'output', 'content']) {
      if (typeof parsed[key] === 'string' && Object.keys(parsed).length <= 2) {
        const inner = parseSummaryReply(parsed[key], kind, depth + 1);
        if (inner) return inner;
      }
    }
    const summary = normalizeSummary(parsed, kind);
    if (hasContent(summary)) return summary;
  }
  return null;
}

// Old record consumers (record export, /api/records search) read these four keys.
export function summaryToLegacyDraft(summary) {
  if (summary.kind === 'meeting') {
    const o = summary.overview;
    return {
      typeLabel: '회의록',
      reviewRequired: true,
      counselingLog: `일시: ${o.datetime}\n장소: ${o.place}\n참석자: ${o.attendees}\n안건: ${o.agenda}\n\n${summary.discussion}`,
      assessment: summary.decisions,
      servicePlan: summary.actions.map((item, index) => `${index + 1}. ${item.task} (담당: ${item.owner || NEEDS_CHECK}, 기한: ${item.due || NEEDS_CHECK})`).join('\n'),
      followUp: '회의 참석자와 결정 사항·담당·기한을 대조합니다.',
    };
  }
  const a = summary.assessment;
  return {
    typeLabel: '상담 기록',
    reviewRequired: true,
    counselingLog: `${summary.overview}\n\n주요 호소\n${summary.complaint}`,
    assessment: `욕구\n${a.needs}\n\n강점\n${a.strengths}\n\n위험\n${a.risks}`,
    servicePlan: summary.intervention,
    followUp: summary.plan,
  };
}

export function summaryTitle(kind) {
  return kind === 'meeting' ? '회의록' : '상담 기록';
}

// Section list used by DOCX export (and anything else that needs a flat view).
export function summarySections(summary) {
  if (summary.kind === 'meeting') {
    const o = summary.overview;
    return [
      { heading: '회의 개요', rows: [['일시', o.datetime], ['장소', o.place], ['참석자', o.attendees], ['안건', o.agenda]] },
      { heading: '논의 내용', content: summary.discussion },
      { heading: '결정 사항', content: summary.decisions },
      { heading: '할 일', table: { columns: ['할 일', '담당', '기한'], rows: summary.actions.map((item) => [item.task, item.owner, item.due]) } },
    ];
  }
  const a = summary.assessment;
  return [
    { heading: '상담 개요', content: summary.overview },
    { heading: '주요 호소', content: summary.complaint },
    { heading: '사정', rows: [['욕구', a.needs], ['강점', a.strengths], ['위험', a.risks]] },
    { heading: '개입 내용', content: summary.intervention },
    { heading: '향후 계획·후속 조치', content: summary.plan },
  ];
}
