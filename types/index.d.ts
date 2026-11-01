export type Subagent = {
  id: string
  name: string
  model: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  steps: number
  // tokens by kind, as billed: input, output, cache read, cache write
  tokens: [number, number, number, number]
  effort?: string
  // the agent type it was spawned as, e.g. `ai-workflow:backend-engineer`
  type: string
  // the task in a few words, as the session log names the agent
  who: string
  spawnedAt: number
}

// The main session's own loop: what the leader box shows.
export type Leader = {
  status: 'working' | 'idle'
  // the model of its latest request, as `shortName` spells it
  model?: string
  effort?: string
  steps: number
  tokens: [number, number, number, number]
  // the task: from the person's prompt until the leader is idle with no subagent running
  taskStartedAt?: number
  taskEndedAt?: number
}

// A permission request waiting on the person: from its check's ask until its call settles.
export type Ask = {
  id: string
  who: string
  tool: string
  // what the call would act on, as `askDetail` names it: `Command`, `File`, ...
  label: string
  detail: string
  reason?: string
  rule?: string
  // answered from the pane (Proceed / Cancel); otherwise the engine's prompt asks
  isAnswerable: boolean
}

export type LogLine = { at: number; who: string; text: string; isError: boolean }

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
    'ai-workflow': { subagents: Subagent[]; log: LogLine[]; leader: Leader; tick: number; asks: Ask[]; isLogOpen: boolean; isPaneOpen: boolean; pomodoro: Pomodoro; pomodoroTick: number }
  }
}
