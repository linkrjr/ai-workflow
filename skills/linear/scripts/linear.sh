#!/usr/bin/env bash
# Linear GraphQL wrapper. Requires LINEAR_API_KEY in the environment.
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "error: LINEAR_API_KEY is not set" >&2
  exit 1
fi

usage() {
  cat <<'EOF' >&2
usage:
  linear.sh my-issues [state-filter]     # state-filter: open (default) | all
  linear.sh issue <IDENTIFIER>           # e.g. ENG-123
  linear.sh team <TEAM_KEY> [limit]      # e.g. ENG, default limit 25
  linear.sh search <TEXT>
  linear.sh raw < query.graphql          # escape hatch, read-only only
EOF
  exit 1
}

post() {
  local query="$1" variables="$2"
  jq -n --arg q "$query" --argjson v "$variables" '{query: $q, variables: $v}' \
    | curl -sS https://api.linear.app/graphql \
        -H "Authorization: ${LINEAR_API_KEY}" \
        -H "Content-Type: application/json" \
        --data-binary @- \
    | jq .
}

ISSUE_FIELDS='identifier title state { name } assignee { name } priority url'

cmd="${1:-}"
case "$cmd" in
  my-issues)
    state="${2:-open}"
    if [[ "$state" == "all" ]]; then
      filter='{assignee: {isMe: {eq: true}}}'
    else
      filter='{assignee: {isMe: {eq: true}}, state: {type: {nin: ["completed","canceled"]}}}'
    fi
    query="query { issues(filter: $filter, first: 50) { nodes { $ISSUE_FIELDS } } }"
    post "$query" '{}'
    ;;
  issue)
    id="${2:-}"; [[ -z "$id" ]] && usage
    query="query(\$id: String!) { issue(id: \$id) { $ISSUE_FIELDS description } }"
    post "$query" "$(jq -n --arg id "$id" '{id: $id}')"
    ;;
  team)
    key="${2:-}"; [[ -z "$key" ]] && usage
    limit="${3:-25}"
    query="query(\$key: String!, \$limit: Int!) { team(id: \$key) { issues(first: \$limit) { nodes { $ISSUE_FIELDS } } } }"
    post "$query" "$(jq -n --arg key "$key" --argjson limit "$limit" '{key: $key, limit: $limit}')"
    ;;
  search)
    text="${2:-}"; [[ -z "$text" ]] && usage
    query="query(\$term: String!) { issueSearch(term: \$term, first: 25) { nodes { $ISSUE_FIELDS } } }"
    post "$query" "$(jq -n --arg term "$text" '{term: $term}')"
    ;;
  raw)
    body="$(cat)"
    if grep -qi 'mutation' <<< "$body"; then
      echo "error: raw mode is read-only, mutations are rejected" >&2
      exit 1
    fi
    post "$body" '{}'
    ;;
  *)
    usage
    ;;
esac
