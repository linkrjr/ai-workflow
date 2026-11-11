---
title: Pomodoro ring sound
status: done
created-at: 2026-11-01
---

# Intent: Pomodoro ring sound

Author: Ronaldo Gomes. Status: done

## Problem

The spec wants an audible ring when a phase ends, so the person doesn't have to watch the band. T1 only shows toasts.

## Proposed outcome

A short ring sound file bundled with the plugin plays on pomodoro end and on break end, alongside the existing toasts.

- (Ring part of) AC4: When a pomodoro reaches 00:00, a toast and a ring play.
- (Ring part of) AC5: When a break reaches 00:00, a toast and a ring play.

Skip, Pause, Resume and Stop stay silent. If audio can't play, the toast still shows and the timer goes on. Covered by a test under `tests/`.

## Affected users and systems

ai-workflow users of the timer. Touches the pomodoro hooks module and adds a sound asset under `assets/`. It must be a sound we're free to ship under the MIT licence: generate it, or use one that's clearly public domain.

## Constraints

- Handoff decisions in tmp/team/handoff.md.
- Depends on: T1 (merged).

## Out of scope

A setting to turn the sound off, choosing between sounds, and the shared count (T2).

## Open questions

None
