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

## 2 — Setup & Prerequisites

This plugin does not declare its external skill dependencies in `plugin.json` — Claude Code's plugin manifest schema has no `dependencies` field to put them in, so this is enforced by convention, not tooling. Before running `/team-manager`, install these or the steps that invoke them silently degrade (the `Skill(...)` call just doesn't resolve — no error, the agent skips the discipline and moves on):

| Skill invoked | Called from | Where it actually comes from |
|---|---|---|
| `tdd`, `surgical-patch`, `safe-refactor`, `writing-for-agents`, `handoff`, `pr` | `agents/backend-engineer.md`, `agents/frontend-engineer.md`, `agents/writer.md`, `agents/reviewer.md`, `skills/team-manager/SKILL.md` | Personal skills-dir symlinks under `~/.claude/skills/` → `~/.agents/skills/` on this machine — not a marketplace plugin. `mattpocock-skills@claude-plugins-official` bundles equivalents for `tdd`/`pr`/`writing-for-agents`, but only under scoped names (`mattpocock-skills:tdd`) that these files do not reference. |
| `code-review` | same as above | Real, installable plugin: `code-review@claude-plugins-official`. |
| `security-review` | same as above | No file footprint under `~/.claude/` — almost certainly a Claude Code built-in, not something to install. |

**Verify before running a task:** confirm each bare skill name above resolves on your machine (e.g. it's listed when Claude Code loads skills, or symlinked under your skills directory). If `tdd`, `surgical-patch`, `safe-refactor`, `writing-for-agents`, `handoff`, or `pr` aren't available, either install an equivalent under that exact bare name, or accept that the corresponding engineering discipline (TDD, surgical patching, doc cleanup) will be silently skipped for this run.

---

## 3 — Execution Stack

The codebase has no application layers in the traditional sense — it is a set of orchestration prompts (skills, user-invoked) and worker prompts (agents, spawned by `team-manager`), listed in the order a run touches them:

| Stage | Responsibility | Key symbol |
|---|---|---|
| Plugin manifest | Declares the plugin and its marketplace listing | `plugin.json`, `marketplace.json` |
| `interview-me` skill | Interviews the user, writes the approved spec | `skills/interview-me/SKILL.md` |
| `team-manager` skill (lead) | Orchestrates Prepare → Design → Implement → Review → Document → Report | `skills/team-manager/SKILL.md` |
| `ticket-reviewer` agent | Conditional reproduction gate for BUG/TICKET specs, before any other agent starts | `agents/ticket-reviewer.md` |
| `designer` agent | Conditional UI/UX pass, before any frontend work starts | `agents/designer.md` |
| `backend-engineer` / `frontend-engineer` agents | Implementation workers, scoped to one layer each | `agents/backend-engineer.md`, `agents/frontend-engineer.md` |
| `reviewer` agent | Mandatory, read-only review gate (no Edit/Write tools) | `agents/reviewer.md` |
| `writer` agent | Final documentation pass, after review is clean | `agents/writer.md` |

---

## 4 — Execution Lifecycle

**Representative execution:** a full `/interview-me` → `/team-manager` run.

1. **Entry (spec):** the user runs `/interview-me`; `skills/interview-me/SKILL.md` asks one multiple-choice question per turn, tracks open decisions, and writes `docs/specs/<slug>.md` once the ledger is empty.
2. **Prepare:** the user runs `/team-manager docs/specs/<slug>.md`; step "1. Prepare" in `skills/team-manager/SKILL.md` reads the spec and writes `tmp/team/handoff.md` (acceptance criteria, scope, API contract, task list) — the single shared source of truth every subagent reads.
3. **Verify reproduction (conditional):** if the spec's `Type:` is `BUG` or `TICKET`, step "1a. Verify reproduction" spawns `ticket-reviewer` alone, before any other agent, and saves its report to `tmp/team/ticket-review.md`. A `REPRODUCED` status continues the pipeline; `NOT REPRODUCED` or `BLOCKED` stops here and reports straight to the user — no designer, no engineer. `FEATURE` specs skip this step entirely.
5. **Design (conditional):** step "2. Design" spawns `designer` alone, only if the spec has a UI/UX or frontend surface and the client isn't a CLI, and only before any engineer starts. Its output is saved to `tmp/team/design.md` and linked from the handoff.
6. **Implement:** step "3. Implement" spawns `backend-engineer` and/or `frontend-engineer` depending on which layers change; each reads `tmp/team/handoff.md` as its brief.
7. **Review:** step "4. Review" spawns `reviewer`, which writes `tmp/team/review-round-<N>.md` ending in `VERDICT: CLEAN` or `VERDICT: FINDINGS`. The lead routes findings back to the owning engineer and loops — no round limit — until a round says `CLEAN`.
8. **Document:** step "5. Document" spawns `writer` alone — never in parallel with another agent, never before the review verdict is `CLEAN` — to update README/API docs/comments for the files that changed.
9. **Report:** step "6. Report" confirms the latest review file says `CLEAN`, then the lead reports what changed, AC-to-test coverage, and try-it-yourself steps to the user. The lead never commits.

---

## 5 — Domain Vocabulary

| Term | Definition |
|---|---|
| **Handoff** (`tmp/team/handoff.md`) | The shared scope/contract document every subagent reads before starting. Written and updated by the lead (`team-manager`). |
| **AC** | Acceptance criteria — numbered (AC1, AC2, …), copied verbatim from the spec into the handoff; each must trace to a test. |
| **Round** | One `reviewer` pass, recorded as `tmp/team/review-round-<N>.md`. The implement→review loop repeats with no round limit until a round is `CLEAN`. |
| **Verdict** | The `reviewer`'s pass/fail line: `VERDICT: CLEAN` (nothing wrong) or `VERDICT: FINDINGS` (listed, routed back to the owning engineer). |
| **subagent_type** | The Agent-tool parameter the lead passes to spawn a specific agent file by name (e.g. `"backend-engineer"`, `"designer"`). |
| **Design doc** (`tmp/team/design.md`) | `designer`'s saved output (aesthetic direction, components, design choices) — linked from the handoff so both engineers can read it. |
| **Type** | The spec's `FEATURE \| BUG \| TICKET` field, written by `interview-me`. `BUG`/`TICKET` gate the pipeline on `ticket-reviewer`; `FEATURE` skips that gate. |
| **Ticket review** (`tmp/team/ticket-review.md`) | `ticket-reviewer`'s saved report for a BUG/TICKET spec, ending in `STATUS: REPRODUCED \| NOT REPRODUCED \| BLOCKED`. Only `REPRODUCED` lets the pipeline continue. |

---

## 6 — Common Change Recipes

### Recipe A — Add a new agent role

Agents are workers spawned by `team-manager`; they have no slash command of their own.

1. Create `agents/<name>.md` with the same frontmatter shape as the existing agents (`name`, `description`, `tools`, `model`, `effort`) — model on `agents/writer.md` for a narrow-scope worker, or `agents/backend-engineer.md`/`agents/frontend-engineer.md` for an implementation-scoped one.
2. Add a numbered step to `skills/team-manager/SKILL.md` stating exactly when the lead spawns it (before/after which existing step) and whether it may run in parallel with another agent — mirror step 2 (Design)'s explicit trigger condition or step 5 (Document)'s explicit exclusivity rule.
3. If other agents need its output, have it write a file under `tmp/team/` and add one line to the handoff pointing at that file (the pattern `designer` → `tmp/team/design.md` already establishes), rather than editing the consumer agents' own files.
4. Renumber every subsequent step and fix every `go back to section N` cross-reference in the file.

### Recipe B — Change the spec template

1. Edit the fenced `markdown` template block in `skills/interview-me/SKILL.md`.
2. `skills/team-manager/SKILL.md` step "1. Prepare" hard-depends on an `## Acceptance criteria` heading existing in the spec (it stops and tells the user to run `/interview-me` first if that heading is missing) — preserve that heading name if you rename or restructure template sections.
3. Step "1. Prepare" also reads the `Type: FEATURE | BUG | TICKET` line to decide whether to gate on `ticket-reviewer` (step "1a. Verify reproduction") — preserve that literal field name and its three values if you touch the template header.

### Recipe C — Rename a skill or agent

1. `git mv` the skill/agent file or directory to the new name (skills live at `skills/<name>/SKILL.md`; agents live at `agents/<name>.md`).
2. Update the `name:` frontmatter field inside the moved file.
3. Grep for the old name in: every `SKILL.md` and `agents/*.md` file (prose cross-references, e.g. `team-manager` naming `designer`), `plugins/team-build-pipeline/.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`. None of these read the frontmatter at runtime to resolve the name — every reference is a literal string that must be updated by hand.

### Recipe D — Add a new skill (slash command)

A skill under `skills/<name>/SKILL.md` is what becomes a slash command (`/interview-me`, `/team-manager`, `/code-audit` are the three precedents) — there is no separate "command" artifact to create.

1. Create `skills/<name>/SKILL.md` with `name` and `description` frontmatter (`description` is what Claude Code uses to decide when to trigger the skill unprompted — be specific about the trigger phrase and the task shape).
2. Write the body as direct instructions to the invoking agent, the same way `skills/interview-me/SKILL.md` and `skills/team-manager/SKILL.md` do — no separate framework or boilerplate needed.
3. If the skill should appear in the local marketplace listing's description, update `.claude-plugin/marketplace.json`.

---

## 7 — High-Signal Files by Question Type

| Question type | Where to start |
|---|---|
| "How does the whole pipeline run end to end?" | `skills/team-manager/SKILL.md` |
| "Where does the spec come from, and what must it contain?" | `skills/interview-me/SKILL.md` |
| "What is `reviewer` allowed to do?" | `agents/reviewer.md` — note its `tools:` list has no `Edit`/`Write` |
| "Which agent owns which layer?" | each agent's frontmatter `description:` line |
| "What does the plugin declare itself as, and how is it installed locally?" | `plugins/team-build-pipeline/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| "What does a spec actually look like before I run `/team-manager`?" | `examples/todo-reminders-spec.md` |

---

## 8 — Known Gotchas

---

**Never skip the reviewer**

**Rule:** every implementation task goes through `reviewer`, with no exceptions — regardless of diff size or whether the engineer already ran tests.
**Why:** `skills/team-manager/SKILL.md`'s own "Never skip the reviewer" table states self-reports are not review, and small diffs still break contracts between layers.
**What breaks:** a contract break between `backend-engineer` and `frontend-engineer` output ships undetected; fixing it later costs more than the review round would have.

---

**No engineer starts on a BUG/TICKET spec until `ticket-reviewer` says `REPRODUCED`**

**Rule:** step "1a. Verify reproduction" in `skills/team-manager/SKILL.md` runs `ticket-reviewer` alone, before `designer` or either engineer, whenever the spec's `Type:` is `BUG` or `TICKET`. `NOT REPRODUCED` or `BLOCKED` stops the pipeline and reports back to the user instead of proceeding.
**Why:** building or designing against an unconfirmed bug risks implementing a fix for something that doesn't actually happen, or that happens for a different reason than the ticket describes.
**What breaks:** skipping this lets an engineer "fix" a symptom that was never reproduced, wasting the round and likely missing the real defect.

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

This list reflects the gotchas made explicit in `skills/team-manager/SKILL.md` itself; it has not had a dedicated senior-engineer pass for gotchas beyond that (e.g. how `handoff.md` should be amended mid-task, or what happens if an engineer disagrees with a finding). Add entries here as they're found.

---

**External skill dependencies are not plugin-enforced** — see [Section 2, Setup & Prerequisites](#2--setup--prerequisites) for the full list and how to verify them.
