import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Pomodoro } from '../types'

const IDLE: Pomodoro = { phase: 'idle', position: 1, total: 4, count: 0 }
const pomodoro = atom({ plugin: 'ai-workflow', key: 'pomodoro' } as const, IDLE)
// Bumped every second while a phase runs, so the countdown redraws.
const tick = atom({ plugin: 'ai-workflow', key: 'pomodoroTick' } as const, 0)

const MINUTE = 60_000

// A setting that is missing, not a whole number or out of range is its default.
const whole = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : dflt

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const isRunning = (s: Pomodoro) => s.phase === 'work' || s.phase === 'short' || s.phase === 'long'

// The pomodoro after the one just done: 1 again after the cycle's last, or if the cycle shrank.
const upNext = (s: Pomodoro, cycle: number) => {
  const n = s.position >= s.total ? 1 : s.position + 1
  return n > cycle ? 1 : n
}

// The lengths in minutes, read once per load: a changed setting reloads the module, and a
// phase already running keeps its stored end, so a new length applies from the next phase.
// Undefined with the setting off.
export type Config = { work: number; short: number; long: number; cycle: number }

export const pomodoroConfig = (options: Record<string, unknown>): Config | undefined =>
  options.pomodoroOn === false
    ? undefined
    : {
        work: whole(options.pomodoroWorkMinutes, 1, 120, 25),
        short: whole(options.pomodoroShortBreakMinutes, 1, 120, 5),
        long: whole(options.pomodoroLongBreakMinutes, 1, 120, 15),
        cycle: whole(options.pomodoroPerCycle, 2, 8, 4),
      }

// The toast and the ring for a phase's end. The ring is not awaited, and a clip that can't
// play (no player, no audio device) is dropped: the toast and the timer go on.
function alert($: EngineInterface, text: string) {
  $.ui.toast(text)
  $.audio.play({ asset: 'assets/sounds/pomodoro-ring.wav' }).catch(() => {})
}

// The hooks that call these sit in register.tsx and pass `$` to module-level functions only:
// the engine reads a hooks module's source and refuses `$` or `on` handed to anything else.
let ticker: ReturnType<EngineInterface['clock']['every']> | undefined

function stopTicking() {
  ticker?.cancel()
  ticker = undefined
}

// Ends the running phase once it reaches 00:00: a pomodoro counts and a break follows,
// a break leaves the timer waiting. The update runs again on a version miss, so the
// transition is read back from the last run.
async function onTick($: EngineInterface, c: Config) {
  const now = await $.clock.now()
  let ended: Pomodoro | undefined
  const after = await update($, pomodoro, (s): Pomodoro => {
    ended = undefined
    if (!isRunning(s) || s.endsAt === undefined || now < s.endsAt) return s
    ended = s
    if (s.phase !== 'work') return { ...s, phase: 'waiting', endsAt: undefined }
    const isLong = s.position >= s.total
    return { ...s, count: s.count + 1, phase: isLong ? 'long' : 'short', endsAt: now + (isLong ? c.long : c.short) * MINUTE }
  })
  if (ended?.phase === 'work') alert($, `Pomodoro done — take a ${after.phase === 'long' ? c.long : c.short}-min break`)
  else if (ended) alert($, 'Break over — start your next pomodoro when ready')
  else await update($, tick, n => n + 1)
  if (!isRunning(after)) stopTicking()
}

function startTicking($: EngineInterface, c: Config) {
  ticker ??= $.clock.every(1000, () => void onTick($, c))
}

// Starts the next pomodoro from idle or waiting.
async function start($: EngineInterface, c: Config) {
  const now = await $.clock.now()
  await update($, pomodoro, (s): Pomodoro =>
    s.phase === 'idle' || s.phase === 'waiting'
      ? { ...s, phase: 'work', position: s.phase === 'idle' ? 1 : upNext(s, c.cycle), total: c.cycle, endsAt: now + c.work * MINUTE }
      : s,
  )
  startTicking($, c)
}

async function pause($: EngineInterface) {
  const now = await $.clock.now()
  const after = await update($, pomodoro, (s): Pomodoro =>
    s.phase === 'work' && s.endsAt !== undefined ? { ...s, phase: 'paused', leftMs: s.endsAt - now, endsAt: undefined } : s,
  )
  // A tick may have ended the pomodoro first: the break it started keeps its ticker.
  if (after.phase === 'paused') stopTicking()
}

async function resume($: EngineInterface, c: Config) {
  const now = await $.clock.now()
  await update($, pomodoro, (s): Pomodoro =>
    s.phase === 'paused' ? { ...s, phase: 'work', endsAt: now + (s.leftMs ?? 0), leftMs: undefined } : s,
  )
  startTicking($, c)
}

// Stop: the band hides and the cycle starts over; today's count stays.
async function stop($: EngineInterface) {
  await update($, pomodoro, (s): Pomodoro => ({ ...s, phase: 'idle', position: 1, endsAt: undefined, leftMs: undefined }))
  stopTicking()
}

async function skip($: EngineInterface) {
  await update($, pomodoro, (s): Pomodoro =>
    s.phase === 'short' || s.phase === 'long' ? { ...s, phase: 'waiting', endsAt: undefined } : s,
  )
  stopTicking()
}

// session.start: registers /pomodoro, and after a reload (a changed setting) picks the
// stored phase's countdown up again.
export async function openPomodoro($: EngineInterface, c: Config) {
  try {
    await $.command.register({ name: 'pomodoro', description: 'Start a Pomodoro, or show where the timer is' })
    if (isRunning(await read($, pomodoro))) startTicking($, c)
  } catch {
    // the timer must never keep the agent teams pane from opening (the same hook)
  }
}

// session.end: the timer belongs to the session (a /clear too), and a pomodoro still
// running is never counted. Never throws, for the same reason as openPomodoro.
export async function closePomodoro($: EngineInterface) {
  try {
    await stop($)
  } catch {
    // the timer must never keep the agent teams pane from opening or closing (the same hooks)
  }
}

// /pomodoro: starts the next pomodoro, or toasts where a running one is.
export async function runPomodoro($: EngineInterface, c: Config) {
  const s = await read($, pomodoro)
  if (s.phase === 'idle' || s.phase === 'waiting') return start($, c)
  const left = clock(s.phase === 'paused' ? s.leftMs ?? 0 : (s.endsAt ?? 0) - (await $.clock.now()))
  const what =
    s.phase === 'work' ? `Pomodoro ${s.position}/${s.total}`
    : s.phase === 'paused' ? `Pomodoro ${s.position}/${s.total} (paused)`
    : s.phase === 'long' ? 'Long break'
    : 'Short break'
  $.ui.toast(`${what} — ${left} left`)
}

// The band's row drawn below `above` (the tree beneath), or undefined while idle.
export async function pomodoroBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, above: RenderElement, c: Config) {
  const s = await read($, pomodoro)
  if (s.phase === 'idle') return undefined
  await read($, tick) // redraw on every tick while a phase runs
  const left = s.phase === 'paused' ? s.leftMs ?? 0 : (s.endsAt ?? 0) - (await $.clock.now())
  const { Box, Button, Text } = $.ui.resolve(e)
  const place = `${s.position}/${s.total}`
  const status = {
    work: `🍅 Pomodoro ${place} · ${clock(left)}`,
    paused: `🍅 Paused ${place} · ${clock(left)}`,
    short: `☕ Short break · ${clock(left)}`,
    long: `☕ Long break · ${clock(left)}`,
    waiting: `🍅 Break over · next: pomodoro ${upNext(s, c.cycle)}/${c.cycle}`,
  }[s.phase]
  const main =
    s.phase === 'work' ? <Button key="pomodoro-pause" label="Pause" onPress={() => pause($)} />
    : s.phase === 'paused' ? <Button key="pomodoro-resume" label="Resume" onPress={() => resume($, c)} />
    : s.phase === 'waiting' ? <Button key="pomodoro-start" label="Start pomodoro" onPress={() => start($, c)} />
    : <Button key="pomodoro-skip" label="Skip" onPress={() => skip($)} />

  return (
    <Box flexDirection="column">
      {above}
      <Box>
        <Text>{status} · today ×{s.count}{'   '}</Text>
        {main}
        <Text> </Text>
        <Button key="pomodoro-stop" label="Stop" onPress={() => stop($)} />
      </Box>
    </Box>
  )
}
