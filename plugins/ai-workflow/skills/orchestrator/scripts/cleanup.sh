#!/usr/bin/env bash
# End-of-run cleanup, run from the main worktree: cleanup.sh <pr number>...
# Removes this repo's agent worktrees, then deletes the task branch of each merged PR.
# Prints what it deleted, and any task/* branch left behind. Never touches another branch.
set -euo pipefail

main="$(git rev-parse --show-toplevel)"
prefix="$(dirname "$main")/$(basename "$main").worktrees/"

git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r path; do
  if [[ "$path" == "$prefix"* ]]; then
    git worktree remove --force "$path"
    echo "removed worktree $path"
  fi
done
git worktree prune

for pr in "$@"; do
  read -r branch state < <(gh pr view "$pr" --json headRefName,state -q '.headRefName + " " + .state')
  [[ "$state" == MERGED && "$branch" == task/* ]] || continue
  if [[ -n "$(git ls-remote --heads origin "$branch")" ]]; then
    git push origin --delete "$branch" >/dev/null 2>&1
    echo "deleted remote $branch"
  fi
  # -D: a squash merge looks unmerged to git. MERGED above is the proof the work is in the base.
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch -D "$branch" >/dev/null
    echo "deleted local $branch"
  fi
done

git fetch --prune origin >/dev/null 2>&1
left="$(git branch --list 'task/*'; git ls-remote --heads origin 'task/*')"
if [[ -n "$left" ]]; then
  echo "left behind:"
  echo "$left"
fi
