---
max_turns: 30
timeout_seconds: 1200
allowed_tools: [Agent, Read, Grep, Glob, Bash]
---

Use the Agent tool to dispatch `ai-workflow:code-reviewer` with exactly this brief, then reply with its one-line result:

"Read tmp/team/context.md. Review the change `git diff base HEAD` in this repo for task T4; it stands in for a PR, so use git instead of gh. Task doc: intent/clear-save-error.md. This is round 1. Write your result to review.md."
