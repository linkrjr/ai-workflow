---
title: Pomodoro ring setting
status: done
created-at: 2026-11-01
---

# Intent: Pomodoro ring setting

Author: Ronaldo Gomes. Status: done

## Problem

The ring (T3, merged) always plays at a phase end. Some people want the toast without the sound.

## Proposed outcome

A sixth /config setting, "Pomodoro · Ring" (boolean, default on). With it off, phase ends show the toast and play no sound.

- AC16: A /config setting "Pomodoro · Ring" (on/off, default on) controls the ring. Off: phase ends show the toast with no ring; everything else is unchanged. A change applies from the next phase end.

Covered by tests under `tests/`.

## Affected users and systems

ai-workflow users of the timer. Touches `.claude-plugin/plugin.json` (userConfig), `alert()` in hooks/pomodoro.tsx (and wherever the options are read), and tests.

## Constraints

- A missing or non-boolean value means on, the same way `alwaysOn` / `iconsOn` are read (`!== false`).
- Depends on: T3 (merged). Runs in parallel with T2's PR #4, which touches the count paths and the test helper `boot()`. Keep away from those, and merge rather than rebase if you conflict.

## Out of scope

Choosing between sounds, volume, and the count (T2).

## Open questions

None
