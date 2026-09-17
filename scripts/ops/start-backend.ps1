<#
.SYNOPSIS
  Start or restart EEARS backend (desktop-shortcut friendly).

.DESCRIPTION
  Prefers PM2 (eears-backend). If PM2 is not installed / not registered,
  falls back to foreground `node server.js` (same as manual start).

.PARAMETER SkipHealthCheck
  Skip API ready wait + post-deploy-check (PM2 path only).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\start-backend.ps1
#>
[CmdletBinding()]
param(
  [switch]$SkipHealthCheck,
  [string]$HealthUrl = 'http://127.0.0.1:3000/api/events',
  [int]$ReadyTimeoutSec = 60
)

$ErrorActionPreference = 'Stop'

$common = Join-Path $PSScriptRoot '_common.ps1'
. $common

Ensure-EearsOpsPath

$repoRoot = Get-EearsRepoRoot
$backendDir = Join-Path $repoRoot 'reservation-backend'
$envFile = Join-Path $backendDir '.env'
$serverJs = Join-Path $backendDir 'server.js'

if (-not (Test-Path -LiteralPath $serverJs)) {
  throw "Missing server.js: $serverJs"
}
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing backend .env (copy from .env.example first): $envFile"
}

Assert-CommandExists 'node'

$hasPm2 = [bool](Get-Command 'pm2' -ErrorAction SilentlyContinue)

if ($hasPm2) {
  Write-EearsStep 'EEARS backend start (PM2)' -Level STEP
  Restart-EearsBackendProcess -BackendDir $backendDir

  if (-not $SkipHealthCheck) {
    Wait-EearsApiReady -HealthUrl $HealthUrl -TimeoutSec $ReadyTimeoutSec
    Invoke-EearsPostDeployCheck -BackendDir $backendDir
  }

  Write-EearsStep 'Backend is running under PM2 (window can be closed)' -Level OK
  & pm2 status
  exit 0
}

Write-EearsStep 'PM2 not found; starting foreground node server.js' -Level WARN
Write-Host '  Tip: for background + reboot persistence, run scripts\ops\setup-pm2.bat once.'
Write-Host ''

Push-Location $backendDir
try {
  & node server.js
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
