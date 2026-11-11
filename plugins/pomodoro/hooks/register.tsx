import type { Register } from 'claude-code'

import { closePomodoro, openPomodoro, pomodoroBand, pomodoroConfig, runPomodoro } from './pomodoro'

export const register: Register = (on, options) => {
  // Undefined with the Pomodoro setting off: nothing of it is offered or drawn.
  const pomodoro = pomodoroConfig(options)

  on('session.start', async ($, e, next) => {
    // With the setting off the stored phase is cleared, so turning it on again never
    // finishes a pomodoro nobody saw.
    await (pomodoro ? openPomodoro($, pomodoro) : closePomodoro($))
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await closePomodoro($)
    return next(e)
  })

  on('command.run', { command: 'pomodoro' }, async $ => {
    if (pomodoro) await runPomodoro($, pomodoro)
    return {}
  })

  // The row goes below whatever the band beneath draws, e.g. another plugin's rows.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const above = await next(e)
    const row = pomodoro && !e.props.hasSurvey ? await pomodoroBand($, e, above, pomodoro) : undefined
    return row ?? above
  })
}
