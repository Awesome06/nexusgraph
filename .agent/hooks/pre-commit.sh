#!/bin/sh
# .agent/hooks/pre-commit.sh
# 1. Updates vendored submodules (.agent/.registry) from vault upstream.
# 2. Analyzes repository stack signatures and synchronizes skills into .agents/skills/ (Antigravity customization root).
# 3. Lints wiki knowledge graph links.

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

SUBMODULE_PATH=".agent/.registry"
REGISTRY_MAP="$SUBMODULE_PATH/skill-map.json"
ACTIVE_SKILLS=".agent/.active-skills.json"
AGENTS_SKILLS_DIR=".agents/skills"

# ---------------------------------------------------------
# Step 1: Submodule Initialization & Automatic Synchronization
# ---------------------------------------------------------
if [ -f ".gitmodules" ]; then
    if [ ! -f "$REGISTRY_MAP" ]; then
        echo "Antigravity Sync (POSIX): Initializing $SUBMODULE_PATH submodule..."
        git submodule update --init --recursive "$SUBMODULE_PATH" 2>/dev/null
    fi

    SUBMODULE_UPDATED=0
    LOCAL_VAULT=""
    if [ -f "../agent-skills-vault/skill-map.json" ]; then
        LOCAL_VAULT="../agent-skills-vault"
    elif [ -f "../../agent-skills-vault/skill-map.json" ]; then
        LOCAL_VAULT="../../agent-skills-vault"
    fi

    if [ -n "$LOCAL_VAULT" ]; then
        VAULT_HEAD=$(git -C "$LOCAL_VAULT" rev-parse HEAD 2>/dev/null)
        CURR_HEAD=$(git -C "$SUBMODULE_PATH" rev-parse HEAD 2>/dev/null)
        if [ -n "$VAULT_HEAD" ] && [ "$VAULT_HEAD" != "$CURR_HEAD" ]; then
            SUB_DIRTY=$(git -C "$SUBMODULE_PATH" status --porcelain 2>/dev/null)
            if [ -z "$SUB_DIRTY" ]; then
                git -C "$SUBMODULE_PATH" fetch "$LOCAL_VAULT" HEAD >/dev/null 2>&1
                git -C "$SUBMODULE_PATH" checkout -q FETCH_HEAD >/dev/null 2>&1
                SUBMODULE_UPDATED=1
                echo "Antigravity Sync (POSIX): Updated $SUBMODULE_PATH to local vault commit $(echo "$VAULT_HEAD" | cut -c1-7)."
            fi
        fi
    else
        CURR_HEAD=$(git -C "$SUBMODULE_PATH" rev-parse HEAD 2>/dev/null)
        git submodule update --remote --recursive "$SUBMODULE_PATH" 2>/dev/null
        NEW_HEAD=$(git -C "$SUBMODULE_PATH" rev-parse HEAD 2>/dev/null)
        if [ -n "$NEW_HEAD" ] && [ "$NEW_HEAD" != "$CURR_HEAD" ]; then
            SUBMODULE_UPDATED=1
            echo "Antigravity Sync (POSIX): Updated $SUBMODULE_PATH to remote commit $(echo "$NEW_HEAD" | cut -c1-7)."
        fi
    fi

    if [ "$SUBMODULE_UPDATED" -eq 1 ]; then
        git add "$SUBMODULE_PATH"
        echo "Antigravity Sync (POSIX): Submodule gitlink staged for commit."
    fi
fi

# Exit silently if vault registry map is still unavailable
[ -f "$REGISTRY_MAP" ] || exit 0

mkdir -p "$AGENTS_SKILLS_DIR"

# ---------------------------------------------------------
# Step 2: Stack Detection & Skill Synchronization
# ---------------------------------------------------------
MATCHED_SKILLS=""
if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
    PY_CMD=$(command -v python3 || command -v python)
    MATCHED_SKILLS=$("$PY_CMD" -c "
import json, os, sys, re

with open('$REGISTRY_MAP', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

manifest_blobs = []
for root, dirs, files in os.walk('.', topdown=True):
    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'vendor', '.venv')]
    depth = root.count(os.sep)
    if depth >= 4:
        continue
    for fn in files:
        if fn in ('pyproject.toml', 'Pipfile', 'package.json', 'go.mod', 'Cargo.toml', 'uv.lock') or fn.startswith('requirements'):
            try:
                with open(os.path.join(root, fn), 'r', encoding='utf-8', errors='ignore') as mf:
                    manifest_blobs.append(mf.read())
            except Exception:
                pass
manifest_text = '\n'.join(manifest_blobs)

matched = set()
for trig, skills in mapping.items():
    if trig.startswith('.') or trig.startswith('agents') or trig.startswith('workflows'):
        continue

    if os.path.exists(trig):
        matched.update(skills)
        continue

    trig_clean = trig.rstrip('/')
    trig_base = os.path.basename(trig_clean)

    if trig.endswith('/'):
        found = False
        for root, dirs, _ in os.walk('.', topdown=True):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'vendor', '.venv')]
            if root.count(os.sep) >= 4:
                continue
            if trig_base in dirs:
                found = True
                break
        if found:
            matched.update(skills)
            continue

    elif '.' in trig_base:
        found = False
        for root, dirs, files in os.walk('.', topdown=True):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'vendor', '.venv')]
            if root.count(os.sep) >= 4:
                continue
            if trig_base in files:
                found = True
                break
        if found:
            matched.update(skills)
            continue

    else:
        if re.search(r'\b' + re.escape(trig) + r'\b', manifest_text, re.IGNORECASE):
            matched.update(skills)
            continue
        found = False
        for root, dirs, files in os.walk('.', topdown=True):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'vendor', '.venv')]
            if root.count(os.sep) >= 4:
                continue
            if any(trig in d for d in dirs) or any(trig in f for f in files):
                found = True
                break
        if found:
            matched.update(skills)

print(' '.join(sorted(matched)))
")
fi

UNIQUE_SKILLS=$(echo "$MATCHED_SKILLS" | tr ' ' '\n' | grep -v '^$' | sort -u)
DRIFT_DETECTED=0
ACTIVE_LIST=""

for skill in $UNIQUE_SKILLS; do
    folder_name=$(basename "$skill")
    if [ -d "$REPO_ROOT/$SUBMODULE_PATH/globals/$folder_name" ]; then
        continue
    fi

    target="$REPO_ROOT/$SUBMODULE_PATH/$skill"
    if [ ! -d "$target" ] && [ -d "$REPO_ROOT/../agent-skills-vault/$skill" ]; then
        target="$REPO_ROOT/../agent-skills-vault/$skill"
    fi

    if [ -d "$target" ]; then
        # Primary .agents/skills/ link
        agents_link="$AGENTS_SKILLS_DIR/$folder_name"
        if [ ! -e "$agents_link" ] && [ ! -L "$agents_link" ]; then
            echo "Antigravity Sync (POSIX): Linking skill -> $AGENTS_SKILLS_DIR/$folder_name"
            ln -s "$target" "$agents_link"
            DRIFT_DETECTED=1
        fi

        ACTIVE_LIST="$ACTIVE_LIST \"$skill\","
    fi
done

# Prune stale domain skills in .agents/skills/
for current_link in "$AGENTS_SKILLS_DIR"/*; do
    [ -e "$current_link" ] || [ -L "$current_link" ] || continue
    link_name=$(basename "$current_link")
    [ "$link_name" = ".gitkeep" ] && continue
    [ "$link_name" = "design-orchestrator" ] && continue
    [ "$link_name" = "hackathon-evaluation-governance" ] && continue

    still_needed=0
    for req in $UNIQUE_SKILLS; do
        if [ "$(basename "$req")" = "$link_name" ]; then
            still_needed=1
            break
        fi
    done

    if [ $still_needed -eq 0 ]; then
        echo "Antigravity Sync (POSIX): Pruning stale skill link -> $link_name"
        rm -f "$current_link"
        DRIFT_DETECTED=1
    fi
done

ACTIVE_LIST_CLEAN=$(echo "$ACTIVE_LIST" | sed 's/,$//')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

cat <<EOF > "$ACTIVE_SKILLS"
{
    "version": "1.0.0",
    "initialized_at": "$TIMESTAMP",
    "stack": "auto",
    "active_skills": [
$(echo "$ACTIVE_LIST_CLEAN" | tr ',' '\n' | sed 's/^/        /')
    ]
}
EOF

if [ $DRIFT_DETECTED -eq 1 ]; then
    echo "Antigravity Sync (POSIX): Active skills updated. Staging tracker..."
    git add "$ACTIVE_SKILLS"
fi

# ---------------------------------------------------------
# Step 3: Wiki Linting
# ---------------------------------------------------------
WIKI_ENGINE="$SUBMODULE_PATH/scripts/wiki-engine.py"
if [ ! -f "$WIKI_ENGINE" ] && [ -f "../agent-skills-vault/scripts/wiki-engine.py" ]; then
    WIKI_ENGINE="../agent-skills-vault/scripts/wiki-engine.py"
fi
if [ -d "wiki" ] && [ -f "$WIKI_ENGINE" ]; then
    if command -v python3 >/dev/null 2>&1; then
        python3 "$WIKI_ENGINE" --root wiki lint || exit 1
    elif command -v python >/dev/null 2>&1; then
        python "$WIKI_ENGINE" --root wiki lint || exit 1
    fi
fi

exit 0
