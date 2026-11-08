# Fix plan for the `ai-workflow` audit

Covers all 45 items in `docs/workflow-audit-2026-11-04.md`. Flaw, Speed and Tokens numbers match sections 1–3 of the audit, and "Other" means section 4. Each phase is one commit on a dedicated branch.

## Progress

Work is on the local branch `workflow-audit-fixes`, not pushed. Phases 1–8 are done. Phase 9 is done except Tokens 5, the effort comparison, and the README allow rule, which no command in the test run needed. One real run on this branch (Nov 9) finished end to end. CI has never run. Open decision: per-merge compaction (Tokens 1) costs more than it saves on small runs; see the Nov 9 note.

To resume: "Continue the plan in `docs/workflow-audit-plan-2026-11-04.md`, on branch `workflow-audit-fixes`." Test runs need `claude --plugin-dir ~/Projects/repos/projects/ai-workflow --model opus --effort medium`. Without `--plugin-dir`, the installed 1.4.0 plugin runs instead, as it did on Nov 8.

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
   - Tokens 5: compare effort levels on a known PR
   - Confirm the lead's model and effort across wakes (held for a whole 1.4.0 run started with the flags; wakes still untested): the docs say a skill's override lasts one turn and don't cover wakes, so Phase 7 only documents starting with `--model opus --effort medium`
   - Confirm agents keep working and reports still arrive when the lead compacts after a merge, and that SendMessage resumes reviewers for later rounds
   - Extract the commands auto mode denies (done from the Nov 8 run), and test the README's allow rule
10. **Prepare to publish**
    - Other: dependency preflight that fails loudly
    - Other: add evals, seeded with whatever the test run exposed
    - Other: move Pomodoro to its own plugin
    - Other: update stale docs, including `TECH_DEBT_AUDIT.md`
    - Bump the version

## Why this order

- **Gates before optimization:** Phases 4–5 change what "clean" means, and Speed 2 and 3 are only safe once the final gate from Flaw 2 exists.
- **Failure rules with fresh agents:** both rewrite how the lead routes work, so Flaw 11 and Tokens 7 belong together, before concurrency goes up in Speed 1.
- **Docs and evals last:** both would go stale if written while the prompts are still changing.
- **Pomodoro late:** moving it earlier would add churn to `hooks/register.tsx` during the pane security work.
