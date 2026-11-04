# Fix plan for the `ai-workflow` audit

Covers all 45 items in `docs/workflow-audit-2026-11-04.md`. Flaw, Speed and Tokens numbers match sections 1–3 of the audit, and "Other" means section 4. Each phase is one commit on a dedicated branch.

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

1. **Repair the tooling**
   - Other: document `claude plugin test`, fix the `tsc` errors and add CI
   - Flaw 3: script paths
   - Flaw 17: `loop-guard` exit code
   - Other: `linear.sh` bugs
2. **Close the security gaps**
   - Other: pane approvals show the full command or diff, and a double press can't approve the next request
   - Other: Jev opt-in
3. **Make run state safe**
   - Flaw 1: per-spec state folders
   - Flaw 13: the lead is the only handoff writer and handles `.gitignore`
   - Tokens 8, part 1: split stable context from live queue state
4. **Add the missing gates**
   - Flaw 4: blocked-AC verdict
   - Flaw 5: CI check before merge
   - Flaw 2: final gate on the feature branch
5. **Make reviews trustworthy**
   - Flaw 6: finding severities
   - Flaw 9: replace the review skills that can't work
   - Tokens 8, part 2: one review checklist
   - Flaw 7: conflicting instructions
   - Flaw 8: designer scope
   - Flaw 10: bug gate order, per-finding status and repro section
   - Tokens 6: one-line gate reports
6. **Rework the task flow**
   - Speed 4: one behavior per task, including `skills/orchestrator/SKILL.md:97`
   - Flaw 12: file-overlap check when splitting tasks
   - Tokens 7: fresh agent per PR
   - Flaw 11: failure rules
   - Flaw 14: worktree setup
   - Speed 6: update from the engineer's own worktree
   - Speed 3: smaller re-check rounds
   - Speed 2: frontend builds against the contract
   - Speed 1: 2–3 reviewers and QA testers at once
7. **Fix run operations**
   - Flaw 15: usage pause
   - Flaw 16: Linear states
   - Speed 5: questions up front
   - Speed 7: permission denials
   - Other: confirm whether the lead keeps its model and effort across a long run
   - Other: document the GitButler exception
8. **Cut lead cost**
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
