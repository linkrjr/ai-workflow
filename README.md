# ONBOARDING.md — team-build-pipeline

---

## Document Owner

**Owner:** Ronaldo Gomes
**Review cadence:** after every agent or skill change
**Last reviewed:** 2026-10

---

## 1 — Codebase Purpose

This repo is a Claude Code plugin, `team-build-pipeline` (`plugins/team-build-pipeline/.claude-plugin/plugin.json`), and a local marketplace (`.claude-plugin/marketplace.json`) that hosts it for installation. It exposes two slash commands that together turn a feature idea into shipped, reviewed, documented code: `/interview-me` interviews the user into an approved spec, and `/team-manager` runs that spec through a lead-and-subagents pipeline (design, implementation, mandatory review, documentation). It produces no runtime service — its "output" is code changes made elsewhere in whatever repo it's invoked in, plus the spec and coordination files it writes under `docs/specs/` and `tmp/team/`.

---

## 2 — Layer Map

The codebase has no application layers in the traditional sense — it is a set of orchestration prompts (skills) and worker prompts (agents), outermost first:

| Stage | Responsibility | Key symbol |
|---|---|---|
| Plugin manifest | Declares the plugin and its marketplace listing | `plugin.json`, `marketplace.json` |
| `interview-me` skill | Interviews the user, writes the approved spec | `skills/interview-me/SKILL.md` |
| `team-manager` skill (lead) | Orchestrates Prepare → Design → Implement → Review → Document → Report | `skills/team-manager/SKILL.md` |
| `designer` agent | Conditional UI/UX pass, before any frontend work starts | `agents/designer.md` |
| `backend-engineer` / `frontend-engineer` agents | Implementation workers, scoped to one layer each | `agents/backend-engineer.md`, `agents/frontend-engineer.md` |
| `reviewer` agent | Mandatory, read-only review gate (no Edit/Write tools) | `agents/reviewer.md` |
| `writer` agent | Final documentation pass, after review is clean | `agents/writer.md` |

---

## 3 — Execution Lifecycle

**Representative execution:** a full `/interview-me` → `/team-manager` run.

1. **Entry (spec):** the user runs `/interview-me`; `skills/interview-me/SKILL.md` asks one multiple-choice question per turn, tracks open decisions, and writes `docs/specs/<slug>.md` once the ledger is empty.
2. **Prepare:** the user runs `/team-manager docs/specs/<slug>.md`; step "1. Prepare" in `skills/team-manager/SKILL.md` reads the spec and writes `tmp/team/handoff.md` (acceptance criteria, scope, API contract, task list) — the single shared source of truth every subagent reads.
3. **Design (conditional):** step "2. Design" spawns `designer` alone, only if the spec has a UI/UX or frontend surface and the client isn't a CLI, and only before any engineer starts. Its output is saved to `tmp/team/design.md` and linked from the handoff.
4. **Implement:** step "3. Implement" spawns `backend-engineer` and/or `frontend-engineer` depending on which layers change; each reads `tmp/team/handoff.md` as its brief.
5. **Review:** step "4. Review" spawns `reviewer`, which writes `tmp/team/review-round-<N>.md` ending in `VERDICT: CLEAN` or `VERDICT: FINDINGS`. The lead routes findings back to the owning engineer and loops — no round limit — until a round says `CLEAN`.
6. **Document:** step "5. Document" spawns `writer` alone — never in parallel with another agent, never before the review verdict is `CLEAN` — to update README/API docs/comments for the files that changed.
7. **Report:** step "6. Report" confirms the latest review file says `CLEAN`, then the lead reports what changed, AC-to-test coverage, and try-it-yourself steps to the user. The lead never commits.

---

## 4 — Domain Vocabulary

| Term | Definition |
|---|---|
| **Handoff** (`tmp/team/handoff.md`) | The shared scope/contract document every subagent reads before starting. Written and updated by the lead (`team-manager`). |
| **AC** | Acceptance criteria — numbered (AC1, AC2, …), copied verbatim from the spec into the handoff; each must trace to a test. |
| **Round** | One `reviewer` pass, recorded as `tmp/team/review-round-<N>.md`. The implement→review loop repeats with no round limit until a round is `CLEAN`. |
| **Verdict** | The `reviewer`'s pass/fail line: `VERDICT: CLEAN` (nothing wrong) or `VERDICT: FINDINGS` (listed, routed back to the owning engineer). |
| **subagent_type** | The Agent-tool parameter the lead passes to spawn a specific agent file by name (e.g. `"backend-engineer"`, `"designer"`). |
| **Design doc** (`tmp/team/design.md`) | `designer`'s saved output (aesthetic direction, components, design choices) — linked from the handoff so both engineers can read it. |

---

## 5 — Common Change Recipes

### Recipe A — Add a new agent role

1. Create `agents/<name>.md` with the same frontmatter shape as the existing agents (`name`, `description`, `tools`, `model`) — model on `agents/writer.md` for a narrow-scope worker, or `agents/backend-engineer.md`/`agents/frontend-engineer.md` for an implementation-scoped one.
2. Add a numbered step to `skills/team-manager/SKILL.md` stating exactly when the lead spawns it (before/after which existing step) and whether it may run in parallel with another agent — mirror step 2 (Design)'s explicit trigger condition or step 5 (Document)'s explicit exclusivity rule.
3. If other agents need its output, have it write a file under `tmp/team/` and add one line to the handoff pointing at that file (the pattern `designer` → `tmp/team/design.md` already establishes), rather than editing the consumer agents' own files.
4. Renumber every subsequent step and fix every `go back to section N` cross-reference in the file.

### Recipe B — Change the spec template

1. Edit the fenced `markdown` template block in `skills/interview-me/SKILL.md`.
2. `skills/team-manager/SKILL.md` step "1. Prepare" hard-depends on an `## Acceptance criteria` heading existing in the spec (it stops and tells the user to run `/interview-me` first if that heading is missing) — preserve that heading name if you rename or restructure template sections.

### Recipe C — Rename a skill or agent

1. `git mv` the skill/agent file or directory to the new name.
2. Update the `name:` frontmatter field inside the moved file.
3. Grep the whole repo for the old name (skill names are cross-referenced in prose inside other `SKILL.md` files, `plugin.json`, and `marketplace.json` — none of them read the frontmatter at runtime to resolve these references).

<!-- TODO: no recipe yet for adding a brand-new pipeline command (a third skill alongside interview-me/team-manager) — there is only one precedent pair to generalize from. -->

---

## 6 — High-Signal Files by Question Type

| Question type | Where to start |
|---|---|
| "How does the whole pipeline run end to end?" | `skills/team-manager/SKILL.md` |
| "Where does the spec come from, and what must it contain?" | `skills/interview-me/SKILL.md` |
| "What is `reviewer` allowed to do?" | `agents/reviewer.md` — note its `tools:` list has no `Edit`/`Write` |
| "Which agent owns which layer?" | each agent's frontmatter `description:` line |
| "What does the plugin declare itself as, and how is it installed locally?" | `plugins/team-build-pipeline/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |

---

## 7 — Known Gotchas

---

**Never skip the reviewer**

**Rule:** every implementation task goes through `reviewer`, with no exceptions — regardless of diff size or whether the engineer already ran tests.
**Why:** `skills/team-manager/SKILL.md`'s own "Never skip the reviewer" table states self-reports are not review, and small diffs still break contracts between layers.
**What breaks:** a contract break between `backend-engineer` and `frontend-engineer` output ships undetected; fixing it later costs more than the review round would have.

---

**`frontend-engineer` must not start before Design finishes, when Design applies**

**Rule:** step "2. Design" in `skills/team-manager/SKILL.md` explicitly says "never start `frontend-engineer` before this step is done" whenever the spec has a UI/UX or frontend surface.
**Why:** `frontend-engineer` is meant to build against the aesthetic direction in `tmp/team/design.md`, which doesn't exist yet until `designer` reports.
**What breaks:** frontend work built without the design doc has to be reworked once the design lands, duplicating the implementation.

---

**`writer` runs alone, and only after the review verdict is `CLEAN`**

**Rule:** step "5. Document" forbids running `writer` in parallel with any other agent, and forbids running it before the latest review round says `VERDICT: CLEAN`.
**Why:** `writer` documents the shipped, reviewed code — not a work-in-progress diff that might still change in the next review round.
**What breaks:** documentation describes behavior that changes again before the task is actually done, going stale immediately.

---

**`tmp/team/` must be gitignored by the first agent that touches it**

**Rule:** step "1. Prepare" instructs whichever engineer touches `tmp/team/` first to add it to `.gitignore` "before doing anything else" if it isn't already there.
**Why:** the handoff, design doc, and review-round files are per-run scratch/coordination state, not product source.
**What breaks:** skipping this lets scratch coordination files get committed into whatever repo the pipeline is running against.

<!-- TODO: no senior-engineer interview has happened yet for gotchas beyond what's already stated explicitly in skills/team-manager/SKILL.md. If more exist (e.g. around how `handoff.md` should be amended mid-task, or what happens if an engineer disagrees with a finding), capture them here after the next review. -->

---

**The agent/skill files assume external skills that are not installable plugin dependencies**

**Rule:** `agents/backend-engineer.md`, `agents/frontend-engineer.md`, `agents/writer.md`, `agents/reviewer.md`, and `skills/team-manager/SKILL.md` invoke `tdd`, `surgical-patch`, `safe-refactor`, `writing-for-agents`, `ai-slop-cleaner`, `security-review`, `code-review`, `pr`, and `handoff` by bare (unscoped) name. On a machine without those exact bare names registered, those `Skill(...)` calls will fail to resolve.
**Why:** verified by checking where each name actually resolves from on this machine: `surgical-patch`, `safe-refactor`, `writing-for-agents`, `handoff`, `tdd`, and `pr` are symlinks under `~/.claude/skills/` pointing into a personal `~/.agents/skills/` directory — Claude Code's local "skills-dir" convention, not a marketplace plugin. `code-review` is backed by the real, installable `code-review@claude-plugins-official` plugin. `security-review` has no file footprint anywhere in `~/.claude/`, so it is almost certainly a Claude Code built-in. None of `surgical-patch`, `safe-refactor`, `writing-for-agents`, or `handoff` have a known publicly-installable source — `mattpocock-skills@claude-plugins-official` bundles equivalents for `tdd`/`pr`/`writing-for-agents`/`code-review`, but only under the scoped name `mattpocock-skills:tdd` etc., which these files do not reference.
**What breaks:** installing this plugin on a machine that lacks that personal skills directory makes every one of those `Skill(...)` invocations (except `code-review` and whatever `security-review` turns out to be) silently unresolvable — the agents degrade to skipping the referenced discipline (TDD, surgical patching, doc cleanup) rather than erroring loudly, since the invocation is just a line of agent prompt text, not a hard dependency check.
