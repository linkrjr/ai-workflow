#!/usr/bin/env bash
# Self-check for linear.sh argument validation and the mutation guard.
# No network calls are made (all cases here exit before curl is invoked).
set -euo pipefail
cd "$(dirname "$0")"

fail=0

assert_exit1() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL: $desc (expected exit 1, got 0)"
    fail=1
  else
    echo "ok: $desc"
  fi
}

LINEAR_API_KEY= assert_exit1 "missing LINEAR_API_KEY rejected" ./linear.sh my-issues
assert_exit1 "no subcommand shows usage" env LINEAR_API_KEY=x ./linear.sh
assert_exit1 "issue without identifier rejected" env LINEAR_API_KEY=x ./linear.sh issue
assert_exit1 "team without key rejected" env LINEAR_API_KEY=x ./linear.sh team
assert_exit1 "search without text rejected" env LINEAR_API_KEY=x ./linear.sh search
assert_exit1 "create-issue without title rejected" env LINEAR_API_KEY=x ./linear.sh create-issue ENG <<< '{}'
assert_exit1 "set-state without state type rejected" env LINEAR_API_KEY=x ./linear.sh set-state ENG-1 ENG

if echo 'mutation { issueCreate }' | LINEAR_API_KEY=x ./linear.sh raw >/dev/null 2>&1; then
  echo "FAIL: mutation guard did not reject a mutation"
  fail=1
else
  echo "ok: mutation guard rejects 'mutation' bodies"
fi

exit $fail
