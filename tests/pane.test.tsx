import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'ai-workflow',
  component: 'Pane',
  requestId: 'agent-teams',
  props: {
    title: 'Agent teams',
    isFocused: false,
    bodyColumns: 120,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the pane shows the leader and each subagent it started', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let now = Date.parse('2026-10-24T14:43:26')
  on('clock.now', () => ({ value: (now += 1000) }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: {
        model: 'claude-sonnet-5-5',
        input_tokens: 1000,
        output_tokens: 1000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const mount = (surface: 'terminal' | 'desktop') => $.ui.mount({ ...PANE, surface })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mount(surface)
    expect((await ui.find({ type: 'Text', text: /^Session not started$/ }))?.text).toBe('Session not started')
    await ui.unmount()
  }

  await $.agent.spawn({
    tool_use_id: 't1',
    prompt: 'go',
    description: 'fix bug',
    name: 'backend',
    subagentType: 'ai-workflow:backend-engineer',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  for await (const _ of $.turn.step({
    turnId: 'x',
    index: 0,
    model: 'claude-sonnet-5-5',
    effort: 'high',
    messageCount: 1,
    agentId: 'a1',
  }));

  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mount(surface)
    const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    expect(await text(/AGENT TEAMS/)).toBe('AGENT TEAMS - OPUS 5.5 IDLE')
    expect(await text(/^Backend/)).toMatch(/^Backend - Sonnet 5\.5 - \d+s - Running$/)
    expect(await text(/%$/)).toBe(`${'█'.repeat(4)}${'░'.repeat(16)} 19%`)
    expect(await text(/^Tokens: 2/)).toBe('Tokens: 2.0k (1.0k in / 1.0k out)')
    // 1000 in at $2/M + 1000 out at $10/M
    expect(await text(/^Cost: \$0\.0120/)).toBe('Cost: $0.0120 (1.0k×$2/M + 1.0k×$10/M)')
    expect(await text(/^Effort: H/)).toBe('Effort: High')
    expect(await text(/^Leader/)).toBe('Leader - Opus 5.5 - — - Idle')
    expect(await text(/^Subagents/)).toBe('Subagents: 1 running · 1 started')
    // The agent's icon is a terminal Image; other surfaces have none.
    const icon = await ui.find({ type: 'Image', key: 'agent-a1' })
    expect(Boolean(icon)).toBe(surface === 'terminal')
    await ui.unmount()
  }

  // A finished agent's box is dropped; the log keeps what it did.
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'x', agentId: 'a1', reason: 'answer' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mount(surface)
    const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    expect(await text(/^Backend/)).toBeUndefined()
    expect(await text(/^No running subagents/)).toBe('No running subagents.')
    expect(await text(/^fix bug$/)).toBe('fix bug')
    expect(await text(/^spawned/)).toBe('spawned · backend')
    expect(await text(/^Bash/)).toBe('Bash → ls')
    expect(await text(/^done/)).toMatch(/^done · \d+s$/)
    expect(await text(/^Session not started/)).toBeUndefined()
    await ui.unmount()
  }
})

test("the leader box follows the main session's own turns", async ($, on) => {
  let now = Date.parse('2026-10-24T14:43:26')
  on('clock.now', () => ({ value: (now += 1000) }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: {
        model: 'claude-opus-5-5',
        input_tokens: 1000,
        output_tokens: 1000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'build it', turnId: 'm1' })
  for await (const _ of $.turn.step({ turnId: 'm1', index: 0, model: 'claude-opus-5-5', effort: 'xhigh', messageCount: 1 }));

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
  expect(await text(/^Leader/)).toBe('Leader - Opus 5.5 - 1s - Working')
  expect(await text(/^AGENT TEAMS/)).toBe('AGENT TEAMS - OPUS 5.5 WORKING')
  expect(await text(/^Tokens/)).toBe('Tokens: 2.0k (1.0k in / 1.0k out)')
  // 1000 in at $4/M + 1000 out at $20/M
  expect(await text(/^Cost/)).toBe('Cost: $0.0240 (1.0k×$4/M + 1.0k×$20/M)')
  expect(await text(/^Effort/)).toBe('Effort: Xhigh')
  expect(await text(/^Subagents/)).toBe('Subagents: 0 running · 0 started')
  expect(await text(/^build it$/)).toBe('build it')
  await ui.unmount()

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm1', reason: 'answer' })
  // The task ended with the turn (no subagent running): its time stops there.
  for (let i = 0; i < 2; i++) {
    const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await after.find({ type: 'Text', text: /^Leader/ }))?.text).toBe('Leader - Opus 5.5 - 2s - Idle')
    await after.unmount()
  }
})

test('a permission ask is held while its call waits, and dropped once it settles', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.check', () => ({ decision: 'ask' as const, reason: 'rm is not allowed by default' }))
  // Every write of the plugin's asks, in order; the kit's own store sits beneath.
  const writes: unknown[] = []
  on('state.set', { plugin: 'ai-workflow', key: 'asks' }, (_, e, next) => (writes.push(e.value), next(e)))
  let held: unknown
  on('classic.PermissionRequest', () => {
    // The person is being asked now: the last write is what the pane shows.
    held = writes.at(-1)
    return { decision: { behavior: 'deny' as const } }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build API_KEY=abc123' })

  expect(held).toEqual([
    {
      id: expect.any(String),
      who: 'Leader',
      tool: 'Bash',
      label: 'Command',
      detail: 'rm -rf build API_KEY=•••',
      reason: 'rm is not allowed by default',
      isAnswerable: false,
    },
  ])
  expect(writes.at(-1)).toEqual([])
})

test('the permission box shows each waiting ask', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const waiting = [
    { id: 't1', who: 'Backend', tool: 'Bash', label: 'Command', detail: 'rm -rf build', reason: 'rm is not allowed', isAnswerable: false },
  ]
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  on('state.get', { plugin: 'ai-workflow', key: 'asks' }, () => ({ value: { value: waiting, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
  expect(await text(/^⚠/)).toBe('⚠ Permission · Backend wants to use Bash')
  expect(await text(/^rm -rf/)).toBe('rm -rf build')
  expect(await text(/^rm is not/)).toBe('rm is not allowed')
  expect(await text(/waiting on your answer/)).toBe('Claude is waiting on your answer in the permission prompt')
  await ui.unmount()
})

test('Proceed in the pane answers an ask a person would', async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.check', () => ({ decision: 'ask' as const, reason: 'rm is not allowed by default' }))
  // The wait's sleep: never ends by itself, only when the pane's answer kills it.
  on('process.spawn', async function* (_, e, next) {
    await new Promise<void>(resolve => next.signal.addEventListener('abort', () => resolve()))
    return { value: { code: null, signal: 'SIGTERM' } }
  })

  let stored!: () => void
  const isStored = new Promise<void>(resolve => (stored = resolve))
  on('state.set', { plugin: 'ai-workflow', key: 'asks' }, (_, e, next) => {
    if (e.value.some(a => a.isAnswerable)) stored()
    return next(e)
  })

  const verdict = $.tool.check({
    tool: 'Bash',
    input: { command: 'rm -rf build' },
    tool_use_id: 't1',
    approver: 'person',
  })
  await isStored
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /waiting on your answer/ }))?.text).toBe('  Claude is waiting on your answer')
  await ui.press({ key: 'proceed-t1' })
  await ui.unmount()

  expect((await verdict).decision).toBe('allow')
})

test('Cancel above the prompt refuses an ask a person would answer', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.check', () => ({ decision: 'ask' as const }))
  on('process.spawn', async function* (_, e, next) {
    await new Promise<void>(resolve => next.signal.addEventListener('abort', () => resolve()))
    return { value: { code: null, signal: 'SIGTERM' } }
  })

  // The band draws once the plugin has stored the ask as answerable.
  let stored!: () => void
  const isStored = new Promise<void>(resolve => (stored = resolve))
  on('state.set', { plugin: 'ai-workflow', key: 'asks' }, (_, e, next) => {
    if (e.value.some(a => a.isAnswerable)) stored()
    return next(e)
  })

  const verdict = $.tool.check({ tool: 'Bash', input: { command: 'git push' }, tool_use_id: 't2', approver: 'person' })
  await isStored
  const band = await $.ui.mount({
    plugin: 'ai-workflow',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })
  expect((await band.find({ type: 'Text', text: /^⚠/ }))?.text).toBe('⚠ Leader wants Bash: git push  ')
  await band.press({ key: 'band-cancel-t2' })
  await band.unmount()

  const r = await verdict
  expect(r.decision).toBe('deny')
})

test('the session log box collapses and expands', async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
  expect(await text(/^Session not started$/)).toBe('Session not started')

  await ui.press({ key: 'log-toggle' })
  expect(await text(/^Session not started$/)).toBeUndefined()

  await ui.press({ key: 'log-toggle' })
  expect(await text(/^Session not started$/)).toBe('Session not started')
  await ui.unmount()
})

const BAND = {
  plugin: 'ai-workflow',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

test('Always On off: the pane waits for the button above the prompt', { options: { alwaysOn: false } }, async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  // The engine's own band beneath: nothing to show.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual([])

  const band = await $.ui.mount(BAND)
  await band.press({ key: 'open-pane' })
  expect(opened).toEqual(['agent-teams'])
  expect(await band.find({ key: 'open-pane' })).toBeUndefined()
  await band.unmount()
})

test('Always On: the pane opens with the session and the band stays empty', async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  // The engine's own band beneath: nothing to show.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual(['agent-teams'])
  const band = await $.ui.mount(BAND)
  expect(await band.find({ key: 'open-pane' })).toBeUndefined()
  await band.unmount()
})

test('Icons On off: the pane draws no icons', { options: { iconsOn: false } }, async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-25T14:20:00') }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /AGENT TEAMS/ }))?.text).toBe('AGENT TEAMS - OPUS 5.5 IDLE')
  await ui.unmount()
})

test('in auto mode an ask is left to the classifier: no permission box', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.check', () => ({ decision: 'ask' as const }))
  on('classic.UserPromptSubmit', () => ({}))
  const writes: unknown[] = []
  on('state.set', { plugin: 'ai-workflow', key: 'asks' }, (_, e, next) => (writes.push(e.value), next(e)))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.classic.UserPromptSubmit({ prompt: 'go', permission_mode: 'auto' })
  const r = await $.tool.check({ tool: 'Bash', input: { command: 'git push' }, tool_use_id: 't3', approver: 'person' })

  expect(r.decision).toBe('ask')
  expect(writes).toEqual([])
})
