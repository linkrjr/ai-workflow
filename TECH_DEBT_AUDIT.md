# Tech Debt Audit — team-build-plugin

**Generated:** 2026-10-21
**Base commit:** a1f8c34
**Repo type:** Claude Code plugin (prompt-based, no runtime code)

---

## Executive Summary

- **3 Critical findings** (dual plugin manifests, undeclared external dependencies, silent skill resolution failures)
- **4 High findings** (documentation drift, inconsistent frontmatter, README TODO gaps)
- **1 Medium finding** (example runs not documented)
- **Debt concentration:** Primarily manifests and documentation; the core skill/agent prompt content is sound
- **Quick remediation:** Fix version mismatch, add dependencies field to plugin.json, and reconcile README recipes with actual file locations (~1 hour)

---

## Architectural Mental Model

This repo packages an AI engineering team orchestration plugin for Claude Code. It has no runtime application code—only declarative prompts that define five AI agents (designer, backend-engineer, frontend-engineer, reviewer, writer) and three skills (/interview-me, /team-manager, /code-audit) that users invoke to guide feature development through spec approval, design, implementation, mandatory code review, and documentation phases.

The architecture is a **lead agent + worker pool model**: team-manager acts as an orchestrating lead, spawning specialist agents for each phase, collecting their output into shared state files (handoff.md, design.md, review-round-N.md), and looping review until clean. This is a *workflow template*, not a service.

**Contradiction with README:** The README states the plugin lives at `plugins/team-build-pipeline/.claude-plugin/plugin.json`, but there is also a root `.claude-plugin/plugin.json` with different version numbers (1.0.6 vs 1.0.0). This dual-manifest pattern is undocumented and creates ambiguity about which is canonical.

---

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|---|---|---|---|---|---|---|
| F001 | Architectural decay | `.claude-plugin/plugin.json` vs `plugins/team-build-pipeline/.claude-plugin/plugin.json` | Critical | S | Dual plugin.json files with mismatched versions (1.0.6 vs 1.0.0); unclear which is canonical. Root manifest was recently edited (commit 086f125) but inner one is stale. | Delete root `.claude-plugin/plugin.json`. Maintain a single canonical manifest in `plugins/team-build-pipeline/.claude-plugin/plugin.json`. Validate that the inner plugin.json is what Claude Code loads. |
| F002 | Dependency debt | `plugins/team-build-pipeline/.claude-plugin/plugin.json:1-26` | Critical | M | Plugin.json declares no `dependencies` field, yet README (section 7) documents that 8 external skills are *required* (tdd, surgical-patch, safe-refactor, writing-for-agents, handoff, code-review, security-review, pr). If these aren't installed, agents silently degrade instead of erroring, leading to incomplete implementations. | Add a `dependencies` field to plugin.json listing each required skill with a source (e.g. `{"tdd": "mattpocock-skills:tdd"}`). Add a pre-flight check to team-manager that validates skill availability and fails loudly if any are missing. |
| F003 | Error handling | `plugins/team-build-pipeline/agents/*.md` + README section 7 | Critical | S | External skill invocations fail silently when skills aren't installed. The Skill() tool just doesn't resolve, so agents skip TDD/surgical-patch/code-review workflows without user awareness. | Document this as a setup requirement in plugin.json's `description`. Add a setup guide in README section 1 (Codebase Purpose) with "Required skills" subsection and installation commands. Consider pre-flight validation. |
| F004 | Documentation drift | `README.md:66-70 (Recipe A)` | High | S | Recipe A instructs to "Create `agents/<name>.md`" but the skill file structure is `skills/<name>/SKILL.md`, and agents are at `agents/<name>.md` — the recipe conflates the two types and misdirects users adding a new agent. | Clarify: Recipe A is for adding a new **agent** (edit agents/<name>.md). Add a Recipe D for adding a new **skill** (create skills/<name>/SKILL.md with `---name, description---` frontmatter). Separate recipes by artifact type. |
| F005 | Documentation drift | `README.md:76-81 (Recipe C)` | High | S | Recipe C says "grep the whole repo for the old name" but skill/agent names are only in frontmatter + plugin.json + prose references inside other SKILL.md files. Doesn't mention greping inside nested `.claude-plugin/` directories or the marketplace.json file. | Update Recipe C step 3 to be specific: "Grep only `plugins/` directory and `.claude-plugin/` directories, plus `marketplace.json`." Add a checklist: plugin.json, marketplace.json, prose in SKILL.md files. |
| F006 | Consistency rot | `plugins/team-build-pipeline/agents/designer.md:5` | High | S | Designer agent uses `level: 2` instead of `effort` field; all other agents (backend-engineer, frontend-engineer, reviewer, writer) use `effort: <high|medium|xhigh>`. Breaks frontmatter schema consistency. | Rename `level: 2` to `effort: high` in designer.md. Verify all 5 agents now use the same frontmatter schema. |
| F007 | Documentation decay | `README.md:82 and 132` | High | M | Two incomplete TODO comments: line 82 says "no recipe yet for adding a brand-new pipeline command" and line 132 says "no senior-engineer interview has happened yet for gotchas beyond what's already stated." These frame unfinished work as documented gotchas, misleading users about what is supported. | Replace each TODO with either (a) a real recipe/gotcha, or (b) a `<!-- TODO: track in issue #X -->` comment pointing to tracked work. Don't ship incomplete sections as if they are documented. |
| F008 | Documentation drift | `README.md:91` | Medium | M | README claims "it is a set of orchestration prompts (skills) and worker prompts (agents), outermost first" but the layer map then lists plugin manifest, interview-me skill, team-manager skill, then agents. The order suggests interview-me is "outermost" but it's actually the first skill, not a plugin-level concern. Subtle but confusing framing. | Reframe section 2 (Layer Map) as "Execution stack" rather than "outermost first." Clarify that interview-me and team-manager are orchestration skills (user-invoked) while agents are worker roles spawned by team-manager. |
| F009 | Architectural decay | `README.md:137-140` | Medium | S | README documents external skill resolution as a "gotcha" under "Known Gotchas" section rather than addressing it in the plugin or setup. The gotcha is real but the section is titled "Known Gotchas" with no gotchas filled in—just references to things that could break. | Move the external skill dependency concern out of "Known Gotchas" into a new "Setup & Prerequisites" section in the README. Frame it as a *requirement*, not a gotcha. Include verification steps. |
| F010 | Test debt | (no file) | Medium | L | No example runs of the pipeline exist in the repo. Users can't see what a real `/interview-me` → `/team-manager` flow produces without actually running it. This is common for prompt-based plugins but worth noting. | Add an `examples/` directory with sample spec markdown files and corresponding handoff, design, and review outputs. Or add to README a "Sample output" section with markdown snippets. Low effort, high value for users. |

---

## Top 5 "If You Fix Nothing Else"

### 1. **F001 — Delete root `.claude-plugin/plugin.json`**
- **Impact:** Removes ambiguity about which manifest is canonical; prevents version skew.
- **Diff:** Delete file. Verify plugins/team-build-pipeline/.claude-plugin/plugin.json is what Claude Code's plugin loader looks for (likely is, based on naming).
- **Effort:** ~5 minutes. Test: run `/reload-plugins` and confirm plugin still loads.

### 2. **F002 + F003 — Add `dependencies` field to plugin.json and document required skills**
- **Impact:** Makes plugin dependencies explicit; prevents silent agent degradation.
- **Diff:**
  ```json
  {
    "dependencies": {
      "tdd": "external",
      "surgical-patch": "external",
      "safe-refactor": "external",
      "writing-for-agents": "external",
      "handoff": "external",
      "code-review": "claude-plugins-official",
      "security-review": "external",
      "pr": "external"
    }
  }
  ```
  Update README section 1 with "Requirements" subsection listing each skill and where to get it.
- **Effort:** ~20 minutes.

### 3. **F006 — Fix designer.md frontmatter to use `effort` instead of `level`**
- **Impact:** Consistent agent schema; tools that parse frontmatter won't choke.
- **Diff:** Change `level: 2` → `effort: high` in plugins/team-build-pipeline/agents/designer.md:5
- **Effort:** ~1 minute. Validate: check all agents use same frontmatter fields.

### 4. **F004 — Clarify and separate recipes in README by artifact type**
- **Impact:** Users adding new agents or skills follow correct patterns; fewer misdirected changes.
- **Diff:** Expand Recipe A section (agents only), add Recipe D (skills only), with correct file paths and examples.
- **Effort:** ~15 minutes. Review each recipe against actual file layout.

### 5. **F007 + F009 — Remove or complete TODO comments; move skill dependencies to Prerequisites section**
- **Impact:** README no longer ships with incomplete sections; setup requirements are explicit.
- **Diff:**
  - Delete TODO comments at lines 82, 132, or replace with issue links.
  - Extract external skill info from "Known Gotchas" into new "Setup & Prerequisites" section.
  - Add installation steps for each required skill (or links to their repos).
- **Effort:** ~30 minutes (20 for writing Prerequisites section, 10 for validation).

---

## Quick Wins

- [ ] F001: Delete `.claude-plugin/plugin.json` (1 minute)
- [ ] F006: Change designer.md `level: 2` → `effort: high` (1 minute)
- [ ] F010: Add 2–3 sample spec markdown files to `examples/` directory (15 minutes, boilerplate from interview-me template)

---

## Things That Look Bad But Are Actually Fine

- **Skills invoke external skills with bare names** (e.g., `Skill(..., 'tdd')`): Looks like it should be scoped (e.g., `'mattpocock-skills:tdd'`), but Claude Code allows both scoped and unscoped resolution. The bare names resolve correctly if those skills are installed locally (the README's "gotcha" documents this). Not a bug; it's an intentional design choice that users install custom local skills.

- **Agent prompt files are 27–120 lines**: Looks small, but this is correct. Agents are role descriptions + constraints, not full implementations. The brevity forces clarity (if the agent prompt is >200 LOC, the role is too large).

- **No version field in agent/skill frontmatter**: Prompt files don't version individually; versioning is at the plugin.json level only. Correct for this architecture.

- **Team-manager is a Opuspr, reviewer is Sonnet**: Looks like cost misalignment, but it's intentional: team-manager is orchestration (low-latency, decision-making), reviewer is deep analysis (requires Sonnet's reasoning). Effort field (`medium` vs `xhigh`) reflects this.

- **README chapter headings are numbered (1, 2, 3…) not h2/h3**: Not conventional markdown style, but deliberate. Matches onboarding document format (numbered "chapters"). Consistent within the file.

---

## Open Questions for the Maintainer

1. **Is `.claude-plugin/plugin.json` at the repo root intentional?** It appears to be a stale or shadow manifest. Is it used for local marketplace registration (`marketplace.json` references the inner plugin), or can it be deleted safely?

2. **What is the intended installation flow?** Does a user clone this repo and run it locally, or install via a marketplace? The marketplace.json suggests local-only, but the GitHub repository link in plugin.json suggests it could be published.

3. **Are the external skills (tdd, surgical-patch, writing-for-agents, handoff, etc.) meant to be user-installed before running team-manager, or should team-manager gracefully handle their absence?** Currently it silently skips workflows. Is that acceptable, or should setup be mandatory?

4. **Designer agent `level: 2` field**: What does `level` mean (versioning, priority, depth)? Should all agents use `effort` for consistency, or does `level` convey different information?

5. **No tests or example runs**: Is this intentional for a prompt-based plugin? Would examples or a "test run" checklist in the README be valuable for validating the plugin works after install?

---

## Summary

This is a well-conceived plugin with clear role boundaries and explicit guardrails (mandatory review, TDD enforcement, design-before-frontend). The core prompt content is sound. Debt is light and concentrated in manifest configuration and documentation organization — no architectural rot, no broken contracts.

**Primary remediation:** Reconcile the dual plugin.json files, explicitly declare external dependencies, and fix documentation recipes to match actual file layout. Everything else is lower-priority polish.

**Risk if not addressed:** Users installing this plugin may silently lose TDD, code review, and documentation workflows if required external skills aren't present, leading to incomplete implementations that appear to succeed.
