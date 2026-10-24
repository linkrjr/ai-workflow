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
  await $.agent.spawn({
    tool_use_id: 't1',
    prompt: 'go',
    description: 'fix bug',
    name: 'backend',
    subagentType: 'general-purpose',
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

  const mount = (surface: 'terminal' | 'desktop') => $.ui.mount({ ...PANE, surface })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mount(surface)
    const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    expect(await text(/AGENT TEAMS/)).toBe('AGENT TEAMS - OPUS 5.5 LEADER')
    expect(await text(/^Backend/)).toBe('Backend - Sonnet 5.5 - Running')
    expect(await text(/%$/)).toBe(`${'█'.repeat(4)}${'░'.repeat(16)} 19%`)
    expect(await text(/^Tokens/)).toBe('Tokens: 2.0k (1.0k in / 1.0k out)')
    // 1000 in at $2/M + 1000 out at $10/M
    expect(await text(/^Cost/)).toBe('Cost: $0.0120 (1.0k×$2/M + 1.0k×$10/M)')
    expect(await text(/^Effort/)).toBe('Effort: High')
    await ui.unmount()
  }

  // The turn's end reason sets the final status and fills the bar.
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'x', agentId: 'a1', reason: 'answer' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mount(surface)
    const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    expect(await text(/^Backend/)).toBe('Backend - Sonnet 5.5 - Completed')
    expect(await text(/%$/)).toBe(`${'█'.repeat(20)} 100%`)
    await ui.unmount()
  }
})
