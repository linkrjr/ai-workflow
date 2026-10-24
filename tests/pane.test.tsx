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
    expect(await text(/AGENT TEAMS/)).toBe('AGENT TEAMS - OPUS 5.5 LEADER')
    expect(await text(/^Backend/)).toBe('Backend - Sonnet 5.5 - Running')
    expect(await text(/%$/)).toBe(`${'█'.repeat(4)}${'░'.repeat(16)} 19%`)
    expect(await text(/^Tokens: 2/)).toBe('Tokens: 2.0k (1.0k in / 1.0k out)')
    // 1000 in at $2/M + 1000 out at $10/M
    expect(await text(/^Cost: \$0\.0120/)).toBe('Cost: $0.0120 (1.0k×$2/M + 1.0k×$10/M)')
    expect(await text(/^Effort: H/)).toBe('Effort: High')
    expect(await text(/^Leader/)).toBe('Leader - Opus 5.5 - Idle')
    expect(await text(/^Subagents/)).toBe('Subagents: 1 running · 1 started')
    // The agent's icon is a terminal Raster; other surfaces have none.
    const icon = await ui.find({ type: 'Raster', key: 'agent-a1' })
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
    expect(await text(/^done/)).toBe('done · 3s')
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
  expect(await text(/^Leader/)).toBe('Leader - Opus 5.5 - Working')
  expect(await text(/^Tokens/)).toBe('Tokens: 2.0k (1.0k in / 1.0k out)')
  // 1000 in at $4/M + 1000 out at $20/M
  expect(await text(/^Cost/)).toBe('Cost: $0.0240 (1.0k×$4/M + 1.0k×$20/M)')
  expect(await text(/^Effort/)).toBe('Effort: Xhigh')
  expect(await text(/^Subagents/)).toBe('Subagents: 0 running · 0 started')
  expect(await text(/^build it$/)).toBe('build it')
  await ui.unmount()

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm1', reason: 'answer' })
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await after.find({ type: 'Text', text: /^Leader/ }))?.text).toBe('Leader - Opus 5.5 - Idle')
  await after.unmount()
})
