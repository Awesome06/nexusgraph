#!/usr/bin/env sh
# setup.sh - Antigravity Agent & Git Hook Setup (POSIX)
set -e

TYPE="${1:-personal}"

echo "Configuring Antigravity Workspace..."

# 1. Verify Git availability
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: Not a git repository. Run 'git init' first." >&2
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# 2. Locate Central Agent Skills Vault
CENTRAL_VAULT="${AGENT_SKILLS_VAULT_PATH:-}"
if [ -z "$CENTRAL_VAULT" ] || [ ! -f "$CENTRAL_VAULT/skill-map.json" ]; then
    for candidate in "$REPO_ROOT/../agent-skills-vault" "$REPO_ROOT/../../agent-skills-vault" "$HOME/.gemini/agent-skills-vault"; do
        if [ -f "$candidate/skill-map.json" ]; then
            CENTRAL_VAULT="$(cd "$candidate" && pwd)"
            break
        fi
    done
fi

if [ -n "$CENTRAL_VAULT" ]; then
    echo "Discovered central agent-skills-vault at $CENTRAL_VAULT"
else
    echo "Warning: Central agent-skills-vault not found in standard paths." >&2
fi

# 3. Ensure Vault Exclusions in .git/info/exclude
EXCLUDE_FILE=".git/info/exclude"
if [ -d ".git/info" ]; then
    for pat in ".agent/.registry" ".agents/skills/*" ".agents/.skill-leases.json" ".agents/.turn-cache.json" ".agents/mode"; do
        if ! grep -qF "$pat" "$EXCLUDE_FILE" 2>/dev/null; then
            echo "$pat" >> "$EXCLUDE_FILE"
        fi
    done
fi

# 4. Synchronize Global Skills
if [ -n "$CENTRAL_VAULT" ] && [ -d "$CENTRAL_VAULT/globals" ]; then
    GLOBAL_CONFIG_SKILLS="$HOME/.gemini/config/skills"
    mkdir -p "$GLOBAL_CONFIG_SKILLS"
    for gskill in "$CENTRAL_VAULT/globals"/*; do
        if [ -d "$gskill" ]; then
            sname="$(basename "$gskill")"
            if [ ! -e "$GLOBAL_CONFIG_SKILLS/$sname" ]; then
                ln -s "$gskill" "$GLOBAL_CONFIG_SKILLS/$sname" 2>/dev/null || true
            fi
        fi
    done
fi

# 5. Configure Git pre-commit hook
HOOKS_DIR=".git/hooks"
GIT_HOOK_PATH="$HOOKS_DIR/pre-commit"
mkdir -p "$HOOKS_DIR"

TRIGGER='# --- Antigravity Agent Hook Start ---
if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .agent/hooks/pre-commit.ps1 || exit 1
elif command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -NonInteractive -File .agent/hooks/pre-commit.ps1 || exit 1
elif [ -f .agent/hooks/pre-commit.sh ]; then
    sh .agent/hooks/pre-commit.sh || exit 1
fi
# --- Antigravity Agent Hook End ---'

if [ -f "$GIT_HOOK_PATH" ]; then
    if ! grep -q "Antigravity Agent Hook" "$GIT_HOOK_PATH"; then
        printf "\n%s\n" "$TRIGGER" >> "$GIT_HOOK_PATH"
    fi
else
    printf "#!/bin/sh\n%s\n" "$TRIGGER" > "$GIT_HOOK_PATH"
    chmod +x "$GIT_HOOK_PATH"
fi

# 6. Apply Project Type Scaffolding
if [ -f ".agent/scaffold.py" ]; then
    python3 .agent/scaffold.py --type "$TYPE" || python .agent/scaffold.py --type "$TYPE" || true
fi

# 7. Initial sync
if [ -f ".agent/hooks/pre-commit.sh" ]; then
    sh .agent/hooks/pre-commit.sh || true
fi

echo "Workspace ready ($TYPE mode)."
