# Google Drive 배포본 · v0.4.5

- 폴더: https://drive.google.com/drive/folders/17oKA6hBmneHvNk44hfog0VJX0QGH9NCc
- GitHub Release: https://github.com/dawith-ai/dawith-welfare-office/releases/tag/v0.4.5
- 최신 기능 커밋: `937cccf`

Google Drive 파일 크기 제한을 피하기 위해 각 파일을 90MiB 이하 조각으로 저장했습니다. 조각을 같은 폴더에 내려받은 뒤 아래처럼 복원합니다.

```bash
cat Dawith-Welfare-Office-0.4.5-x64-Setup.part-* > Dawith-Welfare-Office-0.4.5-x64-Setup.exe
cat Dawith-Welfare-Office-0.4.5-x64-Portable.part-* > Dawith-Welfare-Office-0.4.5-x64-Portable.exe
cat Dawith-Welfare-Office-0.4.5-arm64.part-* > 'Dawith Welfare Office-0.4.5-arm64.dmg'
```

| 파일 | 원본 크기 | SHA-256 |
| --- | ---: | --- |
| `Dawith-Welfare-Office-0.4.5-x64-Setup.exe` | 124,708,267 bytes | `7c50b0d5fd85ea1844ac4c2c28b49f6d6e1cbe937b658e52ed8d6c5070334569` |
| `Dawith-Welfare-Office-0.4.5-x64-Portable.exe` | 397,728,241 bytes | `e070e47e5f6b30197c80dd239bbfc19564163d837a19bf7700602f8abb3f5e84` |
| `Dawith Welfare Office-0.4.5-arm64.dmg` | 126,134,079 bytes | `de74b436b1fe0a4108f38a74fe839d031ae525cd4fbc1f26402cbedae0ba5245` |

이번 버전은 설치·연결·추천 모델 준비를 3단계로 안내합니다. 8~16GB 장치는 기본 7B 모델을 추천하며, Ollama 설치 후 모델은 `127.0.0.1:11434`에서만 준비됩니다.
