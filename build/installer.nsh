; Close an existing Dawith Welfare Office process before replacing its files.
; This prevents the NSIS upgrade step from stopping at the generic
; "application is running" dialog when Electron is still shutting down.
!macro customInit
  nsExec::ExecToLog '"$SYSDIR\\taskkill.exe" /F /T /IM "Dawith Welfare Office.exe"'
  Pop $0
  Sleep 1200
  ; Electron can leave a renderer child alive briefly. Retry before the
  ; default electron-builder process check runs in the install section.
  nsExec::ExecToLog '"$SYSDIR\\taskkill.exe" /F /T /IM "Dawith Welfare Office.exe"'
  Pop $0
  Sleep 1200
!macroend
