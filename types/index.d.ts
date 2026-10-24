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

export type LogLine = { at: number; who: string; text: string; isError: boolean }

declare module 'claude-code' {
  interface PluginState {
    'ai-workflow': { subagents: Subagent[]; log: LogLine[]; leader: Leader; tick: number }
  }
}
