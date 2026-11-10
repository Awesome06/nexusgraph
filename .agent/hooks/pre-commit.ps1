#!/usr/bin/env pwsh
# .agent/hooks/pre-commit.ps1
# 1. Updates vendored submodules (.agent/.registry) from vault upstream.
# 2. Analyzes repository stack signatures and context-corroborates skills into .agents/skills/ (Antigravity customization root).
# 3. Lints wiki knowledge graph links.
# 4. Executes fast local commit lint gate. Deep test suites run on pre-push.

$repoRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { exit 0 }
Set-Location -Path $repoRoot

$submodulePath = ".agent/.registry"
$registryMapPath = "$submodulePath/skill-map.json"
$activeSkillsPath = ".agent/.active-skills.json"
$agentsSkillsDir = ".agents\skills"
$legacySkillsDir = ".agent\skills"

# ---------------------------------------------------------
# Step 1: Discover Central Agent Skills Vault (Zero Submodule)
# ---------------------------------------------------------
$localVault = $env:AGENT_SKILLS_VAULT_PATH
if (-not $localVault -or -not (Test-Path "$localVault/skill-map.json")) {
    $searchPaths = @(
        (Join-Path $repoRoot "..\agent-skills-vault"),
        (Join-Path $repoRoot "..\..\agent-skills-vault"),
        "C:\Users\Bhatn\OneDrive\Desktop\Projects\agent-skills-vault",
        (Join-Path $HOME ".gemini\agent-skills-vault")
    )
    foreach ($p in $searchPaths) {
        if (Test-Path "$p/skill-map.json") {
            $localVault = (Resolve-Path $p).Path
            break
        }
    }
}

if (-not $localVault) {
    # If central vault is not reachable on this machine, exit cleanly
    exit 0
}

$registryMapPath = Join-Path $localVault "skill-map.json"
if (-not (Test-Path $registryMapPath)) { exit 0 }

$map = Get-Content $registryMapPath -Raw | ConvertFrom-Json

# ---------------------------------------------------------
# Step 2: Context-Corroborated Skill Resolution (.agents/skills/)
# ---------------------------------------------------------
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

# Preload manifest contents across repository (depth 4)
$manifests = @()
$manifestFiles = Get-ChildItem -Path "." -Include "requirements*.txt", "pyproject.toml", "Pipfile", "package.json", "go.mod", "Cargo.toml", "uv.lock" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' }

foreach ($mf in $manifestFiles) {
    try {
        $manifests += (Get-Content $mf.FullName -Raw -ErrorAction SilentlyContinue)
    } catch {}
}
$combinedManifestContent = $manifests -join "`n"

# Context Guard: Ambiguous generic filenames must be corroborated by dependency tokens or source imports
$SpecializedSkillGuards = @{
    "frameworks/fastapi"             = @("fastapi", "uvicorn")
    "frameworks/discord-bot"         = @("discord", "nextcord", "hikari", "discord.py")
    "db/event-streaming"             = @("kafka", "aiokafka", "confluent_kafka", "rabbitmq", "pika")
    "ai/agent-orchestration"         = @("langgraph", "crewai", "autogen", "swarm")
    "db/graph-falkordb"              = @("falkordb", "opencypher", "redis-graph")
    "data/tabular-sync"              = @("gspread", "google-api", "sheets", "tabular", "openpyxl")
    "domain/canvas-physics"          = @("d3-force", "cytoscape", "xyflow", "force-directed", "canvas-physics")
    "domain/zt-proxy"                = @("wireguard", "ebpf", "bpf", "tun", "zt-proxy")
    "domain/opportunity-aggregation" = @("devfolio", "unstop", "clist", "aioimaplib", "opportunity")
    "ops/resilient-scheduling"       = @("apscheduler", "celery", "cron", "schedule")
}

function Test-SkillContextCorroborated([string]$skillPath, [string]$manifestContent) {
    if (-not $SpecializedSkillGuards.ContainsKey($skillPath)) {
        return $true
    }

    $requiredTokens = $SpecializedSkillGuards[$skillPath]
    foreach ($tok in $requiredTokens) {
        if ($manifestContent -match "(?i)\b$([regex]::Escape($tok))\b") {
            return $true
        }
    }

    # Inspect top 30 lines of source code imports
    $sourceFiles = Get-ChildItem -Path "." -Include "*.py", "*.ts", "*.js", "*.go" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
        Select-Object -First 20

    foreach ($sf in $sourceFiles) {
        try {
            $head = (Get-Content $sf.FullName -TotalCount 30 -ErrorAction SilentlyContinue) -join "`n"
            foreach ($tok in $requiredTokens) {
                if ($head -match "(?i)\b$([regex]::Escape($tok))\b") {
                    return $true
                }
            }
        } catch {}
    }

    return $false
}

$candidateSkills = @()

# Scan repository signatures from map triggers
foreach ($prop in $map.psobject.properties) {
    $trigger = $prop.Name
    if ($trigger -match '^\.?agents?(/|$)' -or $trigger -match '^\.?registry(/|$)') {
        continue
    }

    $matched = $false

    # Tier 1: Direct root check
    if (Test-Path $trigger) {
        $matched = $true
    }
    # Tier 1: Directory trigger check
    elseif ($trigger.EndsWith("/")) {
        $dirName = $trigger.TrimEnd('/')
        $foundDir = Get-ChildItem -Path "." -Filter $dirName -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
            Select-Object -First 1
        if ($foundDir) { $matched = $true }
    }
    # Tier 1: File trigger check
    elseif ($trigger -match '\.[a-zA-Z0-9_-]+$') {
        $foundFile = Get-ChildItem -Path "." -Filter $trigger -File -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
            Select-Object -First 1
        if ($foundFile) { $matched = $true }
    }
    # Tier 2 & 3: Semantic manifest & stem trigger check
    else {
        if ($combinedManifestContent -match "(?i)\b$([regex]::Escape($trigger))\b") {
            $matched = $true
        } else {
            $foundStem = Get-ChildItem -Path "." -Filter "*$trigger*" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '[\\/](\.agents?|\.git|node_modules|vendor|\.venv)[\\/]' } |
                Select-Object -First 1
            if ($foundStem) { $matched = $true }
        }
    }

    if ($matched) {
        $candidateSkills += $prop.Value
    }
}
$candidateSkills = $candidateSkills | Select-Object -Unique

# Filter candidates through Context Corroboration Guard
$corroboratedSkills = @()
foreach ($cand in $candidateSkills) {
    if (Test-SkillContextCorroborated -skillPath $cand -manifestContent $combinedManifestContent) {
        $corroboratedSkills += $cand
    } else {
        Write-Host "Antigravity Context: Rejecting uncorroborated skill candidate -> $cand" -ForegroundColor DarkGray
    }
}

# Merge explicitly declared active skills with corroborated detected skills
$allTargetSkills = @($state.active_skills + $corroboratedSkills) | Select-Object -Unique

# Filter active skills through context verification to prune historical false-positives
$verifiedTargetSkills = @()
foreach ($target in $allTargetSkills) {
    if (Test-SkillContextCorroborated -skillPath $target -manifestContent $combinedManifestContent) {
        $verifiedTargetSkills += $target
    } else {
        Write-Host "Antigravity Context: Evicting uncorroborated active skill -> $target" -ForegroundColor Yellow
    }
}

$driftDetected = $false

if (-not (Test-Path $agentsSkillsDir)) {
    New-Item -ItemType Directory -Path $agentsSkillsDir -Force | Out-Null
}

$globalSkills = @('code-review', 'doc-sync', 'error-discipline', 'git-release', 'incident-triaging', 'intent-discipline', 'repo-wiki', 'script-optimization', 'security-auditor', 'strategic-reconnaissance', 'test-discipline', 'workspace-initializer')
$protectedSkills = @('design-orchestrator', 'hackathon-evaluation-governance')

function Link-SkillDirectory([string]$linkTarget, [string]$destinationDir, [string]$skillFolder) {
    $destPath = Join-Path $destinationDir $skillFolder
    if (-not (Test-Path $destPath)) {
        try {
            New-Item -ItemType SymbolicLink -Path $destPath -Target $linkTarget -ErrorAction Stop | Out-Null
        } catch {
            cmd.exe /c mklink /J "$destPath" "$linkTarget" 2>$null | Out-Null
        }
    }
}

foreach ($req in $verifiedTargetSkills) {
    $folderName = Split-Path $req -Leaf
    if ($folderName -in $globalSkills -or (Test-Path (Join-Path $localVault "globals\$folderName"))) { continue }

    $targetPath = Join-Path $localVault $req
    if (-not (Test-Path $targetPath)) {
        continue
    }

    # Primary Antigravity customization discovery link
    $agentsLink = Join-Path $agentsSkillsDir $folderName
    if (-not (Test-Path $agentsLink)) {
        Write-Host "Antigravity Sync: Linking -> .agents\skills\$folderName" -ForegroundColor Cyan
        Link-SkillDirectory -linkTarget $targetPath -destinationDir $agentsSkillsDir -skillFolder $folderName
        $driftDetected = $true
    }

    if ($req -notin $state.active_skills) {
        $state.active_skills += $req
        $driftDetected = $true
    }
}

$verifiedFolderNames = @($verifiedTargetSkills | ForEach-Object { Split-Path $_ -Leaf })

# Prune uncorroborated or stale domain skills in .agents\skills
$currentAgentsSkills = Get-ChildItem -Path $agentsSkillsDir -Directory -ErrorAction SilentlyContinue
foreach ($dir in $currentAgentsSkills) {
    if ($dir.Name -notin $verifiedFolderNames -and $dir.Name -notin $protectedSkills) {
        $isReparsePoint = [bool]($dir.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
        if ($isReparsePoint) {
            Write-Host "Antigravity Sync: Pruning uncorroborated skill link -> .agents\skills\$($dir.Name)" -ForegroundColor Yellow
            cmd.exe /c rmdir "$($dir.FullName)" 2>$null
            if (Test-Path $dir.FullName) {
                Remove-Item -Path $dir.FullName -Force -ErrorAction SilentlyContinue
            }
            $state.active_skills = @($state.active_skills | Where-Object { (Split-Path $_ -Leaf) -ne $dir.Name })
            $driftDetected = $true
        }
    }
}

$state.active_skills = @($verifiedTargetSkills)

if ($driftDetected) {
    $state | ConvertTo-Json -Depth 4 | Set-Content -Path $activeSkillsPath -Encoding utf8
    Write-Host "Antigravity Sync: Active skills context-verified. Staging tracker..." -ForegroundColor Green
    git add $activeSkillsPath
}

# ---------------------------------------------------------
# Step 3: Knowledge Graph Wiki Validation
# ---------------------------------------------------------
$wikiEnginePath = Join-Path $localVault "scripts\wiki-engine.py"
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
