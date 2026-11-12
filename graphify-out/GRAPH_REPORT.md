# Graph Report - enable-yolo-mode  (2026-11-12)

## Corpus Check
- 113 files · ~202,716 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .mmd 3, .tar 1)

## Summary
- 1060 nodes · 1246 edges · 50 communities (26 shown, 24 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.89)
- Token cost: 191,679 input · 0 output

## Community Hubs (Navigation)
- Engine Plugin API Types
- Agent Teams Pane Hooks
- Pomodoro Timer Mod
- Eval Fixtures Todo App
- Patch And TDD Skills
- Setup And Workshop Skills
- Pane Tests
- CI Workflow
- Engine Types Config
- Linear Script
- Setup Check Script
- Plugin Agents And Docs
- Bypass Mode Spec
- Team Mode Spec
- Engineer Agent Rules
- Plugin Evals
- URLSearchParams Types
- Audit Fix Plan
- Review And QA Gates
- Plugin State Types
- Builtin Tool Types
- AbortSignal Types
- Audit And Refactor Skills
- Jev Script Tests
- Status Script Tests
- AI Workflow TSConfig
- Pomodoro TSConfig
- Pomodoro State Types
- URL Types
- MCP Tool Types
- Jev Script
- Cleanup Script Tests
- Check Script Tests
- Ring Sound Generator
- AbortController Types
- Engine Interface
- TextDecoder Types
- TextEncoder Types
- Eval Scaffold A
- Eval Scaffold B
- Small Cluster 40
- Small Cluster 41
- Small Cluster 42
- Small Cluster 43
- Small Cluster 44
- Small Cluster 45
- Small Cluster 46
- Small Cluster 47
- Small Cluster 48
- Small Cluster 49

## God Nodes (most connected - your core abstractions)
1. `register()` - 26 edges
2. `ai-workflow plugin` - 22 edges
3. `compilerOptions` - 14 edges
4. `pomodoroBand()` - 12 edges
5. `/orchestrator skill (lead)` - 12 edges
6. `Orchestrator skill` - 12 edges
7. `Team mode spec` - 11 edges
8. `tdd skill` - 11 edges
9. `Pomodoro timer mod spec` - 11 edges
10. `linear.sh script` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Flaw 2: nothing tests the merged result` --rationale_for--> `Final gate`  [INFERRED]
  docs/workflow-audit-2026-11-04.md → README.md
- `CI workflow` --references--> `ai-workflow plugin`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `Eval: orchestrator stops without acceptance criteria` --references--> `/orchestrator skill (lead)`  [INFERRED]
  plugins/ai-workflow/evals/orchestrator-stops-without-acceptance-criteria/case.yaml → README.md
- `Blind approvals in the pane` --references--> `Agent teams pane (hooks/register.tsx)`  [EXTRACTED]
  docs/workflow-audit-2026-11-04.md → README.md
- `Team mode spec` --references--> `TaskCompleted task gate`  [INFERRED]
  docs/specs/team-mode.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Orchestrator agent roster** — plugins_ai_workflow_agents_backend_engineer_backend_engineer, plugins_ai_workflow_agents_frontend_engineer_frontend_engineer, plugins_ai_workflow_agents_fullstack_engineer_fullstack_engineer, plugins_ai_workflow_agents_code_reviewer_code_reviewer, plugins_ai_workflow_agents_qa_tester_qa_tester, plugins_ai_workflow_agents_designer_designer, plugins_ai_workflow_agents_ticket_reviewer_ticket_reviewer, plugins_ai_workflow_agents_writer_writer [EXTRACTED 1.00]
- **Review and QA gate flow** — plugins_ai_workflow_agents_code_reviewer_code_reviewer, plugins_ai_workflow_agents_qa_tester_qa_tester, readme_verdict, readme_round, readme_final_gate, plugins_ai_workflow_agents_code_reviewer_severity_blocker_note [INFERRED 0.85]
- **Orchestrator-stops eval graders** — plugins_ai_workflow_evals_orchestrator_stops_without_acceptance_criteria_case_eval_case, plugins_ai_workflow_evals_orchestrator_stops_without_acceptance_criteria_graders_no_agents_grader, plugins_ai_workflow_evals_orchestrator_stops_without_acceptance_criteria_graders_orchestrator_fired_grader, plugins_ai_workflow_evals_orchestrator_stops_without_acceptance_criteria_graders_sends_to_workshop_grader [EXTRACTED 1.00]
- **Reviewer refailure eval: case, prompt, fixture and graders** — plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_case_case, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_prompt_eval_prompt, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_fixture_context_todo_app_run_context, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_fixture_task_intent_clear_save_errors, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_graders_names_the_bug_grader, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_graders_reviewer_dispatched_grader, plugins_ai_workflow_evals_reviewer_catches_cleared_error_refailure_graders_verdict_grader [EXTRACTED 1.00]
- **Skills used by the orchestrator pipeline** — plugins_ai_workflow_skills_orchestrator_skill_orchestrator, plugins_ai_workflow_skills_jev_skill_jev, plugins_ai_workflow_skills_linear_skill_linear, plugins_ai_workflow_skills_openapi_skill_openapi, plugins_ai_workflow_skills_cmux_skill_cmux, plugins_ai_workflow_skills_orchestrator_team_mode_team_mode [EXTRACTED 1.00]
- **Pomodoro spec split into T1-T4 intents** — plugins_pomodoro_docs_specs_pomodoro_timer_mod, plugins_pomodoro_intent_2026_11_01_pomodoro_timer_core, plugins_pomodoro_intent_2026_11_01_pomodoro_shared_daily_count, plugins_pomodoro_intent_2026_11_01_pomodoro_ring_sound, plugins_pomodoro_intent_2026_11_01_pomodoro_ring_setting [INFERRED 0.95]
- **TDD test quality principles** — plugins_ai_workflow_skills_tdd_skill_seam, plugins_ai_workflow_skills_tdd_tests_integration_style_tests, plugins_ai_workflow_skills_tdd_mocking_system_boundary_mocking, plugins_ai_workflow_skills_tdd_skill_tautological_test, plugins_ai_workflow_skills_tdd_skill_implementation_coupled_test [INFERRED 0.85]
- **Writing-for-agents load and disclosure model** — plugins_ai_workflow_skills_writing_for_agents_skill_context_pointer, plugins_ai_workflow_skills_writing_for_agents_skill_two_loads, plugins_ai_workflow_skills_writing_for_agents_skill_progressive_disclosure, plugins_ai_workflow_skills_writing_for_agents_skill_mechanics_model_invoked_skill, plugins_ai_workflow_skills_writing_for_agents_skill_mechanics_router_skill [INFERRED 0.85]

## Communities (50 total, 24 thin omitted)

### Community 0 - "Engine Plugin API Types"
Cohesion: 0.00
Nodes (641): AgentCallRecord, AgentInfo, AgentLoop, AgentOfferInput, AgentOfferResult, AgentSpawnArgs, AgentSpawnInput, AgentSpawnResult (+633 more)

### Community 1 - "Agent Teams Pane Hooks"
Cohesion: 0.06
Nodes (51): AGENT_ICON_SIZE, AGENT_ICONS, Icon, TEAM_ICON, TEAM_ICON_SIZE, agentIcon(), answerAsk(), answers (+43 more)

### Community 2 - "Pomodoro Timer Mod"
Cohesion: 0.16
Nodes (29): alert(), clock(), closePomodoro(), Config, countOne(), dayOf(), IDLE, isRunning() (+21 more)

### Community 3 - "Eval Fixtures Todo App"
Cohesion: 0.09
Nodes (26): Eval: orchestrator stops without acceptance criteria (prompt), Eval case: reviewer catches cleared-error refailure, AC12: disabled control while saving, inline save error, Todo API contract (/api/todos), Todo app run context (fixture), Intent T4: Clear save errors on any successful action, Grader: names the refailure bug, Grader: code-reviewer dispatched (+18 more)

### Community 4 - "Patch And TDD Skills"
Cohesion: 0.10
Nodes (27): Surgical Patch OpenAI agent config, surgical-patch skill, TDD OpenAI agent config, When to Mock (tdd/mocking.md), Dependency injection for mockability, SDK-style interfaces over generic fetchers, Mock only at system boundaries, tdd skill (+19 more)

### Community 5 - "Setup And Workshop Skills"
Cohesion: 0.13
Nodes (22): setup skill, Agent teams settings (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, CLAUDE_CODE_ENABLE_TODO_TOOLS), check.sh preflight script, Git permissions allowlist (commit, merge, push to feature/*), workshop skill, jev.sh spec-check, Scoping from an audit (TECH_DEBT_AUDIT.md), Spec template (Type, Tech stack, ACs, Scope) (+14 more)

### Community 6 - "Pane Tests"
Cohesion: 0.12
Nodes (12): now(), BAND, buildTask, PANE, pending(), settle(), BAND, boot() (+4 more)

### Community 7 - "CI Workflow"
Cohesion: 0.12
Nodes (15): CI workflow, CI mod tests (claude plugin test), CI marketplace and plugin validation, CI lint: no working-directory script paths, CI lint: per-spec run state paths, CI script tests (jev, linear, cleanup, status, check), CI type check (tsc 5.8.3), ai-workflow 1.4.0 workflow audit (+7 more)

### Community 8 - "Engine Types Config"
Cohesion: 0.12
Nodes (15): compilerOptions, jsx, jsxFactory, jsxFragmentFactory, lib, module, moduleResolution, noEmit (+7 more)

### Community 9 - "Linear Script"
Cohesion: 0.27
Nodes (14): ensure_label_id(), ensure_label_ids(), find_project_id(), find_state_id(), find_team_id(), find_viewer_id(), post(), linear.sh script (+6 more)

### Community 10 - "Setup Check Script"
Cohesion: 0.23
Nodes (7): chrome(), gh_auth(), have(), line(), need(), check.sh script, want()

### Community 11 - "Plugin Agents And Docs"
Cohesion: 0.21
Nodes (12): Ticket review STATUS (REPRODUCED / NOT REPRODUCED / BLOCKED / PARTIAL), ticket-reviewer agent, writer agent, ai-workflow plugin, engine-types/ committed engine types, Live state (state.md), Claude Code marketplace (marketplace.json), openapi skill (+4 more)

### Community 12 - "Bypass Mode Spec"
Cohesion: 0.22
Nodes (7): Bypass mode auto-allow spec, BYPASS pane header marker, Bypass session-log line, Agent teams pane (hooks/register.tsx), Auto mode permissions, Git allow rules (commit, merge, push feature/*), /ai-workflow:setup skill and check.sh preflight

### Community 13 - "Team Mode Spec"
Cohesion: 0.29
Nodes (5): Agent team shared task list, Team mode spec, One-hour teammate prompt cache, fullstack-engineer agent, /orchestrator skill (lead)

### Community 14 - "Engineer Agent Rules"
Cohesion: 0.29
Nodes (6): Engineers avoid Edit/Write (heredoc writes), backend-engineer agent, designer agent, Rendered design storyboard (storyboard.png), frontend-engineer agent, Bundled skills (tdd, surgical-patch, safe-refactor, writing-for-agents, handoff)

### Community 15 - "Plugin Evals"
Cohesion: 0.25
Nodes (9): Plugin evals (orchestrator-stops-without-acceptance-criteria, reviewer-catches-cleared-error-refailure), Examples README, Due-date reminders spec (example), Eval: orchestrator stops without acceptance criteria, Grader: no Agent tool calls, Grader: orchestrator skill fired, Grader: response mentions workshop, Acceptance criteria (AC) (+1 more)

### Community 17 - "Audit Fix Plan"
Cohesion: 0.25
Nodes (5): AC26 cost target ($7.60, <30 min), Agent baseline token breakdown (skill listing ~9k), ai-workflow 2.0.0 release, Audit fix plan (10 phases), Team mode test runs (simple-test-todo-4/5)

### Community 18 - "Review And QA Gates"
Cohesion: 0.36
Nodes (5): code-reviewer agent, Gate routes blockers directly to engineers via SendMessage, qa-tester agent, Review/QA round, Verdict (CLEAN / FINDINGS / BLOCKED)

### Community 19 - "Plugin State Types"
Cohesion: 0.29
Nodes (6): Ask, claude-code, Leader, LogLine, PluginState, Subagent

### Community 20 - "Builtin Tool Types"
Cohesion: 0.40
Nodes (4): RFC-3339, BuiltinToolInputs, BuiltinToolResults, claude-code

### Community 22 - "Audit And Refactor Skills"
Cohesion: 0.50
Nodes (4): Audit skill (Tech Debt Audit), TECH_DEBT_AUDIT.md deliverable, Safe Refactor OpenAI agent interface config, Safe refactor skill

### Community 23 - "Jev Script Tests"
Cohesion: 0.83
Nodes (3): assert_exit1(), check(), test_jev.sh script

### Community 24 - "Status Script Tests"
Cohesion: 0.83
Nodes (3): check(), run(), test_status.sh script

### Community 25 - "AI Workflow TSConfig"
Cohesion: 0.50
Nodes (3): extends, include, ../../engine-types/tsconfig.json

### Community 26 - "Pomodoro TSConfig"
Cohesion: 0.50
Nodes (3): extends, include, ../../engine-types/tsconfig.json

### Community 27 - "Pomodoro State Types"
Cohesion: 0.50
Nodes (3): claude-code, PluginState, Pomodoro

## Knowledge Gaps
- **50 isolated node(s):** `RFC-3339`, `STUB_LOG`, `../../engine-types/tsconfig.json`, `../../engine-types/tsconfig.json`, `derive` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 809 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `Pane Tests` to `Engine Plugin API Types`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `RFC-3339`, `STUB_LOG`, `../../engine-types/tsconfig.json` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Engine Plugin API Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0030816640986132513 - nodes in this community are weakly interconnected._
- **Why does `URLSearchParams` connect `URLSearchParams Types` to `Engine Plugin API Types`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `Agent Teams Pane Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.06359189378057302 - nodes in this community are weakly interconnected._
- **Why does `ai-workflow plugin` connect `Plugin Agents And Docs` to `CI Workflow`, `Bypass Mode Spec`, `Team Mode Spec`, `Engineer Agent Rules`, `Plugin Evals`, `Review And QA Gates`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Eval Fixtures Todo App` be split into smaller, more focused modules?**
  _Cohesion score 0.0896551724137931 - nodes in this community are weakly interconnected._