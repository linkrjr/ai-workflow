# AI Workflow

---

## Document Owner

**Owner:** Ronaldo Gomes
**Review cadence:** after every agent or skill change
**Last reviewed:** 2026-11

---

## Codebase Purpose

This repo is a Claude Code marketplace (`.claude-plugin/marketplace.json`) hosting two plugins. This README covers `ai-workflow`, in `plugins/ai-workflow/`. Paths below such as `agents/`, `skills/`, `hooks/` and `.claude-plugin/plugin.json` are relative to that folder, except `docs/` and `.claude-plugin/marketplace.json`, which are at the repo root. It's meant to be published: installed by adding this GitHub repository as a marketplace (`plugin.json`'s `homepage`/`repository` fields point at it), not just run locally out of a clone. It exposes two slash commands that together turn a feature idea into shipped, reviewed, documented code: `/workshop` interviews the user into an approved spec, and `/orchestrator` runs that spec through a lead-and-subagents pipeline (design, implementation, mandatory review, documentation). The same marketplace also hosts a separate `pomodoro` plugin (`plugins/pomodoro/`), a timer unrelated to the pipeline. It produces no runtime service — its "output" is code changes made elsewhere in whatever repo it's invoked in, plus the spec and coordination files it writes under `docs/specs/` and `tmp/team/`.

---

## Setup & Prerequisites

**Upgrading from 1.4:** `/pomodoro` moved to its own plugin. Run `/plugin install pomodoro@ai-workflow` to keep it, and set its options again in `/config`. Run state is now kept per spec in `tmp/team/<spec slug>/`, so a run started on 1.4 can't be resumed.

**Install:**

```
/plugin marketplace add linkrjr/ai-workflow
/plugin install ai-workflow@ai-workflow
/ai-workflow:setup
```

`/ai-workflow:setup` checks this machine (`skills/setup/scripts/check.sh`), lists what's missing and what each item costs, and offers to install what you tick. The same check runs as `/orchestrator`'s preflight. The plugin's startup hook also runs it and shows a one-time notice when something required is missing.

| Needed | Why | How setup gets it |
|---|---|---|
| `git`, `gh` (signed in), `jq`, `curl` | PRs, Linear, Jev, the status script | `brew install`, or tells you the command; `gh auth login` you run yourself |
| `pinchtab` CLI and skill, plus Chrome or Chromium | QA drives the UI in a real browser; without them every UI check comes back `BLOCKED` | `brew install pinchtab/tap/pinchtab` (or `bun add -g` / `npm install -g`), then `bunx skills add pinchtab/pinchtab` (`npx` without Bun) |
| Agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), optional | Agents run as teammates instead of plain subagents | Writes it to this project's or your user settings, if you agree |
| `graphify`, optional | The codebase graph | `uv tool install graphifyy`, then `graphify install` |
| `LINEAR_API_KEY` / `TYPESAFE_API_KEY`, optional | Linear tracking / Jev signals (Jev also needs a `.jev-enabled` file) | You export it; setup never asks for a key |

The skills the agents follow ship inside the plugin, as `ai-workflow:tdd`, `ai-workflow:surgical-patch`, `ai-workflow:safe-refactor`, `ai-workflow:writing-for-agents` and `ai-workflow:handoff`. They're unmodified copies from mattpocock/skills (MIT) and JuliusBrussee/caveman (Apache-2.0); `third-party/README.md` lists versions and how to update them. The engineers, `qa-tester` and `ticket-reviewer` name theirs in `skills:`, which preloads them as subagents. As agent-team teammates `skills:` isn't applied, so they also carry the `Skill` tool and load them themselves. That tool puts your whole skill listing into every spawn, so keep your personal skills few (181 skills cost about 9k tokens per agent on Nov 9).

---

## Running the Tests

There is no `package.json`, so `bun test` can't find the engine's test kit. Run these instead; CI (`.github/workflows/ci.yml`) runs all but the type check:

```sh
claude plugin validate .                     # the marketplace, from the repo root
cd plugins/ai-workflow                       # the rest from the plugin folder
claude plugin validate .                     # manifests
claude plugin test .                         # tests/*.test.tsx, needs the engine's test kit
claude plugin test ../pomodoro               # the separate pomodoro plugin
bash skills/jev/scripts/test_jev.sh          # stubbed curl, no network
bash skills/linear/scripts/test_linear.sh    # stubbed curl, no network
bash skills/orchestrator/scripts/test_cleanup.sh  # local git remote, stubbed gh
bash skills/orchestrator/scripts/test_status.sh   # stubbed cmux and Linear
bash skills/setup/scripts/test_check.sh           # bare and stubbed machines
bunx tsc --noEmit -p .                       # local only: the engine's types in the repo root's .claude-plugin/types/ are gitignored
```

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
| `qa-tester` agent | Mandatory, read-only functional gate — runs the project locally and exercises every API/UI/CLI surface, runs alongside `code-reviewer`; one agent per PR, at most 3 at a time | `agents/qa-tester.md` |
| Jev signals (optional) | Advisory 0–1 signals from TypeSafe's Jev model: spec check during `/workshop`, stall check on repeating review rounds. Never a gate | `skills/jev/scripts/jev.sh` |
| `writer` agent | Final documentation pass, after both review and QA are clean | `agents/writer.md` |
| `openapi` skill | Writes `<backend project>/openapi.yaml` for public endpoints (all but internal/admin): exports the framework's own spec when it has one, otherwise writes it from the route handlers found through the graph. Reads only the backend project. Invoked by `writer` when public endpoints changed, or on its own as `/openapi` | `skills/openapi/SKILL.md` |
| Agent teams pane | Opens a right pane on session start: the leader's model, and one box per subagent the leader starts (status, simulated progress, tokens, estimated cost, effort). Costs use a hard-coded price table. Permission asks that need the person (none in auto mode, where the classifier decides) show in it with Proceed / Cancel (click, or type 1 / 2 in an empty prompt), which answer the ask. The pane shows the whole request (an edit's change included), and a press within a second of an ask coming up, or of the last answer, is ignored. Above the prompt, Proceed / Cancel only show when the whole request fits on the row. Unanswered for 10 minutes, with the pane off screen, or too long to read whole (over 20 lines or 1,500 characters), the normal permission prompt asks instead. Three settings in `/config` (the plugin's `userConfig`): **Always On** (default on; off, the pane opens only from a `▸ agent teams` button above the prompt), **Icons On** (default on; off hides the agent icons) and **Session Log On** (default on; off hides the session log box) | `hooks/register.tsx` |

---

## Running a long `/orchestrator`

**Start clean.** Run `/clear` after `/workshop`. The spec is on disk, and the lead re-reads its whole context on every turn.

**Pick the lead's model when you start the session.** The skill's `model` and `effort` last only for the turn it runs in, [per the docs](https://code.claude.com/docs/en/skills.md). The lead wakes for a new turn on every agent report, so it may fall back to the session's model partway through a run. The docs don't cover those wakes, and the one measured run stayed on Opus, so this is unconfirmed. To be safe, start with `claude --model opus --effort medium`. Subagents keep the model in their own definitions.

**Auto mode.** [Auto mode](https://code.claude.com/docs/en/permission-modes.md) blocks force pushes by default, so the workflow never force-pushes: a conflict is fixed by merging the base in. The forced branch and worktree deletes all sit in `skills/orchestrator/scripts/cleanup.sh`, so one narrow rule can allow them, shown here for a local checkout (replace the path with yours):

```json
{ "permissions": { "allow": ["Bash(/path/to/ai-workflow/skills/orchestrator/scripts/cleanup.sh *)"] } }
```

Allow rules match the command text, so a compound command needs each part allowed. The measured run's other denials weren't extracted, so the first real run should show whether more rules are needed.

**Plain `git`.** The prompts use raw `git` and worktrees so the plugin works in any repo. On a machine whose global rules require GitButler, this workflow is the exception: the prompts tell each agent to use `git` as written.

---

## Execution Lifecycle

**Representative execution:** a full `/workshop` → `/orchestrator` run.

1. **Entry (spec):** the user runs `/workshop`; `skills/workshop/SKILL.md` asks one multiple-choice question per turn, tracks open decisions, and writes `docs/specs/<slug>.md` once the ledger is empty.
2. **Prepare:** the user runs `/orchestrator docs/specs/<slug>.md`; step "1. Prepare" in `skills/orchestrator/SKILL.md` reads the spec, splits it into tasks of one behavior each that can be worked, reviewed and merged in isolation (with their dependencies, and with no two parallel tasks sharing a file), creates and pushes a `feature/<spec slug>` branch when started on the default branch, or asks first when started on another spec's feature branch (task PRs target it; nothing in the run touches the default branch), commits `tmp/team/` to `.gitignore` if needed, sets up a graphify codebase graph (reuses and refreshes `graphify-out/graph.json` if it exists, otherwise asks the user whether to build one, explaining why; every agent's brief then points at it; the lead commits `graphify-out/` to the base branch when it is built and once more at the end of the run), and writes the run state under `tmp/team/<spec slug>/`: `context.md` (acceptance criteria, scope, API contract), the single source of truth every subagent reads, and `state.md` (task list, queues), which only the lead reads. Early in this step the lead asks all its questions in one call (tracker, graph, design and Figma), saving the repo-wide answers in `tmp/team/defaults.md`. It files the tasks in Linear or as intent files (`intent/YYYY-MM-DD-task-name.md` at the repo root); each agent reads only the task doc for the task it is working on.
3. **Verify reproduction (conditional):** if the spec's `Type:` is `BUG` or `TICKET`, step "1a. Verify reproduction" spawns `ticket-reviewer` alone, before any other agent, and saves its report to `tmp/team/<spec slug>/ticket-review.md`. A `REPRODUCED` status continues the pipeline; `NOT REPRODUCED` or `BLOCKED` stops here and reports straight to the user — no designer, no engineer. `FEATURE` and `TECH_DEBT` specs skip this step entirely.
4. **Design (conditional):** when the spec has a user-facing surface, the lead asks the user whether to run `designer` (never assuming a design is needed); on yes it spawns `designer` alone, before any engineer starts. Its output is saved to `design.md` in the run state and linked from `context.md`, along with a rendered storyboard (`design/storyboard.png`, every screen, state and error case, with interaction arrows). The lead then asks whether to upload it to Figma via the Figma MCP — checking the user is logged in and waiting for them if not — and opens the new file in the browser.
5. **Implement:** the lead starts one `backend-engineer` or `frontend-engineer` per unblocked task, in parallel. Each engineer does one task in its own `git worktree`, made from the fetched base branch and set up with the install and env steps in `context.md`, opens one PR and reports its number to the lead. It comes back only to fix that PR. A frontend task builds against the API contract, without waiting for the backend to merge.
6. **Review and QA:** each PR gets its own `code-reviewer` and `qa-tester`, at most 3 of each at a time, and PRs wait in a queue past that, oldest first. Later rounds go back to the same agents and check only what the fix touched. `code-reviewer` reviews the PR diff and writes `review-pr-<n>-round-<N>.md` in the run state; `qa-tester` checks the PR out in its own worktree, runs the project, exercises every API/UI/CLI surface, and writes `qa-pr-<n>-round-<N>.md`. Each returns one line with its verdict and the file's path. `VERDICT: FINDINGS` means at least one blocker; notes never cause another round and go in the feature PR. QA can also end in `VERDICT: BLOCKED` when an AC went untested, which the lead takes to the user. Findings go back to the PR's engineer, and the loop repeats — no round limit — until the same round is `CLEAN` for both; the lead then waits for the PR's CI, merges it into the feature branch and deletes its branch, local and remote. Throughout the run the lead checks the plan's usage (the mod's `usage` tool): at 90% it starts nothing new, and at 95% it stops every agent. When the window resets within 3 hours it schedules a one-shot `CronCreate` restart and compacts the conversation (the mod's `compact` tool) so the restart re-caches a summary, not the whole run; further out it gives the user the command to resume.
7. **Final gate:** once every task is merged, a fresh `code-reviewer` and `qa-tester` check the merged feature branch against every AC, writing `final-review-round-<R>.md` and `final-qa-round-<R>.md`. Findings become fix tasks that go through steps 5-6, then the gate runs again.
8. **Document:** once the final gate is clean, the lead spawns `writer` alone — never in parallel with another agent, never before both gates are clean — to update README/API docs/comments for the files that changed, and, when public endpoints changed, `openapi.yaml` through the `openapi` skill.
9. **Report:** the lead confirms every PR's latest review and QA files and the final gate's say `CLEAN` from the same round, closes the Linear tickets or intent files, removes the worktrees, and reports what changed, AC-to-test coverage, every QA test and its outcome, and try-it-yourself steps to the user. Engineers commit their own PRs and the lead merges them into the feature branch; the lead commits the writer's doc changes there too, then opens one feature PR against the default branch and waits for its CI. The user reviews and merges it. Linear tickets stay in review until then, and re-running `/orchestrator <spec>` after the merge closes them. Re-running it after a review turns the PR's unresolved comments into fix tasks that go through the same gates, and offers to reply on and resolve the threads.

---

## Domain Vocabulary

| Term | Definition |
|---|---|
| **Run state** (`tmp/team/<spec slug>/`) | One folder per spec, so specs never read each other's state. Only the lead writes its two main files. |
| **Run context** (`context.md`) | The scope/contract document every subagent reads before starting. Written once by the lead. |
| **Live state** (`state.md`) | The task list, queues, `Feature PR:` and `Paused until:`. Only the lead reads it; agents get what they need in their brief. |
| **AC** | Acceptance criteria — numbered (AC1, AC2, …), copied verbatim from the spec into the run context; each must trace to a test. |
| **Round** | One paired `code-reviewer` + `qa-tester` pass on one PR, recorded as `review-pr-<n>-round-<N>.md` and `qa-pr-<n>-round-<N>.md` in the run state. The fix→review/QA loop repeats with no round limit until the same round is `CLEAN` for both. |
| **Task doc** | The one document describing a task: its intent file (`intent/YYYY-MM-DD-task-name.md`) or its Linear issue, depending on the tracker the user chose. Agents read only the task doc of the task they are working on. |
| **Verdict** | `code-reviewer`'s and `qa-tester`'s shared pass/fail line (`VERDICT: CLEAN` or `VERDICT: FINDINGS`) — either one coming back `FINDINGS` routes back to the owning engineer. Only blockers count; notes go in the feature PR. `qa-tester` can also say `VERDICT: BLOCKED`: an AC went untested, and the user decides whether to clear the blocker or accept it untested. |
| **Final gate** | One more `code-reviewer` + `qa-tester` pass, on the merged feature branch against every AC, before the writer and the feature PR. |
| **Accepted untested** | A line in `state.md` listing the ACs the user agreed to ship with no QA test. They are named in the feature PR. |
| **subagent_type** | The Agent-tool parameter the lead passes to spawn a specific agent file by name (e.g. `"backend-engineer"`, `"designer"`). |
| **Design doc** (`design.md` in the run state) | `designer`'s saved output (aesthetic direction, components, design choices) — linked from the run context so both engineers can read it. |
| **Type** | The spec's `FEATURE \| BUG \| TICKET \| TECH_DEBT` field, written by `workshop`. `BUG`/`TICKET` gate the pipeline on `ticket-reviewer`; `FEATURE` and `TECH_DEBT` skip that gate. `/audit` tags each finding `BUG` or `TECH_DEBT`, and `/workshop TECH_DEBT_AUDIT.md` scopes a spec of one of those types from the chosen findings. |
| **Jev signal** | One line of `jev.sh` output, `<signal>: <0-1 value> FLAG\|ok`. Advisory only: a `FLAG` (value ≥ `JEV_FLAG_AT`, default 0.6) points attention at something, it never approves or blocks a PR. |
| **Ticket review** (`ticket-review.md` in the run state) | `ticket-reviewer`'s saved report for a BUG/TICKET spec, ending in `STATUS: REPRODUCED \| NOT REPRODUCED \| BLOCKED`. Only `REPRODUCED` lets the pipeline continue. |

---

## Common Change Recipes

### Recipe A — Add a new agent role

Agents are workers spawned by `orchestrator`; they have no slash command of their own.

1. Create `agents/<name>.md` with the same frontmatter shape as the existing agents (`name`, `description`, `tools`, `model`, `effort`) — model on `agents/writer.md` for a narrow-scope worker, or `agents/backend-engineer.md`/`agents/frontend-engineer.md` for an implementation-scoped one.
2. Add a numbered step to `skills/orchestrator/SKILL.md` stating exactly when the lead spawns it (before/after which existing step) and whether it may run in parallel with another agent — mirror step 2 (Design)'s explicit trigger condition or step 5 (Document)'s explicit exclusivity rule.
3. If other agents need its output, have it write a file in the run state and have the lead add one line to `context.md` pointing at that file (the pattern `designer` → `design.md` already establishes), rather than editing the consumer agents' own files.
4. Renumber every subsequent step and fix every `go back to section N` cross-reference in the file.

### Recipe B — Change the spec template

1. Edit the fenced `markdown` template block in `skills/workshop/SKILL.md`.
2. `skills/orchestrator/SKILL.md` step "1. Prepare" hard-depends on an `## Acceptance criteria` heading existing in the spec (it stops and tells the user to run `/workshop` first if that heading is missing) — preserve that heading name if you rename or restructure template sections.
3. Step "1. Prepare" also reads the `Type: FEATURE | BUG | TICKET | TECH_DEBT` line to decide whether to gate on `ticket-reviewer` (step "1a. Verify reproduction") — preserve that literal field name and its four values if you touch the template header.

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
| "How does `/pomodoro` work, and where is its state?" | It's the separate `pomodoro` plugin: `plugins/pomodoro/hooks/pomodoro.tsx` and `plugins/pomodoro/README.md` |

---

## Known Gotchas

---

**Never skip code-reviewer or qa-tester**

**Rule:** every implementation task goes through both `code-reviewer` and `qa-tester`, with no exceptions — regardless of diff size or whether the engineer already ran tests. A clean code review does not excuse a QA round with findings (or an un-run one), and vice versa; both must be `VERDICT: CLEAN` on the same round. A PR's failing CI blocks its merge, an untested AC goes to the user, and the merged feature branch gets a final gate of both agents before the feature PR opens.
**Why:** `skills/orchestrator/SKILL.md`'s own "Never skip code-reviewer or qa-tester" table states self-reports are not review, unit tests are not QA, and small diffs still break contracts between layers or at runtime.
**What breaks:** a contract break between `backend-engineer` and `frontend-engineer` output ships undetected, or code that passes review still fails when actually run (bad API response, broken UI workflow, crashing CLI flag); fixing it later costs more than the review/QA round would have.

---

**No engineer starts on a BUG/TICKET spec until `ticket-reviewer` says `REPRODUCED`**

**Rule:** step "1a. Verify reproduction" in `skills/orchestrator/SKILL.md` runs `ticket-reviewer` alone, before `designer` or either engineer, whenever the spec's `Type:` is `BUG` or `TICKET`. `NOT REPRODUCED` or `BLOCKED` stops the pipeline and reports back to the user instead of proceeding.
**Why:** building or designing against an unconfirmed bug risks implementing a fix for something that doesn't actually happen, or that happens for a different reason than the ticket describes.
**What breaks:** skipping this lets an engineer "fix" a symptom that was never reproduced, wasting the round and likely missing the real defect.

---

**`frontend-engineer` must not start before Design finishes, when Design applies**

**Rule:** step "2. Design" in `skills/orchestrator/SKILL.md` explicitly says never start `frontend-engineer` before that section is done whenever the user chose "Run designer".
**Why:** `frontend-engineer` is meant to build against the aesthetic direction in `design.md`, which doesn't exist yet until `designer` reports.
**What breaks:** frontend work built without the design doc has to be reworked once the design lands, duplicating the implementation.

---

**`writer` runs alone, and only after both the review and QA verdicts are clean**

**Rule:** step "5. Document" forbids running `writer` in parallel with any other agent, and forbids running it before the latest round says `VERDICT: CLEAN` for both review and QA.
**Why:** `writer` documents the shipped, reviewed, tested code — not a work-in-progress diff that might still change in the next review/QA round.
**What breaks:** documentation describes behavior that changes again before the task is actually done, going stale immediately.

---

**The lead gitignores `tmp/team/` before any task starts**

**Rule:** step "1d. Feature branch" has the lead add `tmp/team/` to `.gitignore` and commit it to the feature branch if it isn't already there.
**Why:** the run context, live state, design doc, and review/QA-round files are per-run scratch/coordination state, not product source.
**What breaks:** skipping this lets scratch coordination files get committed into whatever repo the pipeline is running against.

---

**The hooks module is `hooks/register.tsx` only, and its hooks pass `$` to module-level functions**

**Rule:** `.claude-plugin/plugin.json` and `hooks/hooks.json` declare one hooks module. Its hooks pass `$` (and `on`) only to module-level functions, never to anything else, such as `bandRow`. The `pomodoro` plugin follows the same rule with its own `register.tsx`.
**Why:** `claude plugin validate` refuses a second `modules` entry, and the engine reads a hooks module's source and refuses `$` or `on` handed to anything else.
**What breaks:** `claude plugin validate` fails, or the engine refuses the module, and the plugin's hooks are not loaded.

This list reflects the gotchas made explicit in `skills/orchestrator/SKILL.md` itself; crashed agents, contract changes, disputed findings and late reports are under its "When things go wrong". Add entries here as they're found.

---

**Jev is advisory, never a gate**

**Rule:** `jev.sh` output (spec check, loop-guard) may flag a spec to the user and make the lead ask whether a stalled loop should continue. It must never skip, shorten or satisfy `code-reviewer`, `qa-tester` or the `VERDICT: CLEAN` rule, and a missing `TYPESAFE_API_KEY`, a repo without `.jev-enabled`, or a failed call (`UNAVAILABLE`) must change nothing.
**Why:** Jev only sees the text it is sent (a diff, a spec, two findings files). It cannot run the app or read the rest of the repo, and its scores are not calibrated against this repo's code.
**What breaks:** treating a clean signal as a review lets a contract break or runtime failure ship; treating `UNAVAILABLE` as a failure would stop the pipeline for people without a key.

---

**External skill dependencies are not plugin-enforced** — see [Setup & Prerequisites](#setup--prerequisites) for the full list and how to verify them.
