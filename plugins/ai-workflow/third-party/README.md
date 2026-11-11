# Bundled third-party skills

These skills ship inside the plugin, unmodified, so the agents never depend on a skill the user installed by hand. Claude Code names them `ai-workflow:<skill>`.

| Skill | Source | Version | Licence |
|---|---|---|---|
| `tdd` | [mattpocock/skills](https://github.com/mattpocock/skills) `skills/engineering/tdd` | mattpocock-skills plugin 1.3.1 | MIT, `LICENSE-mattpocock-skills` |
| `writing-for-agents` | mattpocock/skills `skills/productivity/writing-for-agents` | 1.3.1 | MIT, `LICENSE-mattpocock-skills` |
| `handoff` | mattpocock/skills `skills/productivity/handoff` | 1.3.1 | MIT, `LICENSE-mattpocock-skills` |
| `surgical-patch` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) `skills/surgical-patch` | main at 1e91f1306d60 | Apache-2.0, `LICENSE-caveman` |
| `safe-refactor` | JuliusBrussee/caveman `skills/safe-refactor` | main at 1e91f1306d60 | Apache-2.0, `LICENSE-caveman` |

To update one, copy the upstream folder over `skills/<skill>/` unchanged and update its row. Any edit to a caveman skill has to be noted in its file, per the Apache licence.
