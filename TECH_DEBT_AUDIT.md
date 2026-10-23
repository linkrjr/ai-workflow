# Tech Debt Audit — ai-workflow

**Generated:** 2026-10-22
**Base commit:** 88803e5
**Repo type:** Claude Code plugin (prompt-based, no runtime code)

---

## Executive Summary

- No material findings. Every prior finding was fixed and re-verified against the current tree; this pass found nothing new.
- This is a ~1,000-line prompt repo with no application code; the 30–80 finding range in the standard audit template doesn't apply here — padding to hit it would violate the "don't pad" rule.

---

## Architectural Mental Model

This repo packages an AI engineering team orchestration plugin for Claude Code: no runtime application code, only declarative prompts. It defines **six agents** (`ticket-reviewer`, `designer`, `backend-engineer`, `frontend-engineer`, `code-reviewer`, `writer`) and **three skills** (`/workshop`, `/orchestrator`, `/audit`).

The architecture is a **lead agent + worker pool model**: `orchestrator` orchestrates, spawning specialist agents per phase and collecting output into shared state files (`handoff.md`, `design.md`, `ticket-review.md`, `review-round-N.md`). A pre-flight gate runs first for BUG/TICKET specs: `ticket-reviewer` must confirm a reproduction before `designer` or either engineer is allowed to start, and the gate's own failure-reporting path carries its own inline format rather than borrowing another section's.

README is in lockstep with the code — no contradictions found.

---

## Findings

Nothing material.

---

## Top 5 "If You Fix Nothing Else"

Nothing to fix.

---

## Quick Wins

Nothing material.

---

## Things That Look Bad But Are Actually Fine

- **`ticket-reviewer.md` has `Write` in its tools; `code-reviewer.md` doesn't.** Looks like an inconsistency between two review-flavored agents, but it's deliberate: `ticket-reviewer` genuinely needs `Write` for throwaway repro scripts (its own text says so), while `code-reviewer` only ever produces one report file and can do that via `Bash` heredoc/redirection — it's kept off `Write`/`Edit` specifically so it can never touch product code. Different jobs, correctly different tool grants.
- **Agent prompt files are 24–115 lines, `designer.md` the longest:** small, but correct — these are role descriptions and constraints, not implementations. `designer.md` runs longer because visual-design judgment needs more worked examples (good/bad, a full output format) than a backend/review role does.
- **No version field in agent/skill frontmatter:** versioning lives at the `plugin.json` level only. Correct for this architecture.
- **`orchestrator` is Opus, `code-reviewer` is Sonnet with `effort: xhigh`:** looks like cost misalignment, but it's intentional — orchestration needs fast decisions, review needs deep reasoning.
- **`orchestrator`/`workshop` skills have no `tools:` frontmatter field, unlike every agent file:** not an oversight — a skill runs as the invoking session itself, not a spawned subagent, so it inherits the full parent session's tools rather than a scoped allowlist. Documented explicitly in `README.md` Recipe D, contrasted against Recipe A's agent frontmatter.

---

## Open Questions for the Maintainer

None open.

---

## Summary

Clean. Nothing to fix, nothing open.
