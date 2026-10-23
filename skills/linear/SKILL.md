---
name: linear
description: Fetch and summarize Linear issues via the GraphQL API directly, no MCP server. Use when the user asks about their Linear tickets, a team's backlog, a specific issue like ENG-123, or wants to search Linear issues.
---

Read-only skill. Calls Linear's GraphQL API at https://api.linear.app/graphql
through `scripts/linear.sh`, which reads `LINEAR_API_KEY` from the environment.
Never print or echo the key.

## Commands

- `scripts/linear.sh my-issues [open|all]` — caller's assigned issues (default: open only)
- `scripts/linear.sh issue <IDENTIFIER>` — one issue by identifier, e.g. `ENG-123`
- `scripts/linear.sh team <TEAM_KEY> [limit]` — a team's issues (default limit 25)
- `scripts/linear.sh search <TEXT>` — full-text issue search
- `scripts/linear.sh raw < query.graphql` — escape hatch for anything the canned
  queries don't cover; rejects any body containing the word `mutation`

Prefer the canned commands above — they're tested and return only the fields
needed for a summary (identifier, title, state, assignee, priority, url).
Fall back to `raw` only when the user needs a field or filter none of the
canned commands expose.

## Setup

1. Linear → Settings → Security & access → Personal API keys → create one.
2. `export LINEAR_API_KEY=lin_api_...` in the shell Claude runs in.

## Limits

- Read-only by design. Creating/updating issues needs a separate mutation
  script with its own confirmation step — not covered here.
- Requires outbound network access to `api.linear.app`. In a sandboxed cloud
  workspace without that host allowlisted, this will fail; use an MCP/connector
  instead in that environment.
