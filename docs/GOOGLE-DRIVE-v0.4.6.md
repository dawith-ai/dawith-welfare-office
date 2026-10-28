# Google Drive 배포본 · v0.4.6

- 폴더: https://drive.google.com/drive/folders/1lI8pkSSK3NLO5Vpvm4NMXrGFGd8bJYHq
- GitHub Release: https://github.com/dawith-ai/dawith-welfare-office/releases/tag/v0.4.6
- 기능 커밋: `1d68730`

Google Drive 파일 크기 제한을 피하기 위해 각 파일을 90MiB 이하 조각으로 저장했습니다. 조각을 같은 폴더에 내려받은 뒤 아래처럼 복원합니다.

```bash
cat Dawith-Welfare-Office-0.4.6-x64-Setup.part-* > Dawith-Welfare-Office-0.4.6-x64-Setup.exe
cat Dawith-Welfare-Office-0.4.6-x64-Portable.part-* > Dawith-Welfare-Office-0.4.6-x64-Portable.exe
cat Dawith-Welfare-Office-0.4.6-arm64.part-* > 'Dawith Welfare Office-0.4.6-arm64.dmg'
```

| 파일 | 원본 크기 | SHA-256 |
| --- | ---: | --- |
| `Dawith-Welfare-Office-0.4.6-x64-Setup.exe` | 124,709,286 bytes | `c565db45d334a485c402bb9d33acd2f9a8ac012d0ff27e3fa1865d10747a641e` |
| `Dawith-Welfare-Office-0.4.6-x64-Portable.exe` | 397,734,205 bytes | `ee1a84322e3ef6384079741da4c41c8db4775deb5f71c70ce7f9396ec36cef7b` |
| `Dawith Welfare Office-0.4.6-arm64.dmg` | 126,135,709 bytes | `6ac7d1034506b2521b5310efd2303974f2e0851ec656ca5cf5d6a99cb4e10067` |

이번 버전은 PC 사양별 추천 모델과 추천 업무·예상 처리감·다운로드 부담을 보여주고, 설치·연결·모델 준비를 순서대로 안내합니다.
