const text = (value) => String(value ?? '').trim();
const lines = (value) => text(value).split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
const list = (value, fallback = '내용을 입력하세요.') => lines(value).length ? lines(value) : [fallback];
const numbered = (value, fallback) => list(value, fallback).map((item, index) => `${index + 1}. ${item}`).join('\n');
const bullet = (value, fallback) => list(value, fallback).map((item) => `• ${item}`).join('\n');

export const documentTemplates = [
  {
    id: 'business-plan',
    label: '사업기획서',
    eyebrow: 'PLAN / DESIGN',
    description: '사업의 필요성부터 목표·일정·예산·성과지표까지 한 번에 설계합니다.',
    accent: 'violet',
    fields: [
      { key: 'organizationName', label: '기관명', placeholder: '예: 다위종합사회복지관', required: true },
      { key: 'businessName', label: '사업명', placeholder: '예: 취약계층 주거안정 지원사업', required: true },
      { key: 'period', label: '사업 기간', placeholder: '예: 2027년 1월 ~ 12월', required: true },
      { key: 'target', label: '대상·인원', placeholder: '예: 지역 내 주거취약 가구 30가구', required: true },
      { key: 'necessity', label: '추진 배경·필요성', placeholder: '현장에서 확인한 문제와 이 사업이 필요한 이유를 적습니다.', kind: 'textarea', required: true },
      { key: 'goals', label: '사업 목표', placeholder: '목표를 줄바꿈으로 나눠 입력합니다.\n예: 주거 불안 가구의 안정적인 주거 유지', kind: 'textarea', required: true },
      { key: 'activities', label: '주요 활동', placeholder: '실행할 활동을 줄바꿈으로 나눠 입력합니다.\n예: 주거상담\n예: 임대주택 신청 지원', kind: 'textarea', required: true },
      { key: 'schedule', label: '추진 일정', placeholder: '예: 1분기 대상자 모집 / 2분기 주거상담 / 4분기 평가', kind: 'textarea' },
      { key: 'budget', label: '예산 계획', placeholder: '예: 총 12,000,000원\n인건비 4,000,000원\n사업비 8,000,000원', kind: 'textarea' },
      { key: 'indicators', label: '성과지표·평가방법', placeholder: '예: 상담 60회, 주거 유지 25가구, 만족도 4.3점 이상', kind: 'textarea', required: true },
      { key: 'notes', label: '추가 메모', placeholder: '협력기관, 위험요인, 승인 조건 등을 적습니다.', kind: 'textarea' },
    ],
  },
  {
    id: 'business-report',
    label: '사업보고서',
    eyebrow: 'REPORT / REVIEW',
    description: '계획과 실제 실행을 비교하고 성과·증빙·개선점을 보고서로 정리합니다.',
    accent: 'teal',
    fields: [
      { key: 'organizationName', label: '기관명', placeholder: '예: 다위종합사회복지관', required: true },
      { key: 'businessName', label: '사업명', placeholder: '예: 취약계층 주거안정 지원사업', required: true },
      { key: 'period', label: '보고 기간', placeholder: '예: 2027년 1월 ~ 12월', required: true },
      { key: 'plannedParticipants', label: '계획 인원', placeholder: '예: 30가구', required: true },
      { key: 'actualParticipants', label: '실적 인원', placeholder: '예: 28가구', required: true },
      { key: 'activities', label: '추진 내용·실적', placeholder: '실제로 진행한 활동과 횟수를 줄바꿈으로 입력합니다.', kind: 'textarea', required: true },
      { key: 'outcomes', label: '주요 성과', placeholder: '참여자 변화, 서비스 연결, 수치 성과를 적습니다.', kind: 'textarea', required: true },
      { key: 'evidence', label: '증빙·근거', placeholder: '예: 상담일지 28건, 만족도 조사 24부, 사진대지 3건', kind: 'textarea' },
      { key: 'satisfaction', label: '만족도·참여자 의견', placeholder: '평균 점수와 참여자의 주요 의견을 적습니다.', kind: 'textarea' },
      { key: 'issues', label: '문제점·미달성 항목', placeholder: '계획과 달라진 점, 원인, 보완이 필요한 점을 적습니다.', kind: 'textarea' },
      { key: 'nextSteps', label: '향후 계획', placeholder: '다음 기간에 유지·개선·확대할 내용을 적습니다.', kind: 'textarea', required: true },
    ],
  },
  {
    id: 'meeting-minutes',
    label: '회의록',
    eyebrow: 'MEETING / DECISION',
    description: '안건·논의·결정·담당자·기한을 분리해 회의 직후 공유 가능한 문서로 만듭니다.',
    accent: 'blue',
    fields: [
      { key: 'organizationName', label: '기관명', placeholder: '예: 다위종합사회복지관', required: true },
      { key: 'meetingTitle', label: '회의명', placeholder: '예: 2027년 1차 사례회의', required: true },
      { key: 'date', label: '일시', placeholder: '예: 2027년 1월 15일 14:00', required: true },
      { key: 'attendees', label: '참석자', placeholder: '예: 김○○, 이○○, 박○○', required: true },
      { key: 'agenda', label: '주요 안건', placeholder: '안건을 줄바꿈으로 입력합니다.', kind: 'textarea', required: true },
      { key: 'discussion', label: '논의 내용', placeholder: '발언과 검토 내용을 적습니다.', kind: 'textarea', required: true },
      { key: 'decisions', label: '결정사항', placeholder: '확정된 결정사항을 줄바꿈으로 입력합니다.', kind: 'textarea', required: true },
      { key: 'actionItems', label: '후속 실행 항목', placeholder: '담당자와 기한을 포함해 입력합니다.\n예: 김○○ — 1월 20일까지 신청 자격 확인', kind: 'textarea', required: true },
      { key: 'nextMeeting', label: '다음 일정', placeholder: '예: 2027년 2월 12일 14:00' },
      { key: 'notes', label: '기타 메모', placeholder: '공유할 자료, 미결정 사항 등을 적습니다.', kind: 'textarea' },
    ],
  },
];

function templateById(templateId) {
  return documentTemplates.find((template) => template.id === templateId) || documentTemplates[0];
}

function sourceFallback(key, source = {}) {
  const draft = source.draft || {};
  if (key === 'discussion') return draft.counselingLog || source.rawText || '';
  if (key === 'decisions') return draft.assessment || '';
  if (key === 'actionItems') return draft.servicePlan || draft.followUp || '';
  if (key === 'activities') return draft.counselingLog || source.rawText || '';
  if (key === 'outcomes') return draft.assessment || '';
  if (key === 'nextSteps') return draft.servicePlan || draft.followUp || '';
  if (key === 'necessity') return draft.assessment || source.contextText || '';
  if (key === 'goals') return draft.servicePlan || '';
  return '';
}

export function normalizeDocumentFields(templateId, fields = {}, source = {}) {
  const template = templateById(templateId);
  return Object.fromEntries(template.fields.map((field) => [field.key, text(fields[field.key]) || sourceFallback(field.key, source)]));
}

function section(id, heading, content, note = '') {
  return { id, heading, content: text(content), note };
}

export function buildDocumentDraft({ templateId, fields = {}, source = {} } = {}) {
  const template = templateById(templateId);
  const normalized = normalizeDocumentFields(template.id, fields, source);
  const sourceType = source?.draft?.typeLabel || (source?.rawText ? '연결된 로컬 기록' : '직접 입력');
  let title = template.label;
  let sections = [];

  if (template.id === 'business-plan') {
    title = `${normalized.businessName || '사업'} 사업기획서`;
    sections = [
      section('overview', '1. 사업 개요', `${normalized.organizationName || '기관'}은(는) ${normalized.period || '해당 기간'} 동안 ${normalized.target || '대상자'}를 대상으로 “${normalized.businessName || '사업명'}”을(를) 추진한다.`),
      section('necessity', '2. 추진 배경 및 필요성', normalized.necessity, '현장 관찰과 기관 통계 등 확인 가능한 근거를 보완하세요.'),
      section('goals', '3. 사업 목표', numbered(normalized.goals, '구체적인 목표를 입력하세요.'), '목표는 측정 가능한 표현으로 다듬으세요.'),
      section('activities', '4. 주요 사업 내용', numbered(normalized.activities, '실행 활동을 입력하세요.')),
      section('schedule', '5. 추진 일정', normalized.schedule || '세부 일정을 입력하세요.'),
      section('budget', '6. 예산 계획', normalized.budget || '예산 항목과 금액을 입력하세요.'),
      section('indicators', '7. 성과지표 및 평가방법', numbered(normalized.indicators, '성과지표와 평가방법을 입력하세요.')),
      section('notes', '8. 협력·위험요인 및 기타사항', normalized.notes || '추가 검토사항이 없습니다.'),
    ];
  } else if (template.id === 'business-report') {
    title = `${normalized.businessName || '사업'} 사업보고서`;
    sections = [
      section('summary', '1. 사업 개요', `${normalized.organizationName || '기관'}은(는) ${normalized.period || '해당 기간'} 동안 ${normalized.businessName || '사업'}을(를) 운영했다. 계획 인원은 ${normalized.plannedParticipants || '미입력'}, 실제 참여 인원은 ${normalized.actualParticipants || '미입력'}이다.`),
      section('activities', '2. 추진 내용 및 실적', numbered(normalized.activities, '추진 내용과 실적을 입력하세요.')),
      section('outcomes', '3. 주요 성과', normalized.outcomes, '성과를 확인할 수 있는 수치나 사례를 함께 제시하세요.'),
      section('evidence', '4. 증빙자료 및 근거', bullet(normalized.evidence, '증빙자료를 입력하세요.')),
      section('satisfaction', '5. 만족도 및 참여자 의견', normalized.satisfaction || '만족도 조사 결과를 입력하세요.'),
      section('issues', '6. 문제점 및 미달성 항목', normalized.issues || '확인된 문제점이 없습니다. 담당자 검토가 필요합니다.'),
      section('nextSteps', '7. 향후 계획', numbered(normalized.nextSteps, '향후 계획을 입력하세요.')),
    ];
  } else {
    title = `${normalized.meetingTitle || '회의'} 회의록`;
    sections = [
      section('meta', '회의 정보', `기관명: ${normalized.organizationName || '미입력'}\n일시: ${normalized.date || '미입력'}\n참석자: ${normalized.attendees || '미입력'}`),
      section('agenda', '1. 주요 안건', numbered(normalized.agenda, '주요 안건을 입력하세요.')),
      section('discussion', '2. 논의 내용', normalized.discussion, '발언 내용과 확인된 사실을 원문과 대조하세요.'),
      section('decisions', '3. 결정사항', numbered(normalized.decisions, '결정사항을 입력하세요.')),
      section('actionItems', '4. 후속 실행 항목', numbered(normalized.actionItems, '담당자와 기한을 포함한 실행 항목을 입력하세요.')),
      section('nextMeeting', '5. 다음 회의', normalized.nextMeeting || '다음 회의 일정이 정해지지 않았습니다.'),
      section('notes', '6. 기타 메모', normalized.notes || '기타 메모가 없습니다.'),
    ];
  }

  const missing = template.fields.filter((field) => field.required && !text(normalized[field.key])).map((field) => field.label);
  return {
    templateId: template.id,
    templateLabel: template.label,
    title,
    fields: normalized,
    sections,
    sourceType,
    sourceRecordId: source.id || '',
    reviewRequired: true,
    missing,
    generatedAt: new Date().toISOString(),
  };
}

export function documentTemplate(templateId) {
  return templateById(templateId);
}
