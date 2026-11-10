; Portable build: unpacks once per version into %TEMP% and starts the app.
; Built by scripts/build-lite.mjs, which passes VERSION, STAGE and OUTFILE.
Unicode true
!include "MUI2.nsh"

!define APPNAME "Dawith Welfare Office"

Name "${APPNAME}"
Caption "${APPNAME} ${VERSION} 준비 중"
OutFile "${OUTFILE}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "Dawith"
AutoCloseWindow true
ShowInstDetails nevershow
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} (포터블)"
VIAddVersionKey "LegalCopyright" "Dawith"

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Section
  StrCpy $0 "$TEMP\DawithWelfareOffice-${VERSION}"
  ; .ready is written last, so a half-finished unpack is redone.
  IfFileExists "$0\.ready" run
  RMDir /r "$0"
  SetOutPath "$0"
  File /r "${STAGE}\*"
  FileOpen $1 "$0\.ready" w
  FileClose $1
run:
  Exec '"$0\${APPNAME}.exe" --portable'
SectionEnd
