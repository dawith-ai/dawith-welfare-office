// Record templates (기록 양식): the user picks or defines the sections of a
// 상담 기록 / 회의록 ("관찰사항, 상담내용, 상담원 소견 …") and every engine fills
// exactly those sections. The rule engine maps sentences by keywords, the
// local LLM gets a JSON schema keyed by the section names, and the result can
// be poured into an institution's DOCX/HWPX form through {{표식}} placeholders.
// Everything here is pure and runs on this PC.

import {
  DATE_PATTERN, LABEL_LINE, NEEDS_CHECK, RELATIONS, ROLE_WORDS, TIME_PATTERN, TOPICS,
  asText, bounded, clean, dueOf, jsonCandidates, labelled, numbered, ownerOf, sentences, unique,
} from './record-summary.mjs';

export const TEMPLATE_KINDS = ['counseling', 'meeting'];
export const MAX_TEMPLATE_SECTIONS = 15;
const MAX_SECTION_NAME = 30;
const MAX_SECTION_GUIDE = 120;
const MAX_SECTION_CONTENT = 20_000;

// Section roles, checked in order against the section name (then its guide).
// Order matters: "상담원 소견" must hit opinion before anything with 상담, and
// "개입 내용" / "논의 내용" must hit their role before the catch-all "내용".
const ROLES = [
  ['nextMeeting', /다음\s*회의|차기/],
  ['opinion', /소견|의견|총평|종합\s*판단|판단|평가/],
  ['observation', /관찰|태도|외양|인상|행동\s*특성/],
  ['actions', /할\s*일|역할|분담|실행\s*항목|조치\s*사항|담당\s*업무|업무\s*분장/],
  ['decisions', /결정|합의|결론|의결/],
  ['discussion', /논의|협의|토의|검토\s*내용|회의\s*내용/],
  ['plan', /계획|향후|후속|추후|모니터링|다음\s*(?:상담|일정|방문)/],
  ['assessment', /사정/],
  ['complaint', /호소|주\s*문제|주요\s*문제|어려움|의뢰\s*사유|상담\s*요청|요청\s*사항/],
  ['needs', /욕구|필요/],
  ['strengths', /강점|자원/],
  ['risks', /위험|위기|안전/],
  ['intervention', /개입|서비스\s*제공|제공\s*서비스|지원\s*내용|조치\s*내용|연계\s*내용/],
  ['caseStatus', /현황|사례\s*개요|배경|상황|경과/],
  ['notes', /특이\s*사항|비고|기타/],
  ['overview', /개요|기본\s*정보|상담\s*정보|회의\s*정보/],
  ['datetime', /일시|날짜|일자|상담일|회의일/],
  ['place', /장소/],
  ['attendees', /참석/],
  ['agenda', /안건|주제|회의명/],
  ['content', /내용|기록|요약|메모|상담/],
];

const SENTENCE_PATTERNS = {
  observation: /관찰|보임|보였|보이|보여|표정|모습|태도|외모|위생|청결|눈물|울먹|웃|말투|목소리|눈\s*맞춤|위축|긴장|침착|정돈|지저분|냄새|집\s*안|주거\s*환경|복장|안색|체중|불안해/,
  complaint: /어렵|어려움|불안|걱정|힘들|호소|부담|문제|부족|막막|고민|원한다|원함|싶다|싶어/,
  needs: /필요|원함|원한다|원하|희망|요청|싶/,
  strengths: /의지|노력|꾸준|가능|지지|도움을 받|돕고|참여|잘 하|잘하|강점|유지하고/,
  risks: /위험|위기|폭력|학대|방임|자해|자살|극단|체납|연체|밀려|단전|단수|퇴거|중독|응급|고립/,
  plan: /예정|계획|하기로|다음\s*(?:주|달|상담|회기|방문|에)|후속|재상담|모니터링|할 것|까지/,
  intervention: /안내|설명|연계|제공|정보|공감|격려|교육|지지하였|지지함|상담하였|상담함|의뢰/,
  decisions: /결정|합의|확정|하기로|승인|의결|정함|정했다/,
  actions: /담당|연락|신청|확인|방문|연계|예정|하기로|까지|준비|제출|공유/,
  caseStatus: /상황|현재|거주|가구|생활|소득|수급|질환|건강|가족|동거|부채|체납|학교|경과|지난/,
  nextMeeting: /다음\s*회의|차기\s*회의|다음\s*모임|재논의/,
  notes: /특이|주의|위험|위기|체납|퇴거|학대|폭력|자해|응급/,
};

// Sections whose content is "whatever nobody else claimed".
const CATCH_ALL = new Set(['content', 'discussion']);
const STOP_TOKENS = new Set(['사항', '내용', '관련', '기타', '및', '등', '정리', '항목', '부분', '기록', '상황', '현황', '상태', '경과', '배경', '사례', '개요', '관계', '활동', '문제']);
// Everyday words a memo uses for common custom section topics.
const TOPIC_WORDS = {
  경제: ['월세', '소득', '수입', '생계', '부채', '빚', '체납', '연체', '밀려', '비용', '생활비', '급여', '수급'],
  재정: ['월세', '소득', '수입', '부채', '체납', '비용'],
  주거: ['월세', '집', '거주', '퇴거', '임대', '주택', '이사'],
  건강: ['건강', '병원', '질환', '치료', '약', '아프', '통증', '진료', '입원'],
  정서: ['우울', '불안', '걱정', '표정', '눈물', '스트레스', '위축'],
  심리: ['우울', '불안', '걱정', '스트레스'],
  가족: ['자녀', '배우자', '어머니', '아버지', '보호자', '형제', '자매', '아들', '딸', '남편', '아내', '양육', '가족'],
  양육: ['자녀', '양육', '아이', '돌봄'],
  취업: ['취업', '일자리', '구직', '직장', '근로'],
  일자리: ['취업', '일자리', '구직', '직장', '근로'],
  학교: ['학교', '등교', '학업', '담임', '교사'],
  교육: ['학교', '학업', '교육'],
  돌봄: ['돌봄', '간병', '요양', '보호'],
  안전: ['위험', '위기', '폭력', '학대', '자해', '자살'],
  사회: ['친구', '이웃', '모임', '고립', '교류'],
};

const DEFAULT_GUIDES = {
  overview: '일시·대상·장소 등 기본 정보 (모르면 [확인 필요])',
  datetime: '일시 (원문에 없으면 [확인 필요])',
  place: '장소',
  attendees: '참석자 (쉼표로 구분)',
  agenda: '안건',
  observation: '담당자가 직접 보고 들은 모습·태도·생활환경 (원문에 있는 것만)',
  content: '원문의 주요 내용을 순서대로 요약',
  opinion: '원문 근거를 밝힌 담당자 관점의 소견 (진단·단정 금지)',
  complaint: '내담자가 직접 말한 어려움과 요청',
  needs: '확인된 욕구',
  strengths: '내담자·가족·환경의 강점과 자원',
  risks: '위험 단서 (확정 판단 금지, 없으면 "확인된 위험 단서 없음")',
  assessment: '욕구·강점·위험 단서',
  intervention: '이번에 담당자가 한 안내·연계·지지',
  plan: '다음 일정, 연계, 확인할 사항',
  caseStatus: '대상자의 현재 상황과 경과',
  discussion: '안건별 주요 의견 요약',
  decisions: '회의에서 확정된 내용만',
  actions: '할 일마다 "할 일 (담당: 이름, 기한: 날짜)" 형식, 원문에 없으면 담당·기한 생략',
  nextMeeting: '다음 회의 일정과 다룰 안건',
  notes: '특이사항이나 주의할 점',
};

const EMPTY_HINTS = {
  observation: '원문에서 관찰 내용을 찾지 못했습니다. 직접 본 모습·태도·환경을 적어 주세요.',
  risks: `원문에서 위험 단서를 찾지 못했습니다. 담당자 ${NEEDS_CHECK}`,
  strengths: `원문에서 강점 단서를 찾지 못했습니다. ${NEEDS_CHECK}`,
  decisions: `확정된 결정 사항을 찾지 못했습니다. ${NEEDS_CHECK}`,
  plan: `후속 조치를 담당자와 협의합니다. ${NEEDS_CHECK}`,
  nextMeeting: `다음 회의 일정을 찾지 못했습니다. ${NEEDS_CHECK}`,
  notes: '원문에서 특이사항을 찾지 못했습니다.',
};

const cleanName = (value) => String(value ?? '').replace(/[{}<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION_NAME);
const cleanGuide = (value) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION_GUIDE);

// Comparable form of a section/placeholder name: no spaces or punctuation.
export function nameKey(value) {
  return String(value ?? '').toLowerCase().replace(/[\s·・,.()[\]{}<>/\\\-_:：*#'"`~!?]+/g, '');
}

// Validates a template coming from the browser. Returns null when unusable.
export function normalizeTemplate(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.sections)) return null;
  const seen = new Set();
  const sections = [];
  for (const raw of input.sections) {
    const name = cleanName(typeof raw === 'string' ? raw : raw?.name);
    if (!name || seen.has(nameKey(name)) || !nameKey(name)) continue;
    seen.add(nameKey(name));
    sections.push({ name, guide: cleanGuide(typeof raw === 'string' ? '' : raw?.guide) });
    if (sections.length >= MAX_TEMPLATE_SECTIONS) break;
  }
  if (!sections.length) return null;
  return {
    name: cleanName(input.name) || '내 기록 양식',
    kind: TEMPLATE_KINDS.includes(input.kind) ? input.kind : 'counseling',
    sections,
  };
}

export function sectionRole(section) {
  for (const text of [section.name, section.guide]) {
    if (!text) continue;
    const found = ROLES.find(([, pattern]) => pattern.test(text));
    if (found) return found[0];
  }
  return 'unknown';
}

function nameTokens(section) {
  const tokens = `${section.name} ${section.guide || ''}`.split(/[^가-힣A-Za-z0-9]+/).filter((token) => token.length >= 2 && !STOP_TOKENS.has(token));
  // Korean nouns often appear glued to other words ("건강상태"), so also try
  // the first two syllables of longer words, then everyday synonyms.
  const stems = unique([...tokens, ...tokens.filter((token) => /^[가-힣]{3,}$/.test(token)).map((token) => token.slice(0, 2))]).filter((token) => !STOP_TOKENS.has(token));
  return unique([...stems, ...stems.flatMap((token) => TOPIC_WORDS[token] || [])]);
}

const linesFor = (lines, section) => {
  const tokens = nameTokens(section);
  return tokens.length ? lines.filter((line) => tokens.some((token) => line.includes(token))) : [];
};

// Facts that are not sentences: date, place, attendees, agenda, who was involved.
export function extractRecordMeta(rawText, contextText = '') {
  const text = clean(rawText);
  const context = clean(contextText);
  const all = `${text}\n${context}`;
  const date = clean(all.match(DATE_PATTERN)?.[0] || '');
  const time = clean(all.match(TIME_PATTERN)?.[0] || '');
  const datetime = labelled(all, '일시|날짜') || unique([date, time]).join(' ');
  const place = labelled(all, '장소') || clean(all.match(/[가-힣A-Za-z0-9]*(?:회의실|상담실|교육실|사무실|주민센터|복지관|센터)(?=\s|$|[,.])/)?.[0] || '');
  const attendees = labelled(all, '참석자?|참석 인원') || unique(all.match(new RegExp(`[가-힣○]{1,4}\\s?(?:${ROLE_WORDS})`, 'g')) || []).join(', ');
  const agenda = labelled(all, '안건|회의명|주제') || context;
  return {
    date: date || labelled(all, '일시|날짜'),
    datetime,
    place,
    attendees,
    agenda,
    relations: unique(RELATIONS.filter((term) => all.includes(term))),
    topics: unique(TOPICS.filter((term) => all.includes(term))),
    context,
  };
}

const actionText = (line) => {
  const owner = ownerOf(line);
  const due = dueOf(line);
  const meta = [owner && `담당: ${owner}`, due && `기한: ${due}`].filter(Boolean).join(', ');
  return meta ? `${line} (${meta})` : line;
};

function overviewText(kind, meta) {
  if (kind === 'meeting') {
    return [`일시: ${meta.datetime || NEEDS_CHECK}`, `장소: ${meta.place || NEEDS_CHECK}`, `참석자: ${meta.attendees || NEEDS_CHECK}`, `안건: ${meta.agenda || NEEDS_CHECK}`].join('\n');
  }
  return [
    `일시: ${meta.datetime || NEEDS_CHECK}`,
    `대상: ${meta.relations.join(', ') || '내담자'}`,
    `주요 영역: ${meta.topics.join(', ') || NEEDS_CHECK}`,
    meta.context ? `맥락: ${meta.context}` : '',
  ].filter(Boolean).join('\n');
}

const pick = (lines, pattern, exclude = []) => lines.filter((line) => pattern.test(line) && !exclude.includes(line));

// Rule engine: maps the memo's sentences to the chosen sections.
export function buildTemplateRuleSummary({ template, rawText = '', contextText = '' } = {}) {
  const normalized = normalizeTemplate(template);
  if (!normalized) throw new Error('template_invalid');
  const { kind } = normalized;
  const meta = extractRecordMeta(rawText, contextText);
  const lines = sentences(rawText).filter((line) => !LABEL_LINE.test(line));
  const planLines = pick(lines, SENTENCE_PATTERNS.plan);
  const interventionLines = pick(lines, SENTENCE_PATTERNS.intervention, planLines);
  const roles = normalized.sections.map((section) => sectionRole(section));
  const claimed = new Set();
  const take = (items) => { items.forEach((item) => claimed.add(item)); return items; };

  // Pass 1: everything except the catch-all sections.
  const contents = normalized.sections.map((section, index) => {
    const role = roles[index];
    if (CATCH_ALL.has(role)) return null;
    switch (role) {
      case 'overview': return overviewText(kind, meta);
      case 'datetime': return meta.datetime || NEEDS_CHECK;
      case 'place': return meta.place || NEEDS_CHECK;
      case 'attendees': return meta.attendees || NEEDS_CHECK;
      case 'agenda': return meta.agenda || NEEDS_CHECK;
      case 'assessment': {
        const needs = take(pick(lines, SENTENCE_PATTERNS.needs, [...interventionLines, ...planLines]));
        const strengths = take(pick(lines, SENTENCE_PATTERNS.strengths));
        const risks = take(pick(lines, SENTENCE_PATTERNS.risks));
        if (!needs.length && meta.topics.length) needs.push(`${meta.topics.join(', ')} 관련 지원 욕구 ${NEEDS_CHECK}`);
        return [
          `욕구\n${needs.length ? numbered(needs) : NEEDS_CHECK}`,
          `강점\n${strengths.length ? numbered(strengths) : EMPTY_HINTS.strengths}`,
          `위험\n${risks.length ? numbered(risks) : EMPTY_HINTS.risks}`,
        ].join('\n\n');
      }
      case 'opinion': {
        // The rule engine never writes a professional opinion; it lists cues.
        const cues = [
          ['욕구', pick(lines, SENTENCE_PATTERNS.needs, [...interventionLines, ...planLines])[0]],
          ['강점', pick(lines, SENTENCE_PATTERNS.strengths)[0]],
          ['위험 단서', pick(lines, SENTENCE_PATTERNS.risks)[0]],
        ].filter(([, line]) => line);
        return [`${NEEDS_CHECK} 규칙 방식은 소견을 대신 쓰지 않습니다. 아래 단서를 참고해 담당자가 작성하세요.`, ...cues.map(([label, line]) => `- ${label}: ${line}`)].join('\n');
      }
      case 'actions': {
        // A plain decision ("주 2회로 늘리기로 결정함") is not a to-do unless it
        // names who does it or by when.
        const decisions = roles.includes('decisions') ? pick(lines, SENTENCE_PATTERNS.decisions) : [];
        const candidates = unique([...pick(lines, SENTENCE_PATTERNS.actions), ...(kind === 'meeting' ? [] : planLines)]);
        const items = take(candidates.filter((line) => !decisions.includes(line) || ownerOf(line) || dueOf(line)));
        return items.length ? numbered(items.map(actionText)) : `할 일을 찾지 못했습니다. ${NEEDS_CHECK}`;
      }
      case 'plan': {
        const items = take(kind === 'meeting' ? unique([...planLines, ...pick(lines, SENTENCE_PATTERNS.actions)]) : planLines);
        return items.length ? numbered(kind === 'meeting' ? items.map(actionText) : items) : EMPTY_HINTS.plan;
      }
      case 'intervention': {
        const items = take(pick(lines, SENTENCE_PATTERNS.intervention, planLines));
        return items.length ? numbered(items) : NEEDS_CHECK;
      }
      case 'complaint': {
        const items = take(pick(lines, SENTENCE_PATTERNS.complaint));
        return items.length ? numbered(items) : (lines[0] || NEEDS_CHECK);
      }
      case 'needs': {
        const items = take(pick(lines, SENTENCE_PATTERNS.needs, planLines));
        return items.length ? numbered(items) : NEEDS_CHECK;
      }
      case 'unknown': {
        const items = take(linesFor(lines, normalized.sections[index]));
        return items.length ? numbered(items) : `${NEEDS_CHECK} 원문에서 '${normalized.sections[index].name}' 관련 내용을 찾지 못했습니다. 직접 채워 주세요.`;
      }
      case 'caseStatus': {
        // "경제 상황" / "가족 관계": the topic word beats the generic pattern.
        const topical = linesFor(lines, normalized.sections[index]).filter((line) => !planLines.includes(line));
        const items = take(topical.length ? topical : pick(lines, SENTENCE_PATTERNS.caseStatus, planLines));
        return items.length ? numbered(items) : NEEDS_CHECK;
      }
      default: {
        const found = pick(lines, SENTENCE_PATTERNS[role]);
        const items = take(found.length ? found : linesFor(lines, normalized.sections[index]));
        return items.length ? numbered(items) : (EMPTY_HINTS[role] || NEEDS_CHECK);
      }
    }
  });

  // Pass 2: the first catch-all section (상담내용, 논의 내용 …) gets every
  // sentence nobody else claimed. Without one, those sentences are reported
  // back as unassigned so nothing silently disappears.
  const leftovers = lines.filter((line) => !claimed.has(line));
  const catchAll = roles.findIndex((role) => CATCH_ALL.has(role));
  roles.forEach((role, index) => {
    if (!CATCH_ALL.has(role)) return;
    // 논의 내용 with nothing left over still summarizes the non-decision talk.
    const fallback = role === 'discussion' ? lines.filter((line) => !SENTENCE_PATTERNS.decisions.test(line)) : [];
    const items = index === catchAll && leftovers.length ? leftovers : fallback;
    contents[index] = items.length ? numbered(items) : NEEDS_CHECK;
  });
  const unassigned = catchAll >= 0 ? [] : leftovers;
  return {
    kind: 'template',
    templateKind: kind,
    templateName: normalized.name,
    sections: normalized.sections.map((section, index) => ({ ...section, content: contents[index] })),
    meta: { date: meta.date, datetime: meta.datetime, place: meta.place, attendees: meta.attendees, agenda: meta.agenda },
    unassigned,
  };
}

export function buildTemplatePrompt({ template, rawText = '', contextText = '' } = {}) {
  const normalized = normalizeTemplate(template);
  if (!normalized) throw new Error('template_invalid');
  const meeting = normalized.kind === 'meeting';
  const schema = Object.fromEntries(normalized.sections.map((section) => [section.name, section.guide || DEFAULT_GUIDES[sectionRole(section)] || `${section.name}에 해당하는 내용`]));
  return [
    '당신은 한국 사회복지기관의 기록 정리 보조자입니다.',
    `아래 ${meeting ? '회의 메모' : '상담 메모'}를 기관의 "${normalized.name}" 양식 항목에 맞춰 정리하세요.`,
    '규칙:',
    '- 원문에 있는 사실만 사용하고, 없는 사실·이름·수치·날짜를 만들지 마세요.',
    '- 원문에서 확인할 수 없는 항목은 "[확인 필요]"로 적으세요.',
    '- 진단·법률 판단·위험도 확정을 하지 말고 관찰된 단서로만 적으세요.',
    '- 사회복지 기록 문체(~함, ~하였음)로 간결하게 쓰고, 여러 항목은 줄바꿈과 "1. " 번호로 나누세요.',
    '- JSON의 키는 아래 항목 이름을 글자 그대로 쓰고, 항목을 더하거나 빼지 마세요. 값은 모두 문자열입니다.',
    '- 반드시 JSON 객체 하나만 반환하세요. 설명 문장이나 코드블록(```)을 붙이지 마세요.',
    `항목(키)과 작성 안내:\n${JSON.stringify(schema, null, 2)}`,
    `${meeting ? '회의 맥락' : '상담 맥락'}:\n${bounded(contextText, 4_000) || '(없음)'}`,
    `원문:\n${bounded(rawText, 60_000) || '(없음)'}`,
  ].join('\n\n');
}

function matchSectionKey(sections, key) {
  const wanted = nameKey(key);
  if (!wanted) return -1;
  const exact = sections.findIndex((section) => nameKey(section.name) === wanted);
  if (exact >= 0) return exact;
  if (wanted.length < 2) return -1;
  return sections.findIndex((section) => { const name = nameKey(section.name); return name.length >= 2 && (wanted.includes(name) || name.includes(wanted)); });
}

function fromObject(parsed, sections) {
  let source = parsed;
  if (Array.isArray(parsed.sections)) source = Object.fromEntries(parsed.sections.filter((item) => item && typeof item === 'object').map((item) => [asText(item.name ?? item.title ?? item.항목), item.content ?? item.value ?? item.내용]));
  const values = sections.map(() => '');
  for (const [key, value] of Object.entries(source)) {
    const index = matchSectionKey(sections, key);
    if (index >= 0 && !values[index]) values[index] = bounded(asText(value), MAX_SECTION_CONTENT);
  }
  return values;
}

// "## 관찰사항", "관찰사항:", "**관찰사항**", "[관찰사항]", "1. 관찰사항" headings.
function fromHeadings(text, sections) {
  const values = sections.map(() => []);
  let current = -1;
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const heading = line.match(/^\s*(?:#{1,6}\s*|\d+[.)]\s*|[-*•]\s*)?(?:\*\*|\[|【)?\s*([^:：*\]】]{1,40}?)\s*(?:\*\*|\]|】)?\s*(?:[:：]\s*(.*))?$/);
    const index = heading ? matchSectionKey(sections, heading[1]) : -1;
    const isHeading = index >= 0 && (heading[2] !== undefined || /^\s*(?:#|\*\*|\[|【)/.test(line) || nameKey(heading[1]) === nameKey(sections[index].name));
    if (isHeading) { current = index; if (heading[2]) values[index].push(heading[2].trim()); continue; }
    if (current >= 0 && line.trim()) values[current].push(line.trim());
  }
  return values.map((items) => bounded(items.join('\n').trim(), MAX_SECTION_CONTENT));
}

// Model replies are untrusted: JSON may be wrapped in prose or fences, keys may
// be paraphrased, or the model may answer with headings instead of JSON.
// Returns null when no section could be read so the caller can fall back.
export function parseTemplateReply(reply, template, depth = 0) {
  const normalized = normalizeTemplate(template);
  const text = String(reply ?? '').trim();
  if (!normalized || !text || depth > 2) return null;
  const { sections } = normalized;
  const build = (values) => ({
    kind: 'template',
    templateKind: normalized.kind,
    templateName: normalized.name,
    sections: sections.map((section, index) => ({ ...section, content: values[index] || NEEDS_CHECK })),
    unassigned: [],
  });
  for (const candidate of jsonCandidates(text)) {
    let parsed;
    try { parsed = JSON.parse(candidate); } catch { continue; }
    if (typeof parsed === 'string') { const inner = parseTemplateReply(parsed, normalized, depth + 1); if (inner) return inner; continue; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    for (const key of ['text', 'result', 'output', 'content']) {
      if (typeof parsed[key] === 'string' && Object.keys(parsed).length <= 2) {
        const inner = parseTemplateReply(parsed[key], normalized, depth + 1);
        if (inner) return inner;
      }
    }
    const values = fromObject(parsed, sections);
    if (values.some(Boolean)) return build(values);
  }
  const values = fromHeadings(text, sections);
  return values.some(Boolean) ? build(values) : null;
}

// Cleans a (possibly user-edited) template summary coming back from the browser.
export function normalizeTemplateSummary(value) {
  const input = value && typeof value === 'object' ? value : {};
  const sections = (Array.isArray(input.sections) ? input.sections : []).slice(0, MAX_TEMPLATE_SECTIONS)
    .map((section) => ({ name: cleanName(section?.name), guide: cleanGuide(section?.guide), content: bounded(asText(section?.content), MAX_SECTION_CONTENT) }))
    .filter((section) => section.name);
  return {
    kind: 'template',
    templateKind: TEMPLATE_KINDS.includes(input.templateKind) ? input.templateKind : 'counseling',
    templateName: cleanName(input.templateName) || '기록',
    sections,
  };
}

// ---------------------------------------------------------------------------
// Institution forms: {{표식}} placeholders -> values.

const META_ALIASES = {
  organization: ['기관명', '기관', '기관이름', '소속', '소속기관', '기관명칭'],
  author: ['담당자', '담당자명', '작성자', '작성자명', '상담자', '상담자명', '상담원', '상담원명', '사회복지사', '담당사회복지사', '기록자', '담당'],
  date: ['상담일', '상담일자', '상담일시', '상담날짜', '회의일', '회의일자', '회의일시', '회의날짜', '일시', '날짜', '일자', '작성일', '작성일자', '기록일'],
  place: ['장소', '상담장소', '회의장소'],
  attendees: ['참석자', '참석자명단', '참석', '참석인원'],
  agenda: ['안건', '회의안건', '주제', '회의명', '회의주제'],
  title: ['제목', '문서명', '양식명', '기록명'],
};
const META_LABELS = { organization: '기관명', author: '담당자', date: '날짜', place: '장소', attendees: '참석자', agenda: '안건', title: '양식 이름' };

// Where each placeholder's value comes from: a section (by name) or a header field.
export function matchPlaceholder(token, sectionNames = []) {
  const wanted = nameKey(token);
  const exact = sectionNames.findIndex((name) => nameKey(name) === wanted);
  if (exact >= 0) return { type: 'section', name: sectionNames[exact], label: sectionNames[exact] };
  const metaKey = Object.keys(META_ALIASES).find((key) => META_ALIASES[key].some((alias) => nameKey(alias) === wanted));
  if (metaKey) return { type: 'meta', key: metaKey, label: META_LABELS[metaKey] };
  if (wanted.length >= 2) {
    const fuzzy = sectionNames.find((name) => { const key = nameKey(name); return key.length >= 2 && (key.includes(wanted) || wanted.includes(key)); });
    if (fuzzy) return { type: 'section', name: fuzzy, label: fuzzy };
  }
  return null;
}

// Values for every placeholder in the form. extra holds what the user typed
// for placeholders that match nothing (e.g. {{대상자}}).
export function formFieldValues(tokens, { sections = [], header = {}, meta = {}, templateName = '', extra = {} } = {}) {
  const sectionNames = sections.map((section) => section.name);
  const metaValues = {
    organization: header.organization,
    author: header.author,
    date: header.date || meta.datetime || meta.date,
    place: header.place || meta.place,
    attendees: header.attendees || meta.attendees,
    agenda: header.agenda || meta.agenda,
    title: templateName,
  };
  const fields = {};
  const report = [];
  for (const token of tokens) {
    const typed = typeof extra?.[token] === 'string' ? extra[token].trim() : '';
    const source = matchPlaceholder(token, sectionNames);
    let value = '';
    if (typed) value = typed;
    else if (source?.type === 'section') value = String(sections.find((section) => section.name === source.name)?.content || '').trim();
    else if (source?.type === 'meta') value = String(metaValues[source.key] || '').trim();
    if (value) fields[token] = bounded(value, MAX_SECTION_CONTENT);
    report.push({ token, source: typed ? { type: 'typed', label: '직접 입력' } : source, filled: Boolean(value) });
  }
  return { fields, report };
}

// Placeholders worth typing into a form for this template.
export function placeholderGuide(template) {
  const normalized = normalizeTemplate(template);
  if (!normalized) return [];
  const meeting = normalized.kind === 'meeting';
  return [
    ...normalized.sections.map((section) => ({ token: section.name, label: '정리 항목' })),
    { token: '기관명', label: '기본 정보' },
    { token: '담당자', label: '기본 정보' },
    { token: meeting ? '회의일' : '상담일', label: '기본 정보' },
    ...(meeting ? [{ token: '장소', label: '기본 정보' }, { token: '참석자', label: '기본 정보' }] : []),
  ];
}
