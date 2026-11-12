# Bypass mode allows every permission ask

Type: FEATURE
Tech stack: Claude Code plugin — Markdown skills and agent prompts, TypeScript engine hooks with the engine's test runner, Bash scripts with bash tests

## Problem
With bypass permissions on, mostly in the Claude Code desktop app, a long /orchestrator run still stops on permission asks: writes Claude Code still asks about, and asks that the agent teams pane holds in its permission box. The person turned bypass on to leave the run unattended, so every ask that waits on them stalls the run for nothing. Today the plugin only treats auto mode as "hands off", and only notices a mode change at the next prompt.

## User stories
- As a person running /orchestrator with bypass permissions on, I can walk away and the run never waits on a permission ask, so it finishes unattended.
- As that person, I can see in the agent teams pane that bypass is on and which calls were allowed because of it, so I can audit the run afterwards.
- As that person, I still get the workflow's own questions (tracker choice, design, plan approval), so decisions stay mine.

## Acceptance criteria
- AC1: With the session in bypass permissions mode, a permission ask raised by the lead's tool call is allowed without any prompt or pane box, and the call runs.
- AC2: With the session in bypass permissions mode, a permission ask raised inside a subagent or teammate is allowed the same way, and the call runs.
- AC3: In bypass permissions mode, AskUserQuestion and plan approval (ExitPlanMode) still reach the person exactly as today; neither is answered by the plugin.
- AC4: In bypass permissions mode, a call that a deny rule in the person's settings refuses is still refused.
- AC5: In bypass permissions mode, a call whose tool carries an organisation-set ceiling of "ask" still asks the person.
- AC6: Switching the session into bypass permissions mode mid-turn makes the very next permission ask (lead or subagent) be allowed, without waiting for a new prompt.
- AC7: Switching the session out of bypass permissions mode mid-turn makes the very next permission ask follow the new mode (pane box in default mode, left to the classifier in auto mode), without waiting for a new prompt.
- AC8: While the session is in bypass permissions mode, the agent teams pane header shows a BYPASS marker; in any other mode the marker is absent.
- AC9: With Session Log On, each ask the plugin allows because of bypass mode adds one session-log line naming who made the call and the tool, e.g. "Backend · allowed Bash (bypass)". With Session Log On off, no line is added and the call is still allowed.
- AC10: In bypass permissions mode, team mode's first questions leave out the git allow-rules question and no allow rules are written to the project's settings; in any other mode the question is asked as today.
- AC11: AC1–AC9 hold on the desktop app, terminal and IDE surfaces alike.
- AC12: In auto, default and acceptEdits modes the pane's permission handling is unchanged, and the existing pane tests pass.

## Detailed behaviour
**Bypass on, a call needs permission.** Whoever made the call (the lead, a subagent, a teammate), the plugin answers the ask with allow. No permission box appears in the pane, nothing shows above the prompt, the normal permission prompt does not open, and the pane does not open itself because of it. The call runs at once.

**Session log.** When Session Log On is set, each such allow adds one line, "<who> · allowed <tool> (bypass)", using the same names the pane already uses for the lead and subagents. With it off, nothing is logged.

**Header.** While the session is in bypass mode the header carries a BYPASS marker next to the run mode it shows today (TEAM MODE, FALLBACK MODE, PER-TASK FLOW, or the leader's status). It appears and disappears as the mode changes, at the next tool call or prompt.

**Mode changes.** The plugin follows the session's current mode at each tool call, not only at each prompt. Turning bypass on in the desktop app during a run takes effect on the next call; turning it off returns the next ask to that mode's normal handling.

**Questions and denies.** The workflow's questions to the person and plan approval are not permission asks and always reach the person. Deny rules still refuse. An organisation ceiling of "ask" is respected and goes to the normal permission prompt.

**Team mode.** In bypass mode the orchestrator's first-questions call has no git allow-rules question and writes no git rules. Every other first question is unchanged.

**Empty / error states.** If the plugin cannot tell the session's mode, it behaves as today (no auto-allow). If writing the session-log line fails, the call is still allowed. A pane failure never blocks or denies a call.

## Access and permissions
Single person per session. Auto-allowing happens only when that person has put the session in bypass permissions mode themselves; the plugin never switches the mode. Organisation ceilings and the person's deny rules outrank it.

## Business rules
- Only the bypass permissions mode triggers auto-allow; auto, default, acceptEdits, plan and dontAsk do not.
- Exempt from auto-allow: AskUserQuestion, ExitPlanMode, deny-rule refusals, organisation "ask" ceilings.
- Default when the mode is unknown: no auto-allow.

## Scope
- In scope: auto-allowing permission asks in bypass mode for the lead and every subagent/teammate; following mode changes per tool call; the BYPASS header marker and session-log lines; skipping team mode's git allow-rules question in bypass mode; the README's pane and auto-mode notes updated to describe bypass mode.
- Out of scope: changing any subagent's permission mode; /ai-workflow:setup and its check script; auto-answering the workflow's questions; overriding deny rules or organisation ceilings; any change to Claude Code's own bypass behaviour.
- Must stay unchanged: auto mode handling (pane stays out, classifier decides); the pane's permission box, Proceed / Cancel, 10-minute fallback and readability limits in default and acceptEdits modes; the workflow never force-pushes; the Always On, Icons On and Session Log On settings.
