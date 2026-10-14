#!/bin/sh
# .agent/wiki.sh - Fast launcher for repository wiki and knowledge graph tool
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
ENGINE="$REPO_ROOT/.agent/.registry/scripts/wiki-engine.py"

# Local development fallback if submodule is uninitialized
if [ ! -f "$ENGINE" ] && [ -f "$REPO_ROOT/../../agent-skills-vault/scripts/wiki-engine.py" ]; then
    ENGINE="$REPO_ROOT/../../agent-skills-vault/scripts/wiki-engine.py"
fi

if [ ! -f "$ENGINE" ]; then
    echo "Error: Wiki engine not found at $ENGINE. Ensure .agent/.registry submodule is initialized via 'git submodule update --init'." >&2
    exit 1
fi

PY_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PY_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PY_CMD="python"
else
    echo "Error: Python runtime not found in PATH." >&2
    exit 1
fi

if [ $# -eq 0 ]; then
    "$PY_CMD" "$ENGINE" --help
else
    "$PY_CMD" "$ENGINE" "$@"
fi
