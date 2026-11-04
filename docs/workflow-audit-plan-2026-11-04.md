# Fix plan for the `ai-workflow` audit

Covers all 45 items in `docs/workflow-audit-2026-11-04.md`. Flaw, Speed and Tokens numbers match sections 1–3 of the audit, and "Other" means section 4. Each phase is one commit on a dedicated branch.

## Progress

Work is on the local branch `workflow-audit-fixes`, not pushed. Phases 1–8 are done; next is Phase 9, after the Nov 7 usage reset. Nothing has been tested in a real orchestrator run yet, and CI has never run.

To resume: "Continue the plan in `docs/workflow-audit-plan-2026-11-04.md` from Phase 9, on branch `workflow-audit-fixes`."

Decisions made along the way:
- **Phase 2:** an opted-in repo still sends full diffs and specs to Jev; secret scrubbing wasn't part of the decision.
- **Phase 3:** a run started on another spec's feature branch asks before building on it. An interrupted run asks to resume or start over. The Linear team key is saved in `context.md`, which covers a small part of Flaw 16. Engineers no longer delete old branches; the lead's end-of-run cleanup does.
- **Phase 4:** a QA `BLOCKED` the user accepts is saved on an `Accepted untested:` line and named in the feature PR. A branch with no CI merges without waiting. The final gate is section 5a, so later sections keep their numbers.
- **Phase 5:** the reviewer has no skills left, so `Skill` came off its tools. `ponytail-review` went with the two that couldn't work, and its concern is now the checklist's Scope item.
- **Phase 6:** Tokens 7 was applied to engineers too: one engineer and worktree per task, removed at merge. That also answers Flaw 11's busy-engineer case. The cost is a dependency install per task. A user-stopped task gets a `stopped` status and a `Dropped from scope:` line in `context.md`.
- **Phase 7:** conflicts merge the base in instead of rebasing, so nothing force-pushes. The auto-mode allow rule in the README is untested, and the docs don't say whether an allow rule can override the force-push block. The 3-hour cutoff for scheduling a restart is my reading of "a few hours".
- **Phase 8:** `jev.sh triage` stays as a command for calibration but is out of the pipeline. The lead's skill prompt grew from 37 KB at 1.4.0 to about 46 KB across these phases, so the savings have to be measured, not assumed.

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
   - Tokens 2: find why engineers avoid `Edit`, and fix it
   - Tokens 11: break down the 27k agent baseline
   - Test run: compare against $7.60 per task
   - Tokens 5: compare effort levels on a known PR
   - Confirm the lead's model and effort across wakes: the docs say a skill's override lasts one turn and don't cover wakes, so Phase 7 only documents starting with `--model opus --effort medium`
   - Confirm agents keep working and reports still arrive when the lead compacts after a merge, and that SendMessage resumes reviewers for later rounds
   - Extract the commands auto mode denies, and test the README's allow rule
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
