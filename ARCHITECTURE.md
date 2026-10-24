# Dawith Welfare Office 아키텍처

## 1. 결정

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 데스크톱 기반 | 로컬 HTTP 서비스 + Electron 39 셸 | 브라우저 UI와 Windows EXE가 같은 로컬 API를 재사용 |
| 저장소 | SQLite (`node:sqlite` 개발 런타임) | 중앙 DB 없이 기관 PC에 저장 |
| 기본 처리 | 규칙·템플릿 엔진 | 모델 없이도 개인정보를 밖으로 보내지 않고 반복 양식 처리 |
| 선택 처리 | Ollama loopback API | 외부 API가 아니라 기관 PC의 `127.0.0.1:11434`만 호출 |
| 음성 | whisper.cpp CLI 어댑터 | 모델 경로가 있는 경우에만 로컬 전사 |
| 문서 연결 | Markdown/HTML/JSON 로컬 export | HWP/HWPX/DOCX 직접 편집은 OpenOffice/IeumOffice 어댑터의 후속 작업 |

## 2. 런타임 경계

```text
┌────────────────────────────────────────────────────────────┐
│ 기관 PC                                                     │
│                                                            │
│  Browser / Electron EXE ──127.0.0.1──> Local API ──> SQLite│
│                              │                             │
│                              ├─ 규칙·템플릿                 │
│                              ├─ Ollama 127.0.0.1            │
│                              └─ whisper.cpp + local model   │
│                                                            │
│  외부 Cloud LLM / OpenRouter / telemetry: 제품 경로 없음    │
└────────────────────────────────────────────────────────────┘
```

## 3. 데이터 흐름

| 입력 | 처리 | 저장 |
| --- | --- | --- |
| 상담 메모 | 키워드·날짜·관계·계획 추출 → 템플릿 | 원문과 초안 모두 로컬 SQLite |
| 회의 메모 | 참석/결정/후속조치 규칙 추출 | 로컬 SQLite |
| 오디오 파일 | whisper.cpp subprocess, 로컬 임시 파일 | 전사 결과와 메타데이터만 저장, 원본은 선택 저장 |
| Ollama 선택 | 로컬 loopback JSON 요청 | 결과와 provider 기록 |

## 4. 보안 불변조건

1. 서버 listen host는 `127.0.0.1` 고정이다.
2. 허용 provider는 `rules`, `ollama-local`뿐이다.
3. 서버가 cloud/external provider를 받으면 처리하지 않고 거부한다.
4. 오디오 파일명은 경로로 사용하지 않고 랜덤 임시 경로만 사용한다.
5. 원문은 로그·콘솔에 출력하지 않는다.
6. 모든 생성 결과는 `draft` 상태이며 사람 검토가 필요하다.
7. 상담 원문·맥락·초안·사례명은 AES-256-GCM 필드 암호화로 저장한다. 키는 현재 개발용으로 `.data/.local-key` 또는 `WELFARE_DB_KEY`를 사용하며, 배포 전 OS 키체인/TPM 연동으로 교체해야 한다.
8. API는 `Origin`이 127.0.0.1 또는 비어 있는 요청만 허용한다.

## 5. 오픈소스 기반과 라이선스 경계

- IeumOffice 원본/기반: `pblsketch/openoffice`, Apache-2.0. 본 MVP는 기존 저장소를 덮어쓰지 않고 로컬 어댑터로 연결한다.
- Ollama: MIT. 설치된 로컬 서버의 API 계약만 사용한다.
- llama.cpp: MIT. 향후 Ollama 없이 직접 GGUF 런타임을 제공할 때의 후보이다.
- whisper.cpp: MIT. 본 MVP의 CLI 음성 전사 어댑터 후보/실행 계약이다.
- faster-whisper: MIT. Python 기반 기관 서버형 전사 옵션으로 별도 패키징한다.

각 upstream의 소스나 모델 파일은 이 디렉터리에 복사하지 않는다. 배포 시 `UPSTREAM.md`와 각 프로젝트의 NOTICE/라이선스를 함께 관리한다.

## 6. Windows 배포

Electron main process가 사용자 데이터 폴더에 기관별 `data` 디렉터리를 만들고, 임의의 로컬 포트에 API를 바인딩한 뒤 BrowserWindow를 연다. `electron-builder`의 NSIS와 portable target은 별도 명령으로 생성하며, GitHub Actions Windows runner에서 정적 검사·Node 테스트·Chromium E2E·빌드를 재현한다.
