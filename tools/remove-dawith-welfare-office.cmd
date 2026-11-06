@echo off
setlocal

rem Elevate only when Windows requires it for a protected install directory.
fltmc >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo Closing Dawith Welfare Office...
taskkill /F /T /IM "Dawith Welfare Office.exe" >nul 2>&1
taskkill /F /T /IM "Dawith Welfare Office Helper.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

for %%D in (
  "%LOCALAPPDATA%\Programs\Dawith Welfare Office"
  "%LOCALAPPDATA%\Programs\dawith-welfare-office"
  "%ProgramFiles%\Dawith Welfare Office"
  "%ProgramFiles(x86)%\Dawith Welfare Office"
) do (
  if exist "%%~D\uninstall.exe" start /wait "" "%%~D\uninstall.exe" /S
  if exist "%%~D" rd /S /Q "%%~D"
)

del /F /Q "%USERPROFILE%\Desktop\Dawith Welfare Office.lnk" >nul 2>&1
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dawith Welfare Office.lnk" >nul 2>&1

echo.
echo Dawith Welfare Office installation files were removed.
echo User data folders were not removed.
pause
