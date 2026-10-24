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

export type LogLine = { at: number; who: string; text: string; isError: boolean }

declare module 'claude-code' {
  interface PluginState {
    'ai-workflow': { subagents: Subagent[]; log: LogLine[] }
  }
}
