@echo off
REM EEARS backend start — safe for Desktop shortcut (uses this script's folder, not cwd).
REM Create shortcut: right-click this file → Send to → Desktop (create shortcut). Do not copy the .bat.
chcp 65001 >nul 2>&1
setlocal
set "SCRIPT_DIR=%~dp0"

echo.
echo === EEARS backend start ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-backend.ps1" %*
set ERR=%ERRORLEVEL%

if not "%ERR%"=="0" (
  echo.
  echo [ERROR] start-backend failed with exit %ERR%
  echo.
  pause
  exit /b %ERR%
)

echo.
echo [OK] Backend start finished. Press any key to close.
echo.
pause
exit /b 0
