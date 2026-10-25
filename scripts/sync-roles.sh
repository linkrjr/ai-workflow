#!/usr/bin/env bash
# Copies each agents/<role>.md body (frontmatter stripped) into
# skills/orchestrator/roles/<role>.md, so the orchestrator skill carries the
# role instructions with it when installed outside Claude Code.
# --check: exit 1 if roles/ is out of date instead of writing.
set -euo pipefail
cd "$(dirname "$0")/.."

out=skills/orchestrator/roles
check=false
[[ "${1:-}" == "--check" ]] && check=true
[[ "$check" == true ]] && out=$(mktemp -d)
mkdir -p "$out"

for agent in agents/*.md; do
  role=$(basename "$agent" .md)
  {
    echo "<!-- Generated from agents/$role.md by scripts/sync-roles.sh. Edit that file, not this one. -->"
    echo
    awk 'n >= 2 { print } /^---$/ { n++ }' "$agent"
  } > "$out/$role.md"
done

if [[ "$check" == true ]]; then
  diff -r "$out" skills/orchestrator/roles > /dev/null || {
    echo "skills/orchestrator/roles is out of date: run scripts/sync-roles.sh" >&2
    exit 1
  }
fi
