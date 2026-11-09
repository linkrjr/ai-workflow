#!/usr/bin/env bash
# Checks what ai-workflow needs on this machine. One line per item:
#   OK|MISSING|OPTIONAL <id>: <what> [— <what is lost without it>]
# then `SETUP: READY` or `SETUP: <n> MISSING`. Exits 1 when a required item is missing.
# Reads no secrets: for an API key it only checks that the variable is set.
set -uo pipefail

missing=0
have() { command -v "$1" >/dev/null 2>&1; }
line() { # status id what cost
  if [[ $1 == OK ]]; then echo "OK $2: $3"; else echo "$1 $2: $3 — $4"; fi
  [[ $1 == MISSING ]] && missing=$((missing + 1))
  return 0
}
need() { # id what cost test...
  local id=$1 what=$2 cost=$3; shift 3
  if "$@"; then line OK "$id" "$what"; else line MISSING "$id" "$what" "$cost"; fi
}
want() {
  local id=$1 what=$2 cost=$3; shift 3
  if "$@"; then line OK "$id" "$what"; else line OPTIONAL "$id" "$what" "$cost"; fi
}
skill() { [[ -f "$HOME/.claude/skills/$1/SKILL.md" || -f ".claude/skills/$1/SKILL.md" ]]; }
chrome() {
  have google-chrome || have google-chrome-stable || have chromium || have chromium-browser ||
    [[ -d "/Applications/Google Chrome.app" || -d "$HOME/Applications/Google Chrome.app" ]]
}
gh_auth() { have gh && gh auth status >/dev/null 2>&1; }
teams() { [[ ${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-} == 1 ]]; }
task_tools() { [[ ${CLAUDE_CODE_ENABLE_TODO_TOOLS:-} == 1 ]]; }
set_() { [[ -n ${!1:-} ]]; }

need git "git" "nothing can run" have git
need gh "GitHub CLI (gh)" "engineers can't open PRs" have gh
need gh-auth "gh signed in" "engineers can't open PRs" gh_auth
need jq "jq" "Jev, Linear and the status script fail" have jq
need curl "curl" "Jev and Linear fail" have curl
need pinchtab "pinchtab CLI" "QA can't drive the UI, so every UI check comes back BLOCKED" have pinchtab
need pinchtab-skill "pinchtab skill" "QA doesn't know the pinchtab commands" skill pinchtab
need chrome "Chrome or Chromium" "pinchtab has no browser to drive" chrome
want agent-teams "agent teams on (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)" "agents run as plain subagents" teams
want task-tools "task list tools on (CLAUDE_CODE_ENABLE_TODO_TOOLS=1)" "newer models get no TaskCreate, so team mode runs its fallback: no shared task list, no task gate" task_tools
want graphify "graphify CLI and skill" "no codebase graph" bash -c 'command -v graphify >/dev/null && { [ -f "$HOME/.claude/skills/graphify/SKILL.md" ] || [ -f .claude/skills/graphify/SKILL.md ]; }'
want linear "LINEAR_API_KEY set" "tasks can't be tracked in Linear" set_ LINEAR_API_KEY
want jev "TYPESAFE_API_KEY set" "no Jev signals (off by default anyway)" set_ TYPESAFE_API_KEY
want cmux "cmux" "no progress bar in cmux" have cmux

if ((missing)); then echo "SETUP: $missing MISSING"; exit 1; fi
echo "SETUP: READY"
