# openoffice·rea 적용 경계

기준일: 2026-11-07

## 적용한 것

- [pblsketch/openoffice](https://github.com/pblsketch/openoffice)와 이음오피스를 참고해 만들었던 구독·클라우드 AI 연결(`src/subscription.mjs`, `src/ai-connections.mjs`: Claude Code·Codex·Gemini CLI, ChatGPT OAuth, OpenRouter, Gemini 키)은 0.9.9 이후 제품 결정(기록은 PC 밖으로 나가지 않는다)에 따라 모두 제거했다. AI는 `127.0.0.1`의 Ollama만 쓴다.
- [morluto/rea](https://github.com/morluto/rea)는 제품 런타임에 포함하지 않고 `npm run rea:audit` 개발 감사 경로로만 사용한다. REA의 Evidence-first, 실행 검증과 정적 분석을 함께 기록한다.
- 제품 안내 페이지는 [ieumoffice.com](https://ieumoffice.com)의 “기능 안내 → 데이터 경계 → 설치 흐름” 정보 구조를 참고하되 Dawith의 로컬 작업대와 복지 행정 사용 사례에 맞춰 새로 구성했다.

## 지키는 경계

1. AI는 로컬 전용이다. 사용자 텍스트는 `127.0.0.1`의 Ollama로만 보낸다.
2. 클라우드·구독 AI provider, OAuth, API 키 저장 경로를 두지 않는다. 이전 버전의 연결 정보는 시작 시 삭제한다.
3. 로컬 규칙이 기본 경로이며, 로컬 AI는 사용자가 고를 때만 쓴다.
4. 결과는 초안이다. 담당자의 원문 대조와 확정 절차를 제품 문구에 표시한다.

## 라이선스와 재사용

이 저장소는 openoffice 또는 rea의 소스 파일을 제품에 복사하지 않는다(openoffice를 참고한 구독 AI 어댑터는 제거됨). openoffice의 Apache-2.0 라이선스와 rea의 MIT 라이선스를 확인했고, 현재 구현은 해당 프로젝트의 공개 동작 계약과 보안 원칙을 독립적인 코드로 적용한다. 제품에 포함된 서드파티 자산은 각 라이선스 고지 파일을 유지한다.

## 검증 범위

- `npm run check`: 통과
- `npm test`: 통과
- `npm run test:e2e`: 통과
- `test/local-only.test.mjs`: 제거한 클라우드 AI 경로가 404이고, 어떤 모듈도 구독·클라우드 어댑터를 불러오지 않음을 확인한다.
