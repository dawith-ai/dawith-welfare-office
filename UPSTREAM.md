# 오픈소스 기반 및 검토 기록

기준일: 2026-10-24

## 제품 기반

- [pblsketch/openoffice](https://github.com/pblsketch/openoffice) — IeumOffice 원본 저장소. 저장소의 `LICENSE`는 Apache-2.0이며, 기존 코드와 모델 자산을 이 프로젝트에 무단 복사하지 않는다.

## 로컬 AI 런타임

- [ollama/ollama](https://github.com/ollama/ollama) — 로컬 서버 API. 현재 구현은 `http://127.0.0.1:11434/api/tags`와 `/api/chat`만 사용한다.
- [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) — Ollama를 대체할 수 있는 직접 GGUF 실행 후보. MIT 라이선스 확인 대상.
- [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) — 로컬 음성 전사 CLI/API 후보. MIT 라이선스.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — 기관 내부 서버형 Python 전사 후보. MIT 라이선스.

## 회의록 제품 참고

- [manor-os/minutes](https://github.com/manor-os/minutes) — Whisper + Ollama를 이용한 로컬/자체 호스팅 회의록 구조, 결정사항·액션아이템·검색·내보내기 UX를 참고한다. 이 저장소의 코드를 복사하거나 의존하지 않는다.
- [imnotwallace/LocalScribe](https://github.com/imnotwallace/LocalScribe) — Windows 로컬 전사, VAD, 화자별 오디오 병합, 모델 라이선스 표시와 해시 검증 흐름을 참고한다. 모델 자산은 별도 검토한다.
- [openintelligence-labs/meetmind](https://github.com/openintelligence-labs/meetmind) — 로컬 회의 캡처·전사·화자·결정사항·액션아이템·검색 구조를 참고한다. macOS 전용 캡처 코드는 이 제품에 포함하지 않는다.

## 문서 출력 및 에이전트 참고

- [dolanmiu/docx](https://github.com/dolanmiu/docx) — 브라우저 작업 결과를 기관 PC에서 DOCX로 내보내는 데 사용하는 MIT 라이선스 라이브러리. 문서 원문은 외부 API로 보내지 않는다.
- [dolanmiu/docx template patching](https://github.com/dolanmiu/docx/blob/master/docs/usage/templates.md) — `{{태그}}` 문단 패치를 검토했고, 원본 스타일을 유지하는 DOCX 양식 주입에 사용한다.
- [Stenway/openhanji](https://github.com/sxa-lab/openhanji) — Apache-2.0 기반 HWPX/OWPML 구조 분석 도구를 검토했다. 현재 제품은 Python 런타임을 추가하지 않고 JSZip으로 필요한 HWPX ZIP/XML 경계를 직접 처리한다.
- [hwpkit](https://github.com/2naive/hwpkit) — MIT HWP/HWPX 처리 라이브러리를 검토했다. HWP 바이너리 편집을 제품에 넣기 전 라이선스·호환성·Windows 검증이 필요해 현재 의존성으로 포함하지 않았다.
- [Stuk/jszip](https://github.com/Stuk/jszip) — MIT 라이선스 ZIP 처리 라이브러리. HWPX 구조 분석·치환·재패키징에 사용한다.
- [univa-agent/univa](https://github.com/univa-agent/univa) — 사용자가 언급한 `univa.zephy`와 일치할 가능성이 높은 UniVA 저장소를 확인했다. 영상 제작 에이전트와 MCP·도구 오케스트레이션 구조는 참고할 수 있지만, 복지 문서 생성과 직접 관련이 없고 외부 모델·영상 파이프라인을 포함하므로 현재 제품에 코드를 가져오지 않았다.
- [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite) — 기관 시스템 연결 자동화의 후보로 검토했다. 브라우저 페이지·로그인 상태를 에이전트에 전달할 수 있어 개인정보 업무의 기본 경로에는 포함하지 않는다.
- [morluto/rea](https://github.com/morluto/rea) — MIT 라이선스의 JavaScript/Electron 정적 분석·Evidence 도구를 릴리스 감사에 사용한다. `scripts/rea-audit.mjs`가 소스 일부를 임시 디렉터리로 복사해 REA CLI를 실행하며, REA 자체는 제품 런타임이나 개인정보 처리 경로에 포함하지 않는다.

## 현재 구현 범위

이 MVP는 위 프로젝트의 코드를 복사하지 않고, 설치된 로컬 실행 파일과 공식 HTTP/CLI 계약을 어댑터로 사용한다. 현재 회의록과 상담 정리는 자체 규칙·템플릿 및 Ollama 프롬프트로 구현되어 있으며, 위 회의록 프로젝트를 통합한 상태가 아니다. 기관 양식은 DOCX/HWPX의 명시적 `{{태그}}` 계약으로 처리하며, 임의 PDF·스캔 문서·HWP 바이너리를 자동 편집한다고 주장하지 않는다. 모델 다운로드·업데이트는 제품 서버가 자동으로 수행하지 않는다. 기관 관리자가 모델의 출처, 라이선스, 보관 위치를 별도로 승인해야 한다.
