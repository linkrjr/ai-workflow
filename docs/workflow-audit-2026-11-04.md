# `ai-workflow` audit: the gates work, but the plumbing around them doesn't

**Date:** 2026-11-04
**Plugin version audited:** 1.4.0 (commit `7bccf64`)

**Verdict:** this is an impressive prompt system, but it has never been run in its current form. Only 25% of the measured run's cost went to writing code. It also has no check that the merged result works, and a second spec can trip over the first run's leftover state.

**How to read the evidence labels:** findings come from reading the prompts unless marked **Measured** (from the one real run in this project's transcripts) or **Reproduced** (run during this audit, with `curl` stubbed where a network call was involved).

## What the one real run cost

This was the Pomodoro run (session `5958aa4f`): 4 tasks and 29 agents, at about $7.60 per task. Costs are list-price equivalents, not an actual bill.

| Role | Cost | Share | Runs | Active time |
|---|---|---|---|---|
| Lead (Opus) | $11.06 | 36% | 1 | n/a |
| QA | $6.22 | 20% | 6 | 119 min |
| Code review | $5.48 | 18% | 10 | 45 min |
| Engineers | $7.74 | 25% | 12 | 134 min |
| Writer (then on Haiku) | $0.03 | under 1% | 1 | 2 min |
| **Total** | **$30.53** | | **29** | |

- **Limits of this data:** the run predates the graph, the feature-branch flow and 1.4.0, and it never called Jev, so none of those has been measured.
- **Keep the gates:** review caught real bugs, such as `next(e)` running twice per render on PR #2. The waste is around them.

## 1. Workflow flaws

### Critical

1. **Leftover state hijacks new specs.** Re-run and resume detection never compares the spec path, and `tmp/team/` is never cleared (`skills/orchestrator/SKILL.md:32`, `:35`).
   - A new spec after a merged feature PR stops with "nothing left to do" (`:36`).
   - An old `REPRODUCED` file skips the bug gate for a different bug (`:87`).
   - Fix: use `tmp/team/<spec-slug>/`.
2. **Nothing tests the merged result.** QA runs per PR, and tasks may cover only part of an AC (`skills/orchestrator/SKILL.md:99`). Clean text merges get no further check (`:214-216`), and section 7 only reads verdict files. Fix: add one review and QA pass on the feature branch against all ACs before opening the feature PR.
3. **Script paths don't resolve.** **Reproduced:** `scripts/jev.sh` exits 127 and leaves an empty triage file, and `skills/orchestrator/SKILL.md:209` then points the reviewer at it because only `UNAVAILABLE` is handled. The Linear calls use the same relative path, including agents reading their task doc (`agents/backend-engineer.md:82`). Fix: the lead passes absolute paths built from `${CLAUDE_PLUGIN_ROOT}`.
4. **QA can pass with an AC untested.** `BLOCKED` doesn't force `FINDINGS` (`agents/qa-tester.md:50`), so without pinchtab, every UI test can be blocked and the PR still merges. Fix: make a blocked AC its own verdict that goes to the user.
5. **CI is never checked before merging** (`skills/orchestrator/SKILL.md:214`). Fix: add `gh pr checks --watch`.

### High

6. **Any finding forces another round.** Scope creep is "not a blocker" (`agents/code-reviewer.md:16`), yet `CLEAN` requires zero findings (`:53`), with no severities and no round limit. **Measured:** PR #4 took 5 rounds, and PR #2's findings included one marked "very narrow window". Fix: only blockers loop; list the rest in the feature PR.
7. **The prompts contradict each other.**
   - Engineers must apply GoF, PoEAA and OOP (`agents/backend-engineer.md:70-77`) but write minimum code (`:28`), and the reviewer then runs an over-engineering hunt (`agents/code-reviewer.md:26`).
   - "Test passes on first run: test is wrong" (`agents/backend-engineer.md:56`) conflicts with `safe-refactor`.
   - Frontend gets none of these rules.
8. **The designer can leave stray code.** The brief asks for a design (`skills/orchestrator/SKILL.md:179`), but the agent is told to implement components (`agents/designer.md:43`, `:90-91`). Nothing gives it a worktree, reviews its code or commits it. It also still warns about Opus 4.7 habits while running on Sonnet (`agents/designer.md:71`).
9. **Bundled review skills can't do their job.** `code-review` needs parallel sub-agents and a `HEAD` diff, but the reviewer has no Agent tool and never checks out the PR. `security-review` looks at the current branch, also the wrong code.
10. **The bug gate has gaps.**
    - It runs after the branch push and graph build (`skills/orchestrator/SKILL.md:63-66`).
    - An audit batch gets one status, so one bad finding stops them all (`skills/orchestrator/SKILL.md:89`).
    - The feature template has no repro section (`skills/workshop/SKILL.md:21-53`).
    - The ticket reviewer's description promises Pinchtab, but its body only covers Playwright (`agents/ticket-reviewer.md:18`).
11. **Common failures have no rule.**
    - Crashed agents, contract changes and disputed findings have no path, as `README.md:243` nearly admits.
    - A fix for a busy engineer's PR has no routing rule.
    - A QA report finishing after a fix was pushed can double-queue a round (`skills/orchestrator/SKILL.md:197-212`).
12. **Features can conflict by design.** The same-file rule only covers audit specs (`skills/orchestrator/SKILL.md:101`). **Measured:** PR #5 conflicted with PR #4, and any rebase re-runs both gates (`skills/orchestrator/SKILL.md:215`).
13. **Shared-state races.** Parallel engineers edit `handoff.md` even though the lead already gets the PR number (`agents/backend-engineer.md:93`). The first engineer also adds `.gitignore` inside a task PR (`skills/orchestrator/SKILL.md:84`); the lead should do that once.
14. **Worktrees may not be runnable.** No prompt mentions installing dependencies or copying `.env` files. This repo has no dependencies, so the run couldn't expose it.
15. **The usage pause is weak.**
    - 98% is only checked when the lead wakes, and **Measured:** one engineer ran for 85 minutes. Fix: stop spawning at 90% and pause at 95%.
    - A seven-day pause needs the session open for days, because the cron job lives only in that session.
    - `usage` is a deferred tool, so a failed direct call could read as "not there" and silently turn the check off (`skills/orchestrator/SKILL.md:23`).
16. **Linear goes out of sync.** Tickets are marked in progress when filed (`skills/orchestrator/SKILL.md:174`) and completed before the user has merged the feature PR (`skills/orchestrator/SKILL.md:226`). The team key is never saved to the handoff.
17. **`loop-guard` breaks its own promise.** It exits 1 when the previous round's file is missing (`skills/jev/scripts/jev.sh:42`), which happens whenever a queued round gets dropped (`skills/orchestrator/SKILL.md:212`).

## 2. Speed

1. **Allow 2–3 reviewers and QA testers at once** (`skills/orchestrator/SKILL.md:205`). QA already has its own worktree and port, and **Measured:** it took 2.6x review's time.
2. **Stop making frontend wait for a backend merge** (`skills/orchestrator/SKILL.md:100`). Build against the contract, once the final gate from flaw 2 exists.
3. **Check less on later rounds.** Keep both gates, but review only the changes since the last reviewed commit, and test only the ACs the fix touched. **Measured:** PR #2 repeated a full QA pass (7.7 min) after being clean in round 1.
4. **Make tasks bigger.** "As small as it can be" (`skills/orchestrator/SKILL.md:96`) multiplies everything by about $7.60, and splitting by layer pays for review and QA on tasks with little behavior to test. Size each task as one behavior and put same-file work together.
   - **Constraint:** true full-stack slices have no owner today, because each task must be one layer (`skills/orchestrator/SKILL.md:97`) and engineers must hand off work outside their layer (`agents/backend-engineer.md:25`).
   - **Decision: option 1 for now.** Keep the backend and frontend roles, and make each task one behavior within a role. For example, "migration, endpoint and tests" is one backend task, and the UI is a separate frontend task. A behavior still spans two PRs, so this needs the final gate from flaw 2.
   - **Not chosen yet: option 2.** A full-stack engineer would own the whole slice in one PR, with fewer gate runs but a bigger redesign and more context per agent. Revisit it after comparing cost per task on a real full-stack spec, since the measured run had only frontend engineers and no database layer.
   - **Exceptions:** shared foundations, such as a migration or auth change that several behaviors need, go first as their own task. Cross-cutting changes, such as a library swap, don't split by behavior.
5. **Ask everything up front.** The graph, tracker, Linear, design and Figma questions are spread across the run, and the question tool takes 4 per call. Save the answers per repo.
6. **Update from the engineer's own worktree.** Use `git fetch` and `origin/<base>`, not a pull on the main worktree with lock retries (`agents/backend-engineer.md:85`).
7. **Fix permission denials.** **Measured:** auto mode blocked 5 commands, including "Git Destructive" and "Interfere With Workloads". The commands weren't extracted, but the prompts do prescribe force-pushes and forced deletes. Pre-authorize the ones you want and script the cleanup.

## 3. Token savings

Dollar figures are rough estimates for a run this size.

1. **Compact the lead after each merge: about $2–3.** **Measured:** its context grew from 55k to 293k tokens, and re-reading it cost $6.57, or 59% of the lead's total. The `compact` tool already exists, and the handoff holds the state.
2. **Investigate how engineers edit: possibly the largest engineer saving.** **Measured:** 12 engineer agents made 0 `Edit` or `Write` calls, against 55 heredoc writes and 12 python or perl edits. That probably re-emits whole files at output rates. The suspected cause, unverified, is the worktree sitting outside the project folder.
3. **Remove cosmetic lead steps: about $1.85.** **Measured:** `TaskStop` and `cmux` were 51 of 178 tool calls, at about 4¢ each.
   - "Idle agents still burn tokens" (`skills/orchestrator/SKILL.md:16`) looks wrong: completed agents resume from their transcript when messaged. So `TaskStop` after a report is likely wasted.
   - Use one script for handoff, intent and progress updates, and check usage only on wake.
4. **`/clear` between workshop and orchestrator: about $2.** **Measured:** the lead started at about 75k tokens, and the spec is already on disk.
5. **Lower reviewer effort.** **Measured:** at `xhigh`, reviewers produced 167k output tokens against 150k from the engineers. Current guidance for Sonnet 5.5 is to start at `medium` for agent work, so compare `high` and `medium` on a known PR, for engineers too.
6. **Return one line from the gates: about $1.** Reviewer and QA write the report to a file, then send it all again (`agents/code-reviewer.md:44`, `agents/qa-tester.md:37`). Return the verdict and path.
7. **Use a fresh agent per PR.** Telling a reused reviewer to "start fresh" (`agents/code-reviewer.md:41`) doesn't clear its context. Reuse agents only for fix rounds.
8. **Remove duplicated text.**
   - ACs and decisions are copied from spec to handoff to intent file.
   - Live queue state sits in a file every agent reads.
   - The external-services rules appear in four agents.
   - Merge the reviewer's two checklists into one.
9. **Move the writer back to Haiku.** 1.4.0 raised it to Sonnet; use Sonnet only when `openapi` runs.
10. **Cut Jev triage until it's calibrated.** Its reorder only applies to PRs "of equal age", and `spec-check` runs twice (`skills/workshop/SKILL.md:17`, `skills/orchestrator/SKILL.md:61`).
11. **Check the agent baseline.** **Measured:** every agent starts at about 27k tokens, and this plugin accounts for at most 3.5k. The rest wasn't broken down, but it likely comes from installed skills and tools, paid 29 times.

## 4. Other issues

- **Security: blind approvals in the pane.** Commands are cut to one line, `Edit` shows no diff, and other tool input stops at 300 characters (`hooks/register.tsx:136-143`, `:434-439`). Pressing "1" in an empty prompt approves, so a double press might approve the next request too. This hasn't been tried live.
- **Privacy: Jev sends code off-machine.** Full diffs and specs go to `api.typesafe.ai` whenever the key is set, with no consent step or secret scrubbing (`skills/jev/scripts/jev.sh:77-82`).
- **`linear.sh` bugs.**
  - **Reproduced:** `create-issue` without labels crashes on macOS bash 3.2 (`skills/linear/scripts/linear.sh:83`), though labels are documented as optional.
  - **Reproduced:** a failed label creation still goes on to create the issue.
  - From reading, GraphQL errors on the final mutation still exit 0.
- **Not ready to publish.** Missing skills are silently skipped (`README.md:21`), and several are personal symlinks. `ai-slop-cleaner` isn't installed on the audit machine, and neither it nor `graphify` or `ponytail:ponytail-review` is in the dependency table. Fix: add a preflight check that fails loudly.
- **The workflow has no tests.** There's no `evals/` folder even though `claude plugin eval` exists, and 1.4.0 has no recorded run in this project's transcripts.
- **Test setup is undocumented.** **Reproduced:** `bun test` fails, while `claude plugin test` passes 55 of 55. `tsc` reports errors, there's no CI, and the README doesn't name the test command.
- **Stale docs.**
  - `TECH_DEBT_AUDIT.md` says "no application code" and lists six agents, yet `/workshop` treats that file as input.
  - `README.md:215` and `README.md:223` cite old step numbers.
  - `examples/README.md` names old round files.
- **Conflict with the owner's own rules.** The plugin uses raw `git switch` and worktrees, while the owner's global rule requires GitButler.
- **Pomodoro doesn't belong here.** It accounts for 6 of the 9 settings, and the pane opens by default in every session, in every repo. Make it a separate plugin.
- **The lead's model may not stick.** Skill `model` and `effort` overrides only last the current turn, per the docs. It's unclear whether long runs keep them, because the measured run stayed on Opus throughout.

## Fix order

1. **Make runs safe:** per-spec state folders, absolute script paths, and the blocked-AC and CI gates.
2. **Prove the result:** add the final gate on the feature branch.
3. **Stop wasted rounds:** add finding severities and resolve the conflicting instructions.
4. **Cut lead cost:** compact after merges, remove cosmetic steps and send one-line reports.
5. **Find the edit cause:** work out why engineers avoid `Edit`, then run a small spec end to end and compare it to the $7.60 per task.

At the time of this audit, seven-day usage was at 89% and reset on Nov 7, so that test run needed to stay small.
