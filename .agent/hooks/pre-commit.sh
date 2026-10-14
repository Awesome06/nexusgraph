#!/bin/sh
# .agent/hooks/pre-commit.sh
# POSIX skill synchronization for macOS, Linux, and DevContainers.

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

REGISTRY_MAP=".agent/.registry/skill-map.json"
ACTIVE_SKILLS=".agent/.active-skills.json"
SKILLS_DIR=".agent/skills"

# Exit silently if vault isn't vendored yet
[ -f "$REGISTRY_MAP" ] || exit 0

mkdir -p "$SKILLS_DIR"

# Collect required skills by matching triggers across root and nested dirs (depth 4)
# Excludes .agent, .agents, .git, node_modules, vendor, .venv
MATCHED_SKILLS=""

scan_trigger() {
    trigger="$1"
    # Never match customization roots or internal machinery
    case "$trigger" in
        .*|agents*|workflows*|tests*|scripts*) return 1 ;;
    esac

    # 1. Root check
    if [ -e "$trigger" ]; then
        return 0
    fi

    # 2. Nested directory check (depth 4)
    case "$trigger" in
        */)
            # Directory trigger
            dir_name=$(basename "$trigger")
            if find . -maxdepth 4 -type d -name "$dir_name" \
                -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/vendor*' -not -path '*/.venv*' \
                2>/dev/null | grep -q .; then
                return 0
            fi
            ;;
        *)
            # File trigger
            file_name=$(basename "$trigger")
            if find . -maxdepth 4 -type f -name "$file_name" \
                -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/vendor*' -not -path '*/.venv*' \
                2>/dev/null | grep -q .; then
                return 0
            fi
            ;;
    esac
    return 1
}

# Parse skill-map.json using jq or python
parse_and_link() {
    if command -v jq >/dev/null 2>&1; then
        TRIGGERS=$(jq -r 'keys[]' "$REGISTRY_MAP")
        for trig in $TRIGGERS; do
            if scan_trigger "$trig"; then
                SKILLS_FOR_TRIG=$(jq -r --arg t "$trig" '.[$t][]' "$REGISTRY_MAP")
                for s in $SKILLS_FOR_TRIG; do
                    MATCHED_SKILLS="$MATCHED_SKILLS $s"
                done
            fi
        done
    elif command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
        PY_CMD=$(command -v python3 || command -v python)
        MATCHED_SKILLS=$("$PY_CMD" -c "
import json, os, sys
with open('$REGISTRY_MAP') as f:
    mapping = json.load(f)
matched = set()
for trig, skills in mapping.items():
    if trig.startswith('.') or trig.startswith('agents') or trig.startswith('workflows'):
        continue
    # Check root
    if os.path.exists(trig):
        matched.update(skills)
        continue
    # Check nested
    trig_name = os.path.basename(trig.rstrip('/'))
    found = False
    for root, dirs, files in os.walk('.', topdown=True):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'vendor', '.venv')]
        depth = root.count(os.sep)
        if depth >= 4:
            continue
        if trig.endswith('/') and trig_name in dirs:
            found = True
            break
        elif not trig.endswith('/') and trig_name in files:
            found = True
            break
    if found:
        matched.update(skills)
print(' '.join(sorted(matched)))
")
    fi
}

parse_and_link

# Sort and deduplicate matched skills
UNIQUE_SKILLS=$(echo "$MATCHED_SKILLS" | tr ' ' '\n' | grep -v '^$' | sort -u)

DRIFT_DETECTED=0
ACTIVE_LIST=""

# Link required domain skills
for skill in $UNIQUE_SKILLS; do
    folder_name=$(basename "$skill")
    
    # Skip global skills
    if [ -d "$REPO_ROOT/.agent/.registry/globals/$folder_name" ]; then
        continue
    fi

    target="$REPO_ROOT/.agent/.registry/$skill"
    link="$SKILLS_DIR/$folder_name"

    if [ -d "$target" ]; then
        if [ ! -e "$link" ] && [ ! -L "$link" ]; then
            echo "Antigravity Sync (POSIX): Linking skill -> $folder_name ($skill)"
            ln -s "$target" "$link"
            DRIFT_DETECTED=1
        fi
        ACTIVE_LIST="$ACTIVE_LIST \"$skill\","
    fi
done

# Prune stale domain skills in .agent/skills/ that are no longer matched
for current_link in "$SKILLS_DIR"/*; do
    [ -e "$current_link" ] || [ -L "$current_link" ] || continue
    link_name=$(basename "$current_link")
    [ "$link_name" = ".gitkeep" ] && continue

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

# Write updated .agent/.active-skills.json
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

exit 0
