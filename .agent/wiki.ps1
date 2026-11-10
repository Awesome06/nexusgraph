# .agent/wiki.ps1 - Fast launcher for repository wiki and knowledge graph tool
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$EngineArgs
)

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = "." }

$searchPaths = @(
    $env:AGENT_SKILLS_VAULT_PATH,
    (Join-Path $repoRoot "..\agent-skills-vault"),
    (Join-Path $repoRoot "..\..\agent-skills-vault"),
    "C:\Users\Bhatn\OneDrive\Desktop\Projects\agent-skills-vault",
    (Join-Path $HOME ".gemini\agent-skills-vault")
)

$enginePath = $null
foreach ($sp in $searchPaths) {
    if ($sp) {
        $candidate = Join-Path $sp "scripts\wiki-engine.py"
        if (Test-Path $candidate) {
            $enginePath = (Resolve-Path $candidate).Path
            break
        }
    }
}

if (-not $enginePath) {
    Write-Error "Wiki engine not found. Ensure agent-skills-vault is available locally or set AGENT_SKILLS_VAULT_PATH."
    exit 1
}

if (-not $EngineArgs) {
    python $enginePath --help
} else {
    python $enginePath @EngineArgs
}
