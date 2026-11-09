---
name: setup
description: Check what ai-workflow needs on this machine and offer to install what's missing. Run it after installing the plugin, or when /orchestrator's preflight reports something missing.
disable-model-invocation: true
---

Check this machine for what ai-workflow needs, then offer to fix what's missing.

1. Run `${CLAUDE_SKILL_DIR}/scripts/check.sh` from the project folder. Each line is `OK`, `MISSING` (required) or `OPTIONAL`, with what is lost without it.
2. Everything `OK`, or only `OPTIONAL` lines you have no fix for → show the result in a short table and stop.
3. Otherwise ask with the question tool, `multiSelect`, which items to set up. Use one question per group, and only for groups with a missing item: at most 4 questions with at most 4 options each. Label each option with the item, and put what's lost without it in its description. Pre-recommend every `MISSING` item.
   - **Command-line tools:** git, gh, jq, curl
   - **Browser testing:** pinchtab CLI, pinchtab skill, Chrome
   - **Agent teams** (only if `OPTIONAL agent-teams`)
   - **Extras:** graphify, cmux
4. For each item the user ticked, use the matching fix below, one at a time, and show the command before running it. On a failure, say what failed and go on to the next item.

| Item | Fix |
|---|---|
| git, gh, jq, curl | macOS with Homebrew: `brew install <name>`. Linux with apt: tell the user to type `! sudo apt-get install -y <name>`, since `sudo` needs their password. Otherwise point to the tool's install page. |
| gh signed in | Tell the user to type `! gh auth login`. It's interactive, so never run it yourself. |
| pinchtab CLI | `brew install pinchtab/tap/pinchtab`. Without Homebrew: `bun add -g pinchtab` when Bun is installed (check that `~/.bun/bin` is on the PATH), otherwise `npm install -g pinchtab`. |
| pinchtab skill | `bunx skills add pinchtab/pinchtab` when Bun is installed, otherwise `npx skills add pinchtab/pinchtab`. It installs the skill from pinchtab's own repo, so ask before running it. |
| Chrome | Tell the user to install Google Chrome or Chromium. |
| Agent teams | Ask "This project only" (Recommended) / "Every project". Teams are experimental, and in every session they let Claude turn ordinary helper agents into teammates, which costs more tokens. Then add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` under `env` in `.claude/settings.local.json` (this project) or `~/.claude/settings.json` (every project). Keep everything already in the file. Claude Code picks the change up when the file is saved. |
| graphify | `uv tool install graphifyy` (or `pipx install graphifyy` without uv), then `graphify install` to add its skill. |
| cmux | Point to https://cmux.dev. It's a terminal app, so the user installs it. |

5. API keys (`LINEAR_API_KEY`, `TYPESAFE_API_KEY`) are never typed into this conversation. If one is `OPTIONAL` and the user wants that feature, say which variable to export in their shell profile, and that Jev also needs a `.jev-enabled` file at the repo root.
6. Run `check.sh` again and show the final table. If a skill or plugin was installed, say that it loads after `/reload-plugins` or a restart.
