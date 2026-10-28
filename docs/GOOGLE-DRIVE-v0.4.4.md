# Google Drive 배포본 · v0.4.4

- 폴더: https://drive.google.com/drive/folders/1LbWoC7isYNtuykO-MtvXlIP-__Tw3QsL
- GitHub Release: https://github.com/dawith-ai/dawith-welfare-office/releases/tag/v0.4.4
- 커밋: `cac160b`

Google Drive 단일 파일 제한을 피하기 위해 각 파일을 90MiB 이하 조각으로 저장했습니다. 조각을 같은 폴더에 내려받은 뒤 아래처럼 원본 파일을 복원합니다.

```bash
cat Dawith-Welfare-Office-0.4.4-x64-Setup.part-* > Dawith-Welfare-Office-0.4.4-x64-Setup.exe
cat Dawith-Welfare-Office-0.4.4-x64-Portable.part-* > Dawith-Welfare-Office-0.4.4-x64-Portable.exe
cat Dawith-Welfare-Office-0.4.4-arm64.part-* > 'Dawith Welfare Office-0.4.4-arm64.dmg'
```

| 파일 | 원본 크기 | SHA-256 |
| --- | ---: | --- |
| `Dawith-Welfare-Office-0.4.4-x64-Setup.exe` | 124,705,972 bytes | `fd30ce15c290f708a00d13bac08efdf41309f4ac4d66a45139235eea072e4495` |
| `Dawith-Welfare-Office-0.4.4-x64-Portable.exe` | 397,717,987 bytes | `219694206de3d15567fcc967aeb259a60da0dc1293e212de708e2fdce801658c` |
| `Dawith Welfare Office-0.4.4-arm64.dmg` | 126,127,441 bytes | `0902c421530abba9533324eb68d43c9642389ddfb3588ee7542103f3f1ee1657` |

이번 버전의 Ollama 도우미는 OS별 공식 설치 파일을 안내하고, Ollama가 실행된 뒤 이 PC의 `127.0.0.1:11434`로 추천 모델을 준비합니다. 브라우저나 EXE가 운영체제 프로그램을 몰래 설치하지는 않습니다.
