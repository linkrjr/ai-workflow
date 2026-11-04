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

# The rest run against a stubbed curl: STUB_MODE picks the failure, and every
# issueCreate input is appended to $STUB_LOG.
stub="$(mktemp -d)"; trap 'rm -rf "$stub"' EXIT
export STUB_LOG="$stub/created.log"
cat >"$stub/curl" <<'EOS'
#!/usr/bin/env bash
body="$(cat)"
case "$body" in
  *issueCreate*)
    jq -c '.variables.input' <<<"$body" >>"$STUB_LOG"
    if [[ "${STUB_MODE:-}" == create-false ]]; then echo '{"data":{"issueCreate":{"success":false}}}'
    else echo '{"data":{"issueCreate":{"success":true,"issue":{"identifier":"ENG-1"}}}}'; fi ;;
  *issueLabelCreate*)
    if [[ "${STUB_MODE:-}" == label-fails ]]; then echo '{"errors":[{"message":"nope"}]}'
    else echo '{"data":{"issueLabelCreate":{"issueLabel":{"id":"new-label"}}}}'; fi ;;
  *issueLabels*) echo '{"data":{"issueLabels":{"nodes":[]}}}' ;;
  *issueUpdate*) echo '{"errors":[{"message":"nope"}]}' ;;
  *states*) echo '{"data":{"team":{"states":{"nodes":[{"id":"s1","type":"started"},{"id":"s2","type":"completed"}]}}}}' ;;
  *viewer*) echo '{"data":{"viewer":{"id":"v1"}}}' ;;
  *) echo '{"data":{"team":{"id":"t1"}}}' ;;
esac
EOS
chmod +x "$stub/curl"

create() { # stub mode, payload
  : >"$STUB_LOG"
  PATH="$stub:$PATH" STUB_MODE="$1" LINEAR_API_KEY=x ./linear.sh create-issue ENG Title <<<"$2" >/dev/null 2>&1
}
check() { # desc, expected, actual
  if [[ "$3" == "$2" ]]; then echo "ok: $1"; else echo "FAIL: $1 (wanted '$2', got '$3')"; fail=1; fi
}

rc=0; create "" '{"description":"d"}' || rc=$?
check "create-issue without labels succeeds" 0 "$rc"
check "create-issue without labels sends no label ids" '[]' "$(jq -c '.labelIds' "$STUB_LOG")"

rc=0; create "" '{"labels":["a"]}' || rc=$?
check "create-issue with a new label succeeds" 0 "$rc"
check "create-issue sends the created label's id" '["new-label"]' "$(jq -c '.labelIds' "$STUB_LOG")"

rc=0; create label-fails '{"labels":["a"]}' || rc=$?
check "a failed label creation exits 1" 1 "$rc"
check "a failed label creation creates no issue" 0 "$(wc -l <"$STUB_LOG" | tr -d ' ')"

rc=0; create create-false '{}' || rc=$?
check "success:false from Linear exits 1" 1 "$rc"

rc=0; PATH="$stub:$PATH" LINEAR_API_KEY=x ./linear.sh set-state ENG-1 ENG completed >/dev/null 2>&1 || rc=$?
check "GraphQL errors on the final mutation exit 1" 1 "$rc"

exit $fail
