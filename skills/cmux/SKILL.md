---
name: cmux
description: Drive the cmux terminal app from its CLI — create workspaces, splits and tabs, run commands in other panes, read their output, wait for them to finish, message other agents, open browser panes, and report progress/notifications in the sidebar. Use when running inside cmux (CMUX_WORKSPACE_ID is set) and the task needs parallel terminals, a long-running process watched from another pane, a browser surface, cross-agent messaging, or the user says "cmux".
---

cmux talks to the app over a Unix socket. Inside a cmux terminal,
`CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` are set and become the default
`--workspace`/`--surface` for every command. Check the socket with
`cmux ping` (prints `PONG`); if it fails, cmux isn't running — stop and say so.

For anything not covered here: `cmux help <start|agents|navigate|inspect|customize|automation|browser|remote|diagnostics>`,
`cmux <command> --help`, or `cmux guide`. Read the command's `--help` before
using a flag you haven't seen here.

## Model

window → workspace (sidebar tab) → pane (split) → surface (terminal/browser tab in a pane).
Targets accept a UUID, a ref (`workspace:2`, `pane:3`, `surface:4`), or an index.
Always use refs returned by commands; never guess indexes.

```sh
cmux identify --json      # caller's window/workspace/pane/surface refs
cmux tree --json          # current window hierarchy (--all for every window)
```

## Rules

- Don't steal focus from the user. Splits default to `--focus false`; pass
  `--focus false` to `new-workspace`, `new-pane`, `new-surface`, `browser open`.
- Work in panes you created. Never `send` into the user's or caller's surface.
- Clean up what you created: `cmux close-surface --surface <ref>` (add
  `--force` if a process is still running — without it the close is refused).
  Never close surfaces or workspaces you didn't create.
- To talk to another coding agent, use `cmux agent message`, not `send` —
  it goes through the agent's hooks and can't land in a half-typed prompt.

## Run a command in a new pane

Creation prints `OK surface:<n> workspace:<n>`; capture the surface ref.

```sh
s=$(cmux new-split right --command "bun test" | grep -o 'surface:[0-9]*' | head -1)
cmux read-screen --surface "$s" --lines 50     # last 50 lines (implies scrollback)
cmux close-surface --surface "$s" --force
```

`--command` is typed into a login shell, so the pane stays open after the
command exits. Other ways in: `new-pane --direction <dir>`,
`new-surface --pane <ref>` (new tab in a pane),
`workspace create --name <title> --cwd <path> --command <text> --focus false`
(prints `OK workspace:<n>`; `--layout <json>` for a multi-pane workspace — see
`cmux new-workspace --help`). Close it with `cmux workspace close --workspace <ref>`.
The older `new-workspace`/`close-workspace` names still work but print a notice.

## Wait for completion instead of polling

Have the command signal a named token, then block on it:

```sh
s=$(cmux new-split down --command "bun run build; cmux wait-for -S build-done" | grep -o 'surface:[0-9]*' | head -1)
cmux wait-for build-done --timeout 600   # exit 0 when signalled, non-zero on timeout
cmux read-screen --surface "$s" --lines 80
```

Use a unique token name per job. Default timeout is 30s — always set it.

## Send input to a terminal

```sh
cmux send --surface "$s" "ls -la\n"           # typed; \n = Enter, \t = Tab
cmux send-key --surface "$s" ctrl+c           # keys: enter, ctrl+c, escape, ...
cmux send --paste --surface "$s" "$(cat x)"   # multi-line or >4KB: paste, no per-line Enter
```

Read the screen before and after sending. `send` refuses if the target has a
draft prompt or an open dialog; `--force` overrides — only use it on surfaces
you own.

## Message other agents

```sh
cmux agent message workspace:3 "API contract changed, see tmp/team/handoff.md"
cmux agent message <workspace-title> -  < note.md   # text from stdin
cmux agent inbox --mark-read                         # read messages sent to you
```

Target is a workspace/surface ref or a workspace title (exact, then unique prefix).

## Report status to the user

```sh
cmux set-status build "running" --icon hammer --color "#ff9500"   # sidebar pill; unique key per tool
cmux clear-status build
cmux set-progress 0.4 --label "3/8 tasks"; cmux clear-progress    # one bar per workspace
cmux log --level info --source agent "migrations applied"
cmux notify --title "Build done" --body "All tests passed"         # --desktop false: no banner
cmux markdown open docs/report.md      # live-reloading markdown viewer
cmux diff --branch --base main         # diff viewer split
```

Subagents run in the lead's workspace and share its single progress bar, so
a subagent never calls `set-progress` or `clear-progress` — the lead owns it
and reports progress for the whole run.

## Browser pane

```sh
b=$(cmux browser open http://localhost:5173 --focus false | grep -o 'surface:[0-9]*' | head -1)
cmux browser --surface "$b" snapshot --interactive    # elements + selectors
cmux browser --surface "$b" click "<selector>" --snapshot-after
cmux browser --surface "$b" fill "<selector>" "text"
cmux browser --surface "$b" wait --text "Saved" --timeout-ms 5000
cmux browser --surface "$b" screenshot --out shot.png
cmux browser --surface "$b" console list               # JS console; `errors list` for errors
```

Snapshot → act on an observed selector → snapshot again. Full list:
`cmux help browser`.

## Inspect

```sh
cmux list-workspaces; cmux list-panes; cmux list-pane-surfaces --pane <ref>
cmux top --processes          # CPU/mem per surface
cmux shot --out window.png    # screenshot of the cmux window
cmux find-window --content "<text>"   # find a surface by its screen contents
```
