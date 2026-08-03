@echo off
REM EEARS full deploy wrapper (UTF-8). Prefer PowerShell entry for flags.
chcp 65001 >nul 2>&1
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy.ps1" %*
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo [ERROR] deploy failed with exit %ERR%
  exit /b %ERR%
)
echo [OK] deploy finished
exit /b 0
