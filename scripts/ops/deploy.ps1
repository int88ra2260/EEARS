<#
.SYNOPSIS
  EEARS production deploy: build SPA, sync to backend/build, restart Node via PM2, health-check.

.DESCRIPTION
  Canonical Windows ops entry for frontend + backend publish under IIS → Node.

.PARAMETER SkipInstall
  Skip npm ci in frontend (and backend when -InstallBackendDeps).

.PARAMETER SkipBuild
  Reuse existing reservation-frontend/build (sync only).

.PARAMETER SkipRestart
  Do not restart PM2 (SPA-only sync; express.static reads disk).

.PARAMETER SkipHealthCheck
  Skip readiness wait and npm run post-deploy-check.

.PARAMETER InstallBackendDeps
  Run npm ci --omit=dev in reservation-backend before restart.

.PARAMETER FrontendOnly
  Build + sync SPA only; default skips restart and health check.

.PARAMETER HealthUrl
  URL polled until ready (default http://127.0.0.1:3000/api/events).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\deploy.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\deploy.ps1 -FrontendOnly
#>
[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$SkipRestart,
  [switch]$SkipHealthCheck,
  [switch]$InstallBackendDeps,
  [switch]$FrontendOnly,
  [string]$HealthUrl = 'http://127.0.0.1:3000/api/events',
  [int]$ReadyTimeoutSec = 60
)

$common = Join-Path $PSScriptRoot '_common.ps1'
. $common

if ($FrontendOnly) {
  # SPA sync only; express.static reads from disk (no Node restart required).
  $SkipRestart = $true
  $SkipHealthCheck = $true
}

$repoRoot = Get-EearsRepoRoot
$frontendDir = Join-Path $repoRoot 'reservation-frontend'
$backendDir = Join-Path $repoRoot 'reservation-backend'
$sourceBuild = Join-Path $frontendDir 'build'
$targetBuild = Join-Path $backendDir 'build'

Write-EearsStep "EEARS deploy starting (root=$repoRoot)" -Level STEP

foreach ($dir in @($frontendDir, $backendDir)) {
  if (-not (Test-Path -LiteralPath $dir)) {
    throw "Missing directory: $dir"
  }
}

if (-not $SkipInstall) {
  Write-EearsStep 'Frontend: npm ci' -Level STEP
  Invoke-EearsNpm -WorkingDirectory $frontendDir -NpmArgs @('ci')
}

if (-not $SkipBuild) {
  Write-EearsStep 'Frontend: npm run build' -Level STEP
  $env:NODE_ENV = 'production'
  Invoke-EearsNpm -WorkingDirectory $frontendDir -NpmArgs @('run', 'build')
}
else {
  Write-EearsStep 'SkipBuild: using existing frontend build' -Level WARN
}

Write-EearsStep 'Sync SPA → reservation-backend/build' -Level STEP
Sync-EearsFrontendBuild -SourceBuildDir $sourceBuild -TargetBuildDir $targetBuild

if ($InstallBackendDeps) {
  Write-EearsStep 'Backend: npm ci --omit=dev' -Level STEP
  Invoke-EearsNpm -WorkingDirectory $backendDir -NpmArgs @('ci', '--omit=dev')
}

if (-not $SkipRestart) {
  Restart-EearsBackendProcess -BackendDir $backendDir
}
else {
  Write-EearsStep 'SkipRestart: backend process left running' -Level WARN
}

if (-not $SkipHealthCheck) {
  Wait-EearsApiReady -HealthUrl $HealthUrl -TimeoutSec $ReadyTimeoutSec
  Invoke-EearsPostDeployCheck -BackendDir $backendDir
}
else {
  Write-EearsStep 'SkipHealthCheck: skipped readiness + post-deploy-check' -Level WARN
}

Write-EearsStep 'Deploy finished successfully' -Level OK
exit 0
