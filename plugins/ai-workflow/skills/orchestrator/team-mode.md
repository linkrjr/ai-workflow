# Team mode

The default flow: one or two full-stack engineers build the tasks in order, the plugin's task gate runs the project's checks on every completed task, and code-reviewer and qa-tester run once on the whole branch as the final gate. You set it up, answer questions and step in when it stalls; the teammates route work between themselves. Sections named below are in `SKILL.md`.

## Teams or fallback
Team mode runs on Claude Code's agent teams when you have the task tools (`TaskCreate`, `TaskList`, `TaskUpdate`; load them with ToolSearch if they are deferred) and `echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` prints `1`. Otherwise run the **fallback** described at each step: the same flow with plain subagents, where you do the task list's job. State which one this run uses before anything else, even before your first question, and when it's the fallback, name what's missing: newer models such as Opus 5.5 only get the task tools with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, and `/ai-workflow:setup` sets both.

## 1. Prepare
1. Section 1 steps 1-4 as written: the spec check, reproduction for BUG/TICKET specs (1a), the PR and setup checks, and the feature branch (1d). Skip the codebase graph (1c) and the task tracker: team mode builds no graph at the start and files no intent files or tickets.
2. Section 1 steps 6-7: note the main worktree, the feature branch, the default branch and the base commit, and read enough code to know what changes.
3. Split the spec into tasks of one behaviour each, in build order. Don't split by layer: a task takes its behaviour through the server and the client. Every AC is covered. List the files each task touches.
4. Mark a task `Risky: yes` only when it changes something that already exists: an existing data schema or stored data, an API contract other code already uses, or auth. Building what the spec and its contract describe is not risky, even for a new table or endpoint. Most tasks of a new feature are not risky.
5. Group the tasks into file sets. Tasks that share a file are in the same set. Two or more sets that share no file → two engineers, each owning the sets assigned to it, and ask with the 1e questions: "Team mode" (Recommended) / "Per-task flow", saying the per-task flow runs the parts in parallel with one PR each and costs about three times as much. Otherwise one engineer, and no question. On "Per-task flow", stop reading this file and run sections 1-7 of `SKILL.md` from section 1 step 5, asking the tracker and graph questions then.
6. The checks: the project's test, lint and type-check commands from its scripts (`package.json`, a Makefile, `pyproject.toml`, ...), joined with `&&`. None yet → task T1 sets them up for the spec's tech stack, and you write the commands it will add.
7. The 1e questions, in one call: the flow choice (only per step 5), the design (only for a spec with a screen), and any setup gap from step 1. If the check printed `OPTIONAL git-allow`, also ask "Allow the engineers' git commit, merge and push in this project" (Recommended) / "Skip", because auto mode blocks an agent's commit without an allow rule. On "Allow", add `Bash(git commit:*)`, `Bash(git merge:*)` and `Bash(git push origin HEAD:feature/*)` to `permissions.allow` in `.claude/settings.local.json`, keeping everything already in the file. Do it before step 10 writes the cache setting to the same file.
8. Write `<state>/context.md` as in section 1 step 9, leaving out `Graph:` and `Task tracker:`, and adding:
   - `Mode: team` (or `Mode: team, fallback`)
   - `Checks: <commands>`
   - `Engineers:` one line per engineer, `<name>: <files and folders it owns>, worktree <main worktree parent>/<repo name>.worktrees/<name>`
9. Write `<state>/state.md`: `Mode: team`, `Feature PR: none`, `Accepted untested: none`, `Gate round: 0`, and one line per task: ID, name, ACs, engineer, `Risky: yes|no`, depends on, status (`todo`, `in-progress`, `done`). Keep it current at every step: it is what a resumed session rebuilds the run from.
10. Teammates' prompt cache: unless `.claude/settings.local.json` already sets `subagentPromptCacheTtl`, add `"subagentPromptCacheTtl": "1h"` to it, keeping everything else in the file. A gate waiting on a fix then keeps its cache instead of re-caching every 5 minutes.
11. If the user chose a design, run section 3 now.

## 2. Task list
Create every build task with `TaskCreate`: subject `<task ID> <task name>`, and a description with these lines:
```
ACs: <AC IDs>
Engineer: <name>
Risky: yes|no
Checks: <the commands from step 6>
Worktree: <that engineer's worktree>
```
Make each task depend on the previous task of the same engineer, plus any real dependency on the other engineer's task. Then create the two final-gate tasks, each depending on every build task:
- `Final review`, description `Verdict file: <state>/final-review-round-1.md`
- `Final QA`, description `Verdict file: <state>/final-qa-round-1.md`

Fallback: no task list; `state.md` is the list, and you hand the engineers their tasks.

## 3. Build
1. Spawn each engineer as a teammate named as in `context.md`, type `ai-workflow:fullstack-engineer`, briefed: "Your name: <name>. Main worktree: <path>. Your worktree: <path>. Feature branch: <branch>. Read <state>/context.md first. Your tasks are the ones on the task list with `Engineer: <name>`, in order."
2. While they build, schedule a stuck check with `CronCreate` (`recurring: true`, every 15 minutes, prompt `Team-mode stuck check: <spec path>`). On each check and each message: compare the task list with `git log origin/<feature branch>`. A task still `in_progress` whose commit is pushed, or no task-list change in 15 minutes while an engineer is working → message that engineer to mark the task done or say what blocks it. No answer by the next check → replace it with a fresh engineer of the same name and worktree, briefed as above plus "Resume: your worktree has the work in progress."
3. Teammates' messages can cross. An idle notification sent before your reply doesn't mean the reply was lost, so never re-send a message because of one. A plan from an engineer (a `Risky: yes` task): check it against the spec and the API contract. Within both → reply `go`. Wrong → reply what to change. It changes the contract → ask the user with the question tool first, and on approval add the change to `context.md`.
4. `CHECKS STUCK: <task>` → ask "Keep trying" (Recommended) / "Change the task" / "Stop", with the failing output. "Keep trying" → tell the engineer to go on. "Change the task" → update the task's description with the user's change and tell the engineer. "Stop" → mark the task `stopped` in `state.md`, add `Dropped from scope: <task>` to `context.md`, and delete the task.
5. A `QUESTION:` from any teammate → ask the user, and send the answer back.
6. Keep `state.md`'s task lines current from the task list.

Fallback: spawn each engineer as a named subagent with the same brief and its task list from `state.md`. When it reports a task done, run `Checks:` in its worktree yourself. A failure goes back to it with the output, and the third failure on one task goes to the user as in step 4.

## 4. Final gate
1. When every build task is done (the task list unblocks the gate tasks), cancel the stuck check, run `git pull --ff-only` in the main worktree, and spawn two teammates in one message:
   - `ai-workflow:code-reviewer` named `reviewer`: "Team mode. Read <state>/context.md. Final gate: claim the `Final review` task, review <feature branch> since <base commit> against every AC, and write <state>/final-review-round-1.md."
   - `ai-workflow:qa-tester` named `qa`: "Team mode. Read <state>/context.md. Final gate: claim the `Final QA` task, test <feature branch> end to end against every AC, and write <state>/final-qa-round-1.md."
2. They send blockers straight to the engineer who owns the file and re-check each fix themselves, writing a file per round. Each tells you each round's verdict in one line. Set `Gate round:` in `state.md` to the highest round reported.
3. Both say `CLEAN` for the same round → section 5 below.
4. A QA `BLOCKED` → section 5 step 6 of `SKILL.md`.
5. Round 3 still has blockers, or a report marks a blocker `REPEATED` → ask the user "Keep going" (Recommended) / "Change the spec or task" / "Stop", naming the open blockers. "Keep going" → tell both gates to run another round. "Change" → apply the user's change to `context.md` and tell the gates and engineers. "Stop" → section 5 with the open blockers listed as unresolved.

Fallback: spawn both gates as named subagents with the same briefs minus the leading "Team mode." and the task to claim, so they write their file and return. You send each blocker to its engineer, and when it reports the fix, send the gate "Round <R+1>: your earlier reports are <paths>; check that each blocker is fixed."

## 5. Finish
1. Section 6: the writer, and openapi when public endpoints changed.
2. With `graphify` installed (`command -v graphify`): `graphify update .` in the main worktree (code only, no LLM), then commit only `graphify-out/` and push.
3. Section 7, with these changes. The feature PR body lists every task with its status and ACs, every final-gate NOTE, the rounds run, and `Mode: team` (or the fallback). Clean up with `git worktree remove` for each engineer's worktree and `git push origin --delete team/<name>` for each `team/` branch the engineers pushed (only those). Delete the stuck-check job if it's still there.

## Pause and resume
The usage rules in `SKILL.md` apply as written, with team mode's own resume: in-process teammates don't survive a pause. On a resumed run whose `state.md` says `Mode: team`, rebuild the task list from `state.md`. Count a task done when its commit is on the feature branch, recreate the gate tasks if the build isn't finished, then go back to step 3, or to step 4 when every task is done. Spawn fresh engineers with the same names and worktrees, briefed "Resume: your worktree has the work in progress."

## Re-run on the feature PR
On a re-run whose `state.md` says `Mode: team` and has a `Feature PR:` line, follow the Re-run steps 1-3 in `SKILL.md`. Each fix becomes a task on the task list for the engineer who owns its files, and needs no tracker. Then step 3 for those tasks, the final gate with fresh `Final review` and `Final QA` tasks, and Re-run steps 4-5. The fixes go to the same feature PR.
