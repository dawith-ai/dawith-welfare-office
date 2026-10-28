# Google Drive 배포물 — v0.4.3

배포 폴더: [Dawith Welfare Office v0.4.3 · Dawith CI](https://drive.google.com/drive/folders/1DyIke3G4Y4WCDyazDSOK-1FCuYSEycSs)

Google Drive 커넥터의 단일 파일 100MB 제한 때문에 설치 파일은 90MB 이하의 `.part-00`, `.part-01` 형식으로 분할되어 있습니다. 파트를 같은 폴더에 내려받은 뒤 아래 명령으로 원본을 조립합니다.

```bash
cat Dawith-Welfare-Office-0.4.3-x64-Setup.exe.part-* > Dawith-Welfare-Office-0.4.3-x64-Setup.exe
cat Dawith-Welfare-Office-0.4.3-x64-Portable.exe.part-* > Dawith-Welfare-Office-0.4.3-x64-Portable.exe
cat Dawith-Welfare-Office-0.4.3-arm64.dmg.part-* > Dawith-Welfare-Office-0.4.3-arm64.dmg
```

## 원본 검증

| 파일 | 크기(bytes) | SHA-256 |
| --- | ---: | --- |
| `Dawith-Welfare-Office-0.4.3-x64-Setup.exe` | 124701040 | `d38e0de6cf74b3ecaba3c437bd3fea9bf2d4aef76871d9a6fc52556a18fa6e05` |
| `Dawith-Welfare-Office-0.4.3-x64-Portable.exe` | 397692117 | `fa9e88f94994dc94cdf3e4ffa27e40d91e6e88b980b7397402d76781667e913b` |
| `Dawith-Welfare-Office-0.4.3-arm64.dmg` | 126115578 | `80fc0581b8c1f9bb4470baa7eac3043f6ccbad8a18f1dc7074c6b73c60ddd51e` |

조립 후 `shasum -a 256 <파일>` 또는 Windows PowerShell의 `Get-FileHash <파일> -Algorithm SHA256`로 확인합니다. Windows 파일은 GitHub Actions에서 빌드·설치 후 실행까지 검증됐고, macOS DMG는 ARM64 빌드와 앱 기동을 확인했지만 Apple Developer ID 서명·공증은 적용되지 않았습니다.
