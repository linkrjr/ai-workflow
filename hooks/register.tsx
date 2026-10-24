import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Subagent } from '../types'

const PANE = 'agent-teams'
const subagents = atom({ plugin: 'ai-workflow', key: 'subagents' } as const, [] as Subagent[])

// "claude-opus-5-5[1m]" or "Opus 5.5" -> "OPUS 5.5"
const shortName = (model: string) => {
  const s = model.replace(/\[.*\]/, '').replace(/^claude-/, '')
  const m = s.match(/^([a-z]+)-(\d+)-(\d+)/i)
  return (m ? `${m[1]} ${m[2]}.${m[3]}` : s.replace(/-/g, ' ')).toUpperCase()
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

// $ per 1M tokens: [input, output, cache read]; cache write is 1.25x input.
// ponytail: hard-coded list prices (2026-10-06), unknown models cost 0; update when prices move
const PRICES: Record<string, [number, number, number]> = {
  'FABLE 5.1': [10, 50, 0.25],
  'FABLE 5': [10, 50, 1],
  'OPUS 5.5': [4, 20, 0.2],
  'OPUS 5': [5, 25, 0.5],
  'OPUS 4.8': [5, 25, 0.5],
  'OPUS 4.7': [5, 25, 0.5],
  'OPUS 4.6': [5, 25, 0.5],
  'SONNET 5.5': [2, 10, 0.2],
  'SONNET 5': [2, 10, 0.2],
  'SONNET 4.6': [3, 15, 0.3],
  'HAIKU 5.5': [0.1, 0.5, 0.01],
  'HAIKU 4.5': [1, 5, 0.1],
}

const STATUS_COLOR: Record<string, string> = {
  running: 'yellow', completed: 'green', failed: 'red', killed: 'red',
}

const KINDS = ['in', 'out', 'cache read', 'cache write']

const rates = (model: string) => {
  const [inp, out, cached] = PRICES[model] ?? [0, 0, 0]
  return [inp, out, cached, inp * 1.25]
}

const formatRate = (r: number) => `$${+r.toFixed(3)}/M`

// "2.0k (1.0k in / 1.0k out)" and "$0.0120 (1.0k×$2/M + 1.0k×$10/M)", zero kinds left out
const tokenLine = (s: Subagent) => {
  const total = s.tokens.reduce((a, b) => a + b, 0)
  const parts = s.tokens.flatMap((n, i) => (n ? [`${formatTokens(n)} ${KINDS[i]}`] : []))
  return parts.length ? `${formatTokens(total)} (${parts.join(' / ')})` : '0'
}

const costLine = (s: Subagent) => {
  const r = rates(s.model)
  const cost = s.tokens.reduce((sum, n, i) => sum + (n * (r[i] ?? 0)) / 1e6, 0)
  const parts = s.tokens.flatMap((n, i) => (n ? [`${formatTokens(n)}×${formatRate(r[i] ?? 0)}`] : []))
  return parts.length ? `$${cost.toFixed(4)} (${parts.join(' + ')})` : '$0.0000'
}

const BAR = 20

// Simulated: no real progress signal exists, so each step closes 15% of the gap; done fills it.
const progress = (s: Subagent) =>
  s.status === 'completed' ? 1 : 1 - Math.pow(0.85, s.steps)

const formatTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

// ponytail: status refreshes only on a subagent's steps and turns; add a $.clock poll if it lags
async function refresh($: EngineInterface) {
  const list = await $.agent.list()
  await update($, subagents, all =>
    all.map(a => ({ ...a, status: list.find(l => l.id === a.id)?.status ?? a.status })),
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent teams' })

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId && !e.parentAgentId) {
      const sub: Subagent = {
        id: r.agentId,
        name: e.name || e.description || e.subagentType,
        model: shortName(r.model),
        status: 'running',
        steps: 0,
        tokens: [0, 0, 0, 0],
      }
      await update($, subagents, all => [...all, sub])
    }

    return r
  }).catch(($, e, next) => next(e)) // a panel bug must never block a spawn

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const id = e.agentId
    if (id && (await read($, subagents)).some(a => a.id === id)) {
      const u = r.usage
      const used = u
        ? [u.input_tokens, u.output_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens]
        : [0, 0, 0, 0]
      await update($, subagents, all =>
        all.map(a =>
          a.id === id
            ? {
                ...a,
                steps: a.steps + 1,
                tokens: a.tokens.map((n, i) => n + (used[i] ?? 0)) as Subagent['tokens'],
                effort: e.effort === undefined ? a.effort : String(e.effort),
              }
            : a,
        ),
      )
      await refresh($)
    }

    return r
  })

  on('turn.start', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) await refresh($)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) await refresh($)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const model = shortName(await $.session.model())
    const subs = await read($, subagents)

    return (
      <Box flexDirection="column">
        <Box borderStyle="round" paddingX={1} justifyContent="center">
          <Text>
            <Text bold>AGENT TEAMS</Text> - {model} <Text color="green">LEADER</Text>
          </Text>
        </Box>
        <Box width="50%" flexDirection="column" borderStyle="round" paddingX={1}>
          {subs.length === 0 && <Text dimColor>No subagents yet.</Text>}
          {subs.map(s => {
            const done = Math.round(progress(s) * BAR)
            return (
              <Box flexDirection="column" borderStyle="single" paddingX={1}>
                <Text>
                  <Text bold>{capitalize(s.name)}</Text> - {capitalize(s.model)} -{' '}
                  <Text color={STATUS_COLOR[s.status]}>{capitalize(s.status)}</Text>
                </Text>
                <Text>
                  <Text color="cyan">{'█'.repeat(done)}</Text>
                  <Text dimColor>{'░'.repeat(BAR - done)}</Text> {Math.round(progress(s) * 100)}%
                </Text>
                <Text>Tokens: {tokenLine(s)}</Text>
                <Text>Cost: {costLine(s)}</Text>
                <Text>Effort: {s.effort ? capitalize(s.effort) : '—'}</Text>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
