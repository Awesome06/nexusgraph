#!/usr/bin/env pwsh
# .agent/hooks/pre-commit.ps1
# Analyzes the repository for language/stack signatures and dynamically synchronizes agent skills.

$repoRoot = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { exit 0 }
Set-Location -Path $repoRoot

$registryMapPath = ".agent\.registry\skill-map.json"
$activeSkillsPath = ".agent\.active-skills.json"
$skillsDir = ".agent\skills"

# Exit silently if the vault isn't vendored yet
if (-not (Test-Path $registryMapPath)) { exit 0 }

$map = Get-Content $registryMapPath -Raw | ConvertFrom-Json

# Initialize or load state matching the workspace-initializer metadata schema
$state = [ordered]@{
    version        = "1.0.0"
    initialized_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    stack          = "auto"
    active_skills  = @()
}

if (Test-Path $activeSkillsPath) {
    try {
        $loadedState = Get-Content $activeSkillsPath -Raw | ConvertFrom-Json
        if ($loadedState.active_skills) {
            $state.active_skills = @($loadedState.active_skills)
            if ($loadedState.stack) { $state.stack = $loadedState.stack }
            if ($loadedState.initialized_at) { $state.initialized_at = $loadedState.initialized_at }
            if ($loadedState.version) { $state.version = $loadedState.version }
        }
    } catch {}
}

$requiredSkills = @()

# Preload manifest contents across the repository (depth 4) for instant semantic keyword inspection
$manifests = @()
$manifestFiles = Get-ChildItem -Path "." -Include "requirements*.txt", "pyproject.toml", "Pipfile", "package.json", "go.mod", "Cargo.toml", "uv.lock" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' }

foreach ($mf in $manifestFiles) {
    try {
        $manifests += (Get-Content $mf.FullName -Raw -ErrorAction SilentlyContinue)
    } catch {}
}
$combinedManifestContent = $manifests -join "`n"

# Scan repository signatures directly from map properties (excluding agent customization/registry roots)
foreach ($prop in $map.psobject.properties) {
    $trigger = $prop.Name
    if ($trigger -match '^\.?agents?(/|$)' -or $trigger -match '^\.?registry(/|$)') {
        continue
    }

    $matched = $false

    # 1. Direct root check
    if (Test-Path $trigger) {
        $matched = $true
    }
    # 2. Directory trigger check (ending with '/')
    elseif ($trigger.EndsWith("/")) {
        $dirName = $trigger.TrimEnd('/')
        $foundDir = Get-ChildItem -Path "." -Filter $dirName -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
            Select-Object -First 1
        if ($foundDir) { $matched = $true }
    }
    # 3. File trigger check (contains file extension dot, e.g. .py, .json, .ts, .yaml)
    elseif ($trigger -match '\.[a-zA-Z0-9_-]+$') {
        $foundFile = Get-ChildItem -Path "." -Filter $trigger -File -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
            Select-Object -First 1
        if ($foundFile) { $matched = $true }
    }
    # 4. Semantic manifest & stem trigger check (plain package/tech identifiers, e.g. fastapi, falkordb, langgraph, next)
    else {
        # Check manifest contents for package name / keyword boundary
        if ($combinedManifestContent -match "(?i)\b$([regex]::Escape($trigger))\b") {
            $matched = $true
        } else {
            # Fallback: check if any file or directory name contains this identifier
            $foundStem = Get-ChildItem -Path "." -Filter "*$trigger*" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
                Select-Object -First 1
            if ($foundStem) { $matched = $true }
        }
    }

    if ($matched) {
        $requiredSkills += $prop.Value
    }
}
$requiredSkills = $requiredSkills | Select-Object -Unique

$driftDetected = $false

if (-not (Test-Path $skillsDir)) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
}

foreach ($req in $requiredSkills) {
    if ($req -notin $state.active_skills) {
        $folderName = Split-Path $req -Leaf
        $globalSkills = @('code-review', 'doc-sync', 'error-discipline', 'git-release', 'incident-triaging', 'security-auditor', 'test-discipline', 'workspace-initializer', 'repo-wiki')
        if ($folderName -in $globalSkills -or (Test-Path (Join-Path $repoRoot ".agent\.registry\globals\$folderName"))) { continue }

        $linkPath = Join-Path $skillsDir $folderName
        $targetPath = Join-Path $repoRoot ".agent\.registry\$req"

        if (-not (Test-Path $targetPath)) { continue }

        Write-Host "Antigravity Sync: Linking skill -> $folderName ($req)" -ForegroundColor Cyan
        
        if (-not (Test-Path $linkPath)) {
            try {
                New-Item -ItemType SymbolicLink -Path $linkPath -Target $targetPath -ErrorAction Stop | Out-Null
            } catch {
                # Fallback to NTFS junction on Windows if Developer Mode / SeCreateSymbolicLinkPrivilege is absent
                cmd.exe /c mklink /J "$linkPath" "$targetPath" | Out-Null
            }
        }

        $state.active_skills += $req
        $driftDetected = $true
    }
}

# Prune stale domain skills in .agent\skills that are no longer required
$currentSkills = Get-ChildItem -Path $skillsDir -Directory -ErrorAction SilentlyContinue
$reqFolderNames = @($requiredSkills | ForEach-Object { Split-Path $_ -Leaf })

foreach ($dir in $currentSkills) {
    if ($dir.Name -notin $reqFolderNames) {
        Write-Host "Antigravity Sync: Pruning stale skill link -> $($dir.Name)" -ForegroundColor Yellow
        Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        $state.active_skills = @($state.active_skills | Where-Object { (Split-Path $_ -Leaf) -ne $dir.Name })
        $driftDetected = $true
    }
}

if ($driftDetected) {
    $state | ConvertTo-Json -Depth 4 | Set-Content -Path $activeSkillsPath -Encoding utf8
    Write-Host "Antigravity Sync: Active skills updated. Staging tracker..." -ForegroundColor Green
    git add $activeSkillsPath
}

# 3. Validate repository wiki knowledge graph if present
$wikiEnginePath = ".agent\.registry\scripts\wiki-engine.py"
if (-not (Test-Path $wikiEnginePath) -and (Test-Path "..\agent-skills-vault\scripts\wiki-engine.py")) {
    $wikiEnginePath = "..\agent-skills-vault\scripts\wiki-engine.py"
}
if ((Test-Path "wiki") -and (Test-Path $wikiEnginePath)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        python $wikiEnginePath --root wiki lint
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Pre-commit aborted: Wiki validation failed with broken links or errors."
            exit 1
        }
    }
}

exit 0
