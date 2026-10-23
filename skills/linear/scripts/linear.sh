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
  linear.sh projects [limit]             # list Linear projects, default limit 50
  linear.sh raw < query.graphql          # escape hatch, read-only only
  linear.sh create-issue <TEAM_KEY> <TITLE> < payload.json
                                          # payload: {"description": "...", "labels": ["a","b"], "project": "Name"}
                                          # "project" is optional; creates missing labels on
                                          # that team automatically; fails if "project" is set
                                          # but no matching Linear project exists.
                                          # Assigns the issue to the API key's own user and
                                          # sets it to the team's "started" (in progress) state.
  linear.sh set-state <IDENTIFIER> <TEAM_KEY> <STATE_TYPE>
                                          # STATE_TYPE: backlog | unstarted | started | completed | canceled
                                          # moves an existing issue to that workflow state
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

find_team_id() {
  local key="$1"
  local query='query($key: String!) { team(id: $key) { id } }'
  local resp; resp="$(post "$query" "$(jq -n --arg key "$key" '{key: $key}')")"
  local id; id="$(jq -r '.data.team.id // empty' <<< "$resp")"
  if [[ -z "$id" ]]; then
    echo "error: team '$key' not found" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "$id"
}

ensure_label_id() {
  local team_id="$1" name="$2"
  local query='query($teamId: ID!, $name: String!) { issueLabels(filter: { team: { id: { eq: $teamId } }, name: { eq: $name } }) { nodes { id } } }'
  local resp; resp="$(post "$query" "$(jq -n --arg teamId "$team_id" --arg name "$name" '{teamId: $teamId, name: $name}')")"
  local id; id="$(jq -r '.data.issueLabels.nodes[0].id // empty' <<< "$resp")"
  if [[ -n "$id" ]]; then
    echo "$id"
    return
  fi
  local mquery='mutation($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { issueLabel { id } } }'
  resp="$(post "$mquery" "$(jq -n --arg teamId "$team_id" --arg name "$name" '{input: {teamId: $teamId, name: $name}}')")"
  id="$(jq -r '.data.issueLabelCreate.issueLabel.id // empty' <<< "$resp")"
  if [[ -z "$id" ]]; then
    echo "error: failed to create label '$name'" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "$id"
}

ensure_label_ids() {
  local team_id="$1" names_json="$2"
  local name ids=()
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    ids+=("$(ensure_label_id "$team_id" "$name")")
  done < <(jq -r '.[]' <<< "$names_json")
  printf '%s\n' "${ids[@]}" | jq -R . | jq -s .
}

find_project_id() {
  local name="$1"
  local query='query($name: String!) { projects(filter: { name: { eq: $name } }) { nodes { id } } }'
  local resp; resp="$(post "$query" "$(jq -n --arg name "$name" '{name: $name}')")"
  local count; count="$(jq '.data.projects.nodes | length' <<< "$resp")"
  if [[ "$count" -eq 0 ]]; then
    echo "error: project '$name' not found in Linear" >&2
    exit 1
  fi
  if [[ "$count" -gt 1 ]]; then
    echo "error: multiple Linear projects named '$name', ambiguous" >&2
    exit 1
  fi
  jq -r '.data.projects.nodes[0].id' <<< "$resp"
}

find_viewer_id() {
  local resp; resp="$(post 'query { viewer { id } }' '{}')"
  local id; id="$(jq -r '.data.viewer.id // empty' <<< "$resp")"
  if [[ -z "$id" ]]; then
    echo "error: could not resolve the API key's own user" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "$id"
}

find_state_id() {
  local team_id="$1" state_type="$2"
  local query='query($teamId: String!) { team(id: $teamId) { states { nodes { id type } } } }'
  local resp; resp="$(post "$query" "$(jq -n --arg teamId "$team_id" '{teamId: $teamId}')")"
  local id; id="$(jq -r --arg type "$state_type" '[.data.team.states.nodes[] | select(.type == $type)][0].id // empty' <<< "$resp")"
  if [[ -z "$id" ]]; then
    echo "error: no '$state_type' workflow state found for this team" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "$id"
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
  projects)
    limit="${2:-50}"
    query="query(\$limit: Int!) { projects(first: \$limit) { nodes { id name } } }"
    post "$query" "$(jq -n --argjson limit "$limit" '{limit: $limit}')"
    ;;
  raw)
    body="$(cat)"
    if grep -qi 'mutation' <<< "$body"; then
      echo "error: raw mode is read-only, mutations are rejected" >&2
      exit 1
    fi
    post "$body" '{}'
    ;;
  create-issue)
    team_key="${2:-}"; title="${3:-}"
    [[ -z "$team_key" || -z "$title" ]] && usage
    payload="$(cat)"
    description="$(jq -r '.description // ""' <<< "$payload")"
    labels="$(jq -c '.labels // []' <<< "$payload")"
    project_name="$(jq -r '.project // ""' <<< "$payload")"

    team_id="$(find_team_id "$team_key")"
    label_ids="$(ensure_label_ids "$team_id" "$labels")"
    assignee_id="$(find_viewer_id)"
    state_id="$(find_state_id "$team_id" "started")"

    input="$(jq -n --arg teamId "$team_id" --arg title "$title" --arg desc "$description" \
      --argjson labelIds "$label_ids" --arg assigneeId "$assignee_id" --arg stateId "$state_id" \
      '{teamId: $teamId, title: $title, description: $desc, labelIds: $labelIds, assigneeId: $assigneeId, stateId: $stateId}')"
    if [[ -n "$project_name" ]]; then
      project_id="$(find_project_id "$project_name")"
      input="$(jq --arg projectId "$project_id" '. + {projectId: $projectId}' <<< "$input")"
    fi

    query='mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }'
    post "$query" "$(jq -n --argjson input "$input" '{input: $input}')"
    ;;
  set-state)
    issue_id="${2:-}"; team_key="${3:-}"; state_type="${4:-}"
    [[ -z "$issue_id" || -z "$team_key" || -z "$state_type" ]] && usage
    team_id="$(find_team_id "$team_key")"
    state_id="$(find_state_id "$team_id" "$state_type")"
    query='mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { identifier state { name type } } } }'
    post "$query" "$(jq -n --arg id "$issue_id" --arg stateId "$state_id" '{id: $id, input: {stateId: $stateId}}')"
    ;;
  *)
    usage
    ;;
esac
