#!/usr/bin/env bash
# The todo app's web/ before PR #4 of the Nov 9 test run, then the PR's change as one commit.
# That change hides the error when a control fails again after another success cleared its
# earlier failure; the run's task gates passed it, and only a later review round caught it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)/fixture"
git init -q -b main .
git config user.email eval@example.com && git config user.name eval
tar -xf "$here/base.tar"
mkdir -p tmp/team intent && cp "$here/context.md" tmp/team/context.md && cp "$here/task.md" intent/clear-save-error.md
git add -A && git commit -qm "base: todo list with toggle and delete"
git tag base
git apply "$here/change.patch"
git add -A && git commit -qm "web: clear save errors on any successful action"
