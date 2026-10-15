# backup-db-dump.ps1
param(
    [string]$EnvFile = "",
    [string]$OutputDir = "D:\EEARS_backup\local",
    [string]$Timestamp = ""
)
$ErrorActionPreference = "Stop"
if (-not $Timestamp) { $Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm" }
if (-not $EnvFile -or -not (Test-Path -LiteralPath $EnvFile)) { Write-Error ("Env file not found: {0}" -f $EnvFile); exit 2 }
# Parse .env (UTF-8)
Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    if ($line -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "activity_reservation" }
$dbPassword = if ($env:DB_PASSWORD -ne $null) { $env:DB_PASSWORD } else { "" }
# Select mysqldump: only from MYSQDUMP_PATH
if (-not $env:MYSQDUMP_PATH) { Write-Error "MYSQDUMP_PATH is not set."; exit 3 }
if (-not (Test-Path -LiteralPath $env:MYSQDUMP_PATH)) { Write-Error ("MYSQDUMP_PATH not found: {0}" -f $env:MYSQDUMP_PATH); exit 3 }
$dumpExe = $env:MYSQDUMP_PATH
if (-not (Test-Path -LiteralPath $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }
$tempDir = $env:TEMP
if ([string]::IsNullOrWhiteSpace($tempDir)) { $tempDir = [System.IO.Path]::GetTempPath() }
if (-not (Test-Path -LiteralPath $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }
$baseName = "eears_$Timestamp"
$sqlFile = Join-Path $OutputDir "$baseName.sql"
$gzFile = Join-Path $OutputDir "$baseName.sql.gz"
$stderrFile = Join-Path $tempDir "$baseName.mysqldump.stderr.txt"
Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
function Test-SqlFileOk { param([string]$Path) if (-not (Test-Path -LiteralPath $Path)) { return $false }; try { return ((Get-Item -LiteralPath $Path).Length -gt 0) } catch { return $false } }
$cnfPath = Join-Path $tempDir ("eears_my_" + [guid]::NewGuid().ToString("N") + ".cnf")
try {
    if ([string]::IsNullOrEmpty($dbPassword)) { $pwdLine = "password=" } else { $pwdEsc = $dbPassword.Replace("\", "\\").Replace('"', '\"'); $pwdLine = "password=`"$pwdEsc`"" }
    $cnfBody = "[client]`r`nuser=$dbUser`r`n$pwdLine`r`nhost=$dbHost`r`nport=$dbPort`r`ndefault-character-set=utf8mb4`r`n"
    [System.IO.File]::WriteAllText($cnfPath, $cnfBody, [System.Text.UTF8Encoding]::new($false))
} catch { Write-Error ("Failed to write temporary my.cnf. mysqldump_path='{0}'" -f $dumpExe); exit 4 }
try {
    # mysqldump opens the output file itself. PowerShell -RedirectStandardOutput
    # together with -NoNewWindow hands it a bad stdout handle and fails with
    # "Got errno 9 on write" (seen nightly from 2026-10-09).
    if (Test-Path -LiteralPath $sqlFile) { Remove-Item -LiteralPath $sqlFile -Force }
    $process = Start-Process -FilePath $dumpExe `
        -ArgumentList @(
            "--defaults-extra-file=$cnfPath",
            "--single-transaction",
            "--routines",
            "--triggers",
            "--result-file=$sqlFile",
            $dbName
        ) `
        -WindowStyle Hidden `
        -RedirectStandardError $stderrFile `
        -PassThru `
        -Wait

    $exitCode = $process.ExitCode
    $stderrTail = ""
    if (Test-Path -LiteralPath $stderrFile) {
        try {
            $stderrTail = (Get-Content -LiteralPath $stderrFile -ErrorAction SilentlyContinue | Select-Object -Last 20 | Out-String).Trim()
        } catch {
            $stderrTail = ""
        }
    }

    if (($exitCode -ne 0) -or (-not (Test-SqlFileOk $sqlFile))) {
        Write-Error ("mysqldump failed. mysqldump_path='{0}' sql_output='{1}' exit_code={2} stderr_tail='{3}'" -f $dumpExe, $sqlFile, $exitCode, $stderrTail)
        exit 5
    }
} finally {
    if (Test-Path -LiteralPath $cnfPath) { Remove-Item -LiteralPath $cnfPath -Force -ErrorAction SilentlyContinue }
}
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $tar) { $tar = Get-Command tar -ErrorAction SilentlyContinue }
if (-not $tar) { Write-Error "tar not found. Install tar (Windows 10 1803+ or Git for Windows)."; exit 6 }
$tarExe = $tar.Source; if (-not $tarExe) { $tarExe = $tar.Path }
& $tarExe -czf $gzFile $sqlFile
$tarExit = $LASTEXITCODE
if (($tarExit -ne 0) -or (-not (Test-Path -LiteralPath $gzFile)) -or ((Get-Item -LiteralPath $gzFile).Length -le 0)) { Write-Error ("tar failed. sql_output='{0}' gz_output='{1}' exit_code={2}" -f $sqlFile, $gzFile, $tarExit); exit 7 }
Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
Write-Output $gzFile
exit 0
