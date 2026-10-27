# Dawith Welfare Office 0.3.1

사회복지기관의 상담 메모·회의 메모·녹취를 기관 PC 또는 기관 내부망에서 정리하는 Dawith Welfare Office입니다. 웹 데모와 Windows 설치형 EXE가 같은 로컬 API와 SQLite 저장소를 사용합니다.

- 공개 데모: https://dawith-welfare-office-demo.vercel.app
- GitHub Pages 데모(최신 UI 확인용): https://dawith-ai.github.io/dawith-welfare-office/
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
- 기관 문서 스튜디오: 사업기획서·사업보고서·회의록 템플릿
- 저장된 상담·회의 기록을 문서 초안 입력값으로 연결
- 담당자 검토 후 문서 초안 저장 및 DOCX·Markdown·인쇄용 HTML 내보내기
- 기관 양식 업로드: `{{항목명}}` 태그가 있는 DOCX/HWPX를 로컬 분석하고 원본 서식에 값을 주입
- 업로드한 기관 양식과 입력 항목을 암호화된 로컬 SQLite에 저장
- `WHISPER_MODEL_PATH`가 설정된 경우 whisper.cpp CLI로 로컬 음성 전사
- 전사 결과의 구간 타임라인·SHA-256 원본 해시를 기록하고, 기록 저장 시 원문·초안 해시를 함께 보관
- 메타데이터만 담은 로컬 감사 이벤트(`/api/audit`)와 보관기간 자동 삭제
- 외부 provider 요청 차단
- 기관 내부망 모드의 관리자 최초 설정·로그인·세션·역할(viewer/editor/admin)
- LAN 바인딩 시 인증 필수 안전장치와 로그인 실패 제한
- Windows EXE의 Electron OS 보호 DB 키 저장
- 기관 이름·Whisper 경로 등 로컬 설정

## 실행

```bash
cd welfare-office
npm run check
npm start
```

브라우저에서 `http://127.0.0.1:4387`을 엽니다.

## 기관 전체 사용

한 대의 서버를 기관 내부망에서 공유하려면 [`DEPLOYMENT.md`](./DEPLOYMENT.md)의 내부 서버 모드를 사용합니다. `WELFARE_AUTH_REQUIRED=1`과 `WELFARE_BIND_HOST=0.0.0.0`을 함께 설정해야 하며, 인증 없이 LAN에 바인딩하는 실행은 서버가 거부합니다. 최초 관리자 계정은 서버 PC에서 만들고, 이후 관리자만 직원 계정을 추가합니다.

한 명 또는 한 PC에서만 사용하는 경우에는 Windows EXE가 기본 선택입니다. EXE는 `127.0.0.1`만 사용하고 OS 보호 저장소에 DB 키를 보관합니다.

## Windows EXE

개발 환경에서 설치 파일과 portable 실행 파일을 생성합니다.

```bash
npm install
npm run dist:win
```

생성물:

- `dist/Dawith-Welfare-Office-0.3.1-x64-Setup.exe` — 일반 설치형
- `dist/Dawith-Welfare-Office-0.3.1-x64-Portable.exe` — 설치 없이 실행하는 portable 형식

GitHub Actions의 `Build Dawith Welfare Office for Windows` workflow도 같은 Windows runner에서 검사·브라우저 테스트·빌드를 수행합니다.

Ollama 로컬 모델을 쓰려면 Ollama를 실행한 뒤 모델을 선택합니다. 모델이 없는 환경에서는 로컬 규칙·템플릿이 기본 경로입니다. 클라우드 모델은 이 앱의 provider 목록과 서버 검증에서 허용하지 않습니다.

음성 전사는 whisper.cpp 모델 파일을 기관이 별도로 준비하고 다음처럼 실행합니다.

```bash
WHISPER_MODEL_PATH=/기관이승인한경로/ggml-small.bin npm start
```

모델 파일은 크기·라이선스·한국어 성능을 기관이 검토한 뒤 별도 배포해야 하며, 이 저장소에는 포함하지 않습니다.

## 배포 전 확인할 한계

상담 원문·맥락·초안·사례명은 AES-256-GCM으로 필드 암호화되어 SQLite에 저장됩니다. 기록과 전사에는 무결성 검증용 SHA-256이 붙고, 원문을 담지 않는 감사 이벤트와 보관기간 자동 삭제가 동작합니다. Windows EXE는 Electron OS 보호 저장소에 DB 키를 보관하며, 내부 서버 모드는 기관 관리자가 데이터 디렉터리와 키를 보호해야 합니다. 생성 결과는 자동 확정 기록이 아니라 담당자 검토 전 초안입니다.

현재 버전은 기관 내부망에서 운영할 수 있는 인증 포함 베타입니다. 문서 스튜디오의 결과도 담당자 검토 전 초안입니다. 기관 양식은 DOCX/HWPX 파일의 입력 위치에 `{{기관명}}`처럼 태그를 넣으면 원본 서식과 표를 유지한 채 채울 수 있습니다. `.hwp`, PDF, 스캔 이미지, 태그가 여러 XML 텍스트 노드로 쪼개진 파일은 아직 자동 주입하지 않습니다. 실제 판매 전에는 기관별 개인정보·보안 검토, Windows 코드 서명, 장비별 Whisper 성능 검증, 백업·복구 리허설을 완료해야 합니다. 따라서 “모든 기관에서 검증 완료” 또는 “개인정보 위험이 절대 없음”으로 홍보하면 안 됩니다.

### 기관 양식 사용법

1. Word 또는 한글에서 공식 양식의 입력 위치에 `{{기관명}}`, `{{사업명}}`, `{{회의일시}}` 같은 태그를 입력합니다.
2. 문서 스튜디오의 `기관 양식 업로드`에서 `.docx` 또는 `.hwpx` 파일을 선택합니다.
3. 발견된 항목을 직접 입력하거나 저장된 상담·회의 기록에서 연결합니다.
4. 초안을 만들고 담당자가 결과를 검토한 뒤 `Word 다운로드`를 선택합니다. HWPX 양식은 `.hwpx`로 내려받습니다.

업로드된 파일·태그·문서 값은 로컬 서버의 암호화 SQLite에만 저장됩니다. 공개 데모에서는 실제 파일 업로드를 막고 있으므로 기관용 Windows EXE 또는 `127.0.0.1` 로컬 서버에서 사용해야 합니다.

로컬 서버는 요청 Origin이 현재 접속한 `127.0.0.1` 또는 `localhost` 주소와 정확히 일치할 때만 브라우저 요청을 허용합니다. 다른 로컬 포트나 외부 웹사이트에서 API를 호출할 수 없으며, CSP·프레임 삽입 차단·MIME 보호 헤더도 적용됩니다.

오픈소스 기반과 라이선스는 [`UPSTREAM.md`](./UPSTREAM.md), 제품 요구사항은 [`PRD.md`](./PRD.md), 시스템 경계는 [`ARCHITECTURE.md`](./ARCHITECTURE.md)에 기록했습니다.
