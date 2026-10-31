# AI Workflow

---

## Document Owner

**Owner:** Ronaldo Gomes
**Review cadence:** after every agent or skill change
**Last reviewed:** 2026-10

---

## Codebase Purpose

This repo is a Claude Code plugin, `ai-workflow` (`.claude-plugin/plugin.json`), and the marketplace that hosts it (`.claude-plugin/marketplace.json`) — the repo root is the plugin root, same layout as `mattpocock/skills`. It's meant to be published: installed by adding this GitHub repository as a marketplace (`plugin.json`'s `homepage`/`repository` fields point at it), not just run locally out of a clone. It exposes two slash commands that together turn a feature idea into shipped, reviewed, documented code: `/workshop` interviews the user into an approved spec, and `/orchestrator` runs that spec through a lead-and-subagents pipeline (design, implementation, mandatory review, documentation). It produces no runtime service — its "output" is code changes made elsewhere in whatever repo it's invoked in, plus the spec and coordination files it writes under `docs/specs/` and `tmp/team/`.

---

## Setup & Prerequisites

This plugin does not declare its external skill dependencies in `plugin.json` — Claude Code's plugin manifest schema has no `dependencies` field to put them in, so this is enforced by convention, not tooling. Before running `/orchestrator`, install these or the steps that invoke them silently degrade (the `Skill(...)` call just doesn't resolve — no error, the agent skips the discipline and moves on):

| Skill invoked | Called from | Where it actually comes from |
|---|---|---|
| `tdd`, `surgical-patch`, `safe-refactor` | `agents/backend-engineer.md`, `agents/frontend-engineer.md` | Personal skills-dir symlinks under `~/.claude/skills/` → `~/.agents/skills/` on this machine — not a marketplace plugin. `mattpocock-skills@claude-plugins-official` bundles equivalents for `tdd`, but only under a scoped name (`mattpocock-skills:tdd`) these files do not reference. |
| `writing-for-agents` | `agents/writer.md` | Same personal skills-dir symlink as above. `mattpocock-skills@claude-plugins-official` bundles an equivalent under `mattpocock-skills:writing-for-agents`, not referenced here. |
| `handoff`, `pr` | `skills/orchestrator/SKILL.md` (the lead only — no worker agent invokes either) | Same personal skills-dir symlink as above. `mattpocock-skills@claude-plugins-official` bundles an equivalent `pr` under `mattpocock-skills:pr`, not referenced here. |
| `code-review`, `security-review` | `agents/code-reviewer.md` | `code-review`: real, installable plugin, `code-review@claude-plugins-official`. `security-review`: no file footprint under `~/.claude/` — almost certainly a Claude Code built-in, not something to install. |
| `jev` (this plugin's own skill, `skills/jev/`) | `skills/workshop/SKILL.md`, `skills/orchestrator/SKILL.md`, `agents/code-reviewer.md` | Optional. Needs `TYPESAFE_API_KEY` (early access, console.typesafe.ai/keys) plus `curl` and `jq`. Without the key every Jev step prints `UNAVAILABLE` and the pipeline runs exactly as before. |
| `run`, `pinchtab` | `agents/qa-tester.md` | `run` and `pinchtab` are personal skills-dir symlinks, same as the row above. `pinchtab` drives UI workflows end to end; without it, UI surfaces are reported `BLOCKED` instead of tested. |

**Verify before running a task:** confirm each bare skill name above resolves on your machine (e.g. it's listed when Claude Code loads skills, or symlinked under your skills directory). If `tdd`, `surgical-patch`, `safe-refactor`, `writing-for-agents`, `handoff`, or `pr` aren't available, either install an equivalent under that exact bare name, or accept that the corresponding engineering discipline (TDD, surgical patching, doc cleanup) will be silently skipped for this run.

---

## Execution Stack

The codebase has no application layers in the traditional sense — it is a set of orchestration prompts (skills, user-invoked) and worker prompts (agents, spawned by `orchestrator`), listed in the order a run touches them:

| Stage | Responsibility | Key symbol |
|---|---|---|
| Plugin manifest | Declares the plugin and its marketplace listing | `plugin.json`, `marketplace.json` |
| `workshop` skill | Interviews the user, writes the approved spec | `skills/workshop/SKILL.md` |
| `orchestrator` skill (lead) | Orchestrates Prepare → Design → Implement → Review/QA → Document → Report | `skills/orchestrator/SKILL.md` |
| `ticket-reviewer` agent | Conditional reproduction gate for BUG/TICKET specs, before any other agent starts | `agents/ticket-reviewer.md` |
| `designer` agent | Conditional UI/UX pass, before any frontend work starts | `agents/designer.md` |
| `backend-engineer` / `frontend-engineer` agents | Implementation workers, scoped to one layer each | `agents/backend-engineer.md`, `agents/frontend-engineer.md` |
| `code-reviewer` agent | Mandatory, read-only review gate (no Edit/Write tools) | `agents/code-reviewer.md` |
| `qa-tester` agent | Mandatory, read-only functional gate — runs the project locally and exercises every API/UI/CLI surface, runs alongside `code-reviewer`; one instance at a time, working through a queue of PRs | `agents/qa-tester.md` |
| Jev signals (optional) | Advisory 0–1 signals from TypeSafe's Jev model: spec check after `/workshop`, PR triage before review, stall check on repeating review rounds. Never a gate | `skills/jev/scripts/jev.sh` |
| `writer` agent | Final documentation pass, after both review and QA are clean | `agents/writer.md` |
| Agent teams pane | Opens a right pane on session start: the leader's model, and one box per subagent the leader starts (status, simulated progress, tokens, estimated cost, effort). Costs use a hard-coded price table. Permission asks that need the person (none in auto mode, where the classifier decides) show in it with Proceed / Cancel (click, or type 1 / 2 in an empty prompt), which answer the ask; unanswered for 10 minutes, or with the pane off screen, the normal permission prompt asks instead. Two settings in `/config` (the plugin's `userConfig`): **Always On** (default on; off, the pane opens only from a `▸ agent teams` button above the prompt) and **Icons On** (default on; off hides the agent icons) | `hooks/register.tsx` |

---

## Execution Lifecycle

**Representative execution:** a full `/workshop` → `/orchestrator` run.

1. **Entry (spec):** the user runs `/workshop`; `skills/workshop/SKILL.md` asks one multiple-choice question per turn, tracks open decisions, and writes `docs/specs/<slug>.md` once the ledger is empty.
2. **Prepare:** the user runs `/orchestrator docs/specs/<slug>.md`; step "1. Prepare" in `skills/orchestrator/SKILL.md` reads the spec, splits it into the smallest tasks that can be worked, reviewed and merged in isolation (with their dependencies), and writes `tmp/team/handoff.md` (acceptance criteria, scope, API contract, task list) — the single shared source of truth every subagent reads. The lead then asks whether to file the tasks in Linear or as intent files (`intent/YYYY-MM-DD-task-name.md` at the repo root); each agent reads only the task doc for the task it is working on.
3. **Verify reproduction (conditional):** if the spec's `Type:` is `BUG` or `TICKET`, step "1a. Verify reproduction" spawns `ticket-reviewer` alone, before any other agent, and saves its report to `tmp/team/ticket-review.md`. A `REPRODUCED` status continues the pipeline; `NOT REPRODUCED` or `BLOCKED` stops here and reports straight to the user — no designer, no engineer. `FEATURE` specs skip this step entirely.
4. **Design (conditional):** step "2. Design" spawns `designer` alone, only if the spec has a UI/UX or frontend surface and the client isn't a CLI, and only before any engineer starts. Its output is saved to `tmp/team/design.md` and linked from the handoff, along with a rendered storyboard (`tmp/team/design/storyboard.png`, every screen, state and error case, with interaction arrows). The lead then asks whether to upload it to Figma via the Figma MCP — checking the user is logged in and waiting for them if not — and opens the new file in the browser.
5. **Implement:** the lead starts one `backend-engineer` or `frontend-engineer` per unblocked task, in parallel. Each engineer works in its own `git worktree`, opens one PR per task and writes the PR number into the handoff. When it submits, the lead hands it a fix for its own rejected PR first, then the next unblocked task, or stops it when there is none. Before each new task an engineer merges its approved PRs and updates its worktree from the base branch.
6. **Review and QA:** there is one `code-reviewer` and one `qa-tester` at a time, each working through its own queue of submitted PRs, oldest first, alongside each other. Each finished PR goes straight back to the lead, and the agent starts the next one; it is stopped when its queue is empty. `code-reviewer` reviews the PR diff and writes `tmp/team/review-pr-<n>-round-<N>.md`; `qa-tester` checks the PR out in its own worktree, runs the project, exercises every API/UI/CLI surface, and writes `tmp/team/qa-pr-<n>-round-<N>.md`. Each ends in `VERDICT: CLEAN` or `VERDICT: FINDINGS`. Findings go back to the PR's engineer, and the loop repeats — no round limit — until the same round is `CLEAN` for both; the PR is then approved and merged.
7. **Document:** once every task is merged, the lead spawns `writer` alone — never in parallel with another agent, never before both gates are clean — to update README/API docs/comments for the files that changed.
8. **Report:** the lead confirms every PR's latest review and QA files say `CLEAN` from the same round, closes the Linear tickets or intent files, removes the worktrees, and reports what changed, AC-to-test coverage, every QA test and its outcome, and try-it-yourself steps to the user. Engineers commit and merge their own PRs; the writer's doc changes are left uncommitted.

---

## Domain Vocabulary

| Term | Definition |
|---|---|
| **Handoff** (`tmp/team/handoff.md`) | The shared scope/contract document every subagent reads before starting. Written and updated by the lead (`orchestrator`). |
| **AC** | Acceptance criteria — numbered (AC1, AC2, …), copied verbatim from the spec into the handoff; each must trace to a test. |
| **Round** | One paired `code-reviewer` + `qa-tester` pass on one PR, recorded as `tmp/team/review-pr-<n>-round-<N>.md` and `tmp/team/qa-pr-<n>-round-<N>.md`. The fix→review/QA loop repeats with no round limit until the same round is `CLEAN` for both. |
| **Task doc** | The one document describing a task: its intent file (`intent/YYYY-MM-DD-task-name.md`) or its Linear issue, depending on the tracker the user chose. Agents read only the task doc of the task they are working on. |
| **Verdict** | `code-reviewer`'s and `qa-tester`'s shared pass/fail line (`VERDICT: CLEAN` or `VERDICT: FINDINGS`) — either one coming back `FINDINGS` routes back to the owning engineer. |
| **subagent_type** | The Agent-tool parameter the lead passes to spawn a specific agent file by name (e.g. `"backend-engineer"`, `"designer"`). |
| **Design doc** (`tmp/team/design.md`) | `designer`'s saved output (aesthetic direction, components, design choices) — linked from the handoff so both engineers can read it. |
| **Type** | The spec's `FEATURE \| BUG \| TICKET` field, written by `workshop`. `BUG`/`TICKET` gate the pipeline on `ticket-reviewer`; `FEATURE` skips that gate. |
| **Jev signal** | One line of `jev.sh` output, `<signal>: <0-1 value> FLAG\|ok`. Advisory only: a `FLAG` (value ≥ `JEV_FLAG_AT`, default 0.6) points attention at something, it never approves or blocks a PR. |
| **Ticket review** (`tmp/team/ticket-review.md`) | `ticket-reviewer`'s saved report for a BUG/TICKET spec, ending in `STATUS: REPRODUCED \| NOT REPRODUCED \| BLOCKED`. Only `REPRODUCED` lets the pipeline continue. |

---

## Common Change Recipes

### Recipe A — Add a new agent role

Agents are workers spawned by `orchestrator`; they have no slash command of their own.

1. Create `agents/<name>.md` with the same frontmatter shape as the existing agents (`name`, `description`, `tools`, `model`, `effort`) — model on `agents/writer.md` for a narrow-scope worker, or `agents/backend-engineer.md`/`agents/frontend-engineer.md` for an implementation-scoped one.
2. Add a numbered step to `skills/orchestrator/SKILL.md` stating exactly when the lead spawns it (before/after which existing step) and whether it may run in parallel with another agent — mirror step 2 (Design)'s explicit trigger condition or step 5 (Document)'s explicit exclusivity rule.
3. If other agents need its output, have it write a file under `tmp/team/` and add one line to the handoff pointing at that file (the pattern `designer` → `tmp/team/design.md` already establishes), rather than editing the consumer agents' own files.
4. Renumber every subsequent step and fix every `go back to section N` cross-reference in the file.

### Recipe B — Change the spec template

1. Edit the fenced `markdown` template block in `skills/workshop/SKILL.md`.
2. `skills/orchestrator/SKILL.md` step "1. Prepare" hard-depends on an `## Acceptance criteria` heading existing in the spec (it stops and tells the user to run `/workshop` first if that heading is missing) — preserve that heading name if you rename or restructure template sections.
3. Step "1. Prepare" also reads the `Type: FEATURE | BUG | TICKET` line to decide whether to gate on `ticket-reviewer` (step "1a. Verify reproduction") — preserve that literal field name and its three values if you touch the template header.

### Recipe C — Rename a skill or agent

1. `git mv` the skill/agent file or directory to the new name (skills live at `skills/<name>/SKILL.md`; agents live at `agents/<name>.md`).
2. Update the `name:` frontmatter field inside the moved file.
3. Grep for the old name in: every `SKILL.md` and `agents/*.md` file (prose cross-references, e.g. `orchestrator` naming `designer`), `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json`. None of these read the frontmatter at runtime to resolve the name — every reference is a literal string that must be updated by hand.

### Recipe D — Add a new skill (slash command)

A skill under `skills/<name>/SKILL.md` is what becomes a slash command (`/workshop`, `/orchestrator`, `/audit` are the three precedents) — there is no separate "command" artifact to create.

1. Create `skills/<name>/SKILL.md` with `name` and `description` frontmatter (`description` is what Claude Code uses to decide when to trigger the skill unprompted — be specific about the trigger phrase and the task shape). Unlike agents (Recipe A), skills declare no `tools:` field — a skill runs as the invoking session itself, not a spawned subagent, so it inherits the full parent session's tools rather than a scoped allowlist.
2. Write the body as direct instructions to the invoking agent, the same way `skills/workshop/SKILL.md` and `skills/orchestrator/SKILL.md` do — no separate framework or boilerplate needed.
3. If the skill should appear in the local marketplace listing's description, update `.claude-plugin/marketplace.json`.

---

## High-Signal Files by Question Type

| Question type | Where to start |
|---|---|
| "How does the whole pipeline run end to end?" | `skills/orchestrator/SKILL.md` |
| "Where does the spec come from, and what must it contain?" | `skills/workshop/SKILL.md` |
| "What is `code-reviewer` allowed to do?" | `agents/code-reviewer.md` — note its `tools:` list has no `Edit`/`Write` |
| "What is `qa-tester` allowed to do, and how does it test UI?" | `agents/qa-tester.md` — read-only on product code, drives the browser via the `pinchtab` skill |
| "Which agent owns which layer?" | each agent's frontmatter `description:` line |
| "What does the plugin declare itself as, and how is it installed locally?" | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| "What does a spec actually look like before I run `/orchestrator`?" | `examples/todo-reminders-spec.md` |

---

## Known Gotchas

---

**Never skip code-reviewer or qa-tester**

**Rule:** every implementation task goes through both `code-reviewer` and `qa-tester`, with no exceptions — regardless of diff size or whether the engineer already ran tests. A clean code review does not excuse a QA round with findings (or an un-run one), and vice versa; both must be `VERDICT: CLEAN` on the same round.
**Why:** `skills/orchestrator/SKILL.md`'s own "Never skip code-reviewer or qa-tester" table states self-reports are not review, unit tests are not QA, and small diffs still break contracts between layers or at runtime.
**What breaks:** a contract break between `backend-engineer` and `frontend-engineer` output ships undetected, or code that passes review still fails when actually run (bad API response, broken UI workflow, crashing CLI flag); fixing it later costs more than the review/QA round would have.

---

**No engineer starts on a BUG/TICKET spec until `ticket-reviewer` says `REPRODUCED`**

**Rule:** step "1a. Verify reproduction" in `skills/orchestrator/SKILL.md` runs `ticket-reviewer` alone, before `designer` or either engineer, whenever the spec's `Type:` is `BUG` or `TICKET`. `NOT REPRODUCED` or `BLOCKED` stops the pipeline and reports back to the user instead of proceeding.
**Why:** building or designing against an unconfirmed bug risks implementing a fix for something that doesn't actually happen, or that happens for a different reason than the ticket describes.
**What breaks:** skipping this lets an engineer "fix" a symptom that was never reproduced, wasting the round and likely missing the real defect.

---

**`frontend-engineer` must not start before Design finishes, when Design applies**

**Rule:** step "2. Design" in `skills/orchestrator/SKILL.md` explicitly says "never start `frontend-engineer` before this step is done" whenever the spec has a UI/UX or frontend surface.
**Why:** `frontend-engineer` is meant to build against the aesthetic direction in `tmp/team/design.md`, which doesn't exist yet until `designer` reports.
**What breaks:** frontend work built without the design doc has to be reworked once the design lands, duplicating the implementation.

---

**`writer` runs alone, and only after both the review and QA verdicts are clean**

**Rule:** step "5. Document" forbids running `writer` in parallel with any other agent, and forbids running it before the latest round says `VERDICT: CLEAN` for both review and QA.
**Why:** `writer` documents the shipped, reviewed, tested code — not a work-in-progress diff that might still change in the next review/QA round.
**What breaks:** documentation describes behavior that changes again before the task is actually done, going stale immediately.

---

**`tmp/team/` must be gitignored by the first agent that touches it**

**Rule:** step "1. Prepare" instructs whichever engineer touches `tmp/team/` first to add it to `.gitignore` "before doing anything else" if it isn't already there.
**Why:** the handoff, design doc, and review/QA-round files are per-run scratch/coordination state, not product source.
**What breaks:** skipping this lets scratch coordination files get committed into whatever repo the pipeline is running against.

This list reflects the gotchas made explicit in `skills/orchestrator/SKILL.md` itself; it has not had a dedicated senior-engineer pass for gotchas beyond that (e.g. how `handoff.md` should be amended mid-task, or what happens if an engineer disagrees with a finding). Add entries here as they're found.

---

**Jev is advisory, never a gate**

**Rule:** `jev.sh` output (spec check, PR triage, loop-guard) may reorder the review queue, point `code-reviewer` at areas to look at first, and make the lead ask the user whether a stalled loop should continue. It must never skip, shorten or satisfy `code-reviewer`, `qa-tester` or the `VERDICT: CLEAN` rule, and a missing `TYPESAFE_API_KEY` or a failed call (`UNAVAILABLE`) must change nothing.
**Why:** Jev only sees the text it is sent (a diff, a spec, two findings files). It cannot run the app or read the rest of the repo, and its scores are not calibrated against this repo's code.
**What breaks:** treating a low-risk triage as a review lets a contract break or runtime failure ship; treating `UNAVAILABLE` as a failure would stop the pipeline for people without a key.

---

**External skill dependencies are not plugin-enforced** — see [Setup & Prerequisites](#setup--prerequisites) for the full list and how to verify them.
