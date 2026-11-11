# pomodoro

A Claude Code plugin: `/pomodoro` runs a Pomodoro timer above the prompt. It used to ship inside `ai-workflow` and is now its own plugin in the same marketplace, so installing one doesn't install the other.

Install: `/plugin install pomodoro@ai-workflow`. Tests: `claude plugin validate .` and `claude plugin test` from this folder.

**Commands.** `/pomodoro` starts a pomodoro when the timer is idle or waiting. During a pomodoro or a break it only toasts the status, e.g. `Pomodoro 2/4 — 18:42 left`, and changes nothing else.

**Band.** One row above the prompt, below any other plugin's rows, such as the agent teams rows. It is hidden until the first `/pomodoro` in a session, and again after Stop.

| State | Band text | Buttons |
|---|---|---|
| Pomodoro | `🍅 Pomodoro 2/4 · 18:42 · today ×3` | Pause, Stop |
| Paused | `🍅 Paused 2/4 · 18:42 · today ×3` | Resume, Stop |
| Short break | `☕ Short break · 03:12 · today ×3` | Skip, Stop |
| Long break | `☕ Long break · 12:40 · today ×4` | Skip, Stop |
| Waiting | `🍅 Break over · next: pomodoro 3/4 · today ×3` | Start pomodoro, Stop |

`[Reset count]` also shows in the row while today's count file is corrupt (see **Today's count** below).

Flow: `/pomodoro` → pomodoro n/N → at 00:00 the count goes up by one and a break starts by itself (long when n = N, otherwise short) → at 00:00 the band waits → `Start pomodoro` or `/pomodoro`.

- Pause freezes the countdown; a paused pomodoro still counts once it is resumed and finishes.
- Skip ends a break at once, silently, and goes to waiting. Only breaks have Skip.
- Stop cancels the current phase silently, hides the band and resets the cycle to 1. A stopped pomodoro is not counted.

**Settings.** Six settings in `/config`, under the plugin's `userConfig`:

| Setting | Default | Range |
|---|---|---|
| Pomodoro · On | on | on / off |
| Pomodoro · Ring | on | on / off |
| Pomodoro · Work minutes | 25 | 1–120 |
| Pomodoro · Short break minutes | 5 | 1–120 |
| Pomodoro · Long break minutes | 15 | 1–120 |
| Pomodoro · Pomodoros per cycle | 4 | 2–8 |

With Pomodoro · On off, there is no `/pomodoro` and no band. A value that is missing, not a whole number, or out of range uses its default. A change applies from the next phase that starts; the ring setting applies from the next phase end.

**Alerts.** A pomodoro end shows `Pomodoro done — take a <n>-min break` and a break end shows `Break over — start your next pomodoro when ready`. Both play the ring unless Pomodoro · Ring is off. Skip, Pause, Resume and Stop make no sound and show no toast.

The ring is `assets/sounds/pomodoro-ring.wav`, a two-tone bell synthesized by `assets/sounds/make-ring.ts`. Regenerate it with `bun assets/sounds/make-ring.ts`. The engine plays it with `afplay`, so it is audible on macOS only; on Linux or Windows nothing plays and the toast still shows.

**Today's count.** Shared by every session on the machine. It is kept in the engine's cross-session store under the key `pomodoroDay` as `{ date, count }`, in a JSON file named `pomodoro_…` in the `plugins/store` folder. A pomodoro counts on the local date it finishes. A stored date that isn't today reads as 0, so the count resets at local midnight. It survives restarting Claude Code. The move out of `ai-workflow` started it in a new store file, so a count from before the move doesn't carry over.

If the count file is corrupt, a toast says so once per session and the band shows `[Reset count]`. Clicking it rewrites only that file as an empty store, so the band shows `today ×0`. The reset acts only if the file is still corrupt on a fresh read and the file is this plugin's own store file. Otherwise it toasts the path to delete by hand.

**Session scope.** The timer and the cycle position belong to one session. Closing the session (or `/clear`) ends the timer, and a pomodoro still running then is not counted.

**Known limits (accepted)**
- **Reset count folder check is loose by one character.** The own-file check requires the folder to end in `plugins/store` with no leading `/`, so a folder such as `evilplugins/store` also passes. In practice only a file named `pomodoro_*.json` in a folder named `store` could match, and the engine never names one. Fix: `endsWith('/plugins/store')`.
- **Windows paths.** The same check rejects backslash paths, so on Windows Reset count never writes and shows the delete-by-hand toast instead.
- **Two sessions finishing at the same instant** can lose one count; the store has no atomic update.
- **Once per session** for the corrupt-file toast means once per module load. Changing a setting reloads the module and can show it once more.
