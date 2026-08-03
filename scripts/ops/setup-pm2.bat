@echo off
REM One-time PM2 setup for EEARS backend.
chcp 65001 >nul 2>&1
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-pm2.ps1" %*
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo [ERROR] setup-pm2 failed with exit %ERR%
  exit /b %ERR%
)
exit /b 0
