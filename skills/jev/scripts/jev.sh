#!/usr/bin/env bash
# Jev (TypeSafe AI "System One" model) advisory signals for the ai-workflow pipeline.
# Reads TYPESAFE_API_KEY from the environment. Never blocks: when the key is
# missing or the call fails, it prints "JEV <command>: UNAVAILABLE ..." and exits 0.
# Only a usage error exits non-zero.
set -euo pipefail

API_URL="${JEV_API_URL:-https://api.typesafe.ai/v1/systemone}"
MODEL="${JEV_MODEL:-jev-latest}"
FLAG_AT="${JEV_FLAG_AT:-0.6}"          # a noul at or above this value is flagged
MAX_STATE_BYTES="${JEV_MAX_STATE_BYTES:-400000}"

usage() {
  cat <<'EOF2' >&2
usage:
  jev.sh triage < pr.diff                       # risk signals for a PR diff
  jev.sh loop-guard <PREV_FILE> <CURRENT_FILE>  # are review rounds repeating the same findings?
  jev.sh spec-check < spec.md                   # is the spec clear enough to build?
env: TYPESAFE_API_KEY (required for a result), JEV_FLAG_AT (default 0.6),
     JEV_MODEL (default jev-latest), JEV_API_URL
EOF2
  exit 1
}

[[ $# -ge 1 ]] || usage
cmd="$1"; shift

# Each question is a noul: Jev returns a 0-1 truth value for the statement.
# Every statement is phrased so that a HIGH value is a concern.
case "$cmd" in
  triage)
    [[ $# -eq 0 ]] || usage
    state="$(head -c "$MAX_STATE_BYTES")"
    questions='{
      "security_surface":   {"type":"noul","instructions":"The change touches authentication, authorization, secrets, cryptography, user input handling, or network-facing code"},
      "contract_change":    {"type":"noul","instructions":"The change alters a public API, a data schema, a migration, or a contract between frontend and backend"},
      "untested_logic":     {"type":"noul","instructions":"The change adds or modifies non-trivial logic without adding or updating tests"},
      "mixed_concerns":     {"type":"noul","instructions":"The change does more than one unrelated thing"}
    }'
    ;;
  loop-guard)
    [[ $# -eq 2 && -r "$1" && -r "$2" ]] || usage
    state="PREVIOUS ROUND FINDINGS:
$(head -c "$((MAX_STATE_BYTES / 2))" "$1")

CURRENT ROUND FINDINGS:
$(head -c "$((MAX_STATE_BYTES / 2))" "$2")"
    questions='{
      "repeated_findings":  {"type":"noul","instructions":"The current round reports the same defects as the previous round, so the fixes did not resolve them"},
      "oscillating":        {"type":"noul","instructions":"The current round asks for changes that reverse or undo what the previous round asked for"}
    }'
    ;;
  spec-check)
    [[ $# -eq 0 ]] || usage
    state="$(head -c "$MAX_STATE_BYTES")"
    questions='{
      "untestable_criteria":{"type":"noul","instructions":"At least one acceptance criterion is vague or cannot be checked as pass or fail"},
      "missing_states":     {"type":"noul","instructions":"The spec leaves out empty, loading or error states, limits and defaults, or what is out of scope"},
      "implementation_detail":{"type":"noul","instructions":"The spec names classes, files or other implementation details instead of product behaviour"},
      "ambiguous_wording":  {"type":"noul","instructions":"The spec contains wording that two engineers would implement differently"}
    }'
    ;;
  *) usage ;;
esac

if [[ -z "$state" ]]; then
  echo "JEV $cmd: UNAVAILABLE (empty input)"
  exit 0
fi
if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
  echo "JEV $cmd: UNAVAILABLE (TYPESAFE_API_KEY is not set)"
  exit 0
fi

err="$(mktemp)"; trap 'rm -f "$err"' EXIT
if ! response="$(
  jq -n --arg state "$state" --arg model "$MODEL" --argjson questions "$questions" \
        '{state: $state, model: $model, questions: $questions}' \
  | curl --fail-with-body --silent --show-error --max-time 30 "$API_URL" \
      -H "Authorization: Bearer ${TYPESAFE_API_KEY}" \
      -H "Content-Type: application/json" \
      --data-binary @- 2>"$err"
)"; then
  echo "JEV $cmd: UNAVAILABLE (request failed: $(head -c 200 "$err" | tr '\n' ' '))"
  exit 0
fi

if ! rows="$(jq -er '.answers | to_entries[] | "\(.key)\t\(.value.noul)"' <<<"$response" 2>/dev/null)" \
   || [[ -z "$rows" ]]; then
  echo "JEV $cmd: UNAVAILABLE (unexpected response shape)"
  exit 0
fi

flags=0
out=""
while IFS=$'\t' read -r id value; do
  if ! [[ "$value" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    echo "JEV $cmd: UNAVAILABLE (non-numeric answer for $id)"
    exit 0
  fi
  if awk -v v="$value" -v t="$FLAG_AT" 'BEGIN { exit !(v >= t) }'; then
    mark="FLAG"; flags=$((flags + 1))
  else
    mark="ok"
  fi
  out+="$(printf '%s: %.2f %s' "$id" "$value" "$mark")"$'\n'
done <<<"$rows"

echo "JEV $cmd: OK"
printf '%s' "$out"
if [[ "$cmd" == "loop-guard" ]]; then
  if (( flags > 0 )); then echo "JEV VERDICT: STALLED"; else echo "JEV VERDICT: PROGRESSING"; fi
else
  if (( flags > 0 )); then echo "JEV VERDICT: ATTENTION ($flags)"; else echo "JEV VERDICT: NO SIGNALS"; fi
fi
