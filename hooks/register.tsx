import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ask, Leader, LogLine, Subagent } from '../types'

import { AGENT_ICONS, AGENT_ICON_SIZE, TEAM_ICON, TEAM_ICON_SIZE } from './icons'
import type { Icon } from './icons'

const PANE = 'agent-teams'
const subagents = atom({ plugin: 'ai-workflow', key: 'subagents' } as const, [] as Subagent[])
const log = atom({ plugin: 'ai-workflow', key: 'log' } as const, [] as LogLine[])
const leader = atom({ plugin: 'ai-workflow', key: 'leader' } as const, {
  status: 'idle',
  steps: 0,
  tokens: [0, 0, 0, 0],
} as Leader)
// Bumped every second while anything runs, so the running times redraw.
const tick = atom({ plugin: 'ai-workflow', key: 'tick' } as const, 0)
const asks = atom({ plugin: 'ai-workflow', key: 'asks' } as const, [] as Ask[])
const LOG_ROWS = 10
const ASK_COLOR = 'yellow'

// The two roles' colors: the legend, the leader box and the agents box.
const LEADER_COLOR = '#cd7b5b'
const AGENTS_COLOR = '#b4b9f6'

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
const tokenLine = (tokens: number[]) => {
  const total = tokens.reduce((a, b) => a + b, 0)
  const parts = tokens.flatMap((n, i) => (n ? [`${formatTokens(n)} ${KINDS[i]}`] : []))
  return parts.length ? `${formatTokens(total)} (${parts.join(' / ')})` : '0'
}

const costLine = (tokens: number[], model: string) => {
  const r = rates(model)
  const cost = tokens.reduce((sum, n, i) => sum + (n * (r[i] ?? 0)) / 1e6, 0)
  const parts = tokens.flatMap((n, i) => (n ? [`${formatTokens(n)}×${formatRate(r[i] ?? 0)}`] : []))
  return parts.length ? `$${cost.toFixed(4)} (${parts.join(' + ')})` : '$0.0000'
}

const BAR = 20

// This plugin's agents by name; another plugin's type has no icon.
const agentIcon = (type: string) =>
  type.startsWith('ai-workflow:') ? AGENT_ICONS[type.slice('ai-workflow:'.length)] : undefined

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
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  if (s < 60) return `${s}s`
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

// "Edit → todo-app/app.js", "Bash → npm test"; values of secret-looking variables masked.
// Values of secret-looking variables masked.
const mask = (s: string) => s.replace(/\b(\w*(?:KEY|TOKEN|SECRET|PASSWORD|SESSION)\w*=)\S+/gi, '$1•••')

const describeCall = (tool: string, input: Record<string, unknown>) => {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = str('file_path').split(/[\\/]/).slice(-2).join('/')
  const what = str('command') || path || str('pattern') || str('url') || str('description')
  return mask(what ? `${tool} → ${what}` : tool)
}

// What a call asking permission would act on, whole: its command, file, URL or pattern.
const askDetail = (input: unknown) => {
  const i = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const fields: [string, string][] = [['command', 'Command'], ['file_path', 'File'], ['url', 'URL'], ['pattern', 'Pattern']]
  for (const [key, label] of fields) {
    if (typeof i[key] === 'string') return { label, detail: mask(i[key] as string) }
  }
  return { label: 'Input', detail: mask(shorten(JSON.stringify(i), 300)) }
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

// Ends the task once the leader is idle and no subagent it started is still running.
async function endTaskIfDone($: EngineInterface) {
  const [lead, all] = await Promise.all([read($, leader), read($, subagents)])
  if (lead.status !== 'idle' || lead.taskStartedAt === undefined || lead.taskEndedAt !== undefined) return
  if (all.some(a => a.status === 'running')) return
  const now = await $.clock.now()
  await update($, leader, l => ({ ...l, taskEndedAt: now }))
}

// Applies fn to the subagent with this id; other loops (the leader's, nested ones) are skipped.
async function patch($: EngineInterface, id: string | undefined, fn: (a: Subagent) => Subagent) {
  if (!id || !(await read($, subagents)).some(a => a.id === id)) return
  await update($, subagents, all => all.map(a => (a.id === id ? fn(a) : a)))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent teams' })
    // ponytail: redraws the whole pane each second while anything runs; a Client module
    // ticking on the surface (as flightdeck's elapsed.tsx does) if that ever costs too much
    $.clock.every(1000, async () => {
      const [lead, all] = await Promise.all([read($, leader), read($, subagents)])
      const isTaskOpen = lead.taskStartedAt !== undefined && lead.taskEndedAt === undefined
      if (isTaskOpen || all.some(a => a.status === 'running')) await update($, tick, n => n + 1)
    })

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
        type: e.subagentType,
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
    if (!e.agentId) await update($, leader, (l): Leader => ({ ...l, status: 'working' }))
    if (!e.agentId && e.text) {
      const p = promptLine(e.text)
      await say($, p.who, p.text)
      // A prompt of the person's starts a task; a turn the engine opens continues it.
      if (p.who === 'you') {
        const now = await $.clock.now()
        await update($, leader, l => ({ ...l, taskStartedAt: now, taskEndedAt: undefined }))
      }
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
    if (!e.agentId) {
      await update($, leader, l => ({
        ...l,
        model: shortName(e.model),
        steps: l.steps + 1,
        effort: e.effort === undefined ? l.effort : String(e.effort),
      }))
    }
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const used = [u.input_tokens, u.output_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens]
      await patch($, e.agentId, a => ({
        ...a,
        tokens: a.tokens.map((n, i) => n + (used[i] ?? 0)) as Subagent['tokens'],
      }))
      if (!e.agentId) {
        await update($, leader, l => ({
          ...l,
          tokens: l.tokens.map((n, i) => n + (used[i] ?? 0)) as Leader['tokens'],
        }))
      }
    }

    return r
  })

  // An ask the person will answer: shown until its call settles, run or refused.
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    if (r.decision === 'ask' && e.tool_use_id) {
      const sub = (await read($, subagents)).find(a => a.id === e.agentId)
      const ask: Ask = {
        id: e.tool_use_id,
        who: sub ? capitalize(sub.name) : e.agentId ? 'A subagent' : 'Leader',
        tool: e.tool,
        ...askDetail(e.input),
        reason: r.reason,
        rule: r.rule,
      }
      await update($, asks, all => [...all.filter(a => a.id !== ask.id), ask])
    }
    return r
  }).catch(($, e, next) => next(e)) // a panel bug must never change a verdict

  on('tool.call', async ($, e, next) => {
    // ponytail: an approved call stays listed until it finishes (a long Bash too); clear on
    // approval if an event for the person's answer turns up
    const r = await next(e).finally(() => update($, asks, all => all.filter(a => a.id !== e.tool_use_id)))
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
    if (!e.agentId) await update($, leader, (l): Leader => ({ ...l, status: 'idle' }))
    const sub = (await read($, subagents)).find(a => a.id === e.agentId)
    if (sub) {
      const status = ENDED[e.reason] ?? 'completed'
      await patch($, sub.id, a => ({ ...a, status }))
      const took = formatDuration((await $.clock.now()) - sub.spawnedAt)
      await say($, sub.who, status === 'completed' ? `done · ${took}` : status, status !== 'completed')
    }
    await endTaskIfDone($)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const Image = 'Image' in els ? els.Image : undefined
    // The terminal reads the PNG itself; where it cannot draw one, the glyph shows instead.
    const icon = (key: string, i: Icon, size: { columns: number; rows: number }) =>
      Image && (
        <Image
          key={key}
          source={{ file: `${$.plugin.root}/assets/icons/${i.file}`, format: 'png' }}
          columns={size.columns}
          rows={size.rows}
          alt={i.glyph}
        />
      )
    const model = shortName(await $.session.model())
    await read($, tick) // redraw on every tick while anything runs
    const now = await $.clock.now()
    const lead = await read($, leader)
    const all = await read($, subagents)
    const taskTime =
      lead.taskStartedAt === undefined ? '—' : formatDuration((lead.taskEndedAt ?? now) - lead.taskStartedAt)
    // Only working agents get a box: a finished or idle one is dropped.
    const subs = all.filter(s => s.status === 'running')
    const lines = (await read($, log)).slice(-LOG_ROWS)
    const waiting = await read($, asks)

    return (
      <Box width="100%" flexDirection="column">
        <Box borderStyle="round" paddingX={1} justifyContent="center" alignItems="center">
          {icon('team', TEAM_ICON, TEAM_ICON_SIZE)}
          <Box marginLeft={Image ? 2 : 0} flexDirection="column">
            <Text>
              <Text bold>AGENT TEAMS</Text> - {model} <Text bold color={LEADER_COLOR}>{lead.status.toUpperCase()}</Text>
            </Text>
            <Text>
              <Text color={LEADER_COLOR}>●</Text> leader  <Text color={AGENTS_COLOR}>●</Text> agents
            </Text>
          </Box>
        </Box>
        <Box width="100%" flexDirection="column" borderStyle="round" borderColor={LEADER_COLOR} paddingX={1}>
          <Text>
            <Text bold color={LEADER_COLOR}>Leader</Text> - {capitalize(model)} - {taskTime} -{' '}
            <Text bold color={lead.status === 'working' ? 'yellow' : undefined} dimColor={lead.status === 'idle'}>
              {capitalize(lead.status)}
            </Text>
          </Text>
          <Text><Text bold>Tokens:</Text> {tokenLine(lead.tokens)}</Text>
          <Text><Text bold>Cost:</Text> {costLine(lead.tokens, lead.model ?? model)}</Text>
          <Text><Text bold>Effort:</Text> {lead.effort ? capitalize(lead.effort) : '—'}</Text>
          <Text>
            <Text bold>Subagents:</Text> {subs.length} running · {all.length} started
          </Text>
        </Box>
        {waiting.length > 0 && (
          <Box width="100%" flexDirection="column" borderStyle="round" borderColor={ASK_COLOR} paddingX={1}>
            {waiting.map((a, i) => (
              <Box flexDirection="column" marginTop={i > 0 ? 1 : 0}>
                <Text bold color={ASK_COLOR}>
                  ⚠ Permission · {a.who} wants to use {a.tool}
                </Text>
                <Box>
                  <Box width={9} flexShrink={0}>
                    <Text dimColor>{a.label}</Text>
                  </Box>
                  <Text bold>{a.detail}</Text>
                </Box>
                {a.reason && (
                  <Box>
                    <Box width={9} flexShrink={0}>
                      <Text dimColor>Why</Text>
                    </Box>
                    <Text>{a.rule ? `${a.reason} (${a.rule})` : a.reason}</Text>
                  </Box>
                )}
              </Box>
            ))}
            <Box marginTop={1}>
              <Text dimColor italic>
                {waiting.length === 1 ? 'Claude is' : `${waiting.length} calls are`} waiting on your answer in the permission prompt
              </Text>
            </Box>
          </Box>
        )}
        <Box width="100%" flexDirection="column" borderStyle="round" borderColor={AGENTS_COLOR} paddingX={1}>
          {subs.length === 0 && <Text dimColor>No running subagents.</Text>}
          {subs.map(s => {
            const done = Math.round(progress(s) * BAR)
            const agent = agentIcon(s.type)
            return (
              <Box borderStyle="single" paddingX={1}>
                {Image && agent && (
                  <Box marginRight={1} flexShrink={0}>
                    {icon(`agent-${s.id}`, agent, AGENT_ICON_SIZE)}
                  </Box>
                )}
                <Box flexDirection="column" flexGrow={1}>
                  <Text>
                    <Text bold>{capitalize(s.name)}</Text> - {capitalize(s.model)} -{' '}
                    {formatDuration(now - s.spawnedAt)} -{' '}
                    <Text bold color={STATUS_COLOR[s.status]}>{capitalize(s.status)}</Text>
                  </Text>
                  <Text>
                    <Text color="cyan">{'█'.repeat(done)}</Text>
                    <Text dimColor>{'░'.repeat(BAR - done)}</Text> {Math.round(progress(s) * 100)}%
                  </Text>
                  <Text><Text bold>Tokens:</Text> {tokenLine(s.tokens)}</Text>
                  <Text><Text bold>Cost:</Text> {costLine(s.tokens, s.model)}</Text>
                  <Text><Text bold>Effort:</Text> {s.effort ? capitalize(s.effort) : '—'}</Text>
                </Box>
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
