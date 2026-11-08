# Synthetic checks for preflight decisions. Does not run the host preflight body.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'production-preflight-readonly.ps1')
$ErrorActionPreference = 'Stop'

$failed = 0
$passed = 0
function Assert-Equal {
  param($Name, $Actual, $Expected)
  if ([string]$Actual -ne [string]$Expected) {
    Write-Host ("FAIL " + $Name + " actual=" + $Actual + " expected=" + $Expected)
    $script:failed += 1
  }
  else {
    $script:passed += 1
  }
}

function Sync-Class([string]$Text) {
  return Get-DotenvSyncClass -Parsed (ConvertFrom-DotenvText -Text $Text)
}

Assert-Equal 'sync true' (Sync-Class "ENABLE_DB_SYNC=true") 'TRIGGERS'
Assert-Equal 'sync TRUE is not js true' (Sync-Class "ENABLE_DB_SYNC=TRUE") 'OTHER'
Assert-Equal 'sync comment' (Sync-Class "ENABLE_DB_SYNC=true # temporary") 'TRIGGERS'
Assert-Equal 'sync double quotes' (Sync-Class 'ENABLE_DB_SYNC="true"') 'TRIGGERS'
Assert-Equal 'sync single quotes' (Sync-Class "ENABLE_DB_SYNC='true'") 'TRIGGERS'
Assert-Equal 'sync empty' (Sync-Class "ENABLE_DB_SYNC=") 'EMPTY'
Assert-Equal 'sync missing' (Sync-Class "DB_HOST=127.0.0.1") 'ABSENT'
Assert-Equal 'sync last key triggers' (Sync-Class "ENABLE_DB_SYNC=false`nENABLE_DB_SYNC=true") 'TRIGGERS'
Assert-Equal 'sync last key safe file' (Sync-Class "ENABLE_DB_SYNC=true`nENABLE_DB_SYNC=false") 'OTHER'

Assert-Equal 'file true is fail' (Get-SyncCheckStatus -FileClass 'TRIGGERS' -LiveProcessKnown $false) 'FAIL'
Assert-Equal 'file TRUE stays unknown' (Get-SyncCheckStatus -FileClass 'OTHER' -LiveProcessKnown $false) 'UNKNOWN'
Assert-Equal 'file empty stays unknown' (Get-SyncCheckStatus -FileClass 'EMPTY' -LiveProcessKnown $false) 'UNKNOWN'
Assert-Equal 'file absent stays unknown' (Get-SyncCheckStatus -FileClass 'ABSENT' -LiveProcessKnown $false) 'UNKNOWN'
Assert-Equal 'unparsed stays unknown' (Get-SyncCheckStatus -FileClass 'UNPARSED' -LiveProcessKnown $false) 'UNKNOWN'
Assert-Equal 'live true fails even if file does not' (Get-SyncCheckStatus -FileClass 'OTHER' -LiveProcessKnown $true -LiveValuePresent $true -LiveValue 'true') 'FAIL'
Assert-Equal 'live TRUE does not trigger' (Get-SyncCheckStatus -FileClass 'TRIGGERS' -LiveProcessKnown $true -LiveValuePresent $true -LiveValue 'TRUE') 'PASS'

$secret = 'super-secret-value'
$parsedSecret = ConvertFrom-DotenvText -Text ("DB_PASSWORD=" + $secret + " # note")
Assert-Equal 'password set' (Get-PresenceLabel -Parsed $parsedSecret -Key 'DB_PASSWORD') 'SET'
if ((Get-PresenceLabel -Parsed $parsedSecret -Key 'DB_PASSWORD') -like ('*' + $secret + '*')) {
  Write-Host 'FAIL password label leaked'
  $script:failed += 1
}
else { $script:passed += 1 }
$loop = ConvertFrom-DotenvText -Text "DB_HOST=127.0.0.1"
Assert-Equal 'host loopback' (Get-HostClass -Parsed $loop) 'LOOPBACK'
if ((Get-HostClass -Parsed (ConvertFrom-DotenvText -Text "DB_HOST=db.internal")) -eq 'db.internal') {
  Write-Host 'FAIL host value leaked'
  $script:failed += 1
}
else { $script:passed += 1 }

Assert-Equal 'firewall missing cmdlet' (Get-FirewallExposureAssessment -QueryAvailable $false -QueryFailed $false -SawExplicitInboundAllow $false).Status 'NOT_AVAILABLE'
Assert-Equal 'firewall query failed' (Get-FirewallExposureAssessment -QueryAvailable $true -QueryFailed $true -SawExplicitInboundAllow $false).Status 'UNKNOWN'
Assert-Equal 'firewall no match is not pass' (Get-FirewallExposureAssessment -QueryAvailable $true -QueryFailed $false -SawExplicitInboundAllow $false).Status 'UNKNOWN'
Assert-Equal 'firewall explicit allow warns' (Get-FirewallExposureAssessment -QueryAvailable $true -QueryFailed $false -SawExplicitInboundAllow $true).Status 'WARN'
Assert-Equal 'listen all interfaces warns' (Get-ListenAssessment -QueryAvailable $true -Addresses @('0.0.0.0')).Status 'WARN'

$stopped = Get-EearsIisAssessment -ExpectedBuild 'D:\EEARS\reservation-backend\build' -Sites @([pscustomobject]@{ State = 'Stopped'; PoolState = 'Started'; PhysicalPath = 'D:\EEARS\reservation-backend\build'; ConfigCompare = 'MATCH' })
Assert-Equal 'iis stopped is not pass' $stopped.Status 'FAIL'
$unknownSite = Get-EearsIisAssessment -ExpectedBuild 'D:\EEARS\reservation-backend\build' -Sites @([pscustomobject]@{ State = 'Started'; PoolState = 'Started'; PhysicalPath = 'D:\Other'; ConfigCompare = 'MATCH' })
Assert-Equal 'other iis site is unknown' $unknownSite.Status 'UNKNOWN'

$pm2 = Get-Pm2Assessments -CliPresent $true -DumpReadable $true -DumpNamesApp $true -ProcessQueryFailed $false -LiveServerCount 0
$dump = @($pm2 | Where-Object { $_.Id -eq 'PM2-DUMP' })[0]
$live = @($pm2 | Where-Object { $_.Id -eq 'PM2-LIVE' })[0]
$version = @($pm2 | Where-Object { $_.Id -eq 'PM2-VERSION' })[0]
Assert-Equal 'dump is not a running pass' $dump.Status 'UNKNOWN'
Assert-Equal 'no live process is unknown' $live.Status 'UNKNOWN'
Assert-Equal 'version not confirmed' $version.Status 'UNKNOWN'
$two = @((Get-Pm2Assessments -CliPresent $true -DumpReadable $false -DumpNamesApp $false -ProcessQueryFailed $false -LiveServerCount 2) | Where-Object { $_.Id -eq 'PM2-LIVE' })[0]
Assert-Equal 'two backends fail' $two.Status 'FAIL'

$now = [datetime]::Parse('2026-11-04T12:00:00Z')
$notesOnly = Get-SourceBackupRows -IdPrefix 'BACKUP_LEGACY' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-EearsBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'no legacy sql' -Files @([pscustomobject]@{ Name = 'notes.txt'; Length = 5000; LastWriteTimeUtc = $now })
Assert-Equal 'txt is not a backup' (@($notesOnly | Where-Object { $_.Id -eq 'BACKUP_LEGACY_FILE_PRESENT' })[0].Status) 'FAIL'
$restore = Get-RestoreVerifiedRow
Assert-Equal 'restore stays unknown' $restore.Status 'UNKNOWN'
$goodSql = Get-SourceBackupRows -IdPrefix 'BACKUP_LEGACY' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-EearsBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'empty' -Files @([pscustomobject]@{ Name = 'activity_reservation_backup_2026-11-04_02-00-00.sql'; Length = 4096; LastWriteTimeUtc = $now.AddHours(-2) })
Assert-Equal 'named sql present' (@($goodSql | Where-Object { $_.Id -eq 'BACKUP_LEGACY_FILE_PRESENT' })[0].Status) 'PASS'
Assert-Equal 'named sql recent' (@($goodSql | Where-Object { $_.Id -eq 'BACKUP_LEGACY_RECENT' })[0].Status) 'PASS'
if ((@($goodSql | Where-Object { $_.Id -eq 'BACKUP_LEGACY_FILE_PRESENT' })[0].Detail) -like '*activity_reservation_backup_2026*') {
  Write-Host 'FAIL backup name leaked'
  $script:failed += 1
}
else { $script:passed += 1 }

$goodGz = Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'empty' -Files @([pscustomobject]@{ Name = 'eears_2026-11-04_02-00.sql.gz'; Length = 4096; LastWriteTimeUtc = $now.AddHours(-2) })
Assert-Equal 'scheduled gz present' (@($goodGz | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_FILE_PRESENT' })[0].Status) 'PASS'
Assert-Equal 'scheduled gz recent' (@($goodGz | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_RECENT' })[0].Status) 'PASS'
$otherGz = Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'no scheduled name' -Files @([pscustomobject]@{ Name = 'other.sql.gz'; Length = 4096; LastWriteTimeUtc = $now })
Assert-Equal 'arbitrary gz is not scheduled backup' (@($otherGz | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_FILE_PRESENT' })[0].Status) 'FAIL'
$oldGz = Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'empty' -Files @([pscustomobject]@{ Name = 'eears_2026-11-01_02-00.sql.gz'; Length = 4096; LastWriteTimeUtc = $now.AddHours(-80) })
Assert-Equal 'old gz is not recent' (@($oldGz | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_RECENT' })[0].Status) 'WARN'
$emptyDir = Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $true -NowUtc $now -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'missing' -EmptyDetail 'empty dir' -Files @()
Assert-Equal 'empty backup dir' (@($emptyDir | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_FILE_PRESENT' })[0].Status) 'FAIL'
$missingDir = Get-SourceBackupRows -IdPrefix 'BACKUP_SCHEDULED' -DirectoryPresent $false -NowUtc $now -NameTest { param($Name) Test-ScheduledBackupFileName -Name $Name } -MissingDetail 'dir missing' -EmptyDetail 'empty' -Files @()
Assert-Equal 'missing backup dir is unknown' (@($missingDir | Where-Object { $_.Id -eq 'BACKUP_SCHEDULED_FILE_PRESENT' })[0].Status) 'UNKNOWN'
Assert-Equal 'runtime source stays unknown' (Get-BackupRuntimeAssessment -OverrideLabel 'MISSING').Status 'UNKNOWN'
Assert-Equal 'override does not pass default dir' (Get-BackupRuntimeAssessment -OverrideLabel 'SET').Status 'UNKNOWN'
Assert-Equal 'repo root missing' (Get-RepoRootAssessment -PathExists $false -HasServerJs $false).Status 'UNKNOWN'
Assert-Equal 'repo root wrong tree' (Get-RepoRootAssessment -PathExists $true -HasServerJs $false).Status 'UNKNOWN'
Assert-Equal 'repo root shape is not runtime proof' (Get-RepoRootAssessment -PathExists $true -HasServerJs $true).Status 'PASS'
if ((Get-RepoRootAssessment -PathExists $true -HasServerJs $true).Detail -notlike '*not proof*') {
  Write-Host 'FAIL repo detail omitted runtime limit'
  $script:failed += 1
}
else { $script:passed += 1 }
$scriptBody = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'production-preflight-readonly.ps1') -Raw
if ($scriptBody -match '\$PSScriptRoot') {
  Write-Host 'FAIL script depends on its own directory'
  $script:failed += 1
}
else { $script:passed += 1 }
Assert-Equal 'permission failure stays unknown' (Get-FirewallExposureAssessment -QueryAvailable $true -QueryFailed $true -SawExplicitInboundAllow $false).Status 'UNKNOWN'

Assert-Equal 'unknown exit is 2' (Get-PreflightExitCode -Statuses @('PASS', 'UNKNOWN')) 2
Assert-Equal 'warn exit is 2' (Get-PreflightExitCode -Statuses @('PASS', 'WARN')) 2
Assert-Equal 'not available exit is 2' (Get-PreflightExitCode -Statuses @('NOT_AVAILABLE')) 2
Assert-Equal 'fail wins' (Get-PreflightExitCode -Statuses @('FAIL', 'UNKNOWN')) 1
Assert-Equal 'clean exit is 0' (Get-PreflightExitCode -Statuses @('PASS', 'PASS')) 0
if ((Get-PreflightExitCode -Statuses @('PASS')) -eq 0) { $script:passed += 1 } else { $script:failed += 1 }

Write-Host ("passed=" + $passed + " failed=" + $failed)
if ($failed -gt 0) { exit 1 }
exit 0
