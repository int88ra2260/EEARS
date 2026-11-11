# Keep three Vercel skills on-demand.
# Cursor 3.27 treats every workspace AGENTS.md as an always-applied rule.
# These packages ship a compiled AGENTS.md beside SKILL.md. This script
# renames that file and points the skill at the new relative path.
#
# This checkout does not include those packages' package.json or build
# sources. Do not claim that pnpm build was run here.
#
# After a third-party reinstall or update (for example npx skills add):
# 1. powershell -NoProfile -File .agents/normalize-vercel-skill-packaging.ps1
# 2. powershell -NoProfile -File .agents/normalize-vercel-skill-packaging.ps1 -Check
# 3. In a new top-level agent chat, confirm the compiled files are absent
#    from always-applied rules, the three skills are still listed, and the
#    new filenames can be read.
#
# -Check validates these three skill trees only. It does not compare
# AGENTS.md, .cursor/rules, or .cursor/skills with HEAD. Rules validation
# belongs to git diff review. The idempotency probe copies the skill trees
# to a temp directory and does not write the checkout.

param([switch]$Check)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$skillsRoot = Join-Path $repo ".agents\skills"

function Read-Text([string]$Path) {
    return [System.IO.File]::ReadAllText($Path)
}

function Write-Text([string]$Path, [string]$Text) {
    if (Test-Path -LiteralPath $Path) {
        $current = [System.IO.File]::ReadAllText($Path)
        if ($current -eq $Text) { return }
    }
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

function Replace-Once([string]$Text, [string]$Old, [string]$New) {
    $count = ([regex]::Matches($Text, [regex]::Escape($Old))).Count
    if ($count -eq 0) { return $Text }
    if ($count -gt 1) { throw "Expected one occurrence of [$Old], found $count" }
    return $Text.Replace($Old, $New)
}

$jobs = @(
    @{
        Name = "vercel-react-best-practices"
        Dest = "compiled-guide.md"
        SkillOld = 'For the complete guide with all rules expanded: `AGENTS.md`'
        SkillNew = 'For the complete guide with all rules expanded: `compiled-guide.md`'
        ReadmeOld = '- __`AGENTS.md`__ - Compiled output (generated)'
        ReadmeNew = '- __`compiled-guide.md`__ - Compiled output (generated upstream as AGENTS.md)'
        Note = 'EEARS packaging: this checkout keeps the compiled guide at `compiled-guide.md`. Upstream `pnpm build` is not vendored here. If an update restores `AGENTS.md`, run `.agents/normalize-vercel-skill-packaging.ps1`.'
    },
    @{
        Name = "vercel-react-view-transitions"
        Dest = "compiled-guide.md"
        SkillOld = 'For the complete guide with all reference files expanded: `AGENTS.md`'
        SkillNew = 'For the complete guide with all reference files expanded: `compiled-guide.md`'
        ReadmeOld = '├── AGENTS.md                     # Full compiled document (all references expanded)'
        ReadmeNew = '├── compiled-guide.md             # Full compiled document (all references expanded)'
        Note = 'EEARS packaging: this checkout keeps the compiled guide at `compiled-guide.md`. If an update restores `AGENTS.md`, run `.agents/normalize-vercel-skill-packaging.ps1`.'
    },
    @{
        Name = "vercel-optimize"
        Dest = "cross-agent.md"
        SkillOld = $null
        SkillNew = $null
        ReadmeOld = $null
        ReadmeNew = $null
        Note = 'EEARS packaging: this checkout keeps the cross-agent entry at `cross-agent.md`. The sentence about the project `AGENTS.md` means the repository root file. If an update restores this skill''s `AGENTS.md`, run `.agents/normalize-vercel-skill-packaging.ps1`.'
        SkillLink = 'Cross-agent entry point: [cross-agent.md](cross-agent.md).'
    }
)

function Get-SkillDir([string]$Name, [string]$Root) {
    $dir = Join-Path $Root $Name
    if (-not (Test-Path -LiteralPath $dir)) { throw "Missing skill directory $dir" }
    return $dir
}

function Invoke-Normalize {
    param([string]$TargetSkillsRoot = $skillsRoot)
    foreach ($job in $jobs) {
        $dir = Get-SkillDir $job.Name $TargetSkillsRoot
        $source = Join-Path $dir "AGENTS.md"
        $dest = Join-Path $dir $job.Dest
        if (Test-Path -LiteralPath $source) {
            if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
            Move-Item -LiteralPath $source -Destination $dest
        }
        if (-not (Test-Path -LiteralPath $dest)) { throw "Missing $($job.Dest) in $($job.Name)" }

        $skillPath = Join-Path $dir "SKILL.md"
        $skill = Read-Text $skillPath
        if ($job.SkillOld) { $skill = Replace-Once $skill $job.SkillOld $job.SkillNew }
        if ($job.SkillLink -and -not $skill.Contains($job.SkillLink)) {
            $skill = Insert-AfterFirstLine $skill "# Vercel Optimize" $job.SkillLink
        }
        Write-Text $skillPath $skill

        $readmePath = Join-Path $dir "README.md"
        if (Test-Path -LiteralPath $readmePath) {
            $readme = Read-Text $readmePath
            if ($job.ReadmeOld) { $readme = Replace-Once $readme $job.ReadmeOld $job.ReadmeNew }
            if (-not $readme.Contains("EEARS packaging:")) {
                $title = ($readme -split '\r?\n', 2)[0]
                $readme = Insert-AfterFirstLine $readme $title $job.Note
            }
            Write-Text $readmePath $readme
        }
    }
}

function Get-TreeHash([string]$Root) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $files = Get-ChildItem -LiteralPath $Root -Recurse -File | Sort-Object FullName
        $builder = New-Object System.Text.StringBuilder
        foreach ($file in $files) {
            $rel = $file.FullName.Substring($Root.Length).TrimStart('\', '/')
            $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
            $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "")
            [void]$builder.AppendLine("$rel $hash")
        }
        return $builder.ToString()
    }
    finally { $sha.Dispose() }
}

function Insert-AfterFirstLine([string]$Text, [string]$FirstLine, [string]$Insertion) {
    $nl = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $heading = $FirstLine + $nl
    $pos = $Text.IndexOf($heading)
    if ($pos -lt 0) { throw "Expected [$FirstLine] in the file" }
    $insertAt = $pos + $heading.Length
    return $Text.Substring(0, $insertAt) + $nl + $Insertion + $nl + $Text.Substring($insertAt)
}

function Invoke-Check {
    $errors = New-Object System.Collections.Generic.List[string]
    $agents = @(Get-ChildItem -LiteralPath $skillsRoot -Recurse -Filter AGENTS.md -File -ErrorAction SilentlyContinue)
    foreach ($file in $agents) { $errors.Add("skill AGENTS.md present: $($file.FullName)") }

    $rootAgents = Join-Path $repo "AGENTS.md"
    if (-not (Test-Path -LiteralPath $rootAgents)) { $errors.Add("root AGENTS.md missing") }

    $required = @(
        ".agents\skills\vercel-react-best-practices\SKILL.md",
        ".agents\skills\vercel-react-best-practices\compiled-guide.md",
        ".agents\skills\vercel-react-best-practices\rules\async-parallel.md",
        ".agents\skills\vercel-react-view-transitions\SKILL.md",
        ".agents\skills\vercel-react-view-transitions\compiled-guide.md",
        ".agents\skills\vercel-react-view-transitions\references\implementation.md",
        ".agents\skills\vercel-react-view-transitions\references\patterns.md",
        ".agents\skills\vercel-react-view-transitions\references\css-recipes.md",
        ".agents\skills\vercel-react-view-transitions\references\nextjs.md",
        ".agents\skills\vercel-optimize\SKILL.md",
        ".agents\skills\vercel-optimize\cross-agent.md",
        ".agents\skills\vercel-optimize\references\doctrine.md",
        ".agents\skills\vercel-optimize\references\voice.md",
        ".agents\skills\vercel-optimize\scripts\gate-investigations.mjs"
    )
    foreach ($rel in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $repo $rel))) { $errors.Add("missing $rel") }
    }

    $bestSkill = Read-Text (Join-Path $skillsRoot "vercel-react-best-practices\SKILL.md")
    $viewSkill = Read-Text (Join-Path $skillsRoot "vercel-react-view-transitions\SKILL.md")
    $optSkill = Read-Text (Join-Path $skillsRoot "vercel-optimize\SKILL.md")
    if (-not $bestSkill.Contains('compiled-guide.md')) { $errors.Add("best-practices SKILL.md missing compiled-guide.md") }
    if (-not $viewSkill.Contains('compiled-guide.md')) { $errors.Add("view-transitions SKILL.md missing compiled-guide.md") }
    if (-not $optSkill.Contains('cross-agent.md')) { $errors.Add("optimize SKILL.md missing cross-agent.md") }
    if ($bestSkill -match 'AGENTS\.md' -or $viewSkill -match 'AGENTS\.md' -or $optSkill -match 'AGENTS\.md') {
        $errors.Add("a Vercel SKILL.md still names AGENTS.md")
    }

    $bestGuide = Join-Path $skillsRoot "vercel-react-best-practices\compiled-guide.md"
    $viewGuide = Join-Path $skillsRoot "vercel-react-view-transitions\compiled-guide.md"
    $optGuide = Join-Path $skillsRoot "vercel-optimize\cross-agent.md"
    $bestText = Read-Text $bestGuide
    $viewText = Read-Text $viewGuide
    $optText = Read-Text $optGuide
    if ($bestText -notlike '*### 8.4 useEffectEvent for Stable Callback Refs*') { $errors.Add("best-practices compiled guide lost section 8.4") }
    if ($viewText -notlike '*animation-name: via-blur*') { $errors.Add("view-transitions compiled guide lost via-blur") }
    if ($optText -notlike '*Cross-agent entry point for the Vercel Optimize skill*') { $errors.Add("optimize cross-agent entry lost its opening") }
    if ((Get-Item -LiteralPath $bestGuide).Length -lt 100000) { $errors.Add("best-practices compiled guide is unexpectedly small") }
    if ((Get-Item -LiteralPath $viewGuide).Length -lt 20000) { $errors.Add("view-transitions compiled guide is unexpectedly small") }

    $probe = Join-Path ([System.IO.Path]::GetTempPath()) ("eears-packaging-idem-" + [guid]::NewGuid().ToString("n"))
    $probeSkills = Join-Path $probe "skills"
    New-Item -ItemType Directory -Path $probeSkills | Out-Null
    try {
        foreach ($job in $jobs) {
            Copy-Item -LiteralPath (Join-Path $skillsRoot $job.Name) -Destination (Join-Path $probeSkills $job.Name) -Recurse
        }
        $before = Get-TreeHash $probeSkills
        Invoke-Normalize -TargetSkillsRoot $probeSkills
        $once = Get-TreeHash $probeSkills
        Invoke-Normalize -TargetSkillsRoot $probeSkills
        $twice = Get-TreeHash $probeSkills
        if ($before -ne $once) { $errors.Add("normalize changed an already-normalized skill tree") }
        if ($once -ne $twice) { $errors.Add("normalize is not idempotent") }
    }
    finally {
        if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Recurse -Force }
    }

    if ($errors.Count -gt 0) {
        $errors | ForEach-Object { Write-Host $_ }
        exit 1
    }
    Write-Host "check-ok"
}

if ($Check) {
    Invoke-Check
}
else {
    Invoke-Normalize
    Invoke-Check
}
