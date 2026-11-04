#!/usr/bin/env bash
# Self-check for cleanup.sh, with a real local git remote and a stubbed gh.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/cleanup.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail=0
check() { # desc, expected, actual
  if [[ "$3" == "$2" ]]; then echo "ok: $1"; else echo "FAIL: $1 (wanted '$2', got '$3')"; fail=1; fi
}

mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'EOS'
#!/usr/bin/env bash
case "$3" in
  1) echo "task/merged MERGED" ;;
  2) echo "task/open OPEN" ;;
  3) echo "feature/x MERGED" ;;
esac
EOS
chmod +x "$tmp/bin/gh"

git init -q --bare "$tmp/remote.git"
git init -q -b main "$tmp/repo"
cd "$tmp/repo"
git config user.email t@t; git config user.name t
git commit -q --allow-empty -m init
git remote add origin "$tmp/remote.git"
for b in task/merged task/open feature/x; do git branch "$b"; git push -q origin "$b"; done
git worktree add -q "$tmp/repo.worktrees/t1" task/merged
git worktree add -q "$tmp/other" -b keep

out="$(PATH="$tmp/bin:$PATH" bash "$script" 1 2 3)"

check "removes the agent worktree" no "$([[ -d "$tmp/repo.worktrees/t1" ]] && echo yes || echo no)"
check "keeps a worktree outside the agent folder" yes "$([[ -d "$tmp/other" ]] && echo yes || echo no)"
check "deletes a merged task branch locally" "" "$(git branch --list task/merged)"
check "deletes a merged task branch on the remote" "" "$(git ls-remote --heads origin task/merged)"
check "keeps an open PR's branch" 1 "$(git branch --list task/open | wc -l | tr -d ' ')"
check "keeps a merged PR's non-task branch" 1 "$(git ls-remote --heads origin feature/x | wc -l | tr -d ' ')"
check "names what it left behind" 1 "$(grep -c 'left behind' <<<"$out")"

exit $fail
