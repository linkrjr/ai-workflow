import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LogLine, Subagent } from '../types'

const PANE = 'agent-teams'
const subagents = atom({ plugin: 'ai-workflow', key: 'subagents' } as const, [] as Subagent[])
const log = atom({ plugin: 'ai-workflow', key: 'log' } as const, [] as LogLine[])
const LOG_ROWS = 10

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

// Simulated: no real progress signal exists, so each step start and each tool call
// closes 10% of the gap; a finished turn fills it.
const progress = (s: Subagent) =>
  s.status === 'completed' ? 1 : 1 - Math.pow(0.9, s.steps)

const formatTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

// How a subagent's turn ended, as its status.
const ENDED: Record<string, Subagent['status']> = {
  answer: 'completed', aborted: 'killed', refusal: 'failed', error: 'failed',
}

const shorten = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1).trimEnd()}…` : one
}

const formatClock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)

const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

// "Edit → todo-app/app.js", "Bash → npm test"; values of secret-looking variables masked.
const describeCall = (tool: string, input: Record<string, unknown>) => {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = str('file_path').split(/[\\/]/).slice(-2).join('/')
  const what = str('command') || path || str('pattern') || str('url') || str('description')
  const line = what ? `${tool} → ${what}` : tool
  return line.replace(/\b(\w*(?:KEY|TOKEN|SECRET|PASSWORD|SESSION)\w*=)\S+/gi, '$1•••')
}

// A turn the engine opened with a tagged message (a teammate's, a notification) is the engine's.
const promptLine = (text: string) => {
  const tag = /^\s*<([a-z][\w-]*)/i.exec(text)?.[1]
  return tag
    ? { who: 'engine', text: tag.replace(/[-_]/g, ' ') }
    : { who: 'you', text }
}

async function say($: EngineInterface, who: string, text: string, isError = false) {
  const line: LogLine = { at: await $.clock.now(), who, text, isError }
  await update($, log, all => [...all, line].slice(-60))
}

// Applies fn to the subagent with this id; other loops (the leader's, nested ones) are skipped.
async function patch($: EngineInterface, id: string | undefined, fn: (a: Subagent) => Subagent) {
  if (!id || !(await read($, subagents)).some(a => a.id === id)) return
  await update($, subagents, all => all.map(a => (a.id === id ? fn(a) : a)))
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
        who: shorten(e.description || e.name || e.subagentType, 12),
        spawnedAt: await $.clock.now(),
      }
      await update($, subagents, all => [...all, sub])
      await say($, sub.who, `spawned · ${e.name || e.subagentType}`)
    }

    return r
  }).catch(($, e, next) => next(e)) // a panel bug must never block a spawn

  on('turn.start', async ($, e, next) => {
    await patch($, e.agentId, a => ({ ...a, status: 'running' }))
    if (!e.agentId && e.text) {
      const p = promptLine(e.text)
      await say($, p.who, p.text)
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    // Tick when the request starts, so the bar moves while the model is still answering.
    await patch($, e.agentId, a => ({
      ...a,
      steps: a.steps + 1,
      effort: e.effort === undefined ? a.effort : String(e.effort),
    }))
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const used = [u.input_tokens, u.output_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens]
      await patch($, e.agentId, a => ({
        ...a,
        tokens: a.tokens.map((n, i) => n + (used[i] ?? 0)) as Subagent['tokens'],
      }))
    }

    return r
  })

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    const sub = (await read($, subagents)).find(a => a.id === e.agentId)
    if (sub) {
      await patch($, sub.id, a => ({ ...a, steps: a.steps + 1 }))
      const call = describeCall(e.tool, e as unknown as Record<string, unknown>)
      if (r.deny !== undefined) await say($, sub.who, `${call}  denied`, true)
      else await say($, sub.who, r.isError ? `${call}  ✗` : call, r.isError === true)
    }
    return r
  }).catch(($, e, next) => next(e)) // a panel bug must never block a tool

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const sub = (await read($, subagents)).find(a => a.id === e.agentId)
    if (sub) {
      const status = ENDED[e.reason] ?? 'completed'
      await patch($, sub.id, a => ({ ...a, status }))
      const took = formatDuration((await $.clock.now()) - sub.spawnedAt)
      await say($, sub.who, status === 'completed' ? `done · ${took}` : status, status !== 'completed')
    }
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const model = shortName(await $.session.model())
    // Only working agents get a box: a finished or idle one is dropped.
    const subs = (await read($, subagents)).filter(s => s.status === 'running')
    const lines = (await read($, log)).slice(-LOG_ROWS)

    return (
      <Box width="100%" flexDirection="column">
        <Box borderStyle="round" paddingX={1} justifyContent="center">
          <Text>
            <Text bold>AGENT TEAMS</Text> - {model} <Text color="green">LEADER</Text>
          </Text>
        </Box>
        <Box width="50%" flexDirection="column" borderStyle="round" paddingX={1}>
          {subs.length === 0 && <Text dimColor>No running subagents.</Text>}
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
        <Box width="100%" flexDirection="column" borderStyle="round" paddingX={1}>
          <Text dimColor>session log</Text>
          {lines.length === 0 && <Text dimColor>Session not started</Text>}
          {lines.map(l => (
            <Box>
              <Box width={9} flexShrink={0}>
                <Text dimColor>{formatClock(l.at)}</Text>
              </Box>
              <Box width={13} flexShrink={0}>
                <Text bold wrap="truncate">{l.who}</Text>
              </Box>
              <Text color={l.isError ? 'red' : undefined} wrap="truncate">
                {l.text}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
