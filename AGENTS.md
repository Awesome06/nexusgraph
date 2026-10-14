# Workspace Agent Directives

## Bootstrap Protocol
- On session initialization:
  1. Verify Git hook configuration by checking if `.git/hooks/pre-commit` exists. If missing, execute `.agent/setup.ps1` (or verify that `.agent/.registry` is present).
  2. Check if the local `.agent/skills/` directory contains active domain skills.
  3. Automatically detect the application stack from repository manifest files (`pyproject.toml`, `package.json`, `go.mod`, etc.) and synchronize skills silently without pausing to ask the user for confirmation to analyze.
  4. Once skills are linked, strictly enforce their constraints during all subsequent code generation and review tasks.
  5. Note: Global skills (`code-review`, `doc-sync`, `error-discipline`, `git-release`, `incident-triaging`, `security-auditor`, `test-discipline`, `workspace-initializer`, `repo-wiki`) are pre-loaded at the machine level (`~/.gemini/config/skills/`). Do not attempt to symlink them into `.agent/skills/`.
  6. Repository Knowledge Graph: Check for `wiki/`. When architectural decisions, design contracts, or runbooks change, maintain atomic records using the `repo-wiki` protocol (`[[wikilinks]]`, YAML frontmatter). Use `.agent/wiki.ps1 query <topic>` (or `.agent/wiki.sh`) to slice context on demand without bloating the prompt window.

## General Constraints
- The `.agent/` and `.agents/` directories (including `.agent/.registry`) are internal registry, hook, and customization storage. NEVER treat them as application source code, and NEVER allow internal registry files to trigger skills.
- Do not add or remove third-party dependencies without explicit user confirmation.
- Keep the context window lean: do not load files into context unless actively modifying them.
- Run active linters and tests via `test-discipline` before staging any changes.
- Never run `git commit` or `git push` without explicit user instruction. Always leave changes uncommitted for user review.
