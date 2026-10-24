# 오픈소스 기반 및 검토 기록

기준일: 2026-10-23

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

## 현재 구현 범위

이 MVP는 위 프로젝트의 코드를 복사하지 않고, 설치된 로컬 실행 파일과 공식 HTTP/CLI 계약을 어댑터로 사용한다. 현재 회의록과 상담 정리는 자체 규칙·템플릿 및 Ollama 프롬프트로 구현되어 있으며, 위 회의록 프로젝트를 통합한 상태가 아니다. 모델 다운로드·업데이트는 제품 서버가 자동으로 수행하지 않는다. 기관 관리자가 모델의 출처, 라이선스, 보관 위치를 별도로 승인해야 한다.
