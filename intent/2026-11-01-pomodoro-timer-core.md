---
title: Pomodoro timer core
status: done
created-at: 2026-11-01
---

# Intent: Pomodoro timer core

Author: Ronaldo Gomes. Status: done

## Problem

Long Claude Code sessions run with no natural pauses. The ai-workflow plugin should ship a Pomodoro timer people can run without leaving the terminal (spec: docs/specs/pomodoro-timer-mod.md).

## Proposed outcome

A `/pomodoro` command, five /config settings, and a band row above the prompt covering every timer state and button, with phase transitions and toasts. Today's count is kept in memory for this session only (T2 makes it shared). No ring sound yet (T3 adds it).

- AC1: With the setting on, `/pomodoro` exists. With it off, `/pomodoro` is not offered and no Pomodoro band ever shows.
- AC2: Before `/pomodoro` is run in a session, no Pomodoro band shows.
- AC3: Running `/pomodoro` while idle starts a pomodoro of the configured work length (default 25 min) and shows the band with a mm:ss countdown that updates every second.
- AC4: When a pomodoro reaches 00:00, today's count goes up by 1, a toast and a ring play, and a break starts by itself. It is the long break (default 15 min) when this pomodoro completes the cycle (default every 4th), otherwise the short break (default 5 min). *(T1 covers everything here except the ring.)*
- AC5: When a break reaches 00:00, a toast and a ring play, and the band switches to the waiting state with a "Start pomodoro" button. No new pomodoro starts on its own. *(T1 covers everything here except the ring.)*
- AC6: During a pomodoro the band offers Pause and Stop, with no Skip. Pause freezes the countdown and changes the button to Resume. Resume continues from the frozen time.
- AC7: Stop during a pomodoro cancels it: the count does not change, the band disappears, and the cycle position goes back to 1.
- AC8: During a break the band offers Skip and Stop. Skip ends the break at once, with no alert, and goes to the waiting state. Stop hides the band and resets the cycle position.
- AC9: Running `/pomodoro` during a pomodoro or break changes nothing and shows a toast with the current status. Running it in the waiting state starts the next pomodoro.
- AC10: The band shows the phase, the cycle position (e.g. 2/4), the countdown and today's completed count.
- AC12: Closing a session ends its timer. A pomodoro still running at that moment is not counted.
- AC13: Each of the four timing settings that is missing or out of range falls back to its default. A changed setting takes effect from the next phase that starts, not the one running.
- AC14: When the agent teams band rows show (the open button, or Proceed/Cancel asks), they stay first and unchanged, and the Pomodoro row sits below them.

Covered by tests under `tests/`, run with `claude plugin test`.

## Affected users and systems

Every ai-workflow user (the setting is on by default, but nothing shows until they run /pomodoro). Touches `.claude-plugin/plugin.json` (userConfig), `hooks/hooks.json`, a new pomodoro hooks module, `types/index.d.ts` if new state is added, and a new test file. The agent teams AbovePrompt hook in `hooks/register.tsx` only if it has to change for the rows to compose.

## Constraints

- Everything under "Decisions already made" in tmp/team/handoff.md: band text per state, settings and ranges, transitions, silent controls, toast texts.
- The agent teams band's visible behaviour must not change (Proceed/Cancel, hotkeys 1/2, the open button).
- Depends on: none.

## Out of scope

The shared cross-session daily count with a midnight reset (T2) and the ring sound (T3). History, task labels, side pane, status line.

## Open questions

None
