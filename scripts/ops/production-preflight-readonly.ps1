#Requires -Version 5.1
<#
.SYNOPSIS
  EEARS production preflight. Read-only. No repair.

.DESCRIPTION
  For a Windows Server administrator to review, then run manually.
  Console summary only. It does not write a report file.
  It does not deploy, restart services, change IIS or the firewall,
  read or write MySQL, or print DB_* values.

  Exit 0 means this run saw no FAIL, WARN, UNKNOWN, or NOT_AVAILABLE.
  Exit 0 is not Production Approved.
  UNKNOWN is not a pass. RESTORE_VERIFIED is always UNKNOWN.

.PARAMETER RepoRoot
  Explicit EEARS checkout to inspect. Default is D:\EEARS.
  The script does not search the disk and does not use its own folder.
  Alias: EearsRoot.

.PARAMETER ScheduledBackupDir
  Directory written by scripts/backup-db.bat. Default is D:\EEARS_backup\local.

.PARAMETER BackupDir
  Legacy directory written by reservation-backend/scripts/backup-database.js.
  Default is G:\ plus that script's folder name. This is not the scheduler output.

.PARAMETER ListenPort
  Port server.js uses when PORT is unset (3000).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File C:\AdminTools\production-preflight-readonly.ps1 -RepoRoot D:\EEARS
#>
[CmdletBinding()]
param(
  [Alias('EearsRoot')]
  [string]$RepoRoot = 'D:\EEARS',
  [string]$ScheduledBackupDir = 'D:\EEARS_backup\local',
  [string]$BackupDir = '',
  [int]$ListenPort = 3000
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Continue'

function ConvertFrom-DotenvText {
  param([AllowNull()][string]$Text)
  $parsed = @{}
  if ([string]::IsNullOrEmpty($Text)) { return $parsed }
  $normalized = ($Text -replace "`r`n", "`n") -replace "`r", "`n"
  $pattern = '(?m)^[ \t]*(?:export[ \t]+)?([\w.-]+)(?:[ \t]*=[ \t]*|[ \t]*:[ \t]+)([ \t]*''(?:\\''|[^''])*''|[ \t]*"(?:\\"|[^"])*"|[ \t]*`(?:\\`|[^`])*`|[^#\n]+)?'
  $regex = New-Object System.Text.RegularExpressions.Regex $pattern
  foreach ($match in $regex.Matches($normalized)) {
    $key = $match.Groups[1].Value
    $value = $match.Groups[2].Value
    if ($null -eq $value) { $value = '' }
    $value = $value.Trim()
    $quote = ''
    if ($value.Length -gt 0) { $quote = $value.Substring(0, 1) }
    if ($value.Length -ge 2 -and ($quote -eq '"' -or $quote -eq "'" -or $quote -eq '`') -and $value.EndsWith($quote)) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($quote -eq '"') {
      $value = $value.Replace('\n', "`n").Replace('\r', "`r")
    }
    $parsed[$key] = $value
  }
  return $parsed
}

function Get-DotenvSyncClass {
  param($Parsed)
  if ($null -eq $Parsed -or -not $Parsed.ContainsKey('ENABLE_DB_SYNC')) { return 'ABSENT' }
  $value = [string]$Parsed['ENABLE_DB_SYNC']
  if ($value.Length -eq 0) { return 'EMPTY' }
  if ([string]::Equals($value, 'true', [System.StringComparison]::Ordinal)) { return 'TRIGGERS' }
  return 'OTHER'
}

function Get-SyncCheckStatus {
  param(
    [string]$FileClass,
    [bool]$LiveProcessKnown = $false,
    [bool]$LiveValuePresent = $false,
    [AllowNull()][string]$LiveValue = $null
  )
  if ($FileClass -eq 'UNPARSED') { return 'UNKNOWN' }
  $liveTriggers = $LiveValuePresent -and [string]::Equals([string]$LiveValue, 'true', [System.StringComparison]::Ordinal)
  if ($LiveProcessKnown) {
    if ($liveTriggers) { return 'FAIL' }
    if ($LiveValuePresent) { return 'PASS' }
    if ($FileClass -eq 'TRIGGERS') { return 'FAIL' }
    return 'PASS'
  }
  if ($FileClass -eq 'TRIGGERS') { return 'FAIL' }
  return 'UNKNOWN'
}

function Get-PresenceLabel {
  param($Parsed, [string]$Key)
  if ($null -eq $Parsed -or -not $Parsed.ContainsKey($Key)) { return 'MISSING' }
  if ([string]::IsNullOrWhiteSpace([string]$Parsed[$Key])) { return 'EMPTY' }
  return 'SET'
}

function Get-HostClass {
  param($Parsed)
  $label = Get-PresenceLabel -Parsed $Parsed -Key 'DB_HOST'
  if ($label -ne 'SET') { return $label }
  $hostName = ([string]$Parsed['DB_HOST']).Trim().ToLowerInvariant()
  if ($hostName -eq 'localhost' -or $hostName -eq '127.0.0.1' -or $hostName -eq '::1') { return 'LOOPBACK' }
  return 'NOT_LOOPBACK'
}

function Get-ListenAssessment {
  param([bool]$QueryAvailable, [string[]]$Addresses)
  if (-not $QueryAvailable) {
    return [pscustomobject]@{ Status = 'NOT_AVAILABLE'; Detail = 'Get-NetTCPConnection is not available.' }
  }
  if ($null -eq $Addresses -or $Addresses.Count -eq 0) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'No listen address was returned.' }
  }
  $exposed = $false
  $loopbackOnly = $true
  foreach ($addr in $Addresses) {
    if ($addr -eq '0.0.0.0' -or $addr -eq '::' -or $addr -eq '[::]') { $exposed = $true; $loopbackOnly = $false }
    elseif ($addr -ne '127.0.0.1' -and $addr -ne '::1') { $loopbackOnly = $false }
  }
  if ($exposed) {
    return [pscustomobject]@{ Status = 'WARN'; Detail = 'Listens on 0.0.0.0 or ::. IIS rewrites only to 127.0.0.1. Network exposure is not fully assessed. Firewall was not changed.' }
  }
  if ($loopbackOnly) {
    return [pscustomobject]@{ Status = 'PASS'; Detail = 'Listen addresses are loopback only. This does not certify the firewall.' }
  }
  return [pscustomobject]@{ Status = 'WARN'; Detail = 'Listen address is not loopback-only. Network exposure is not fully assessed.' }
}

function Get-FirewallExposureAssessment {
  param([bool]$QueryAvailable, [bool]$QueryFailed, [bool]$SawExplicitInboundAllow)
  if (-not $QueryAvailable) {
    return [pscustomobject]@{ Status = 'NOT_AVAILABLE'; Detail = 'Firewall port filter cmdlet is not available. Rules were not changed.' }
  }
  if ($QueryFailed) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'Firewall query failed. Missing evidence is not a pass.' }
  }
  if ($SawExplicitInboundAllow) {
    return [pscustomobject]@{ Status = 'WARN'; Detail = 'An enabled inbound Allow rule matches this port exactly or by range. Rules were not changed.' }
  }
  return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'No exact or ranged inbound Allow for this port was found. Program rules, profiles, Group Policy, and any-port rules were not fully evaluated. This is not proof the port is closed.' }
}

function Get-EearsIisAssessment {
  param($Sites, [string]$ExpectedBuild)
  $expected = ''
  if (-not [string]::IsNullOrWhiteSpace($ExpectedBuild)) {
    $expected = $ExpectedBuild.Trim().TrimEnd('\').ToLowerInvariant()
  }
  $matches = @()
  foreach ($site in @($Sites)) {
    $path = ''
    if ($null -ne $site.PhysicalPath) { $path = ([string]$site.PhysicalPath).Trim().TrimEnd('\').ToLowerInvariant() }
    if ($path.Length -gt 0 -and $path -eq $expected) { $matches += $site }
  }
  if ($matches.Count -eq 0) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'No IIS site physical path matched reservation-backend\build. Other sites were not accepted as EEARS. Paths and bindings were not printed.' }
  }
  if ($matches.Count -gt 1) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'More than one IIS site matches the expected build directory. Paths and bindings were not printed.' }
  }
  $site = $matches[0]
  $state = [string]$site.State
  $poolState = [string]$site.PoolState
  $config = [string]$site.ConfigCompare
  if ($state -ne 'Started') {
    return [pscustomobject]@{ Status = 'FAIL'; Detail = 'The EEARS site is not Started. Paths and bindings were not printed.' }
  }
  if ($poolState -ne 'Started') {
    return [pscustomobject]@{ Status = 'FAIL'; Detail = 'The EEARS application pool is not Started. Paths and bindings were not printed.' }
  }
  if ($config -eq 'DIFFER') {
    return [pscustomobject]@{ Status = 'WARN'; Detail = 'Site and pool are Started, but live web.config differs from reservation-frontend/public/web.config. File text was not printed.' }
  }
  if ($config -ne 'MATCH') {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'Site and pool are Started, but web.config could not be compared. File text was not printed.' }
  }
  return [pscustomobject]@{ Status = 'PASS'; Detail = 'One site matches this RepoRoot build directory. Site and pool are Started. web.config matches. This does not prove the running PM2 process was started from this checkout.' }
}

function Get-Pm2Assessments {
  param(
    [bool]$CliPresent,
    [bool]$DumpReadable,
    [bool]$DumpNamesApp,
    [bool]$ProcessQueryFailed,
    [int]$LiveServerCount
  )
  $rows = @()
  if ($CliPresent) {
    $rows += [pscustomobject]@{ Id = 'PM2-CLI'; Status = 'PASS'; Detail = 'pm2 is on PATH. The CLI was not executed, so this does not prove a running daemon or app.' }
  }
  else {
    $rows += [pscustomobject]@{ Id = 'PM2-CLI'; Status = 'NOT_AVAILABLE'; Detail = 'pm2 was not found on PATH. The CLI was not started.' }
  }
  $rows += [pscustomobject]@{ Id = 'PM2-VERSION'; Status = 'UNKNOWN'; Detail = 'Version was not queried. A nearby package.json is not proof, and the pm2 CLI can start a daemon.' }
  if (-not $DumpReadable) {
    $rows += [pscustomobject]@{ Id = 'PM2-DUMP'; Status = 'UNKNOWN'; Detail = 'No readable PM2 dump for this user. A dump would only be saved configuration, not a live process.' }
  }
  elseif ($DumpNamesApp) {
    $rows += [pscustomobject]@{ Id = 'PM2-DUMP'; Status = 'UNKNOWN'; Detail = 'SAVED_CONFIG_ONLY. The dump mentions eears-backend. That does not mean the process is running. Dump text was not printed.' }
  }
  else {
    $rows += [pscustomobject]@{ Id = 'PM2-DUMP'; Status = 'UNKNOWN'; Detail = 'A PM2 dump was readable but did not name eears-backend. Dump text was not printed.' }
  }
  if ($ProcessQueryFailed) {
    $rows += [pscustomobject]@{ Id = 'PM2-LIVE'; Status = 'UNKNOWN'; Detail = 'Process list could not be read. Command lines were not printed.' }
  }
  elseif ($LiveServerCount -gt 1) {
    $rows += [pscustomobject]@{ Id = 'PM2-LIVE'; Status = 'FAIL'; Detail = 'More than one node process matches reservation-backend\server.js. A second process can repeat schedulers. Command lines were not printed.' }
  }
  elseif ($LiveServerCount -eq 1) {
    $rows += [pscustomobject]@{ Id = 'PM2-LIVE'; Status = 'UNKNOWN'; Detail = 'One node process matches server.js. The PM2 app name was not confirmed without the CLI. Command lines were not printed.' }
  }
  else {
    $rows += [pscustomobject]@{ Id = 'PM2-LIVE'; Status = 'UNKNOWN'; Detail = 'No node process matched reservation-backend\server.js. The process may be hidden from this user.' }
  }
  return $rows
}

function Get-RepoRootAssessment {
  param([bool]$PathExists, [bool]$HasServerJs)
  if (-not $PathExists) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'RepoRoot does not exist. The script did not search the disk and did not read an .env file.' }
  }
  if (-not $HasServerJs) {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'RepoRoot exists, but reservation-backend\server.js was not found. The directory was not accepted as an EEARS tree.' }
  }
  return [pscustomobject]@{ Status = 'PASS'; Detail = 'RepoRoot contains reservation-backend\server.js. Path existence is not proof that IIS or PM2 are serving this checkout.' }
}

function Get-BackupRuntimeAssessment {
  param([string]$OverrideLabel)
  $label = [string]$OverrideLabel
  if ($label -eq 'SET') {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'OPS_BACKUP_SCRIPT is set. The value was not printed. The default backup directory is not proof of the running producer.' }
  }
  if ($label -eq 'UNPARSED') {
    return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'OPS_BACKUP_SCRIPT could not be classified, and the live Node process environment was not read.' }
  }
  return [pscustomobject]@{ Status = 'UNKNOWN'; Detail = 'Repository default is scripts/backup-db.bat. The live process environment was not read, so runtime use of that default is not confirmed.' }
}

function Test-EearsBackupFileName {
  param([string]$Name)
  return [string]$Name -cmatch '^activity_reservation_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$'
}

function Test-ScheduledBackupFileName {
  param([string]$Name)
  return [string]$Name -cmatch '^eears_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.sql\.gz$'
}

function Get-SourceBackupRows {
  param(
    [string]$IdPrefix,
    [bool]$DirectoryPresent,
    $Files,
    [scriptblock]$NameTest,
    [string]$MissingDetail,
    [string]$EmptyDetail,
    [datetime]$NowUtc = ([datetime]::UtcNow),
    [bool]$DowngradeBecauseOverride = $false
  )
  if (-not $DirectoryPresent) {
    return @(
      [pscustomobject]@{ Id = ($IdPrefix + '_FILE_PRESENT'); Status = 'UNKNOWN'; Detail = $MissingDetail },
      [pscustomobject]@{ Id = ($IdPrefix + '_RECENT'); Status = 'UNKNOWN'; Detail = 'No timestamp was read because the directory was not available.' }
    )
  }
  $matched = @()
  foreach ($file in @($Files)) {
    if (& $NameTest ([string]$file.Name)) { $matched += $file }
  }
  if ($matched.Count -eq 0) {
    $status = 'FAIL'
    if ($DowngradeBecauseOverride) { $status = 'UNKNOWN' }
    return @(
      [pscustomobject]@{ Id = ($IdPrefix + '_FILE_PRESENT'); Status = $status; Detail = $EmptyDetail },
      [pscustomobject]@{ Id = ($IdPrefix + '_RECENT'); Status = 'UNKNOWN'; Detail = 'No name-matched file to date. Names were not printed.' }
    )
  }
  $plausible = @($matched | Where-Object { $_.Length -ge 1024 })
  if ($plausible.Count -eq 0) {
    return @(
      [pscustomobject]@{ Id = ($IdPrefix + '_FILE_PRESENT'); Status = 'WARN'; Detail = 'Name-matched files exist, but none are at least 1024 bytes. Contents were not opened. Names were not printed.' },
      [pscustomobject]@{ Id = ($IdPrefix + '_RECENT'); Status = 'WARN'; Detail = 'No plausible-sized file to treat as recent.' }
    )
  }
  $presentStatus = 'PASS'
  $presentDetail = 'count=' + $plausible.Count + '; bytes-of-newest-plausible=' + (@($plausible | Sort-Object LastWriteTimeUtc -Descending)[0].Length) + '. Names were not printed. This is not a restore test.'
  if ($DowngradeBecauseOverride) {
    $presentStatus = 'UNKNOWN'
    $presentDetail = 'Matching files exist, but OPS_BACKUP_SCRIPT is set, so this directory is not proof. Names and the override value were not printed.'
  }
  $recentSource = $plausible | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  $ageHours = ($NowUtc - [datetime]$recentSource.LastWriteTimeUtc).TotalHours
  $recentStatus = 'WARN'
  $recentDetail = 'Newest plausible file is ' + [math]::Round($ageHours, 1) + ' hours old.'
  if ($ageHours -le 36 -and -not $DowngradeBecauseOverride) {
    $recentStatus = 'PASS'
    $recentDetail = 'Newest plausible file is ' + [math]::Round($ageHours, 1) + ' hours old. This does not prove the running scheduler wrote it.'
  }
  elseif ($DowngradeBecauseOverride) {
    $recentStatus = 'UNKNOWN'
    $recentDetail = 'A timestamp exists, but the running producer path was overridden. The timestamp was not paired with a printed filename.'
  }
  return @(
    [pscustomobject]@{ Id = ($IdPrefix + '_FILE_PRESENT'); Status = $presentStatus; Detail = $presentDetail },
    [pscustomobject]@{ Id = ($IdPrefix + '_RECENT'); Status = $recentStatus; Detail = $recentDetail }
  )
}

function Get-RestoreVerifiedRow {
  return [pscustomobject]@{ Id = 'RESTORE_VERIFIED'; Status = 'UNKNOWN'; Detail = 'This script never restores a backup. A file on disk is not a tested restore.' }
}

function Get-PreflightExitCode {
  param([string[]]$Statuses)
  if ($null -eq $Statuses -or $Statuses.Count -eq 0) { return 2 }
  foreach ($status in $Statuses) {
    if ($status -eq 'FAIL') { return 1 }
  }
  foreach ($status in $Statuses) {
    if ($status -eq 'UNKNOWN' -or $status -eq 'NOT_AVAILABLE' -or $status -eq 'NOT_CHECKED' -or $status -eq 'WARN') {
      return 2
    }
  }
  return 0
}

function Add-Result {
  param([string]$Id, [string]$Status, [string]$Detail)
  $allowed = @('PASS', 'WARN', 'FAIL', 'UNKNOWN', 'NOT_CHECKED', 'NOT_AVAILABLE')
  if ($allowed -notcontains $Status) {
    $Status = 'UNKNOWN'
    $Detail = 'Unrecognized status was not treated as PASS. ' + $Detail
  }
  [void]$script:Results.Add([pscustomobject]@{ Id = $Id; Status = $Status; Detail = $Detail })
}

function Add-Assessment {
  param([string]$Id, $Assessment)
  Add-Result -Id $Id -Status $Assessment.Status -Detail $Assessment.Detail
}

if ($MyInvocation.InvocationName -eq '.') {
  return
}

$EearsRoot = $RepoRoot
if ([string]::IsNullOrWhiteSpace($BackupDir)) {
  $BackupDir = 'G:\' + [string]::Concat([char]0x8CC7, [char]0x6599, [char]0x593E, [char]0x5099, [char]0x4EFD)
}

$script:Results = New-Object System.Collections.Generic.List[object]
$script:RepoAccepted = $false
$script:BackupOverrideSet = $false

function Invoke-Check {
  param([string]$Id, [scriptblock]$Body)
  try { & $Body }
  catch { Add-Result -Id $Id -Status 'UNKNOWN' -Detail ('Check failed: ' + $_.Exception.Message) }
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host 'EEARS production preflight (read-only)'
Write-Host 'No deploy, no service change, no SQL, no firewall change, no report file.'
Write-Host ('RepoRoot=' + $RepoRoot)
Write-Host ('ScheduledBackupDir=' + $ScheduledBackupDir)
Write-Host ('LegacyBackupDir=' + $BackupDir)

$repoExists = Test-Path -LiteralPath $RepoRoot
$hasServerJs = $repoExists -and (Test-Path -LiteralPath (Join-Path $RepoRoot 'reservation-backend\server.js'))
Add-Assessment -Id 'REPO-ROOT' -Assessment (Get-RepoRootAssessment -PathExists $repoExists -HasServerJs $hasServerJs)
$script:RepoAccepted = $hasServerJs

if (Test-IsAdministrator) {
  Add-Result -Id 'HOST-ADMIN' -Status 'PASS' -Detail 'This window is elevated. Elevation is not used to change anything.'
}
else {
  Add-Result -Id 'HOST-ADMIN' -Status 'WARN' -Detail 'Not elevated. IIS, firewall, or TCP checks may return UNKNOWN.'
}

Invoke-Check -Id 'IIS' -Body {
  $service = Get-Service -Name 'W3SVC' -ErrorAction SilentlyContinue
  if (-not $service) {
    Add-Result -Id 'IIS-SERVICE' -Status 'NOT_AVAILABLE' -Detail 'W3SVC was not found. The script will not install IIS.'
    return
  }
  if ($service.Status -ne 'Running') {
    Add-Result -Id 'IIS-SERVICE' -Status 'FAIL' -Detail 'W3SVC is not running.'
    return
  }
  Add-Result -Id 'IIS-SERVICE' -Status 'PASS' -Detail 'W3SVC is running.'
  if (-not $script:RepoAccepted) {
    Add-Result -Id 'IIS-EEARS' -Status 'UNKNOWN' -Detail 'RepoRoot was not accepted, so no site path was compared. Other sites were not treated as EEARS.'
    return
  }
  if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Add-Result -Id 'IIS-EEARS' -Status 'NOT_AVAILABLE' -Detail 'WebAdministration is not installed. The EEARS site was not queried.'
    return
  }
  $previousLocation = Get-Location
  Import-Module WebAdministration -ErrorAction Stop
  Set-Location -LiteralPath $previousLocation
  $expectedBuild = Join-Path $EearsRoot 'reservation-backend\build'
  $repoConfig = Join-Path $EearsRoot 'reservation-frontend\public\web.config'
  $sites = @()
  foreach ($site in @(Get-Website)) {
    $poolState = 'Unknown'
    try { $poolState = [string](Get-WebAppPoolState -Name $site.ApplicationPool).Value } catch { $poolState = 'Unknown' }
    $configCompare = 'MISSING'
    $liveConfig = Join-Path ([string]$site.PhysicalPath) 'web.config'
    if ((Test-Path -LiteralPath $repoConfig) -and (Test-Path -LiteralPath $liveConfig)) {
      $repoNorm = ([System.IO.File]::ReadAllText($repoConfig) -replace "`r`n", "`n").Trim()
      $liveNorm = ([System.IO.File]::ReadAllText($liveConfig) -replace "`r`n", "`n").Trim()
      if ($repoNorm -eq $liveNorm -and $liveNorm.Contains('http://127.0.0.1:3000/')) { $configCompare = 'MATCH' }
      else { $configCompare = 'DIFFER' }
    }
    $sites += [pscustomobject]@{
      State          = [string]$site.State
      PoolState      = $poolState
      PhysicalPath   = [string]$site.PhysicalPath
      ConfigCompare  = $configCompare
    }
  }
  Add-Assessment -Id 'IIS-EEARS' -Assessment (Get-EearsIisAssessment -Sites $sites -ExpectedBuild $expectedBuild)
}

Invoke-Check -Id 'NODE' -Body {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Add-Result -Id 'NODE-VERSION' -Status 'NOT_AVAILABLE' -Detail 'node was not found on PATH.'
  }
  else {
    $version = & node -v
    Add-Result -Id 'NODE-VERSION' -Status 'PASS' -Detail ('node ' + $version)
  }
  $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  $dumpReadable = $false
  $dumpNamesApp = $false
  $dumpPath = Join-Path $env:USERPROFILE '.pm2\dump.pm2'
  if (Test-Path -LiteralPath $dumpPath) {
    $dumpReadable = $true
    $dumpText = [System.IO.File]::ReadAllText($dumpPath)
    if ($dumpText.Contains('"name":"eears-backend"') -or $dumpText.Contains('"name": "eears-backend"')) {
      $dumpNamesApp = $true
    }
  }
  $processFailed = $false
  $liveCount = 0
  try {
    $nodeProcs = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop)
    foreach ($proc in $nodeProcs) {
      $cmd = [string]$proc.CommandLine
      if ($cmd -like '*reservation-backend*server.js*') { $liveCount += 1 }
    }
  }
  catch { $processFailed = $true }
  foreach ($row in (Get-Pm2Assessments -CliPresent ([bool]$pm2) -DumpReadable $dumpReadable -DumpNamesApp $dumpNamesApp -ProcessQueryFailed $processFailed -LiveServerCount $liveCount)) {
    Add-Result -Id $row.Id -Status $row.Status -Detail $row.Detail
  }
}

Invoke-Check -Id 'PORT' -Body {
  $available = [bool](Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
  $addresses = @()
  if ($available) {
    $listeners = @(Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue)
    $addresses = @($listeners | ForEach-Object { [string]$_.LocalAddress } | Sort-Object -Unique)
  }
  Add-Assessment -Id 'PORT-LISTEN' -Assessment (Get-ListenAssessment -QueryAvailable $available -Addresses $addresses)
}

Invoke-Check -Id 'FIREWALL' -Body {
  $available = [bool](Get-Command Get-NetFirewallPortFilter -ErrorAction SilentlyContinue)
  $failed = $false
  $explicit = $false
  if ($available) {
    try {
      $filters = @(Get-NetFirewallPortFilter -ErrorAction Stop)
      foreach ($filter in $filters) {
        $ports = @([string[]]$filter.LocalPort)
        $hit = $false
        foreach ($port in $ports) {
          if ($port -eq [string]$ListenPort) { $hit = $true }
          if ($port -match '^(\d+)-(\d+)$') {
            $start = [int]$Matches[1]
            $end = [int]$Matches[2]
            if ($ListenPort -ge $start -and $ListenPort -le $end) { $hit = $true }
          }
        }
        if (-not $hit) { continue }
        $rule = Get-NetFirewallRule -AssociatedNetFirewallPortFilter $filter -ErrorAction SilentlyContinue
        if ($rule -and [string]$rule.Enabled -eq 'True' -and [string]$rule.Direction -eq 'Inbound' -and [string]$rule.Action -eq 'Allow') {
          $explicit = $true
        }
      }
    }
    catch { $failed = $true }
  }
  Add-Assessment -Id 'FIREWALL-3000' -Assessment (Get-FirewallExposureAssessment -QueryAvailable $available -QueryFailed $failed -SawExplicitInboundAllow $explicit)
}

Invoke-Check -Id 'MYSQL' -Body {
  $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*mysql*' -or $_.DisplayName -like '*mysql*' })
  if ($services.Count -eq 0) {
    Add-Result -Id 'MYSQL-SERVICE' -Status 'UNKNOWN' -Detail 'No Windows service name or display name contains mysql.'
  }
  else {
    $running = @($services | Where-Object { $_.Status -eq 'Running' }).Count
    $status = 'WARN'
    if ($running -ge 1) { $status = 'PASS' }
    Add-Result -Id 'MYSQL-SERVICE' -Status $status -Detail ('MySQL-like service count=' + $services.Count + '; running=' + $running + '. No connection was opened.')
  }
  $mysqld = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'mysqld.exe'" -ErrorAction SilentlyContinue)
  if ($mysqld.Count -ge 1) {
    Add-Result -Id 'MYSQL-PROCESS' -Status 'PASS' -Detail ('mysqld.exe count=' + $mysqld.Count + ' on this host. Command line was not printed.')
  }
  else {
    Add-Result -Id 'MYSQL-PROCESS' -Status 'UNKNOWN' -Detail 'mysqld.exe was not visible to this user.'
  }

  $envPath = Join-Path $EearsRoot 'reservation-backend\.env'
  $keys = @('DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')
  if (-not $script:RepoAccepted) {
    foreach ($key in $keys) { Add-Result -Id ('ENV-' + $key) -Status 'UNKNOWN' -Detail 'RepoRoot was not accepted. .env was not read.' }
    Add-Result -Id 'ENV-DB_HOST' -Status 'UNKNOWN' -Detail 'RepoRoot was not accepted. .env was not read.'
    Add-Result -Id 'ENV-ENABLE_DB_SYNC' -Status 'UNKNOWN' -Detail 'RepoRoot was not accepted. The live Node process environment was not read.'
    Add-Result -Id 'BACKUP-RUNTIME' -Status 'UNKNOWN' -Detail 'RepoRoot was not accepted. OPS_BACKUP_SCRIPT was not read.'
    return
  }
  if (-not (Test-Path -LiteralPath $envPath)) {
    foreach ($key in $keys) { Add-Result -Id ('ENV-' + $key) -Status 'FAIL' -Detail 'MISSING. .env file was not found. No values were read.' }
    Add-Result -Id 'ENV-DB_HOST' -Status 'FAIL' -Detail 'MISSING'
    Add-Result -Id 'ENV-ENABLE_DB_SYNC' -Status 'UNKNOWN' -Detail 'UNPARSED. .env file was not found, and the live Node process environment was not read.'
    Add-Result -Id 'BACKUP-RUNTIME' -Status 'UNKNOWN' -Detail 'UNPARSED. .env file was not found.'
    return
  }
  $overrideLabel = 'UNPARSED'
  try {
    $parsed = ConvertFrom-DotenvText -Text ([System.IO.File]::ReadAllText($envPath))
  }
  catch {
    foreach ($key in $keys) { Add-Result -Id ('ENV-' + $key) -Status 'UNKNOWN' -Detail 'UNPARSED. .env could not be read. No values were printed.' }
    Add-Result -Id 'ENV-DB_HOST' -Status 'UNKNOWN' -Detail 'UNPARSED'
    Add-Result -Id 'ENV-ENABLE_DB_SYNC' -Status 'UNKNOWN' -Detail 'UNPARSED. Live Node process environment was not read.'
    Add-Result -Id 'BACKUP-RUNTIME' -Status 'UNKNOWN' -Detail 'UNPARSED. .env could not be read.'
    return
  }
  $overrideLabel = Get-PresenceLabel -Parsed $parsed -Key 'OPS_BACKUP_SCRIPT'
  foreach ($key in $keys) {
    $label = Get-PresenceLabel -Parsed $parsed -Key $key
    $status = 'FAIL'
    if ($label -eq 'SET') { $status = 'PASS' }
    Add-Result -Id ('ENV-' + $key) -Status $status -Detail $label
  }
  $hostClass = Get-HostClass -Parsed $parsed
  $hostStatus = 'FAIL'
  if ($hostClass -eq 'LOOPBACK') { $hostStatus = 'PASS' }
  elseif ($hostClass -eq 'NOT_LOOPBACK') { $hostStatus = 'WARN' }
  Add-Result -Id 'ENV-DB_HOST' -Status $hostStatus -Detail $hostClass

  $fileClass = Get-DotenvSyncClass -Parsed $parsed
  $syncStatus = Get-SyncCheckStatus -FileClass $fileClass -LiveProcessKnown $false
  $syncDetail = 'File class ' + $fileClass + '. server.js calls dotenv.config() without override, then uses ENABLE_DB_SYNC === true. The live eears-backend process environment was not read, so only an exact file value of true is FAIL. Any other file result stays UNKNOWN.'
  Add-Result -Id 'ENV-ENABLE_DB_SYNC' -Status $syncStatus -Detail $syncDetail
  Add-Assessment -Id 'BACKUP-RUNTIME' -Assessment (Get-BackupRuntimeAssessment -OverrideLabel $overrideLabel)
  $script:BackupOverrideSet = ($overrideLabel -eq 'SET')
  Add-Result -Id 'MYSQL-SCHEMA' -Status 'UNKNOWN' -Detail 'MANUAL_VERIFICATION_REQUIRED. This script does not connect or compare schema.'
}

Invoke-Check -Id 'RUNNER' -Body {
  $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'actions.runner*' })
  if ($services.Count -eq 0) {
    Add-Result -Id 'RUNNER-SERVICE' -Status 'UNKNOWN' -Detail 'No service named actions.runner* was found. Token files were not read.'
  }
  else {
    $running = @($services | Where-Object { $_.Status -eq 'Running' }).Count
    $status = 'UNKNOWN'
    if ($running -ge 1) { $status = 'WARN' }
    Add-Result -Id 'RUNNER-SERVICE' -Status $status -Detail ('actions.runner count=' + $services.Count + '; running=' + $running + '. A running runner can deploy after CI succeeds on main. Credentials were not read.')
  }
  if (Test-Path -LiteralPath 'C:\actions\actions-runner') {
    Add-Result -Id 'RUNNER-PATH' -Status 'PASS' -Detail 'Documented runner directory exists. Credential files were not opened.'
  }
  else {
    Add-Result -Id 'RUNNER-PATH' -Status 'UNKNOWN' -Detail 'C:\actions\actions-runner was not found. Another path is still possible.'
  }
  $deploying = 0
  foreach ($proc in @(Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue)) {
    $cmd = [string]$proc.CommandLine
    if ($cmd -like '*scripts\ops\deploy.ps1*') { $deploying += 1 }
  }
  if ($deploying -eq 0) {
    Add-Result -Id 'DEPLOY-IN-PROGRESS' -Status 'PASS' -Detail 'No process command line referenced deploy.ps1. Command lines were not printed.'
  }
  else {
    Add-Result -Id 'DEPLOY-IN-PROGRESS' -Status 'FAIL' -Detail ('A deploy-looking process count=' + $deploying)
  }
}

Invoke-Check -Id 'BACKUP' -Body {
  $scheduledFiles = @()
  $scheduledPresent = Test-Path -LiteralPath $ScheduledBackupDir
  if ($scheduledPresent) {
    $scheduledFiles = @(Get-ChildItem -LiteralPath $ScheduledBackupDir -File -ErrorAction Stop | ForEach-Object {
        [pscustomobject]@{ Name = $_.Name; Length = $_.Length; LastWriteTimeUtc = $_.LastWriteTimeUtc }
      })
  }
  foreach ($row in (Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $scheduledPresent -Files $scheduledFiles -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'Scheduled backup directory was not found. The script did not search other drives. OPS_BACKUP_SCRIPT may point elsewhere.' -EmptyDetail 'Scheduled directory exists, but no eears_yyyy-MM-dd_HH-mm.sql.gz file matched. Other extensions were ignored. Names were not printed.' -DowngradeBecauseOverride ([bool]$script:BackupOverrideSet))) {
    Add-Result -Id $row.Id -Status $row.Status -Detail $row.Detail
  }

  $legacyFiles = @()
  $legacyPresent = Test-Path -LiteralPath $BackupDir
  if ($legacyPresent) {
    $legacyFiles = @(Get-ChildItem -LiteralPath $BackupDir -File -ErrorAction Stop | ForEach-Object {
        [pscustomobject]@{ Name = $_.Name; Length = $_.Length; LastWriteTimeUtc = $_.LastWriteTimeUtc }
      })
  }
  foreach ($row in (Get-SourceBackupRows -IdPrefix 'BACKUP_LEGACY' -DirectoryPresent $legacyPresent -Files $legacyFiles -NameTest { param($Name) Test-EearsBackupFileName -Name $Name } -MissingDetail 'Legacy backup-database.js directory was not found. That script is not the scheduler. Absence is not proof the scheduled backup is missing.' -EmptyDetail 'Legacy directory exists, but no activity_reservation_backup_YYYY-MM-DD_HH-MM-SS.sql file matched. .txt and .gz were not counted. Names were not printed.' -DowngradeBecauseOverride $false)) {
    Add-Result -Id $row.Id -Status $row.Status -Detail $row.Detail
  }
  $restore = Get-RestoreVerifiedRow
  Add-Result -Id $restore.Id -Status $restore.Status -Detail $restore.Detail
}

Invoke-Check -Id 'CAPACITY' -Body {
  foreach ($letter in @('C:', 'D:', 'G:')) {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter ("DeviceID = '" + $letter + "'") -ErrorAction SilentlyContinue
    if (-not $disk) {
      Add-Result -Id ('DISK-' + $letter.TrimEnd(':')) -Status 'UNKNOWN' -Detail 'Drive was not returned by Win32_LogicalDisk.'
      continue
    }
    $freeGb = [math]::Round($disk.FreeSpace / 1GB, 2)
    $sizeGb = [math]::Round($disk.Size / 1GB, 2)
    $status = 'PASS'
    if ($freeGb -lt 5) { $status = 'WARN' }
    Add-Result -Id ('DISK-' + $letter.TrimEnd(':')) -Status $status -Detail ('freeGiB=' + $freeGb + '; sizeGiB=' + $sizeGb)
  }
  $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
  if ($os) {
    Add-Result -Id 'MEMORY' -Status 'PASS' -Detail ('totalGiB=' + [math]::Round($os.TotalVisibleMemorySize / 1MB, 2) + '; freeGiB=' + [math]::Round($os.FreePhysicalMemory / 1MB, 2))
  }
  else {
    Add-Result -Id 'MEMORY' -Status 'UNKNOWN' -Detail 'Win32_OperatingSystem was not readable.'
  }
  $cpu = @(Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue)
  if ($cpu.Count -ge 1) {
    $logical = ($cpu | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
    Add-Result -Id 'CPU' -Status 'PASS' -Detail ('logical=' + $logical)
  }
  else {
    Add-Result -Id 'CPU' -Status 'UNKNOWN' -Detail 'Win32_Processor was not readable.'
  }
}

$statuses = @($script:Results | ForEach-Object { [string]$_.Status })
$exitCode = Get-PreflightExitCode -Statuses $statuses
Write-Host ''
Write-Host 'ID | STATUS | DETAIL'
foreach ($row in $script:Results) {
  Write-Host ($row.Id + ' | ' + $row.Status + ' | ' + $row.Detail)
}
Write-Host ''
Write-Host ('Summary exit=' + $exitCode + ' total=' + $script:Results.Count)
Write-Host 'Exit 0 = no FAIL, WARN, UNKNOWN, or NOT_AVAILABLE. Exit 1 = FAIL. Exit 2 = UNKNOWN, NOT_AVAILABLE, or WARN.'
Write-Host 'Exit 0 is not Production Approved, not SERVER_PREFLIGHT_PASSED, and not a release authorization.'
Write-Host 'UNKNOWN is not PASS. RESTORE_VERIFIED is UNKNOWN. ROLLBACK was not run.'
exit $exitCode
