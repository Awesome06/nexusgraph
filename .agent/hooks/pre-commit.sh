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

# Preload manifest contents for semantic keyword scanning
MANIFEST_TEXT=""
MANIFEST_FILES=$(find . -maxdepth 4 -type f \( -name "requirements*.txt" -o -name "pyproject.toml" -o -name "Pipfile" -o -name "package.json" -o -name "go.mod" -o -name "Cargo.toml" -o -name "uv.lock" \) \
    -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/vendor*' -not -path '*/.venv*' 2>/dev/null)
for mf in $MANIFEST_FILES; do
    if [ -f "$mf" ]; then
        MANIFEST_TEXT="$MANIFEST_TEXT $(cat "$mf" 2>/dev/null)"
    fi
done

scan_trigger() {
    trigger="$1"
    # Never match customization roots or internal machinery
    case "$trigger" in
        .*|agents*|workflows*|tests*|scripts*) return 1 ;;
    esac

    # 1. Direct root check
    if [ -e "$trigger" ]; then
        return 0
    fi

    # 2. Directory trigger check
    case "$trigger" in
        */)
            dir_name=$(basename "$trigger")
            if find . -maxdepth 4 -type d -name "$dir_name" \
                -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/vendor*' -not -path '*/.venv*' \
                2>/dev/null | grep -q .; then
                return 0
            fi
            ;;
        *.*)
            # 3. File trigger check
            file_name=$(basename "$trigger")
            if find . -maxdepth 4 -type f -name "$file_name" \
                -not -path '*/.*' -not -path '*/node_modules*' -not -path '*/vendor*' -not -path '*/.venv*' \
                2>/dev/null | grep -q .; then
                return 0
            fi
            ;;
        *)
            # 4. Semantic manifest & stem check
            if echo "$MANIFEST_TEXT" | grep -iq "[^a-zA-Z0-9_-]${trigger}[^a-zA-Z0-9_-]"; then
                return 0
            fi
            if find . -maxdepth 4 -name "*$trigger*" \
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
    if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
        PY_CMD=$(command -v python3 || command -v python)
        MATCHED_SKILLS=$("$PY_CMD" -c "
import json, os, sys, re

with open('$REGISTRY_MAP', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

# Collect manifest content
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

    # 1. Root check
    if os.path.exists(trig):
        matched.update(skills)
        continue

    trig_clean = trig.rstrip('/')
    trig_base = os.path.basename(trig_clean)

    # 2. Directory check
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

    # 3. File check
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

    # 4. Semantic manifest check & stem fallback
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
    elif command -v jq >/dev/null 2>&1; then
        TRIGGERS=$(jq -r 'keys[]' "$REGISTRY_MAP")
        for trig in $TRIGGERS; do
            if scan_trigger "$trig"; then
                SKILLS_FOR_TRIG=$(jq -r --arg t "$trig" '.[$t][]' "$REGISTRY_MAP")
                for s in $SKILLS_FOR_TRIG; do
                    MATCHED_SKILLS="$MATCHED_SKILLS $s"
                done
            fi
        done
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

# 3. Validate repository wiki knowledge graph if present
WIKI_ENGINE=".agent/.registry/scripts/wiki-engine.py"
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
