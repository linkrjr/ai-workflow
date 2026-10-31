---
name: jev
description: Advisory risk signals from TypeSafe's Jev model for the ai-workflow pipeline — PR triage before code review, a stall check on repeating review rounds, and a spec clarity check after /workshop. Used by /workshop and /orchestrator; never decides a gate. Needs TYPESAFE_API_KEY, and does nothing without it.
---

Calls TypeSafe's Jev model (`POST https://api.typesafe.ai/v1/systemone`) through
`scripts/jev.sh`, which reads `TYPESAFE_API_KEY` from the environment. Never print
or echo the key. Jev is in early access; get a key at console.typesafe.ai/keys.

Jev returns a 0–1 truth value for each yes/no statement about the text it is given.
It cannot run the project, read the rest of the repo or write code, so its signals
are **advisory**: they point attention, they never replace `code-reviewer`,
`qa-tester` or the user's decision. Calibrate before trusting them: run the script on
diffs and specs whose quality you already know.

## Commands

All three print `JEV <command>: OK` followed by one `<signal>: <value> FLAG|ok` line
per signal and a `JEV VERDICT:` line. A value at or above `JEV_FLAG_AT` (default
`0.6`) is a `FLAG`.

- `scripts/jev.sh triage < pr.diff` — signals `security_surface`, `contract_change`,
  `untested_logic`, `mixed_concerns`. Verdict `ATTENTION (n)` or `NO SIGNALS`.
- `scripts/jev.sh loop-guard <PREV_FILE> <CURRENT_FILE>` — signals `repeated_findings`,
  `oscillating`, comparing two rounds' review or QA findings. Verdict `STALLED` or
  `PROGRESSING`.
- `scripts/jev.sh spec-check < spec.md` — signals `untestable_criteria`,
  `missing_states`, `implementation_detail`, `ambiguous_wording`. Verdict
  `ATTENTION (n)` or `NO SIGNALS`.

## Never blocks

If `TYPESAFE_API_KEY` is unset, the input is empty, the request fails, or the answer
has an unexpected shape, the script prints `JEV <command>: UNAVAILABLE (<reason>)`
and exits 0. Treat that as "no signal": carry on exactly as if Jev were not part of
the pipeline, and say once, in one line, that Jev was unavailable and why. Only a
usage error exits non-zero.

Other environment: `JEV_MODEL` (default `jev-latest`), `JEV_API_URL`,
`JEV_MAX_STATE_BYTES` (default 400000; longer input is truncated).

`scripts/test_jev.sh` checks argument validation, the fallbacks and response parsing
against a stubbed `curl`; it makes no network calls.
