const RELATIONS = ['친모', '친부', '배우자', '자녀', '형제', '자매', '보호자', '내담자'];
const PARTICIPANTS = ['담당자', '팀장', '센터장', '사례관리자', '상담자'];
const TOPICS = ['이혼', '주거', '경제', '취업', '건강', '양육', '면접교섭', '학교', '폭력', '중독', '서비스'];
const PLAN_TERMS = ['예정', '계획', '연락', '신청', '방문', '연계', '논의', '진행'];

function cleanText(value = '') {
  return String(value).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function sentences(text) {
  return cleanText(text).split(/(?<=[.!?。！？])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
}

function includesAny(text, terms) {
  return terms.filter((term) => text.includes(term));
}

function unique(items) {
  return [...new Set(items)];
}

function phrase(items, fallback) {
  const values = unique(items);
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]}와 ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} 및 ${values.at(-1)}`;
}

function matchingSentences(sourceSentences, pattern) {
  return sourceSentences.filter((line) => pattern.test(line));
}

function extractFacts(rawText, contextText = '') {
  const text = cleanText(`${rawText}\n${contextText}`);
  const sourceSentences = sentences(rawText);
  const dates = text.match(/(?:20\d{2}년\s*)?\d{1,2}월(?:\s*\d{1,2}일)?|다음\s*달|이번\s*주|3개월\s*후/g) ?? [];
  const concerns = matchingSentences(sourceSentences, /어렵|불안|위기|위험|갈등|필요|문제|부족|거부|걱정/);
  const decisions = matchingSentences(sourceSentences, /결정|합의|확정|하기로|논의함|논의하였다/);
  const actionItems = matchingSentences(sourceSentences, /담당|연락|신청|확인|방문|연계|예정|하기로/);
  return {
    dates: unique(dates),
    relations: unique(includesAny(text, RELATIONS)),
    participants: unique(includesAny(text, PARTICIPANTS)),
    topics: unique(includesAny(text, TOPICS)),
    plans: unique(includesAny(text, PLAN_TERMS)),
    concerns,
    decisions,
    actionItems,
    sourceSentences,
  };
}

function servicePlan(subject, facts, source) {
  const items = [];
  if (facts.topics.includes('주거') && /신청|임대|월세/.test(source)) items.push('주거 지원 신청 절차와 필요 서류를 확인한다');
  if (facts.topics.includes('면접교섭')) items.push('면접교섭 일정과 진행 상황을 확인한다');
  if (facts.topics.includes('학교') || facts.topics.includes('양육')) items.push('자녀의 학교·양육 상황을 다음 상담에서 확인한다');
  if (facts.topics.includes('경제') || /경제|비용|부담/.test(source)) items.push('경제적 부담과 이용 가능한 지원 자원을 확인한다');
  if (facts.plans.includes('연계')) items.push('필요한 서비스 연계 가능 여부를 확인한다');
  if (!items.length) items.push(`${subject}의 상황을 원문과 대조하고 후속 지원 계획을 담당자와 협의한다`);
  return `${items.map((item) => `${item}.`).join(' ')}`;
}

function followUp(facts, date) {
  const items = ['담당자 검토 및 원문 대조'];
  if (facts.actionItems.length) items.push(...facts.actionItems.slice(0, 2));
  if (date !== '기록일 기준') items.push(`${date} 일정 확인`);
  return unique(items).map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function buildDrafts({ kind = 'counseling', rawText = '', contextText = '' }) {
  const source = cleanText(rawText);
  const context = cleanText(contextText);
  const facts = extractFacts(source, context);
  const subject = phrase(facts.relations, '내담자');
  const date = phrase(facts.dates, '기록일 기준');
  const topic = phrase(facts.topics, '상담 내용');
  const concern = facts.concerns[0] ?? '추가 확인이 필요한 내용은 담당자 검토가 필요함';
  const typeLabel = kind === 'meeting' ? '회의록' : kind === 'audio' ? '녹취 기반 상담기록' : '상담일지';

  if (kind === 'meeting') {
    const decisions = facts.decisions.length ? facts.decisions.map((line, index) => `${index + 1}. ${line}`).join('\n') : '확정된 결정사항이 없습니다. 원문을 검토해 주세요.';
    const actions = facts.actionItems.length ? facts.actionItems.map((line, index) => `${index + 1}. ${line}`).join('\n') : '담당자와 후속 조치를 확인해 주세요.';
    return {
      typeLabel,
      facts,
      reviewRequired: true,
      counselingLog: `주요 안건은 ${topic}이다. ${source || '입력된 원문이 없습니다.'}`,
      assessment: `논의 및 결정사항\n${decisions}`,
      servicePlan: `후속 실행 항목\n${actions}`,
      followUp: `1. 회의 참석자와 결정사항 대조\n2. 담당자·기한을 원문에서 확인\n3. 미결정 안건의 다음 논의 일정 확인`,
      sourceSummary: context ? `회의 맥락: ${context}` : '회의 맥락이 입력되지 않았습니다. 저장 전 확인하세요.',
    };
  }

  return {
    typeLabel,
    facts,
    reviewRequired: true,
    counselingLog: `${subject}와의 상담에서 ${topic} 관련 내용을 확인하였다. ${source || '입력된 원문이 없습니다.'}`,
    assessment: `${date} 기준 주요 확인 영역은 ${topic}이며, 현재 확인된 우려사항은 “${concern}”이다. 사실관계와 위험도는 원문 대조 후 담당자가 확정해야 한다.`,
    servicePlan: servicePlan(subject, facts, source),
    followUp: followUp(facts, date),
    sourceSummary: context ? `사례 맥락: ${context}` : '사례 맥락이 입력되지 않았습니다. 저장 전 확인하세요.',
  };
}

export function buildOllamaPrompt({ kind, rawText, contextText }) {
  const format = kind === 'meeting'
    ? '회의 요약, 논의·결정사항, 후속 실행 항목, 미결정 후속 확인을 각각 counselingLog, assessment, servicePlan, followUp 키로 작성하세요.'
    : '상담일지, 사정기록, 서비스계획, 후속조치를 각각 counselingLog, assessment, servicePlan, followUp 키로 작성하세요.';
  return [
    '당신은 한국 사회복지기관의 기록 초안 작성 보조자입니다.',
    '입력된 사실을 추가하지 말고, 모르는 내용은 확인 필요로 표시하세요.',
    '진단·법률판단·위험도 확정을 하지 말고 담당자 검토 문구를 유지하세요.',
    '반드시 JSON 객체만 반환하세요. ' + format,
    `기록 유형: ${kind}`,
    `사례 맥락:\n${contextText || '(없음)'}`,
    `원문:\n${rawText || '(없음)'}`,
  ].join('\n\n');
}

export function parseOllamaDraft(content, fallback) {
  try {
    const parsed = JSON.parse(content);
    const required = ['counselingLog', 'assessment', 'servicePlan', 'followUp'];
    if (required.every((key) => typeof parsed[key] === 'string' && parsed[key].trim())) {
      return { ...fallback, ...parsed, provider: 'ollama-local', reviewRequired: true };
    }
  } catch {
    // Local model output is untrusted and falls back to deterministic drafts.
  }
  return fallback;
}
