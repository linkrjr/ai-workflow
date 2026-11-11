# Team mode for /orchestrator

Type: FEATURE
Tech stack: the ai-workflow plugin's current stack — Markdown skills and agents, Bash scripts with Bash tests, the TypeScript/TSX hooks module tested with `claude plugin test`, evals with `claude plugin eval`

## Problem
On the same small todo spec, the current per-task flow cost $15.19 and took 58 minutes, while a hand-run prototype (one engineer, checks after each task, one final gate) cost about $4.90 and took 12 minutes with the same gate outcome. Most of the per-task flow's cost is the lead routing every message and the review and QA of each task alone, and it barely uses Claude Code's agent teams (shared task list, direct messaging, task hooks).

## User stories
- As a developer, I run `/orchestrator <spec>` and get a reviewed, tested feature PR for a fraction of today's cost and time.
- As a developer, I still choose the per-task flow when a large spec has parts that can be built in parallel.
- As a developer, I am asked only when a run is stuck, risky or about to change what the spec agreed.

## Acceptance criteria
- AC1: `/orchestrator <spec>` runs team mode by default.
- AC2: When the lead finds parts of the spec that can be built in parallel on separate sets of files, it asks the user "Team mode" (Recommended) / "Per-task flow" before building, and runs the chosen flow. Otherwise it doesn't ask.
- AC3: The per-task flow, when chosen, behaves exactly as it does today.
- AC4: Team mode uses one full-stack engineer teammate, or two when the tasks split into two separate sets of files; each engineer only edits files in its own set.
- AC5: Engineers build their tasks in the listed order, commit each task on the feature branch and push it. No task PRs are opened.
- AC6: Every build task is on the agent team's shared task list with its dependencies; no intent files or Linear tickets are created in team mode.
- AC7: A build task cannot be marked complete while any of the project's test, lint or type-check commands fails; the failure output goes back to the engineer.
- AC8: After 3 refused completions of the same task, the lead asks the user "Keep trying" (Recommended) / "Change the task" / "Stop".
- AC9: In a repo with no test or type-check command, task 1 adds them for the spec's tech stack; from task 2 on, a missing command counts as a failing check.
- AC10: Before building a task the lead marked risky (it changes the data schema, the API contract or auth, or deletes data), the engineer sends the lead a short plan and waits; the lead replies "go" or what to change, and a plan that changes the API contract goes to the user first. Other tasks skip this.
- AC11: The final gate's review and QA are tasks on the shared list that unblock only when every build task is complete.
- AC12: A review or QA task cannot be marked complete without its verdict file.
- AC13: code-reviewer and qa-tester review and test the whole branch against every AC, and send each blocker directly to the engineer who owns the file.
- AC14: After an engineer reports a fix, the same reviewer and QA re-check that fix; the lead is told only each round's verdicts.
- AC15: After 3 fix rounds with blockers left, or when the same blocker comes back after being reported fixed, the lead asks the user "Keep going" (Recommended) / "Change the spec or task" / "Stop".
- AC16: If a task shows in progress after its commit exists, or nothing on the task list changes for 15 minutes while a teammate is working, the lead checks that teammate and corrects or nudges it.
- AC17: A team-mode run sets the teammates' prompt cache to one hour.
- AC18: Without agent teams (the setting off, or a non-interactive `claude -p` session), team mode runs the same flow with ordinary subagents: the lead runs the checks after each task and relays gate findings, and says once that it is in fallback.
- AC19: BUG and TICKET specs still need ticket-reviewer's confirmed reproduction before any engineer starts.
- AC20: For a spec with a screen, the designer is still offered before the engineer starts.
- AC21: After both gates are clean, the writer runs (and openapi when public endpoints changed), then the lead runs the code-only graph update and commits it with the feature.
- AC22: No codebase graph is built at the start of a team-mode run.
- AC23: The lead opens one feature PR that lists every task, its status and the ACs it covers, and every NOTE from the final gate.
- AC24: The preflight and the usage pause behave as today; on resume, a fresh engineer continues from the branch's commits and the task list.
- AC25: Re-running `/orchestrator` on a reviewed feature PR turns each comment into a task on the shared list for one engineer, then reruns the final gate and pushes to the same PR.
- AC26: On the todo spec, an interactive team-mode run costs at most $7.60 at the plugin's price table, takes under 30 minutes, ends with both final gates clean, and QA tests every AC.

## Detailed behaviour
- **Start:** preflight, then (BUG/TICKET) reproduction, then the run's questions together: per-task flow (only when AC2 applies) and designer (only for a spec with a screen).
- **Split:** the lead splits the spec into tasks of one behaviour each, in build order, marks risky ones, groups them into one or two file sets, and puts them on the shared task list with the final-gate review and QA tasks blocked behind them.
- **Build:** each engineer claims its tasks in order. Completing a task runs the checks; a refusal sends the output back and the engineer keeps working.
- **Final gate:** the review and QA tasks unblock, a fresh code-reviewer and qa-tester claim them, write their verdict files, and message blockers to the owning engineer. Fix rounds repeat between them without the lead.
- **Finish:** writer, openapi if needed, graph update, feature PR, cleanup, report.
- **Stuck or failing:** a teammate that ends on an error is replaced by a fresh one of the same role, briefed from the task list and the commits.
- **Fallback:** without agent teams, the lead plays the task list's part: it runs the checks after each engineer report, starts the gates, and forwards findings.

## Access and permissions
Anyone with the plugin. Team mode runs in the session's permission mode; teammates inherit it. It never merges into the default branch.

## Business rules
- At most two engineers per run; never two engineers on the same file.
- Check failures: 3 refusals per task before the user is asked.
- Fix rounds: 3 before the user is asked, or earlier on a repeated blocker.
- Stuck check: 15 minutes without a task-list change while a teammate is working.
- Teammate cache: one hour.
- Usage: stop spawning at 90%, pause at 95%, as today.

## Scope
- In scope: team mode as the default flow, the full-stack engineer role, the task-completion hooks, the fallback, an eval or test run for AC26, and README updates.
- Out of scope: turning agent teams on for the user, split-pane mode, Claude Code's built-in plan approval, a CI step for the graph, per-teammate permission modes.
- Must stay unchanged: the per-task flow, /workshop, /audit, the agent teams pane, the pomodoro plugin.
