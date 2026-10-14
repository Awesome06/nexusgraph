#!/bin/sh
# .agent/setup.sh - Antigravity Agent & Git Hook Setup for POSIX (Linux, macOS, DevContainers)
set -e

echo "\033[0;36mConfiguring Antigravity Workspace (POSIX)...\033[0m"

# 1. Verify Git availability and repository state
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "\033[0;31mError: Not a git repository. Run 'git init' before setup.\033[0m" >&2
    exit 1
}
cd "$REPO_ROOT"

# 2. Initialize or vendor .agent/.registry submodule
if [ ! -f ".agent/.registry/skill-map.json" ]; then
    echo "\033[0;33mInitializing .agent/.registry submodule from vault...\033[0m"
    git submodule update --init --recursive || {
        echo "\033[0;33mWarning: Submodule init failed. Attempting fallback submodule add...\033[0m"
        git submodule add --force https://github.com/Awesome06/agent-skills-vault.git .agent/.registry || true
    }
else
    echo "Updating .agent/.registry submodule..."
    git submodule update --remote --recursive 2>/dev/null || true
fi

# 3. Synchronize Global Skills to Antigravity Global Config (~/.gemini/config/skills)
HOME_DIR="${HOME:-$USERPROFILE}"
GLOBAL_CONFIG_SKILLS="$HOME_DIR/.gemini/config/skills"
REGISTRY_GLOBALS_DIR="$REPO_ROOT/.agent/.registry/globals"

if [ -d "$REGISTRY_GLOBALS_DIR" ]; then
    mkdir -p "$GLOBAL_CONFIG_SKILLS"
    for skill_path in "$REGISTRY_GLOBALS_DIR"/*; do
        if [ -d "$skill_path" ]; then
            skill_name=$(basename "$skill_path")
            link_path="$GLOBAL_CONFIG_SKILLS/$skill_name"
            if [ ! -e "$link_path" ] && [ ! -L "$link_path" ]; then
                echo "\033[0;36mLinking global skill -> $skill_name\033[0m"
                ln -s "$skill_path" "$link_path"
            fi
        fi
    done
    echo "\033[0;32mGlobal skills verified in $GLOBAL_CONFIG_SKILLS.\033[0m"
fi

# 4. Configure Git pre-commit hook
HOOKS_DIR=".git/hooks"
GIT_HOOK_PATH="$HOOKS_DIR/pre-commit"

mkdir -p "$HOOKS_DIR"

HOOK_BODY='
# --- Antigravity Agent Hook Start ---
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
        printf "%s\n" "$HOOK_BODY" >> "$GIT_HOOK_PATH"
        echo "\033[0;32mAppended Antigravity sync to existing pre-commit hook.\033[0m"
    else
        echo "\033[0;33mAntigravity sync is already configured in the pre-commit hook.\033[0m"
    fi
else
    printf "#!/bin/sh\n%s\n" "$HOOK_BODY" > "$GIT_HOOK_PATH"
    echo "\033[0;32mCreated pre-commit hook with Antigravity sync.\033[0m"
fi

chmod +x "$GIT_HOOK_PATH" 2>/dev/null || true
if [ -f ".agent/hooks/pre-commit.sh" ]; then
    chmod +x ".agent/hooks/pre-commit.sh" 2>/dev/null || true
fi

# 5. Run initial skill discovery immediately
if [ -f ".agent/hooks/pre-commit.sh" ]; then
    echo "\033[0;36mRunning initial skill synchronization...\033[0m"
    sh ".agent/hooks/pre-commit.sh"
fi

echo "\033[0;36mWorkspace ready. Agent skills will validate and sync on every commit.\033[0m"
