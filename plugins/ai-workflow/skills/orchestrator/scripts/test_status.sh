#!/usr/bin/env bash
# Self-check for status.sh, with stubbed cmux and Linear. No network calls are made.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/status.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
fail=0
check() { # desc, expected substring, actual
  if [[ "$3" == *"$2"* ]]; then echo "ok: $1"; else echo "FAIL: $1 (wanted '$2', got '$3')"; fail=1; fi
}

mkdir -p state bin intent
cat >state/state.md <<'S'
Feature PR: none
T1 Build it — AC1 — owner: backend-engineer — depends on: none — intent: intent/a.md — status: todo
T10 Other — AC2 — owner: frontend-engineer — depends on: none — linear: ENG-7 — status: todo
S
echo 'Linear team: ENG' >state/context.md
printf -- '---\nstatus: todo\n---\n\nAuthor: me. Status: todo\n' >intent/a.md
printf '#!/usr/bin/env bash\necho "$*" >>"%s/cmux.log"\n' "$tmp" >bin/cmux
printf '#!/usr/bin/env bash\necho "$*" >>"%s/linear.log"\n[[ "$4" != "In Review" ]]\n' "$tmp" >bin/linear
chmod +x bin/*
run() { PATH="$tmp/bin:$PATH" CMUX_WORKSPACE_ID=1 LINEAR_SH="$tmp/bin/linear" bash "$script" state "$@"; }

run T1 in-review 12
check "sets the status" "T1 Build it — AC1 — owner: backend-engineer — depends on: none — intent: intent/a.md — status: in-review" "$(<state/state.md)"
check "adds the PR" "— PR: #12" "$(sed -n 2p state/state.md)"
check "leaves a task with a longer ID alone" "T10 Other — AC2 — owner: frontend-engineer — depends on: none — linear: ENG-7 — status: todo" "$(<state/state.md)"
check "moves the intent frontmatter" "status: in-review" "$(sed -n 2p intent/a.md)"
check "moves the intent status line" "Status: in-review" "$(<intent/a.md)"
check "shows progress" "set-progress 0.30 --label 0/2 merged · 1 in review" "$(<cmux.log)"

run T1 merged
check "a merged task is done in its intent file" "status: done" "$(sed -n 2p intent/a.md)"
check "keeps one PR" "1" "$(sed -n 2p state/state.md | grep -o 'PR: #12' | wc -l | tr -d ' ')"

run T10 in-progress
check "starts the Linear ticket" "set-state ENG-7 ENG started" "$(<linear.log)"
out="$(run T10 merged)"
check "moves the ticket to In Review" "set-state ENG-7 ENG In Review" "$(<linear.log)"
check "a team with no In Review is a note, not a failure" "note: ENG-7 stays" "$out"

if run T99 merged 2>/dev/null; then echo "FAIL: unknown task accepted"; fail=1; else echo "ok: unknown task rejected"; fi
if run T1 nope 2>/dev/null; then echo "FAIL: unknown status accepted"; fail=1; else echo "ok: unknown status rejected"; fi

exit $fail
