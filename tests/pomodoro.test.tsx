import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'ai-workflow',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

const MIN = 60_000

// The engine beneath the plugin: the clock, the command list, the toasts and an empty band.
// Extras go in one named options object, never positional: { startAt, audioFails }.
const boot = async (
  $: any,
  on: any,
  { startAt = Date.parse('2026-11-01T09:00:00'), audioFails = false }: { startAt?: number; audioFails?: boolean } = {},
) => {
  const clock = mock.clock(on, { now: startAt })
  const registered: string[] = []
  const toasts: string[] = []
  const rings: string[] = []
  const draws = { engineBand: 0 }
  on('command.register', (_: any, e: any) => (registered.push(e.name), { value: { command: e.name } }))
  on('ui.toast', (_: any, e: any) => (toasts.push(e.text), { value: undefined }))
  on('audio.play', (_: any, e: any) => {
    rings.push(e.clip.asset)
    if (audioFails) throw new Error('no audio device')
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: any, e: any) => ({ sessionId: e.sessionId }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    draws.engineBand++
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  return { clock, registered, toasts, rings, draws }
}

// The Pomodoro row's text and the keys of its buttons.
const row = async (ui: any) => ({
  text: (await ui.find({ type: 'Text', text: /^(🍅|☕)/ }))?.text as string | undefined,
  has: async (key: string) => (await ui.find({ key })) !== undefined,
})

const run = ($: any) => $.command.run({ command: 'pomodoro' })

test('AC1: /pomodoro is offered with the setting on, and not with it off', async ($, on) => {
  const { registered } = await boot($, on)
  expect(registered).toEqual(['pomodoro'])
})

test('AC1: with the setting off there is no /pomodoro and no band', { options: { pomodoroOn: false } }, async ($, on) => {
  const { registered } = await boot($, on)
  expect(registered).toEqual([])
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Pomodoro/ })).toBeUndefined()
  await ui.unmount()
})

test('AC2: no band before /pomodoro is run', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(BAND)
  expect((await row(ui)).text).toBeUndefined()
  expect(await ui.find({ key: 'engine-band' })).toBeDefined()
  await ui.unmount()
})

test('AC2: the idle band asks the hooks beneath for the band once per draw', async ($, on) => {
  const { draws } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  expect(draws.engineBand).toBe(1)
  await ui.unmount()
})

test('AC3, AC10: /pomodoro starts a 25-minute pomodoro that counts down every second', async ($, on) => {
  const { clock } = await boot($, on)
  await run($)
  const ui = await $.ui.mount(BAND)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 25:00 · today ×0   ')
  await clock.advance(1000)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 24:59 · today ×0   ')
  await clock.advance(59_000)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 24:00 · today ×0   ')
  await ui.unmount()
})

test('AC6: a pomodoro offers Pause and Stop; Pause freezes the countdown, Resume continues it', async ($, on) => {
  const { clock } = await boot($, on)
  await run($)
  const ui = await $.ui.mount(BAND)
  await clock.advance(10_000)
  const r = await row(ui)
  expect([await r.has('pomodoro-pause'), await r.has('pomodoro-stop'), await r.has('pomodoro-skip')]).toEqual([true, true, false])

  await ui.press({ key: 'pomodoro-pause' })
  expect((await row(ui)).text).toBe('🍅 Paused 1/4 · 24:50 · today ×0   ')
  await clock.advance(5 * MIN)
  expect((await row(ui)).text).toBe('🍅 Paused 1/4 · 24:50 · today ×0   ')
  expect(await ui.find({ key: 'pomodoro-pause' })).toBeUndefined()

  await ui.press({ key: 'pomodoro-resume' })
  await clock.advance(10_000)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 24:40 · today ×0   ')
  await ui.unmount()
})

test('AC4, AC5, AC8: a pomodoro counts and starts a break, a break ends in the waiting state; the 4th pomodoro earns the long break', async ($, on) => {
  const { clock, toasts } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)

  for (const n of [1, 2, 3]) {
    await clock.advance(25 * MIN)
    expect((await row(ui)).text).toBe(`☕ Short break · 05:00 · today ×${n}   `)
    expect(toasts.at(-1)).toBe('Pomodoro done — take a 5-min break')
    await clock.advance(5 * MIN)
    expect((await row(ui)).text).toBe(`🍅 Break over · next: pomodoro ${n + 1}/4 · today ×${n}   `)
    expect(toasts.at(-1)).toBe('Break over — start your next pomodoro when ready')
    // no new pomodoro starts by itself
    await clock.advance(10 * MIN)
    expect((await row(ui)).text).toContain('Break over')
    await ui.press({ key: 'pomodoro-start' })
    expect((await row(ui)).text).toBe(`🍅 Pomodoro ${n + 1}/4 · 25:00 · today ×${n}   `)
  }

  await clock.advance(25 * MIN)
  expect((await row(ui)).text).toBe('☕ Long break · 15:00 · today ×4   ')
  expect(toasts.at(-1)).toBe('Pomodoro done — take a 15-min break')
  await clock.advance(15 * MIN)
  expect((await row(ui)).text).toBe('🍅 Break over · next: pomodoro 1/4 · today ×4   ')
  await ui.unmount()
})

test('AC7: Stop during a pomodoro keeps the count, hides the band and resets the cycle', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(25 * MIN) // pomodoro 1 counts, short break
  await ui.press({ key: 'pomodoro-skip' })
  await ui.press({ key: 'pomodoro-start' }) // pomodoro 2/4
  await clock.advance(MIN)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 2/4 · 24:00 · today ×1   ')

  await ui.press({ key: 'pomodoro-stop' })
  expect((await row(ui)).text).toBeUndefined()
  await clock.advance(30 * MIN)
  expect((await row(ui)).text).toBeUndefined()

  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 25:00 · today ×1   ')
  await ui.unmount()
})

test('AC8: a break offers Skip and Stop; Skip goes to waiting with no alert, Stop hides the band', async ($, on) => {
  const { clock, toasts } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(25 * MIN)
  const toastsBefore = toasts.length
  const r = await row(ui)
  expect([await r.has('pomodoro-skip'), await r.has('pomodoro-stop'), await r.has('pomodoro-pause')]).toEqual([true, true, false])

  await ui.press({ key: 'pomodoro-skip' })
  expect((await row(ui)).text).toBe('🍅 Break over · next: pomodoro 2/4 · today ×1   ')
  expect(toasts.length).toBe(toastsBefore)

  await ui.press({ key: 'pomodoro-start' })
  await clock.advance(25 * MIN)
  await ui.press({ key: 'pomodoro-stop' }) // during the break
  expect((await row(ui)).text).toBeUndefined()
  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 25:00 · today ×2   ')
  await ui.unmount()
})

test('AC9: /pomodoro during a pomodoro or break only toasts the status; waiting starts the next pomodoro', async ($, on) => {
  const { clock, toasts } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(6 * MIN + 18_000)
  await run($)
  expect(toasts).toEqual(['Pomodoro 1/4 — 18:42 left'])
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 18:42 · today ×0   ')

  await clock.advance(18 * MIN + 42_000) // done: toast, break
  await clock.advance(MIN + 48_000)
  await run($)
  expect(toasts.at(-1)).toBe('Short break — 03:12 left')
  expect((await row(ui)).text).toBe('☕ Short break · 03:12 · today ×1   ')

  await clock.advance(5 * MIN)
  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 2/4 · 25:00 · today ×1   ')
  await ui.unmount()
})

test('AC12: closing the session ends its timer; the running pomodoro is not counted', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(10 * MIN)
  await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
  expect((await row(ui)).text).toBeUndefined()
  await clock.advance(30 * MIN)
  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 25:00 · today ×0   ')
  await ui.unmount()
})

// A second `session.start` mid-phase (what a reload runs) keeps the stored phase: the running phase
// keeps its stored end, still ticks and still transitions. The kit cannot swap `options` mid-test, so
// this uses the same lengths. That a new length waits for the next phase follows from the phase
// keeping its end and the lengths being read only when a phase starts. NOT covered: `openPomodoro`
// picking the ticker back up after a real reload (the kit cannot restart the module, so the module's
// ticker survives this second `session.start`).
test('AC13: a reload mid-phase carries the countdown on from its stored end and still transitions', async ($, on) => {
  const { clock, toasts } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(10 * MIN)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 15:00 · today ×0   ')
  await clock.advance(1000)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 14:59 · today ×0   ')
  await clock.advance(15 * MIN)
  expect((await row(ui)).text).toBe('☕ Short break · 04:59 · today ×1   ')
  expect(toasts).toEqual(['Pomodoro done — take a 5-min break'])
  await ui.unmount()
})

test('AC13: settings set the lengths and the cycle', { options: { pomodoroWorkMinutes: 2, pomodoroShortBreakMinutes: 1, pomodoroLongBreakMinutes: 3, pomodoroPerCycle: 2 } }, async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/2 · 02:00 · today ×0   ')
  await clock.advance(2 * MIN)
  expect((await row(ui)).text).toBe('☕ Short break · 01:00 · today ×1   ')
  await clock.advance(MIN)
  await ui.press({ key: 'pomodoro-start' })
  await clock.advance(2 * MIN)
  expect((await row(ui)).text).toBe('☕ Long break · 03:00 · today ×2   ')
  await ui.unmount()
})

test('AC13: a missing, fractional or out-of-range setting falls back to its default', { options: { pomodoroWorkMinutes: 0, pomodoroShortBreakMinutes: 2.5, pomodoroLongBreakMinutes: 121, pomodoroPerCycle: 9 } }, async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  expect((await row(ui)).text).toBe('🍅 Pomodoro 1/4 · 25:00 · today ×0   ')
  await clock.advance(25 * MIN)
  expect((await row(ui)).text).toBe('☕ Short break · 05:00 · today ×1   ')
  await ui.unmount()
})

// The Buttons of the band, top to bottom.
const buttons = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)

test('AC14: the agent teams open button stays first, the Pomodoro row below it', { options: { alwaysOn: false } }, async ($, on) => {
  await boot($, on)
  await run($)
  const ui = await $.ui.mount(BAND)
  expect(await buttons(ui)).toEqual(['open-pane', 'pomodoro-pause', 'pomodoro-stop'])
  await ui.unmount()
})

test('AC14: a Proceed / Cancel ask stays first, the Pomodoro row below it', async ($, on) => {
  on('tool.check', () => ({ decision: 'ask' as const }))
  // The ask's wait: ends only when the answer kills it.
  on('process.spawn', async function* (_: any, __: any, next: any) {
    await new Promise<void>(resolve => next.signal.addEventListener('abort', () => resolve()))
    return { value: { code: null, signal: 'SIGTERM' } }
  })
  let stored!: () => void
  const isStored = new Promise<void>(resolve => (stored = resolve))
  on('state.set', { plugin: 'ai-workflow', key: 'asks' }, (_: any, e: any, next: any) => {
    if (e.value.some((a: any) => a.isAnswerable)) stored()
    return next(e)
  })
  await boot($, on)
  await run($)
  const verdict = $.tool.check({ tool: 'Bash', input: { command: 'git push' }, tool_use_id: 't1', approver: 'person' })
  await isStored

  const ui = await $.ui.mount(BAND)
  expect(await buttons(ui)).toEqual(['band-proceed-t1', 'band-cancel-t1', 'pomodoro-pause', 'pomodoro-stop'])
  expect((await ui.find({ type: 'Text', text: /^⚠/ }))?.text).toBe('⚠ Leader wants Bash: git push  ')
  await ui.press({ key: 'band-cancel-t1' })
  await ui.unmount()
  expect((await verdict).decision).toBe('deny')
})

test('AC4, AC5: the ring plays with the toast at the end of a pomodoro and of a break', async ($, on) => {
  const { clock, rings } = await boot($, on)
  await run($)
  await clock.advance(25 * MIN - 1000)
  expect(rings).toEqual([])
  await clock.advance(1000)
  // The kit has no fs ($.fs is undefined under `claude plugin test`), so this only checks the path
  // string; that assets/sounds/pomodoro-ring.wav exists on disk is not testable here.
  expect(rings).toEqual(['assets/sounds/pomodoro-ring.wav'])
  await clock.advance(5 * MIN)
  expect(rings).toEqual(['assets/sounds/pomodoro-ring.wav', 'assets/sounds/pomodoro-ring.wav'])
})

test('AC8: Skip, Pause, Resume and Stop are silent', async ($, on) => {
  const { clock, rings } = await boot($, on)
  const ui = await $.ui.mount(BAND)
  await run($)
  await ui.press({ key: 'pomodoro-pause' })
  await ui.press({ key: 'pomodoro-resume' })
  await clock.advance(25 * MIN)
  expect(rings.length).toBe(1) // the pomodoro's own end
  await ui.press({ key: 'pomodoro-skip' })
  await ui.press({ key: 'pomodoro-stop' })
  expect(rings.length).toBe(1)
  await ui.unmount()
})

test('AC4, AC5: when the ring cannot play the toast still shows and the timer goes on', async ($, on) => {
  const { clock, toasts, rings } = await boot($, on, { audioFails: true })
  const ui = await $.ui.mount(BAND)
  await run($)
  await clock.advance(25 * MIN)
  expect(rings.length).toBe(1)
  expect(toasts.at(-1)).toBe('Pomodoro done — take a 5-min break')
  await clock.advance(5 * MIN)
  expect(toasts.at(-1)).toBe('Break over — start your next pomodoro when ready')
  expect((await row(ui)).text).toContain('Break over')
  await ui.unmount()
})

test('AC16: with the ring off a phase end shows the toast and plays no sound', { options: { pomodoroRing: false } }, async ($, on) => {
  const { clock, toasts, rings } = await boot($, on)
  await run($)
  await clock.advance(25 * MIN)
  expect(toasts.at(-1)).toBe('Pomodoro done — take a 5-min break')
  await clock.advance(5 * MIN)
  expect(toasts.at(-1)).toBe('Break over — start your next pomodoro when ready')
  expect(rings).toEqual([])
})

test('AC16: with the ring on, or the setting missing, a phase end plays the ring', { options: { pomodoroRing: true } }, async ($, on) => {
  const { clock, rings } = await boot($, on)
  await run($)
  await clock.advance(25 * MIN)
  expect(rings.length).toBe(1)
})
