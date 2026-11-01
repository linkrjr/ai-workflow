# Pomodoro timer mod

Type: FEATURE
Tech stack: Claude Code mod API (TypeScript/TSX hooks module on the `claude-code` engine API), shipped inside the ai-workflow plugin; tests run with `claude plugin test`; persistence via the engine's cross-session store.

## Problem
Long Claude Code sessions blur into hours of unbroken focus with no natural pauses. The Pomodoro Technique (Francesco Cirillo) structures work into 25-minute focused pomodoros separated by short breaks, with a longer break every four. A timer built into Claude Code lets people follow that rhythm without leaving the terminal.

## User stories
- As a Claude Code user, I can run `/pomodoro` to start a 25-minute focused pomodoro and see the countdown above my prompt.
- As a user, I'm told with a toast and a ring when a pomodoro or break ends, so I don't have to watch the clock.
- As a user, I can pause, resume or stop a pomodoro, and skip or stop a break, from buttons above the prompt.
- As a user, I can see how many pomodoros I've completed today and where I am in the current cycle of four.
- As a user, I can change the timings in /config, or turn the timer off entirely.

## Acceptance criteria
- AC1: With the setting on, `/pomodoro` exists. With it off, `/pomodoro` is not offered and no Pomodoro band ever shows.
- AC2: Before `/pomodoro` is run in a session, no Pomodoro band shows.
- AC3: Running `/pomodoro` while idle starts a pomodoro of the configured work length (default 25 min) and shows the band with a mm:ss countdown that updates every second.
- AC4: When a pomodoro reaches 00:00, today's count goes up by 1, a toast and a ring play, and a break starts by itself. It is the long break (default 15 min) when this pomodoro completes the cycle (default every 4th), otherwise the short break (default 5 min).
- AC5: When a break reaches 00:00, a toast and a ring play, and the band switches to the waiting state with a "Start pomodoro" button. No new pomodoro starts on its own.
- AC6: During a pomodoro the band offers Pause and Stop, with no Skip. Pause freezes the countdown and changes the button to Resume. Resume continues from the frozen time.
- AC7: Stop during a pomodoro cancels it: the count does not change, the band disappears, and the cycle position goes back to 1.
- AC8: During a break the band offers Skip and Stop. Skip ends the break at once, with no alert, and goes to the waiting state. Stop hides the band and resets the cycle position.
- AC9: Running `/pomodoro` during a pomodoro or break changes nothing and shows a toast with the current status. Running it in the waiting state starts the next pomodoro.
- AC10: The band shows the phase, the cycle position (e.g. 2/4), the countdown and today's completed count.
- AC11: Today's count is shared by all sessions on the machine, survives restarting Claude Code, and resets to 0 at local midnight.
- AC12: Closing a session ends its timer. A pomodoro still running at that moment is not counted.
- AC13: Each of the four timing settings that is missing or out of range falls back to its default. A changed setting takes effect from the next phase that starts, not the one running.
- AC14: When the agent teams band rows show (the open button, or Proceed/Cancel asks), they stay first and unchanged, and the Pomodoro row sits below them.
- AC15: When today's count file is corrupt (unreadable), a toast says so once per session, and while the band shows it has a [Reset count] button. Clicking it rewrites only that file as a fresh valid count; the band shows ×0 and later pomodoros count again. If the reset fails, a toast names the file to delete by hand.
- AC16: A /config setting "Pomodoro · Ring" (on/off, default on) controls the ring. Off: phase ends show the toast with no ring; everything else is unchanged. A change applies from the next phase end.

## Detailed behaviour

### Band states (one row above the prompt, below any agent teams rows)
- **Hidden**: the default in every new session, and again after Stop.
- **Pomodoro running**: `🍅 Pomodoro 2/4 · 18:42 · today ×3   [Pause] [Stop]`
- **Pomodoro paused**: `🍅 Paused 2/4 · 18:42 · today ×3   [Resume] [Stop]` (the countdown does not move)
- **Short break**: `☕ Short break · 03:12 · today ×3   [Skip] [Stop]`
- **Long break**: `☕ Long break · 12:40 · today ×4   [Skip] [Stop]`
- **Waiting**: `🍅 Break over · next: pomodoro 3/4 · today ×3   [Start pomodoro] [Stop]`

Buttons work by click, like the agent teams band.

### Flow
Idle → `/pomodoro` → Pomodoro n/N → (00:00) → Short break, or Long break when n = N → (00:00, or Skip) → Waiting → Start pomodoro or `/pomodoro` → Pomodoro n+1/N (back to 1/N after a long break).

### Alerts
- Pomodoro ends: toast "Pomodoro done — take a <length>-min break" plus a ring.
- Break ends: toast "Break over — start your next pomodoro when ready" plus a ring.
- Skip, Pause, Resume and Stop make no sound and show no toast.

### `/pomodoro` command
- Idle or waiting: starts a pomodoro.
- During a pomodoro or break: a toast with the status, e.g. "Pomodoro 2/4 — 18:42 left", and nothing else changes.

### Empty, loading and error states
- No timer yet: the band is hidden (the empty state).
- No loading state; the timer starts instantly.
- If the ring can't play (no audio output), the toast still shows and the timer goes on. If the saved count can't be read, the count starts at 0 for today and the timer still works; if the count file itself is corrupt, the person is told by a toast and can repair it with the band's [Reset count] button (AC15).

## Access and permissions
Any user of a Claude Code session with ai-workflow installed and the setting on. Single user, no sharing. The timer never asks for tool permissions and never blocks or changes Claude's work.

## Business rules
- /config settings (in ai-workflow's plugin settings, next to the agent teams settings):
  - **Pomodoro · On**: on/off, default on
  - **Pomodoro · Work minutes**: 1–120, default 25
  - **Pomodoro · Short break minutes**: 1–120, default 5
  - **Pomodoro · Long break minutes**: 1–120, default 15
  - **Pomodoro · Pomodoros per cycle**: 2–8, default 4
  - **Pomodoro · Ring**: on/off, default on
- A value that is missing, not a whole number, or out of range uses its default.
- Pomodoros can't be split: only a pomodoro that reaches 00:00 counts. A stopped one never counts. A paused one still counts once it is resumed and finishes.
- A pomodoro counts on the local date when it finishes.
- The cycle position belongs to one session. Today's count is shared across sessions.

## Scope
- In scope: the `/pomodoro` command, the band and its states, the alerts (toast and bundled ring), the six /config settings, today's shared count.
- Out of scope: task labels, a history or log, interruption marks, estimates, a side pane, a status line entry, one timer shared across sessions, changing or pausing Claude's behaviour during breaks, a separate plugin, restructuring the repo.
- Must stay unchanged: the agent teams pane and band (layout, Proceed/Cancel asks, hotkeys 1/2, the Always On and Icons On settings), all agents and skills, and the plugin's name and marketplace layout.

## Known limits (accepted)
- **Reset count folder check is loose by one character.** The own-file check before a reset tests that the folder ends in `plugins/store` with no leading `/`, so a folder named e.g. `evilplugins/store` would also pass. Reach: only a file named `ai-workflow_*.json` in a folder named `store`, which the engine never names. Accepted as is (2026-11-01); the fix is `endsWith('/plugins/store')`.
- **Windows paths:** the same check rejects backslash paths, so on Windows Reset count never writes and shows the "delete this file by hand" toast instead (safe failure; the engine's Windows path format is unverified).
- **Two sessions finishing at the same instant** can lose one count (the store has no atomic update).
- **Once per session** for the corrupt-file toast means once per module load; changing a setting reloads the module and can show it once more.
