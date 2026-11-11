// The session's Pomodoro timer. Today's count is not here: it is shared across sessions in `$.store`.
export type Pomodoro = {
  phase: 'idle' | 'work' | 'paused' | 'short' | 'long' | 'waiting'
  // the pomodoro running or just done, of `total` in the cycle it started in
  position: number
  total: number
  // a running phase: when it reaches 00:00 (ms since epoch)
  endsAt?: number
  // a paused pomodoro: the ms it has left
  leftMs?: number
}

declare module 'claude-code' {
  interface PluginState {
    pomodoro: { pomodoro: Pomodoro; pomodoroTick: number }
  }
}
