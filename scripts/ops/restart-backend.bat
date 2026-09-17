@echo off
REM EEARS backend restart — desktop-shortcut friendly (keeps window open so you can see result).
chcp 65001 >nul 2>&1
setlocal
set "SCRIPT_DIR=%~dp0"

echo.
echo === EEARS backend restart ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%restart-backend.ps1" %*
set ERR=%ERRORLEVEL%

echo.
if not "%ERR%"=="0" (
  echo [ERROR] restart failed with exit %ERR%
  echo         Check window messages above, or run: pm2 logs eears-backend
  echo.
  pause
  exit /b %ERR%
)

echo [OK] restart finished — backend should be online.
echo      You can close this window.
echo.
pause
exit /b 0
