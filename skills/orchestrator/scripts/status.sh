#!/usr/bin/env bash
# Moves one task to a new status in a single call, from the main worktree: its line in
# state.md, its intent file or Linear ticket, and the cmux progress bar.
# usage: status.sh <state dir> <task ID> <status> [PR number]
set -euo pipefail

[[ $# -ge 3 ]] || { echo "usage: status.sh <state dir> <task ID> <status> [PR number]" >&2; exit 1; }
state="$1"; id="$2"; status="$3"; pr="${4:-}"
file="$state/state.md"

case "$status" in
  todo|in-progress|in-review|changes-requested|approved|merged|stopped) ;;
  *) echo "error: unknown status '$status'" >&2; exit 1 ;;
esac
line="$(grep -E "^$id " "$file")" || { echo "error: no task $id in $file" >&2; exit 1; }

new="$line"
if [[ -n "$pr" && "$new" != *"— PR: "* ]]; then new="$new — PR: #$pr"; fi
if [[ "$new" == *"— status: "* ]]; then
  new="$(sed -E "s/— status: [a-z-]+/— status: $status/" <<<"$new")"
else
  new="$new — status: $status"
fi
awk -v id="$id " -v new="$new" 'index($0, id) == 1 { print new; next } { print }' "$file" >"$file.tmp"
mv "$file.tmp" "$file"

intent="$(sed -nE 's/.*— intent: ([^ ]+).*/\1/p' <<<"$new")"
if [[ -n "$intent" ]]; then
  case "$status" in
    changes-requested|approved) word=in-review ;;
    merged) word=done ;;
    *) word="$status" ;;
  esac
  sed -E "s/^status: .*/status: $word/; s/Status: [a-z-]+\$/Status: $word/" "$intent" >"$intent.tmp"
  mv "$intent.tmp" "$intent"
fi

ticket="$(sed -nE 's/.*— linear: ([^ ]+).*/\1/p' <<<"$new")"
if [[ -n "$ticket" ]]; then
  case "$status" in
    in-progress) target=started ;;
    merged) target="In Review" ;;
    *) target="" ;;
  esac
  if [[ -n "$target" ]]; then
    team="$(sed -nE 's/^(- )?Linear team: *//p' "$state/context.md")"
    linear="${LINEAR_SH:-$(dirname "$0")/../../linear/scripts/linear.sh}"
    "$linear" set-state "$ticket" "$team" "$target" >/dev/null 2>&1 \
      || echo "note: $ticket stays in its current Linear state (no '$target' on team $team, or the call failed)"
  fi
fi

if [[ -n "${CMUX_WORKSPACE_ID:-}" ]] && command -v cmux >/dev/null; then
  read -r p label < <(awk '
    /^T[0-9]+ / {
      n++
      w = 0
      if (/— status: in-progress/) w = .25
      if (/— status: (in-review|changes-requested)/) { w = .5; r++ }
      if (/— status: approved/) w = .75
      if (/— status: (merged|stopped)/) { w = 1; m++ }
      sum += w
    }
    END { printf "%.2f %d/%d merged · %d in review\n", .1 + .8 * sum / n, m, n, r }' "$file")
  cmux set-progress "$p" --label "$label" >/dev/null 2>&1 || true
fi
