@echo off
REM EEARS backend restart wrapper.
chcp 65001 >nul 2>&1
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%restart-backend.ps1" %*
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo [ERROR] restart failed with exit %ERR%
  exit /b %ERR%
)
echo [OK] restart finished
exit /b 0
