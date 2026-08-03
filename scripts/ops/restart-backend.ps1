<#
.SYNOPSIS
  Restart EEARS backend via PM2 (eears-backend).

.PARAMETER SkipHealthCheck
  Do not wait for API or run post-deploy-check.

.PARAMETER HealthUrl
  URL polled until ready.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\restart-backend.ps1
#>
[CmdletBinding()]
param(
  [switch]$SkipHealthCheck,
  [string]$HealthUrl = 'http://127.0.0.1:3000/api/events',
  [int]$ReadyTimeoutSec = 60
)

$common = Join-Path $PSScriptRoot '_common.ps1'
. $common

$repoRoot = Get-EearsRepoRoot
$backendDir = Join-Path $repoRoot 'reservation-backend'

Write-EearsStep 'EEARS backend restart' -Level STEP
Restart-EearsBackendProcess -BackendDir $backendDir

if (-not $SkipHealthCheck) {
  Wait-EearsApiReady -HealthUrl $HealthUrl -TimeoutSec $ReadyTimeoutSec
  Invoke-EearsPostDeployCheck -BackendDir $backendDir
}

Write-EearsStep 'Restart finished successfully' -Level OK
exit 0
