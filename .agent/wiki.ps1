# .agent/wiki.ps1 - Fast launcher for repository wiki and knowledge graph tool
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$EngineArgs
)

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = "." }
$enginePath = Join-Path $repoRoot ".agent\.registry\scripts\wiki-engine.py"

# Local development fallback if submodule is uninitialized
if (-not (Test-Path $enginePath)) {
    $siblingEngine = Join-Path $repoRoot "..\..\agent-skills-vault\scripts\wiki-engine.py"
    if (Test-Path $siblingEngine) {
        $enginePath = $siblingEngine
    }
}

if (-not (Test-Path $enginePath)) {
    Write-Error "Wiki engine not found at $enginePath. Ensure .agent/.registry submodule is initialized via 'git submodule update --init'."
    exit 1
}

if (-not $EngineArgs) {
    python $enginePath --help
} else {
    python $enginePath @EngineArgs
}
