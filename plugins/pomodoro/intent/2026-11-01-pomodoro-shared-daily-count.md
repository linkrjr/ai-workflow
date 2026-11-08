---
title: Pomodoro shared daily count
status: done
created-at: 2026-11-01
---

# Intent: Pomodoro shared daily count

Author: Ronaldo Gomes. Status: done

## Problem

After T1, the "today ×n" count lives only in one session. The spec wants one daily total shared by every session that survives restarts.

## Proposed outcome

Today's completed count lives in the engine's cross-session store, keyed by local date. Every session's band shows that shared value and adds to it when a pomodoro completes.

- AC11: Today's count is shared by all sessions on the machine, survives restarting Claude Code, and resets to 0 at local midnight.
- (Count part of) AC4: When a pomodoro reaches 00:00, today's count goes up by 1.
- (Count part of) AC10: The band shows today's completed count.

Rules: a pomodoro counts on the local date when it finishes. If the stored count can't be read, start at 0 and keep the timer working. Covered by a test under `tests/`.

## Affected users and systems

ai-workflow users of the timer. Touches the pomodoro hooks module from T1, the state contract if needed, and the tests.

## Constraints

- Handoff decisions in tmp/team/handoff.md. The cycle position stays per session; only the daily count is shared.
- Depends on: T1 (merged).

## Out of scope

The ring sound (T3), history, and per-day logs beyond today's number.

## Open questions

None
