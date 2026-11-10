#!/usr/bin/env sh
# .agent/wiki.sh - Fast launcher for repository wiki and knowledge graph tool
set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

ENGINE_PATH=""
if [ -n "$AGENT_SKILLS_VAULT_PATH" ] && [ -f "$AGENT_SKILLS_VAULT_PATH/scripts/wiki-engine.py" ]; then
    ENGINE_PATH="$AGENT_SKILLS_VAULT_PATH/scripts/wiki-engine.py"
else
    for candidate in "$REPO_ROOT/../agent-skills-vault" "$REPO_ROOT/../../agent-skills-vault" "$HOME/.gemini/agent-skills-vault"; do
        if [ -f "$candidate/scripts/wiki-engine.py" ]; then
            ENGINE_PATH="$candidate/scripts/wiki-engine.py"
            break
        fi
    done
fi

if [ -z "$ENGINE_PATH" ]; then
    echo "Error: wiki-engine.py not found. Ensure agent-skills-vault is available." >&2
    exit 1
fi

if [ "$#" -eq 0 ]; then
    python3 "$ENGINE_PATH" --help 2>/dev/null || python "$ENGINE_PATH" --help
else
    python3 "$ENGINE_PATH" "$@" 2>/dev/null || python "$ENGINE_PATH" "$@"
fi
