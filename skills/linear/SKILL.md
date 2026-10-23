---
name: linear
description: Fetch and summarize Linear issues via the GraphQL API directly, no MCP server. Also creates issues (with auto-created labels) for a known team. Use when the user asks about their Linear tickets, a team's backlog, a specific issue like ENG-123, wants to search Linear issues, or needs tickets filed from a spec.
---

Calls Linear's GraphQL API at https://api.linear.app/graphql through
`scripts/linear.sh`, which reads `LINEAR_API_KEY` from the environment. Never
print or echo the key.

## Commands

- `scripts/linear.sh my-issues [open|all]` — caller's assigned issues (default: open only)
- `scripts/linear.sh issue <IDENTIFIER>` — one issue by identifier, e.g. `ENG-123`
- `scripts/linear.sh team <TEAM_KEY> [limit]` — a team's issues (default limit 25)
- `scripts/linear.sh search <TEXT>` — full-text issue search
- `scripts/linear.sh raw < query.graphql` — escape hatch for anything the canned
  read queries don't cover; rejects any body containing the word `mutation`
- `scripts/linear.sh create-issue <TEAM_KEY> <TITLE> < payload.json` — creates
  one issue on that team. `payload.json` is
  `{"description": "...", "labels": ["a","b"], "project": "Name"}` (all three
  optional). Any label name that doesn't already exist on the team is created
  automatically. `project`, if given, must match an existing Linear project by
  name exactly — the project is not created if missing, and the command fails
  loudly instead of guessing. Prints the created issue's `identifier` and `url`.

Prefer the canned commands above — they're tested and return only the fields
needed for a summary (identifier, title, state, assignee, priority, url).
Fall back to `raw` only when the user needs a field or filter none of the
canned commands expose; `raw` stays read-only on purpose, mutations always go
through `create-issue` instead.

## Creating issues

`create-issue` is the one mutation this skill exposes, and it is scoped
tightly: one issue, one team, an optional existing project, auto-created
labels, nothing else (no assignee, no priority, no cycle). Ticket creation is
visible to the whole team and not easily undone — whoever calls this command
(e.g. the `orchestrator` skill) is responsible for showing the caller what's
about to be created and getting a confirmation first. This skill does not
prompt on its own.

## Setup

1. Linear → Settings → Security & access → Personal API keys → create one.
2. `export LINEAR_API_KEY=lin_api_...` in the shell Claude runs in.

## Limits

- Updating or deleting existing issues isn't covered — only read queries and
  single-issue creation.
- Requires outbound network access to `api.linear.app`. In a sandboxed cloud
  workspace without that host allowlisted, this will fail; use an MCP/connector
  instead in that environment.
