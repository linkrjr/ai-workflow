#!/usr/bin/env bash
# check.sh against a bare machine (no tools, empty HOME) and a full one (stubbed tools).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
fail() { echo "FAIL: $*"; exit 1; }
BASH_BIN=$(command -v bash)

mkdir -p "$t/bare-bin" "$t/bare-home" "$t/work"
ln -s "$BASH_BIN" "$t/bare-bin/bash"
for b in dirname grep; do ln -s "$(command -v $b)" "$t/bare-bin/$b"; done
out=$(cd "$t/work" && env -i PATH="$t/bare-bin" HOME="$t/bare-home" bash "$here/check.sh") && fail "bare machine should exit 1"
grep -q '^MISSING gh: ' <<<"$out" || fail "gh not reported missing"
grep -q '^MISSING pinchtab-skill: ' <<<"$out" || fail "pinchtab skill not reported missing"
grep -q '^OPTIONAL agent-teams: ' <<<"$out" || fail "agent teams should be optional"
grep -q '^OPTIONAL git-allow: ' <<<"$out" || fail "missing git allow rules should be optional"
# 8 required items; Chrome may still be found in /Applications on a Mac.
grep -Eq '^SETUP: [78] MISSING$' <<<"$out" || fail "expected 7-8 missing, got: $(tail -1 <<<"$out")"

mkdir -p "$t/full-bin" "$t/full-home/.claude/skills/pinchtab" "$t/full-home/.claude/skills/graphify"
touch "$t/full-home/.claude/skills/pinchtab/SKILL.md" "$t/full-home/.claude/skills/graphify/SKILL.md"
echo '{"permissions":{"allow":["Bash(git commit:*)"]}}' > "$t/full-home/.claude/settings.json"
ln -s "$(command -v grep)" "$t/full-bin/grep"
ln -s "$BASH_BIN" "$t/full-bin/bash"
for b in git gh jq curl pinchtab chromium graphify cmux; do printf '#!/bin/sh\nexit 0\n' > "$t/full-bin/$b"; chmod +x "$t/full-bin/$b"; done
out=$(cd "$t/work" && env -i PATH="$t/full-bin" HOME="$t/full-home" CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 LINEAR_API_KEY=x bash "$here/check.sh") || fail "full machine should exit 0: $out"
grep -q '^SETUP: READY$' <<<"$out" || fail "full machine not READY"
grep -q '^OK git-allow: ' <<<"$out" || fail "an allow rule in user settings should count"
grep -q '^OPTIONAL jev: ' <<<"$out" || fail "missing TYPESAFE_API_KEY should be optional"
[[ $(grep '^OK linear' <<<"$out") == 'OK linear: LINEAR_API_KEY set' ]] || fail "the linear line should name the variable, never its value"
echo "check.sh: all tests passed"
