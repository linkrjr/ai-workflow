export type Subagent = {
  id: string
  name: string
  model: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  steps: number
  // tokens by kind, as billed: input, output, cache read, cache write
  tokens: [number, number, number, number]
  effort?: string
}

declare module 'claude-code' {
  interface PluginState {
    'agent-teams': { subagents: Subagent[] }
  }
}
