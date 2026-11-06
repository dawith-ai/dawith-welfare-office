# openoffice·rea 적용 경계

기준일: 2026-11-07

## 적용한 것

- [pblsketch/openoffice](https://github.com/pblsketch/openoffice)의 구독 AI 경계를 참고했다. 핵심은 앱이 Claude·Codex 로그인 화면을 직접 만들거나 로그인 파일을 읽지 않고, 사용자가 설치한 공식 CLI를 직접 실행하는 것이다.
- openoffice의 `locate → direct spawn → status command → explicit provider choice` 흐름을 JavaScript 서버 어댑터 [`src/subscription.mjs`](../src/subscription.mjs)로 새로 작성했다.
- [morluto/rea](https://github.com/morluto/rea)는 제품 런타임에 포함하지 않고 `npm run rea:audit` 개발 감사 경로로만 사용한다. REA의 Evidence-first, 실행 검증과 정적 분석을 함께 기록한다.
- 제품 안내 페이지는 [ieumoffice.com](https://ieumoffice.com)의 “기능 안내 → 데이터 경계 → 설치 흐름” 정보 구조를 참고하되 Dawith의 로컬 작업대와 복지 행정 사용 사례에 맞춰 새로 구성했다.

## 지키는 경계

1. Claude·Codex 인증 파일, 쿠키, 계정 토큰을 읽거나 복사하지 않는다.
2. 구독 CLI는 `shell: false`로 실행하고, 환경에 들어온 API 키·토큰 변수는 자식 프로세스에 전달하지 않는다.
3. 상태 확인과 원문 전송을 분리한다. 상태 확인은 설치·로그인 여부만 읽고 문서 원문은 보내지 않는다.
4. 구독 AI 전송은 `confirmExternal: true`와 UI 확인창을 모두 거쳐야 한다.
5. 로컬 규칙·Ollama가 기본 경로이며, 구독 provider는 자동 선택하지 않는다.
6. 결과는 초안이다. 담당자의 원문 대조와 확정 절차를 제품 문구에 표시한다.

## 라이선스와 재사용

이 저장소는 openoffice 또는 rea의 소스 파일을 제품에 복사하지 않는다. openoffice의 Apache-2.0 라이선스와 rea의 MIT 라이선스를 확인했고, 현재 구현은 해당 프로젝트의 공개 동작 계약과 보안 원칙을 독립적인 코드로 적용한다. 제품에 포함된 서드파티 자산은 각 라이선스 고지 파일을 유지한다.

## 검증 범위

- `npm run check`: 통과
- `npm test`: 통과
- `npm run test:e2e`: 통과
- 실제 로컬 환경에서 `claude auth status --json`과 `codex login status`의 상태 경계 확인
- 실제 구독 호출은 비용·개인정보가 발생하므로 자동 테스트에서 실행하지 않는다. 사용자가 AI 연결 센터에서 확인창을 승인한 경우에만 실행된다.
