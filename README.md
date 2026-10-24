# Dawith Welfare Office

사회복지기관의 상담 메모·회의 메모·녹취를 기관 PC 안에서 정리하는 Dawith Welfare Office입니다. 웹 데모와 Windows 설치형 EXE가 같은 로컬 API와 SQLite 저장소를 사용합니다.

- 공개 데모: https://dawith-welfare-office-demo.vercel.app
- 소스 저장소: https://github.com/dawith-ai/dawith-welfare-office

공개 데모는 개인정보 보호를 위해 서버 API를 호출하지 않고 브라우저 규칙 엔진과 `localStorage`만 사용합니다. 실제 상담 원문은 공개 데모에 입력하지 말고 기관용 Windows EXE를 사용하세요.

## 현재 실제로 되는 것

- 상담 내용 / 회의록 / 녹취 정리 업무 선택
- 업무별 전용 작업대: 상담은 사례 파일, 회의는 결정 보드, 녹취는 전사 작업대 UI
- 규칙·템플릿 기반 상담일지·사정기록·서비스계획·후속조치 초안 생성
- Ollama가 같은 PC에서 실행 중이면 `127.0.0.1:11434`의 로컬 모델 선택
- 새 기록을 SQLite 파일에 저장하고 다시 읽기
- 기록 보관함 검색·재열기·검토 수정
- 로컬 사례 생성·선택 및 기록별 사례 구분
- 초안 생성 뒤 추출된 관계·주제·일정·후속 단서 확인
- JSON·Markdown·HTML 로컬 내보내기 및 인쇄용 문서 생성
- `WHISPER_MODEL_PATH`가 설정된 경우 whisper.cpp CLI로 로컬 음성 전사
- 외부 provider 요청 차단
- 기관 이름·Whisper 경로 등 로컬 설정

## 실행

```bash
cd welfare-office
npm run check
npm start
```

브라우저에서 `http://127.0.0.1:4387`을 엽니다.

## Windows EXE

개발 환경에서 설치 파일과 portable 실행 파일을 생성합니다.

```bash
npm install
npm run dist:win
```

생성물:

- `dist/Dawith-Welfare-Office-0.1.4-x64-Setup.exe` — 일반 설치형
- `dist/Dawith-Welfare-Office-0.1.4-x64-Portable.exe` — 설치 없이 실행하는 portable 형식

GitHub Actions의 `Build Dawith Welfare Office for Windows` workflow도 같은 Windows runner에서 검사·브라우저 테스트·빌드를 수행합니다.

Ollama 로컬 모델을 쓰려면 Ollama를 실행한 뒤 모델을 선택합니다. 모델이 없는 환경에서는 로컬 규칙·템플릿이 기본 경로입니다. 클라우드 모델은 이 앱의 provider 목록과 서버 검증에서 허용하지 않습니다.

음성 전사는 whisper.cpp 모델 파일을 기관이 별도로 준비하고 다음처럼 실행합니다.

```bash
WHISPER_MODEL_PATH=/기관이승인한경로/ggml-small.bin npm start
```

모델 파일은 크기·라이선스·한국어 성능을 기관이 검토한 뒤 별도 배포해야 하며, 이 저장소에는 포함하지 않습니다.

## 배포 전 확인할 한계

상담 원문·맥락·초안·사례명은 현재 AES-256-GCM으로 필드 암호화되어 SQLite에 저장됩니다. 개발 환경의 키는 `.data/.local-key`에 생성되며, 실제 기관 배포 전에는 OS 키체인/TPM 기반 키 관리, 사용자별 권한과 감사로그, 자동 삭제 정책, EXE 코드 서명, 모델 출처 검증을 기관별로 추가 검토해야 합니다. 생성 결과는 자동 확정 기록이 아니라 담당자 검토 전 초안입니다.

현재 버전은 기관용 업무 보조 제품의 기반입니다. 기관 계정·역할별 권한, 중앙 감사로그, HWP/HWPX/DOCX 직접 편집, 실제 Windows 장비별 Whisper 성능 검증은 아직 배포 전 단계입니다. 따라서 “모든 기관에서 검증 완료” 또는 “개인정보 위험이 절대 없음”으로 홍보하면 안 됩니다.

오픈소스 기반과 라이선스는 [`UPSTREAM.md`](./UPSTREAM.md), 제품 요구사항은 [`PRD.md`](./PRD.md), 시스템 경계는 [`ARCHITECTURE.md`](./ARCHITECTURE.md)에 기록했습니다.
