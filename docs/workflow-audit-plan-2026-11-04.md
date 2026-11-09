# Fix plan for the `ai-workflow` audit

Covers all 45 items in `docs/workflow-audit-2026-11-04.md`. Flaw, Speed and Tokens numbers match sections 1–3 of the audit, and "Other" means section 4. Each phase is one commit on a dedicated branch.

## Progress

Work is on the local branch `workflow-audit-fixes`, not pushed. All 10 phases are done, except testing the README's allow rule, which no command in either test run needed. One real run on this branch (Nov 9) finished end to end. CI has never run, and nothing is published yet.

The plugin now lives in `plugins/ai-workflow/`, so test runs need `claude --plugin-dir ~/Projects/repos/projects/ai-workflow/plugins/ai-workflow --model opus --effort medium`. Without `--plugin-dir`, the installed 1.4.0 plugin runs instead, as it did on Nov 8.

Decisions made along the way:
- **Phase 2:** an opted-in repo still sends full diffs and specs to Jev; secret scrubbing wasn't part of the decision.
- **Phase 3:** a run started on another spec's feature branch asks before building on it. An interrupted run asks to resume or start over. The Linear team key is saved in `context.md`, which covers a small part of Flaw 16. Engineers no longer delete old branches; the lead's end-of-run cleanup does.
- **Phase 4:** a QA `BLOCKED` the user accepts is saved on an `Accepted untested:` line and named in the feature PR. A branch with no CI merges without waiting. The final gate is section 5a, so later sections keep their numbers.
- **Phase 5:** the reviewer has no skills left, so `Skill` came off its tools. `ponytail-review` went with the two that couldn't work, and its concern is now the checklist's Scope item.
- **Phase 6:** Tokens 7 was applied to engineers too: one engineer and worktree per task, removed at merge. That also answers Flaw 11's busy-engineer case. The cost is a dependency install per task. A user-stopped task gets a `stopped` status and a `Dropped from scope:` line in `context.md`.
- **Phase 7:** conflicts merge the base in instead of rebasing, so nothing force-pushes. The auto-mode allow rule in the README is untested, and the docs don't say whether an allow rule can override the force-push block. The 3-hour cutoff for scheduling a restart is my reading of "a few hours".
- **Phase 8:** `jev.sh triage` stays as a command for calibration but is out of the pipeline. The lead's skill prompt grew from 37 KB at 1.4.0 to about 46 KB across these phases, so the savings have to be measured, not assumed.
- **Phase 9, offline:** the worktree location isn't why engineers avoid `Edit`: fe-1's one `Edit` in `managua.worktrees/` succeeded, and no engineer had an `Edit` or `Write` fail. They just reached for `cat`, heredocs, `sed -i` and Python, so the engineer prompts now require `Read`/`Edit`/`Write` for source. The 27k baseline is mostly the 181-skill listing (about 9k tokens), plus the user's ponytail SubagentStart hook (about 1.3k), global CLAUDE.md and rules (about 1k) and the system prompt (about 2.3k). The designer, which had no `Skill` tool, got no listing and started at 11.3k against be-1's 22.4k. So the engineers, `qa-tester` and `ticket-reviewer` dropped `Skill` and preload their skills through `skills:` frontmatter. Reviewers lost `Skill` in Phase 5 already. `writer` keeps it: it runs once, and two of its three skills are conditional. The hook and CLAUDE.md are the user's environment, not the plugin's.
- **Phase 9, Nov 8 `tiny-todo-app` run (session `473da807`):** it loaded the installed 1.4.0 plugin, not this branch, so it's a second 1.4.0 baseline and tests none of Phases 1–9. The next run must use `claude --plugin-dir <this repo>`. At the same prices it cost about 39% of the Pomodoro run, for 4 tasks and 21 agents, so about $2.90 per task in the audit's terms. That comes from the smaller spec, not from the plugin. It confirms three things. The lead stayed on `claude-opus-5-5` at `medium` for all 179 requests, when started with `--model opus --effort medium`. Engineers still used Bash writes: 27 of them against 2 `Edit` and 1 `Write`. Agents with `Skill` started at 26–28k tokens, and the designer without it at 16.7k. Auto mode denied 9 Bash calls. Six came from QA or an engineer stopping processes with `pkill -f` and the like ("Interfere With Workloads"). Three came from reviewers running `rm -rf` on `/tmp` globs or `$(...)` paths. So QA now stops processes only by a saved PID, and reviewers use one `mktemp -d` folder removed by its exact path.
- **Phase 9, Nov 9 `todo-app` run on this branch (session `1fd37370`, repo `simple-test-todo`):** it finished end to end. There were 4 tasks, 19 agents and one pause for the usage window. It produced feature PR #5, and the worktrees and task branches were cleaned up. The final gate caught a real AC12 bug that every task gate had passed, and filed it as T4. Agents started at 14.5–16k tokens, against 26–28k on 1.4.0. A probe confirmed that preloaded skills are injected, though transcripts don't show them. Engineers made 39 `Edit` and 9 `Write` calls against 7 Bash writes, and auto mode denied nothing. The lead stayed on `claude-opus-5-5` at `medium` for all 115 requests, including the 37 after the pause. Agent reports kept arriving after each compaction, and SendMessage resumed `review-pr-4` for rounds 2 and 3. Total cost at my price table was $27.21, against $19.87 for the Nov 8 4-task run. That's about $4.00 per task in the audit's terms, against $2.90. The extra came from the final gate (2 rounds), PR #4's 3 review rounds and QA output (91k against 66k tokens). The lead's cache writes also went from $1.05 to $4.02. Three full re-caches of about 100k tokens followed gaps of over an hour: the usage pause and two long waits on QA. Each compaction then re-cached about 70k. The lead's floor is about 72k tokens before it does anything, so compacting after a merge saves at most 30k per later turn. On a run this size that costs more than it saves.

## Decisions

| Decision | Choice |
|---|---|
| Usage thresholds (Flaw 15) | Stop spawning at 90%, pause at 95% |
| Long pauses (Flaw 15) | If the reset is more than a few hours away, stop and give the user the resume command instead of keeping a session open |
| Linear closing (Flaw 16) | "In review" until a later run sees the feature PR merged |
| Jev privacy (Other) | Off unless a repo opts in, even with the key set |
| GitButler conflict (Other) | Keep raw `git` in the plugin for portability, and document the owner's rule as an exception for these agents |
| Task sizing (Speed 4) | Option 1: keep the backend and frontend roles, one behavior per task |

## Order

1. **Repair the tooling** (done)
   - Other: document `claude plugin test`, fix the `tsc` errors and add CI
   - Flaw 3: script paths
   - Flaw 17: `loop-guard` exit code
   - Other: `linear.sh` bugs
2. **Close the security gaps** (done)
   - Other: pane approvals show the full command or diff, and a double press can't approve the next request
   - Other: Jev opt-in
3. **Make run state safe** (done)
   - Flaw 1: per-spec state folders
   - Flaw 13: the lead is the only handoff writer and handles `.gitignore`
   - Tokens 8, part 1: split stable context from live queue state
4. **Add the missing gates** (done)
   - Flaw 4: blocked-AC verdict
   - Flaw 5: CI check before merge
   - Flaw 2: final gate on the feature branch
5. **Make reviews trustworthy** (done)
   - Flaw 6: finding severities
   - Flaw 9: replace the review skills that can't work
   - Tokens 8, part 2: one review checklist
   - Flaw 7: conflicting instructions
   - Flaw 8: designer scope
   - Flaw 10: bug gate order, per-finding status and repro section
   - Tokens 6: one-line gate reports
6. **Rework the task flow** (done)
   - Speed 4: one behavior per task, including `skills/orchestrator/SKILL.md:97`
   - Flaw 12: file-overlap check when splitting tasks
   - Tokens 7: fresh agent per PR
   - Flaw 11: failure rules
   - Flaw 14: worktree setup
   - Speed 6: update from the engineer's own worktree
   - Speed 3: smaller re-check rounds
   - Speed 2: frontend builds against the contract
   - Speed 1: 2–3 reviewers and QA testers at once
7. **Fix run operations** (done)
   - Flaw 15: usage pause
   - Flaw 16: Linear states
   - Speed 5: questions up front
   - Speed 7: permission denials
   - Other: confirm whether the lead keeps its model and effort across a long run
   - Other: document the GitButler exception
8. **Cut lead cost** (done)
   - Tokens 1: compact after merges
   - Tokens 3: remove cosmetic steps, with one status script
   - Tokens 4: `/clear` before orchestrating
   - Tokens 8, part 3: remove remaining duplicated text
   - Tokens 9: writer back on Haiku
   - Tokens 10: cut Jev triage and the duplicate `spec-check`
9. **Measure on a small real spec** (after the Nov 7 usage reset)
   - Tokens 2: find why engineers avoid `Edit`, and fix it (done, confirmed Nov 9)
   - Tokens 11: break down the 27k agent baseline (done, confirmed Nov 9: 14.5–16k)
   - Test run: compare against $7.60 per task (done Nov 9: about $4.00, against $2.90 for 1.4.0 on a similar spec)
   - Tokens 5: compare effort levels on a known PR (done Nov 9; reviewer lowered from `xhigh` to `high`)
   - Confirm the lead's model and effort across wakes (done Nov 9: held across a usage pause and resume)
   - Confirm agents keep working and reports still arrive when the lead compacts after a merge, and that SendMessage resumes reviewers for later rounds (done Nov 9; per-merge compaction then removed, see Phase 10)
   - Extract the commands auto mode denies (done from the Nov 8 run), and test the README's allow rule (still untested)
10. **Prepare to publish** (done)
    - Tokens 1 reversed: no compaction after merges, only before a usage pause

    - Other: dependency preflight that fails loudly
    - Other: add evals, seeded with whatever the test run exposed
    - Other: move Pomodoro to its own plugin
    - Other: update stale docs, including `TECH_DEBT_AUDIT.md`
    - Bump the version

Phase 10 notes:
- **Tokens 1 reversed:** the user chose to drop compaction after merges and keep it only before a usage pause. The lead's floor is about 72k tokens, so each compaction re-cached more than it saved.
- **Tokens 5:** fresh reviewers at `medium`, `high` and `xhigh` reviewed PR #4's round-2 commit (8a5ba20..8c0d104) once each. They cost $0.13, $0.15 and $0.41. All three returned `CLEAN` and missed the blocker the real run's round-2 reviewer caught; that reviewer had round 1's reports to start from. `xhigh` did more checking, a mutation check and a browser look, but reached the same verdict for 2.7 times the cost of `high`. So the reviewer is now at `high`. One sample on one PR, so `medium` isn't ruled out.
- **Preflight:** section 1 step 3 checks `git`, `gh`, `jq`, `curl` and every skill the agents preload, names what each missing one costs, and asks whether to continue. The writer's `ai-slop-cleaner` line is gone, because that skill isn't installed or documented.
- **Pomodoro:** it's now its own plugin, `plugins/pomodoro/`, with its own settings, tests and README. `claude plugin test` runs every test under the folder it's given, so the repo had to become a marketplace with both plugins under `plugins/`. Plugin hook order isn't fixed, so the agent teams band now draws its row above whatever the band beneath returns, instead of replacing it. That keeps the Pomodoro row showing during an ask, whichever plugin loads first. Today's count starts again in the new plugin's store file.
- **Evals:** `plugins/ai-workflow/evals/` has two cases. `orchestrator-stops-without-acceptance-criteria` passed on its first run, costing $0.31. `reviewer-catches-cleared-error-refailure` is seeded from the bug the task gates missed, using the real PR's code. Its first run, a reviewer at `high` briefed by a main session, caught the bug and scored 1.0 for $0.30. The three effort runs above had missed it, so a fresh reviewer catches this bug 1 time in 4. Run it with `--runs 5` or more before trusting a change to the reviewer. Run them with `claude plugin eval . --scaffold --trust-plugin --allow-tools Bash` from the plugin folder.
- **Stale docs:** `TECH_DEBT_AUDIT.md` is deleted. It still described six agents and no runtime code, and `/workshop` reads it as input; `/audit` writes a fresh one. `examples/README.md` paths are updated.
- **Version:** `ai-workflow` 2.0.0, because `/pomodoro` and its settings left the plugin and run state moved. `pomodoro` starts at 1.0.0. The README has an upgrade note.

Follow-ups from the Nov 9 runs:
- **Run 2 (`simple-test-todo-2`, 2.0.0 after the user's plugin cleanup):** 5 tasks, every gate clean on its first round. It cost $15.19 against run 1's $27.21 at the same prices, and took 58 minutes. The lead started at 52.7k tokens and agents at 12.4–14.2k. Final QA passed the save-error rule ("clears on the next successful action") as a note. Run 1's final gate had blocked it. That rule lives in the spec's Detailed behaviour, not in AC12.
- **Tier 2 prototype (`simple-test-todo-3`, local only, `claude -p`):** one full-stack engineer built 10 tasks, then the final gate ran once. It cost $3.42, about $4.90 counting the reused design and the skipped graph, and took about 12 minutes. 59 tests and both type checks pass when rerun by hand, and both gates came back clean. It shipped the same save-error note.
- **Skill preloading doesn't reach teammates:** the orchestrator's agents run as agent-team teammates, and Claude Code doesn't apply `skills:` to those. The Phase 9 change had left them with no skills at all. The `Skill` tool is back on the engineers, `qa-tester` and `ticket-reviewer`, with `skills:` kept for subagent runs.
- **Stated behaviour is a requirement:** `/workshop` now makes every testable statement an AC. Both gates treat a behaviour the spec states but the code doesn't do as a blocker, even outside the AC list.
- **Reviewer bloat checks:** the Scope item now covers reimplemented helpers and dependencies a few lines would replace, as notes. A new item makes dead code the change leaves behind a blocker.
- **Next:** a spec for a leaner team mode built on the tier 2 result.

## Why this order

- **Gates before optimization:** Phases 4–5 change what "clean" means, and Speed 2 and 3 are only safe once the final gate from Flaw 2 exists.
- **Failure rules with fresh agents:** both rewrite how the lead routes work, so Flaw 11 and Tokens 7 belong together, before concurrency goes up in Speed 1.
- **Docs and evals last:** both would go stale if written while the prompts are still changing.
- **Pomodoro late:** moving it earlier would add churn to `hooks/register.tsx` during the pane security work.
