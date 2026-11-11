#!/usr/bin/env bash
# A spec with no "Acceptance criteria" section: the orchestrator must stop before spawning anyone.
set -euo pipefail
git init -q -b main .
git config user.email eval@example.com && git config user.name eval
mkdir -p docs/specs
cat > docs/specs/dark-mode.md <<'SPEC'
# Dark mode

Type: FEATURE

Add a dark mode toggle to the settings page. It should remember the choice.
SPEC
git add -A && git commit -qm "spec: dark mode draft"
