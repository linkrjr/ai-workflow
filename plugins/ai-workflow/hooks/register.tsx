import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

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
const isLogOpen = atom({ plugin: 'ai-workflow', key: 'isLogOpen' } as const, true)
// Whether the pane is open, so the band above the prompt can offer to open it.
const isPaneOpen = atom({ plugin: 'ai-workflow', key: 'isPaneOpen' } as const, false)
// Team mode: build tasks per engineer name, from the lead's TaskCreate calls (`Engineer: <name>`).
const planned = atom({ plugin: 'ai-workflow', key: 'planned' } as const, {} as Record<string, number>)
// The session's permission mode as the person set it; undefined while unknown. Read by tool.check
// (and the header), written by every classic hook that carries one.
const permissionMode = atom({ plugin: 'ai-workflow', key: 'permissionMode' } as const, undefined as string | undefined)
const ASK_COLOR = 'yellow'
// How long the pane waits for Proceed / Cancel before the engine's own prompt asks.
const ASK_WAIT_S = 600
// Tools whose dialog is the person's own (a question, a plan): a hook's allow cannot answer it.
const PERSON_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

// A press this soon after an ask comes up is ignored: a double press, or a digit meant for
// something else, must not answer a request nobody has read.
const ARM_MS = 1000
// The longest ask the pane answers. Past this it can't be read whole, so the engine's prompt asks.
const MAX_ASK_LINES = 20
const MAX_ASK_CHARS = 1500
// What the band's Proceed and Cancel take up on its row.
const BAND_BUTTONS_WIDTH = 20

type Choice = 'proceed' | 'cancel'
// The pane's buttons settle a waiting ask through these, keyed by its tool_use_id.
const answers = new Map<string, { settle: (choice: Choice) => void; shownAt: number }>()
let answeredAt = 0

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

// This plugin's agents by name; another plugin's type has no icon.
const agentIcon = (type: string) =>
  type.startsWith('ai-workflow:') ? AGENT_ICONS[type.slice('ai-workflow:'.length)] : undefined

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
const mask = (s: string) => s.replace(/\b(\w*(?:KEY|TOKEN|SECRET|PASSWORD|SESSION)\w*=)\S+/gi, '$1•••')

const describeCall = (tool: string, input: Record<string, unknown>) => {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = str('file_path').split(/[\\/]/).slice(-2).join('/')
  const what = str('command') || path || str('pattern') || str('url') || str('description')
  return mask(what ? `${tool} → ${what}` : tool)
}

const marked = (mark: string, text: string) => text.split('\n').map(line => `${mark} ${line}`)

// What a call asking permission would do, whole: an edit's change, or its command, file, URL,
// pattern or raw input.
const askDetail = (tool: string, input: unknown) => {
  const i = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const str = (key: string) => (typeof i[key] === 'string' ? (i[key] as string) : undefined)
  const file = str('file_path')
  if (tool === 'Edit' && file) {
    const change = [file, ...marked('-', str('old_string') ?? ''), ...marked('+', str('new_string') ?? '')]
    return { label: 'Change', detail: mask(change.join('\n')) }
  }
  if (tool === 'Write' && file) {
    return { label: 'Change', detail: mask([file, ...marked('+', str('content') ?? '')].join('\n')) }
  }
  const pattern = str('pattern')
  if (pattern) return { label: 'Pattern', detail: mask(str('path') ? `${pattern} in ${str('path')}` : pattern) }
  const fields: [string, string][] = [['command', 'Command'], ['file_path', 'File'], ['url', 'URL']]
  for (const [key, label] of fields) {
    const value = str(key)
    if (value) return { label, detail: mask(value) }
  }
  return { label: 'Input', detail: mask(JSON.stringify(i)) }
}

const isReadable = (detail: string) => detail.length <= MAX_ASK_CHARS && detail.split('\n').length <= MAX_ASK_LINES

// What the Proceed and Cancel buttons call. Ignored until the ask has been up for ARM_MS, and
// counting from the last answer, since the next waiting ask takes the buttons' place at once.
async function answerAsk($: EngineInterface, id: string, choice: Choice) {
  const ask = answers.get(id)
  if (!ask) return
  const now = await $.clock.now()
  if (now < Math.max(ask.shownAt, answeredAt) + ARM_MS) return
  answeredAt = now
  ask.settle(choice)
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

// Waits for the ask's Proceed / Cancel, or undefined once ASK_WAIT_S pass or the dispatch aborts.
// ponytail: a sleeping child process is the wait, since a hook's own time is capped at 10s but
// stands still while a $ call is in flight; swap it for a real wait if the engine grows one
async function waitForAnswer($: EngineInterface, id: string, shownAt: number): Promise<Choice | undefined> {
  const pressed = new Promise<Choice>(settle => answers.set(id, { settle, shownAt }))
  const sleeping = $.process.spawn({ argv: ['sleep', String(ASK_WAIT_S)] })[Symbol.asyncIterator]()
  const expired = (async () => {
    while (!(await sleeping.next()).done);
    return undefined
  })()
  try {
    return await Promise.race([pressed, expired])
  } finally {
    answers.delete(id)
    void sleeping.return?.(undefined as never) // kills the sleep; the answer need not wait for it
  }
}

// Applies fn to the subagent with this id; other loops (the leader's, nested ones) are skipped.
async function patch($: EngineInterface, id: string | undefined, fn: (a: Subagent) => Subagent) {
  if (!id || !(await read($, subagents)).some(a => a.id === id)) return
  await update($, subagents, all => all.map(a => (a.id === id ? fn(a) : a)))
}

async function openPane($: EngineInterface) {
  await update($, isPaneOpen, () => true)
  return $.ui.open({ id: PANE, title: 'Agent teams' })
}

// When the setup check finds a required tool or skill missing, a toast points at /ai-workflow:setup:
// once per list of missing items, so it stays quiet until the list changes. It never blocks or
// breaks the session start.
const SETUP_SEEN = 'setupMissing'
async function setupNotice($: EngineInterface) {
  try {
    const { exitCode, stdout } = await $.process.run(['bash', `${$.plugin.root}/skills/setup/scripts/check.sh`])
    const missing = stdout.split('\n').filter(l => l.startsWith('MISSING ')).map(l => l.slice(8, l.indexOf(':')))
    const seen = exitCode === 0 ? '' : missing.join(',')
    if ((await $.store.get(SETUP_SEEN)) === seen) return
    await $.store.set(SETUP_SEEN, seen)
    if (seen) $.ui.toast(`ai-workflow: ${missing.length} missing (${missing.join(', ')}) — run /ai-workflow:setup`)
  } catch {
    // no process runner or store here: the orchestrator's own preflight still checks
  }
}

// Team mode's task gate: the orchestrator's lead writes these lines into a task's description.
//   Checks: <shell command>  — a build task completes only while it exits 0, run in `Worktree:`
//   Worktree: <path>         — where the checks run (the session's folder without it)
//   Verdict file: <path>     — a review or QA task completes only once this file exists
// The text returned blocks the completion and reaches the teammate; undefined lets it through.
const GATE_TRIES = 3
const failedChecks = new Map<string, number>() // task id → failed completions in a row
const field = (text: string | undefined, name: string) =>
  text?.split('\n').find(l => l.startsWith(`${name}:`))?.slice(name.length + 1).trim() || undefined
async function taskGate($: EngineInterface, e: { task_id: string; task_subject: string; task_description?: string; cwd: string }) {
  const verdict = field(e.task_description, 'Verdict file')
  if (verdict && !(await $.fs.exists(verdict))) return `Write your verdict to ${verdict} before completing "${e.task_subject}".`
  const checks = field(e.task_description, 'Checks')
  if (!checks) return undefined
  const r = await $.process.run(['bash', '-c', checks], { cwd: field(e.task_description, 'Worktree') ?? e.cwd, timeoutMs: 600_000 }) // the host caps a run at 10 min
  if (r.exitCode === 0) {
    failedChecks.delete(e.task_id)
    return undefined
  }
  const n = (failedChecks.get(e.task_id) ?? 0) + 1
  failedChecks.set(e.task_id, n)
  const out = `${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-40).join('\n')
  const next =
    n >= GATE_TRIES
      ? `This is failure ${n} of ${GATE_TRIES}: stop, and SendMessage the lead "CHECKS STUCK: ${e.task_subject}" with the failing output.`
      : `Failure ${n} of ${GATE_TRIES}: fix it, then mark the task complete again.`
  return `"${e.task_subject}" can't complete: \`${checks}\` exited ${r.exitCode}.\n${out}\n${next}`
}

// The orchestrator's run mode for the pane's header, from the newest run state in tmp/team/:
// `Mode: team` is team mode, `Mode: team, fallback` the fallback, no Mode line the per-task flow.
// Read at most every 5 s. ponytail: the newest state.md wins when several specs ran in this folder
let modeRead: { at: number; mode?: string } = { at: -Infinity }
async function runMode($: EngineInterface, now: number) {
  if (Math.abs(now - modeRead.at) < 5000) return modeRead.mode
  let mode: string | undefined
  try {
    let newest: { path: string; at: number } | undefined
    for (const d of await $.fs.list('tmp/team')) {
      const path = `tmp/team/${d.name}/state.md`
      if (d.kind !== 'dir' || !(await $.fs.exists(path))) continue
      const at = (await $.fs.stat(path)).mtimeMs
      if (!newest || at > newest.at) newest = { path, at }
    }
    if (newest) {
      const line = String(await $.fs.read(newest.path)).split('\n').find(l => l.startsWith('Mode:'))
      mode = !line ? 'per-task flow' : line.includes('fallback') ? 'fallback mode' : 'team mode'
    }
  } catch {
    // no run state here: the header shows the leader's status
  }
  modeRead = { at: now, mode }
  return mode
}

// The agent teams row above the prompt, or undefined when it has nothing to show.
async function bandRow($: EngineInterface, e: RenderInput<'AbovePrompt'>, isAlwaysOn: boolean) {
  const a = (await read($, asks)).find(x => x.isAnswerable)
  const { Box, Button, Text } = $.ui.resolve(e)
  if (!a) {
    if (isAlwaysOn || (await read($, isPaneOpen))) return undefined
    return (
      <Box>
        <Button key="open-pane" label="▸ agent teams" plain dimColor onPress={() => void openPane($)} />
      </Box>
    )
  }
  const summary = `⚠ ${a.who} wants ${a.tool}: `
  if (a.detail.includes('\n') || summary.length + a.detail.length + 2 + BAND_BUTTONS_WIDTH > e.props.bodyColumns) {
    return (
      <Box>
        <Text color={ASK_COLOR} wrap="truncate-end">{summary}read it in the agent teams pane</Text>
      </Box>
    )
  }
  return (
    <Box>
      <Text color={ASK_COLOR} wrap="truncate-end">
        {summary}{a.detail}{'  '}
      </Text>
      <Button key={`band-proceed-${a.id}`} label="Proceed" hotkey="1" plain onPress={() => answerAsk($, a.id, 'proceed')} />
      <Text> </Text>
      <Button key={`band-cancel-${a.id}`} label="Cancel" hotkey="2" plain onPress={() => answerAsk($, a.id, 'cancel')} />
    </Box>
  )
}

// Records the session's mode from a classic hook that carries it. A subagent's hook carries the
// subagent's own mode, so only the lead's count.
async function followMode($: EngineInterface, e: { permission_mode?: string; agent_id?: string }) {
  if (e.permission_mode && !e.agent_id) await update($, permissionMode, () => e.permission_mode)
}

export const register: Register = (on, options) => {
  // Always On off: the pane opens only from the button above the prompt.
  const isAlwaysOn = options.alwaysOn !== false
  const isIconsOn = options.iconsOn !== false
  const isLogOn = options.logOn !== false

  // The session's permission mode. In auto mode the classifier answers asks, so the pane stays
  // out of them; the normal dialog asks if it can't. The engine hands tool.call, tool.check and
  // classic.PreToolUse no mode, so it is refreshed from each classic hook that carries one and
  // fires near an ask: start, prompt, the ask itself (PermissionRequest, PermissionDenied), and
  // after every tool call. SubagentStart/Stop always carry an agent_id, so they never count.
  // ponytail: tool.check runs before PermissionRequest, so a switch since the last hook is seen one ask late
  on('classic.SessionStart', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.UserPromptSubmit', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.PermissionRequest', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.PermissionDenied', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.PostToolUse', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.PostToolUseFailure', async ($, e, next) => (await followMode($, e), next(e)))
  on('classic.PostToolBatch', async ($, e, next) => (await followMode($, e), next(e)))

  on('classic.TaskCompleted', async ($, e, next) => {
    const block = await taskGate($, e)
    const r = await next(e)
    return block ? { ...r, block } : r
  })
    // A gate that can't run its checks (a worktree that's gone, a command that won't start)
    // refuses the completion instead of letting the task through unchecked.
    .catch(async ($, e, next) => ({
      ...(await next(e)),
      block: `The task gate couldn't run the checks for "${e.task_subject}": ${String(next.error ?? 'unknown error')}. Check the task's Worktree: line, then mark it complete again; if it keeps failing, SendMessage the lead.`,
    }))

  on('session.start', async ($, e, next) => {
    // The orchestrator reads the plan's limits through this to pause before one runs out.
    await $.tool.register({
      name: 'usage',
      description: 'The plan rate-limit windows (five_hour, seven_day, ...): percent used and reset time.',
    }).catch(err => $.ui.log(`ai-workflow: usage tool not registered: ${err}`))
    // It pauses on a full window: compacting first makes the resumed turn re-cache a summary.
    await $.tool.register({
      name: 'compact',
      description: 'Compact the conversation, as /compact does, once the current turn ends.',
      inputSchema: { type: 'object', properties: { instructions: { type: 'string', description: 'What the summary must keep' } } },
    }).catch(err => $.ui.log(`ai-workflow: compact tool not registered: ${err}`))
    void setupNotice($)
    // A reload (a changed setting) keeps the engine's panes: read whether ours is up.
    await update($, isPaneOpen, () => false)
    if (isAlwaysOn) void openPane($)
    else if ((await $.ui.panes()).some(p => p.id === PANE)) await update($, isPaneOpen, () => true)
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

  // An ask the person will answer: shown until its call settles, run or refused. Where a person
  // answers and the pane is on screen, its Proceed / Cancel decide; else the engine's prompt does.
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    const id = e.tool_use_id
    if (r.decision !== 'ask' || !id || (await read($, permissionMode)) === 'auto') return r
    const sub = (await read($, subagents)).find(a => a.id === e.agentId)
    const shown = askDetail(e.tool, e.input)
    const isPerson = e.approver === 'person' && !PERSON_TOOLS.has(e.tool) && isReadable(shown.detail)
    // Always On off: an ask doesn't open the pane; it is answered there only if already open.
    const placed = !isPerson
      ? undefined
      : isAlwaysOn
        ? await $.ui.open({ id: PANE })
        : (await $.ui.panes()).find(p => p.id === PANE)
    const ask: Ask = {
      id,
      who: sub ? capitalize(sub.name) : e.agentId ? 'A subagent' : 'Leader',
      tool: e.tool,
      ...shown,
      reason: r.reason,
      rule: r.rule,
      isAnswerable: placed?.isPlaced === true,
    }
    const shownAt = ask.isAnswerable ? await $.clock.now() : 0
    await update($, asks, all => [...all.filter(a => a.id !== id), ask])
    if (!ask.isAnswerable) return r

    const choice = await waitForAnswer($, id, shownAt)
    await update($, asks, all => all.filter(a => a.id !== id))
    if (choice === undefined) return r // no answer in time: the engine's prompt asks
    await say($, ask.who, `${choice === 'proceed' ? 'allowed' : 'cancelled'} · ${ask.tool} → ${ask.detail}`, choice === 'cancel')
    return choice === 'proceed'
      ? { decision: 'allow', reason: 'Allowed in the agent teams pane' }
      : { decision: 'deny', reason: 'The person cancelled this in the agent teams pane' }
  }).catch(($, e, next) => next(e)) // a panel bug must never change a verdict: the prompt asks

  // Compaction is refused while a turn runs, so the tool only books it for the turn's end.
  let compactAfterTurn: { instructions?: string } | undefined
  // @ts-ignore TS2589 (types recurse too deep) only when a session rewrote the MCP types with every connected server
  on('tool.call', { tool: /^mcp__ai-workflow__compact$/ }, async (_, e) => {
    const instructions = (e as { instructions?: unknown }).instructions
    compactAfterTurn = typeof instructions === 'string' ? { instructions } : {}
    return { result: [{ type: 'text', text: 'The conversation will be compacted when this turn ends.' }] }
  })

  on('tool.call', { tool: /^mcp__ai-workflow__usage$/ }, async $ => {
    const { rateLimits } = await $.session.usage()
    return { result: [{ type: 'text', text: JSON.stringify(rateLimits) }] }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const call = describeCall(e.tool, input)
    const sub = (await read($, subagents)).find(a => a.id === e.agentId)
    // What the agent is doing now, shown in its box while the call runs.
    if (sub) {
      const at = await $.clock.now()
      await patch($, sub.id, a => ({ ...a, doing: call, doingAt: at }))
    }
    // ponytail: an approved call stays listed until it finishes (a long Bash too); clear on
    // approval if an event for the person's answer turns up
    const r = await next(e).finally(() => update($, asks, all => all.filter(a => a.id !== e.tool_use_id)))
    const isOk = r.deny === undefined && r.isError !== true
    if (sub) {
      await patch($, sub.id, a => ({ ...a, steps: a.steps + 1 }))
      if (r.deny !== undefined) await say($, sub.who, `${call}  denied`, true)
      else await say($, sub.who, r.isError ? `${call}  ✗` : call, r.isError === true)
      // A completion the task gate refused comes back as an error, so it doesn't count.
      const id = String(input.taskId ?? '')
      if (e.tool === 'TaskUpdate' && input.status === 'completed' && isOk && id) {
        await patch($, sub.id, a => ({ ...a, tasksDone: [...new Set([...(a.tasksDone ?? []), id])] }))
      }
    } else if (!e.agentId && e.tool === 'TaskCreate' && isOk) {
      const name = /^Engineer:\s*(\S+)/m.exec(String(input.description ?? ''))?.[1]
      if (name) await update($, planned, p => ({ ...p, [name]: (p[name] ?? 0) + 1 }))
    }
    return r
  }).catch(($, e, next) => next(e)) // a panel bug must never block a tool

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) await update($, leader, (l): Leader => ({ ...l, status: 'idle' }))
    if (!e.agentId && compactAfterTurn) {
      const args = compactAfterTurn
      compactAfterTurn = undefined
      // ponytail: 1s after the turn so the engine is between turns; retry if it ever still rejects
      $.clock.after(1000, () => void $.session.compact(args).catch(err => $.ui.log(`ai-workflow: compact failed: ${err}`)))
    }
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

  on('ui.close', async ($, e, next) => {
    const r = await next(e)
    if (e.id === PANE) await update($, isPaneOpen, () => false)
    return r
  })

  // The first answerable ask, above the prompt too: a bare 1 or 2 in an empty prompt answers it,
  // but only when its whole request fits on the row. Otherwise the band points at the pane.
  // With Always On off and the pane closed, the band offers to open it instead. The rows beneath
  // (another plugin's, such as the Pomodoro band) stay below this one.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const own = await bandRow($, e, isAlwaysOn)
    const beneath = await next(e)
    if (!own) return beneath
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {own}
        {beneath}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Image = isIconsOn && 'Image' in els ? els.Image : undefined
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
    const mode = await runMode($, now)
    const plan = await read($, planned)
    const lead = await read($, leader)
    const all = await read($, subagents)
    const taskTime =
      lead.taskStartedAt === undefined ? '—' : formatDuration((lead.taskEndedAt ?? now) - lead.taskStartedAt)
    // Only working agents get a box: a finished or idle one is dropped.
    const subs = all.filter(s => s.status === 'running')
    const lines = (await read($, log)).slice(-LOG_ROWS)
    const waiting = await read($, asks)
    const isOpen = await read($, isLogOpen)

    return (
      <Box width="100%" flexDirection="column">
        <Box borderStyle="round" paddingX={1} justifyContent="center" alignItems="center">
          {icon('team', TEAM_ICON, TEAM_ICON_SIZE)}
          <Box marginLeft={Image ? 2 : 0} flexDirection="column">
            <Text>
              <Text bold>AGENT TEAMS</Text> - {model} <Text bold color={LEADER_COLOR}>{(mode ?? lead.status).toUpperCase()}</Text>
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
                  {/* Whole when the pane answers it; else one line, since the engine's prompt shows it whole. */}
                  {a.isAnswerable ? (
                    <Text bold>{a.detail}</Text>
                  ) : (
                    <Text bold wrap="truncate-end">
                      {a.detail.replace(/\s+/g, ' ')}
                    </Text>
                  )}
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
            {waiting[0]?.isAnswerable ? (
              <Box marginTop={1}>
                <Button key={`proceed-${waiting[0].id}`} label="Proceed" hotkey="1" plain onPress={() => answerAsk($, waiting[0]!.id, 'proceed')} />
                <Text> </Text>
                <Button key={`cancel-${waiting[0].id}`} label="Cancel" hotkey="2" plain onPress={() => answerAsk($, waiting[0]!.id, 'cancel')} />
                <Text dimColor italic>
                  {'  '}Claude is waiting on your answer{waiting.length > 1 ? ` (1 of ${waiting.length})` : ''}
                </Text>
              </Box>
            ) : (
              <Box marginTop={1}>
                <Text dimColor italic>
                  {waiting.length === 1 ? 'Claude is' : `${waiting.length} calls are`} waiting on your answer in the permission prompt
                </Text>
              </Box>
            )}
          </Box>
        )}
        <Box width="100%" flexDirection="column" borderStyle="round" borderColor={AGENTS_COLOR} paddingX={1}>
          {subs.length === 0 && <Text dimColor>No running subagents.</Text>}
          {subs.map(s => {
            const agent = agentIcon(s.type)
            const total = plan[s.name]
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
                  <Text wrap="truncate-end">
                    <Text bold>Now:</Text> {s.doing ?? 'Thinking'}
                    {s.doingAt !== undefined && <Text dimColor> · {formatDuration(now - s.doingAt)} ago</Text>}
                  </Text>
                  {total !== undefined && (
                    <Text>
                      <Text bold>Tasks:</Text> {s.tasksDone?.length ?? 0} of {total} done
                    </Text>
                  )}
                  <Text><Text bold>Tokens:</Text> {tokenLine(s.tokens)}</Text>
                  <Text><Text bold>Cost:</Text> {costLine(s.tokens, s.model)}</Text>
                  <Text><Text bold>Effort:</Text> {s.effort ? capitalize(s.effort) : '—'}</Text>
                </Box>
              </Box>
            )
          })}
        </Box>
        {isLogOn && (
          <Box width="100%" flexDirection="column" borderStyle="round" paddingX={1}>
            <Box>
              <Button key="log-toggle" plain dimColor onPress={() => update($, isLogOpen, open => !open)}>
                {isOpen ? '▾' : '▸'} session log
              </Button>
              {!isOpen && lines.length > 0 && <Text dimColor> ({lines.length} lines)</Text>}
            </Box>
            {isOpen && lines.length === 0 && <Text dimColor>Session not started</Text>}
            {isOpen && lines.map(l => (
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
        )}
      </Box>
    )
  })
}
