---
name: linear
description: Fetch and summarize Linear issues via the GraphQL API directly, no MCP server. Also creates issues (self-assigned, auto-created labels, set in progress) for a known team, and moves issues between workflow states. Use when the user asks about their Linear tickets, a team's backlog, a specific issue like ENG-123, wants to search Linear issues, or needs tickets filed or closed out from a spec.
---

Calls Linear's GraphQL API at https://api.linear.app/graphql through
`scripts/linear.sh`, which reads `LINEAR_API_KEY` from the environment. Never
print or echo the key.

## Commands

- `scripts/linear.sh my-issues [open|all]` — caller's assigned issues (default: open only)
- `scripts/linear.sh issue <IDENTIFIER>` — one issue by identifier, e.g. `ENG-123`
- `scripts/linear.sh team <TEAM_KEY> [limit]` — a team's issues (default limit 25)
- `scripts/linear.sh search <TEXT>` — full-text issue search
- `scripts/linear.sh projects [limit]` — list Linear projects (id, name; default limit 50) — use this to let a caller pick a project by name before passing it to `create-issue`
- `scripts/linear.sh raw < query.graphql` — escape hatch for anything the canned
  read queries don't cover; rejects any body containing the word `mutation`
- `scripts/linear.sh create-issue <TEAM_KEY> <TITLE> < payload.json` — creates
  one issue on that team. `payload.json` is
  `{"description": "...", "labels": ["a","b"], "project": "Name"}` (all three
  optional). Any label name that doesn't already exist on the team is created
  automatically. `project`, if given, must match an existing Linear project by
  name exactly — the project is not created if missing, and the command fails
  loudly instead of guessing. The issue is assigned to the API key's own user
  and set to the team's `started` (in progress) workflow state. Prints the
  created issue's `identifier` and `url`.
- `scripts/linear.sh set-state <IDENTIFIER> <TEAM_KEY> <STATE_TYPE>` — moves
  an existing issue to a workflow state, where `STATE_TYPE` is one of Linear's
  standard types: `backlog`, `unstarted`, `started`, `completed`, `canceled`.
  Fails loudly if the team has no state of that type.

Prefer the canned commands above — they're tested and return only the fields
needed for a summary (identifier, title, state, assignee, priority, url).
Fall back to `raw` only when the user needs a field or filter none of the
canned commands expose; `raw` stays read-only on purpose, mutations always go
through `create-issue` instead.

## Creating and updating issues

`create-issue` and `set-state` are the two mutations this skill exposes, and
both are scoped tightly: `create-issue` is one issue, one team, an optional
existing project, auto-created labels, self-assignment, and an initial
`started` state — nothing else (no priority, no cycle). `set-state` only
moves an issue between existing workflow states, nothing else. Ticket
creation and state changes are visible to the whole team and not easily
undone — whoever calls these commands (e.g. the `orchestrator` skill) is
responsible for showing the caller what's about to happen and getting a
confirmation first. This skill does not prompt on its own.

## Setup

1. Linear → Settings → Security & access → Personal API keys → create one.
2. `export LINEAR_API_KEY=lin_api_...` in the shell Claude runs in.

## Limits

- Deleting issues, and updating fields other than workflow state, isn't
  covered — only read queries, single-issue creation, and `set-state`.
- Requires outbound network access to `api.linear.app`. In a sandboxed cloud
  workspace without that host allowlisted, this will fail; use an MCP/connector
  instead in that environment.
