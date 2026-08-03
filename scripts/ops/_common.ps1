# Shared helpers for EEARS ops scripts. Dot-source only; do not run directly.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EearsRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Write-EearsStep {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet('INFO', 'OK', 'WARN', 'ERROR', 'STEP')]
    [string]$Level = 'INFO'
  )
  $prefix = switch ($Level) {
    'OK' { '[OK]' }
    'WARN' { '[WARN]' }
    'ERROR' { '[ERROR]' }
    'STEP' { '[STEP]' }
    default { '[INFO]' }
  }
  $color = switch ($Level) {
    'OK' { 'Green' }
    'WARN' { 'Yellow' }
    'ERROR' { 'Red' }
    'STEP' { 'Cyan' }
    default { 'Gray' }
  }
  Write-Host "$prefix $Message" -ForegroundColor $color
}

function Assert-CommandExists {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found in PATH: $Name"
  }
}

function Invoke-EearsNpm {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string[]]$NpmArgs
  )
  Assert-CommandExists 'npm'
  Push-Location $WorkingDirectory
  try {
    & npm @NpmArgs
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($NpmArgs -join ' ') failed (exit $LASTEXITCODE) in $WorkingDirectory"
    }
  }
  finally {
    Pop-Location
  }
}

function Sync-EearsFrontendBuild {
  param(
    [Parameter(Mandatory = $true)][string]$SourceBuildDir,
    [Parameter(Mandatory = $true)][string]$TargetBuildDir
  )
  if (-not (Test-Path -LiteralPath (Join-Path $SourceBuildDir 'index.html'))) {
    throw "Frontend build missing index.html: $SourceBuildDir"
  }

  New-Item -ItemType Directory -Force -Path $TargetBuildDir | Out-Null

  # Robocopy: 0-7 = success with various copy outcomes
  $null = & robocopy $SourceBuildDir $TargetBuildDir /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1
  $code = $LASTEXITCODE
  if ($code -ge 8) {
    throw "robocopy failed syncing SPA build (exit $code): $SourceBuildDir -> $TargetBuildDir"
  }
  Write-EearsStep "SPA synced to $TargetBuildDir" -Level OK
}

function Test-EearsPm2App {
  param([string]$AppName = 'eears-backend')
  if (-not (Get-Command 'pm2' -ErrorAction SilentlyContinue)) {
    return $false
  }
  $listJson = & pm2 jlist 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($listJson)) {
    return $false
  }
  try {
    $apps = $listJson | ConvertFrom-Json
    return [bool]($apps | Where-Object { $_.name -eq $AppName })
  }
  catch {
    return $false
  }
}

function Restart-EearsBackendProcess {
  param(
    [Parameter(Mandatory = $true)][string]$BackendDir,
    [string]$AppName = 'eears-backend',
    [string]$EcosystemFile = ''
  )
  if (-not (Get-Command 'pm2' -ErrorAction SilentlyContinue)) {
    throw @"
PM2 is not installed or not in PATH.
Install once:
  npm install -g pm2
  npm install -g pm2-windows-startup   # optional, for boot persistence
Then run:
  powershell -File scripts\ops\setup-pm2.ps1
"@
  }

  if (Test-EearsPm2App -AppName $AppName) {
    Write-EearsStep "pm2 restart $AppName" -Level STEP
    & pm2 restart $AppName
    if ($LASTEXITCODE -ne 0) {
      throw "pm2 restart $AppName failed (exit $LASTEXITCODE)"
    }
  }
  else {
    if ([string]::IsNullOrWhiteSpace($EcosystemFile)) {
      $EcosystemFile = Join-Path $BackendDir 'ecosystem.config.cjs'
    }
    if (-not (Test-Path -LiteralPath $EcosystemFile)) {
      throw "PM2 app '$AppName' not found and ecosystem file missing: $EcosystemFile"
    }
    Write-EearsStep "pm2 start $EcosystemFile (first start)" -Level STEP
    & pm2 start $EcosystemFile
    if ($LASTEXITCODE -ne 0) {
      throw "pm2 start failed (exit $LASTEXITCODE)"
    }
    & pm2 save
  }

  Write-EearsStep "Backend process ready ($AppName)" -Level OK
}

function Wait-EearsApiReady {
  param(
    [string]$HealthUrl = 'http://127.0.0.1:3000/api/events',
    [int]$TimeoutSec = 60,
    [int]$IntervalSec = 2
  )
  Write-EearsStep "Waiting for API: $HealthUrl (timeout ${TimeoutSec}s)" -Level STEP
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Write-EearsStep "API responded HTTP $($resp.StatusCode)" -Level OK
        return
      }
    }
    catch {
      # keep polling
    }
    Start-Sleep -Seconds $IntervalSec
  }
  throw "API did not become ready within ${TimeoutSec}s: $HealthUrl"
}

function Invoke-EearsPostDeployCheck {
  param([Parameter(Mandatory = $true)][string]$BackendDir)
  Write-EearsStep 'Running post-deploy-check' -Level STEP
  Push-Location $BackendDir
  try {
    & npm run post-deploy-check
    if ($LASTEXITCODE -ne 0) {
      throw "post-deploy-check failed (exit $LASTEXITCODE)"
    }
  }
  finally {
    Pop-Location
  }
  Write-EearsStep 'post-deploy-check passed' -Level OK
}
