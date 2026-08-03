<#
.SYNOPSIS
  One-time PM2 registration for EEARS backend on Windows.

.DESCRIPTION
  Starts reservation-backend/ecosystem.config.cjs as eears-backend, saves process list,
  and prints guidance for boot persistence (pm2-windows-startup).

.PARAMETER Force
  Delete existing eears-backend app (if any) and start fresh from ecosystem file.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\setup-pm2.ps1
#>
[CmdletBinding()]
param(
  [switch]$Force
)

$common = Join-Path $PSScriptRoot '_common.ps1'
. $common

Assert-CommandExists 'npm'
Assert-CommandExists 'node'

if (-not (Get-Command 'pm2' -ErrorAction SilentlyContinue)) {
  Write-EearsStep 'Installing pm2 globally...' -Level STEP
  & npm install -g pm2
  if ($LASTEXITCODE -ne 0) {
    throw 'npm install -g pm2 failed'
  }
}

$repoRoot = Get-EearsRepoRoot
$backendDir = Join-Path $repoRoot 'reservation-backend'
$ecosystem = Join-Path $backendDir 'ecosystem.config.cjs'
$envFile = Join-Path $backendDir '.env'

if (-not (Test-Path -LiteralPath $ecosystem)) {
  throw "Missing ecosystem file: $ecosystem"
}
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing backend .env (copy from .env.example first): $envFile"
}

Push-Location $backendDir
try {
  if ($Force -and (Test-EearsPm2App)) {
    Write-EearsStep 'Force: pm2 delete eears-backend' -Level WARN
    & pm2 delete eears-backend | Out-Null
  }

  if (Test-EearsPm2App) {
    Write-EearsStep 'App already registered; restarting' -Level STEP
    & pm2 restart eears-backend
  }
  else {
    Write-EearsStep "pm2 start $ecosystem" -Level STEP
    & pm2 start $ecosystem
  }

  if ($LASTEXITCODE -ne 0) {
    throw "pm2 start/restart failed (exit $LASTEXITCODE)"
  }

  & pm2 save
  if ($LASTEXITCODE -ne 0) {
    throw "pm2 save failed (exit $LASTEXITCODE)"
  }
}
finally {
  Pop-Location
}

Write-EearsStep 'PM2 status:' -Level INFO
& pm2 status

Write-Host ''
Write-EearsStep 'Boot persistence (run once as Administrator if needed):' -Level INFO
Write-Host '  npm install -g pm2-windows-startup'
Write-Host '  pm2-startup install'
Write-Host '  pm2 save'
Write-Host ''
Write-EearsStep 'Daily commands:' -Level INFO
Write-Host '  pm2 restart eears-backend'
Write-Host '  pm2 logs eears-backend'
Write-Host '  powershell -File scripts\ops\restart-backend.ps1'
Write-Host '  powershell -File scripts\ops\deploy.ps1'
Write-Host ''
Write-EearsStep 'setup-pm2 finished' -Level OK
exit 0
