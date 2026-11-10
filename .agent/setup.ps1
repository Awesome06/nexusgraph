# setup.ps1 - Antigravity Agent & Git Hook Setup
[CmdletBinding()]
param(
    [ValidateSet("personal", "team", "oss", "research", "author-oss")]
    [string]$Type = "personal"
)

$ErrorActionPreference = "Stop"
Write-Host "Configuring Antigravity Workspace..." -ForegroundColor Cyan

# 1. Verify Git availability and repository state
$repoRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
    Write-Error "Not a git repository. Run 'git init' before setup."
    exit 1
}
Set-Location -Path $repoRoot

# 2. Locate Central Agent Skills Vault
$centralVault = $env:AGENT_SKILLS_VAULT_PATH
if (-not $centralVault -or -not (Test-Path "$centralVault/skill-map.json")) {
    $searchPaths = @(
        (Join-Path $repoRoot "..\agent-skills-vault"),
        (Join-Path $repoRoot "..\..\agent-skills-vault"),
        "C:\Users\Bhatn\OneDrive\Desktop\Projects\agent-skills-vault",
        (Join-Path $HOME ".gemini\agent-skills-vault")
    )
    foreach ($p in $searchPaths) {
        if (Test-Path "$p/skill-map.json") {
            $centralVault = (Resolve-Path $p).Path
            break
        }
    }
}

if ($centralVault) {
    Write-Host "Discovered central agent-skills-vault at $centralVault" -ForegroundColor Green
} else {
    Write-Warning "Central agent-skills-vault not found in standard paths. Set AGENT_SKILLS_VAULT_PATH if located elsewhere."
}

# 3. Ensure Vault Exclusions in .git/info/exclude
$excludeFile = ".git/info/exclude"
if (Test-Path (Split-Path $excludeFile)) {
    $excludePatterns = @(
        "# Agent Skills Vault dynamic sidecar (Local developer harness)",
        ".agent/.registry",
        ".agents/skills/*",
        ".agents/.skill-leases.json",
        ".agents/.turn-cache.json",
        ".agents/mode"
    )
    $existing = if (Test-Path $excludeFile) { Get-Content $excludeFile -Raw } else { "" }
    $toAdd = @()
    foreach ($pat in $excludePatterns) {
        if ($pat -notmatch "^#" -and $existing -notmatch [regex]::Escape($pat)) {
            $toAdd += $pat
        }
    }
    if ($toAdd.Count -gt 0) {
        Add-Content -Path $excludeFile -Value ("`n" + $excludePatterns[0] + "`n" + ($toAdd -join "`n"))
        Write-Host "Configured vault exclusions in $excludeFile." -ForegroundColor Green
    }
}

# 4. Synchronize Global Skills to Antigravity Global Config (~/.gemini/config/skills)
if ($centralVault) {
    $homeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
    $globalConfigSkills = Join-Path $homeDir ".gemini\config\skills"
    $registryGlobalsDir = Join-Path $centralVault "globals"

    if (Test-Path $registryGlobalsDir) {
        if (-not (Test-Path $globalConfigSkills)) {
            New-Item -ItemType Directory -Path $globalConfigSkills -Force | Out-Null
        }

        $globalSkills = Get-ChildItem -Path $registryGlobalsDir -Directory
        foreach ($globalSkill in $globalSkills) {
            $skillName = $globalSkill.Name
            $targetSkillPath = $globalSkill.FullName
            $linkSkillPath = Join-Path $globalConfigSkills $skillName

            if (-not (Test-Path $linkSkillPath)) {
                Write-Host "Linking global skill -> $skillName" -ForegroundColor Cyan
                try {
                    New-Item -ItemType SymbolicLink -Path $linkSkillPath -Target $targetSkillPath -ErrorAction Stop | Out-Null
                } catch {
                    if ($IsWindows -or ($env:OS -like "*Windows*")) {
                        cmd.exe /c mklink /J "$linkSkillPath" "$targetSkillPath" | Out-Null
                    } else {
                        ln -s "$targetSkillPath" "$linkSkillPath"
                    }
                }
            }
        }
    }
}

# 5. Configure Git pre-commit hook
$hooksDir = ".git/hooks"
$gitHookPath = "$hooksDir/pre-commit"

if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
}

$agentTrigger = @"
# --- Antigravity Agent Hook Start ---
if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .agent/hooks/pre-commit.ps1 || exit 1
elif command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -NonInteractive -File .agent/hooks/pre-commit.ps1 || exit 1
elif [ -f .agent/hooks/pre-commit.sh ]; then
    sh .agent/hooks/pre-commit.sh || exit 1
fi
# --- Antigravity Agent Hook End ---
"@ -replace "`r`n", "`n"

if (Test-Path $gitHookPath) {
    $existing = (Get-Content $gitHookPath -Raw) -replace "`r`n", "`n"
    if ($existing -notmatch "Antigravity Agent Hook") {
        $updated = "$existing`n$agentTrigger`n"
        [System.IO.File]::WriteAllText((Convert-Path $gitHookPath), $updated, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Appended Antigravity sync to existing pre-commit hook." -ForegroundColor Green
    }
} else {
    $newHook = "#!/bin/sh`n$agentTrigger`n"
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $gitHookPath), $newHook, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Created pre-commit hook with Antigravity sync (LF encoded)." -ForegroundColor Green
}

# 6. Apply Project Type Scaffolding
if (Test-Path ".agent/scaffold.py") {
    Write-Host "Applying Project Type Scaffolding ($Type)..." -ForegroundColor Yellow
    python .agent/scaffold.py --type $Type
}

# 7. Run initial skill discovery immediately
if (Test-Path ".agent/hooks/pre-commit.ps1") {
    Write-Host "Running initial skill synchronization..." -ForegroundColor Cyan
    & ".agent/hooks/pre-commit.ps1"
}

Write-Host "Workspace ready ($Type mode). Agent skills will validate and sync on every commit." -ForegroundColor Cyan
