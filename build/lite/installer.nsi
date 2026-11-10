; Per-user installer for the lightweight runtime (Node + Edge app window).
; Built by scripts/build-lite.mjs, which passes VERSION, STAGE and OUTFILE.
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define APPNAME "Dawith Welfare Office"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\DawithWelfareOffice"
; electron-builder used this name for the Electron build (0.9.6 and earlier).
!define LEGACY_UNINSTALLER "Uninstall Dawith Welfare Office.exe"

Name "${APPNAME}"
Caption "${APPNAME} ${VERSION} 설치"
OutFile "${OUTFILE}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "Dawith"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} 설치"
VIAddVersionKey "LegalCopyright" "Dawith"

Var ForceRun

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPNAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "지금 Dawith 복지 업무 도구함 열기"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Function .onInit
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "--force-run" $1
  ${IfNot} ${Errors}
    StrCpy $ForceRun "1"
  ${EndIf}
FunctionEnd

Section "Install"
  ; Close a running copy so its files can be replaced. The runtime has its own
  ; process name, so no other Node process is touched.
  nsExec::Exec 'taskkill /F /IM dawith-runtime.exe'
  ; taskkill returns before Windows releases the exe; overwriting it too early
  ; leaves an empty file. Wait until the old runtime can actually be deleted.
  StrCpy $R0 0
  wait_for_runtime:
    ClearErrors
    Delete "$INSTDIR\runtime\dawith-runtime.exe"
    IfErrors 0 runtime_released
    IntOp $R0 $R0 + 1
    Sleep 500
    IntCmp $R0 20 runtime_released wait_for_runtime runtime_released
  runtime_released:
  ; Remove the old Electron build quietly. App data stays in %APPDATA%.
  IfFileExists "$INSTDIR\${LEGACY_UNINSTALLER}" 0 +3
    ExecWait '"$INSTDIR\${LEGACY_UNINSTALLER}" /S _?=$INSTDIR'
    Delete "$INSTDIR\${LEGACY_UNINSTALLER}"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"

  SetOutPath "$INSTDIR"
  File /r "${STAGE}\*"
  ; Refuse to finish with a broken runtime rather than leave an app that
  ; silently does nothing.
  FileOpen $R1 "$INSTDIR\runtime\dawith-runtime.exe" r
  FileSeek $R1 0 END $R2
  FileClose $R1
  IntCmp $R2 1000000 runtime_ok 0 runtime_ok
    MessageBox MB_ICONSTOP "설치 파일을 모두 복사하지 못했습니다. Dawith Welfare Office를 닫은 뒤 다시 설치해 주세요." /SD IDOK
    Abort
  runtime_ok:
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPNAME}.exe"
  CreateShortcut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${APPNAME}.exe"

  WriteRegStr HKCU "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "Dawith"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\${APPNAME}.exe"
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${REGKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${REGKEY}" "EstimatedSize" "$0"

  ; Silent updates (from the app) reopen the new version by themselves.
  StrCmp $ForceRun "1" 0 +2
    Exec '"$INSTDIR\${APPNAME}.exe"'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM dawith-runtime.exe'
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\runtime"
  Delete "$INSTDIR\${APPNAME}.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${REGKEY}"
SectionEnd
