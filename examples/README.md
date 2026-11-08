# Examples

Sample output from a `/workshop` run, so you can see what the pipeline produces without running it yourself first.

- [`todo-reminders-spec.md`](./todo-reminders-spec.md) — a spec written by `/workshop` using the template in `plugins/ai-workflow/skills/workshop/SKILL.md`. This is the input `/orchestrator` expects (`/orchestrator docs/specs/<slug>.md`).

`/orchestrator`'s own outputs (`tmp/team/<spec slug>/context.md`, `state.md`, `design.md`, and the `review-pr-<n>-round-<N>.md` and `qa-pr-<n>-round-<N>.md` reports) are per-run scratch state, gitignored by design (see "Known Gotchas" in the README) — they aren't checked into the repo, so there's no sample to show here beyond the shapes already documented in the README's Domain Vocabulary section.
