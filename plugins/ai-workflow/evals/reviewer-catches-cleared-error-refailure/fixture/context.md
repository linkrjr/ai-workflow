# Run context: docs/specs/todo-app.md

- Spec: docs/specs/todo-app.md
- Base branch: feature/todo-app
- Default branch: main — never merged into by this run
- Spec type: FEATURE
- Tech stack: Bun + TypeScript; backend Express + SQLite (bun:sqlite); frontend React + Vite + TanStack Router + TanStack Query; tests Vitest
- Backend project: server
- Task tracker: intent

## Acceptance criteria
- AC1: Typing a title and submitting (Enter or Add button) adds the todo at the top of the list, not completed, and clears the input.
- AC2: Submitting an empty or whitespace-only title adds nothing and shows a validation message; the API rejects it with a 400.
- AC3: A title over 200 characters (after trimming) is rejected by both the UI and the API (400). Exactly 200 is accepted.
- AC4: Leading and trailing whitespace is trimmed from the saved title.
- AC5: Clicking a todo's checkbox toggles it between completed and not completed; completed todos show struck through; its position in the list does not change.
- AC6: Clicking a todo's delete button removes it immediately, with no confirmation.
- AC7: Todos are listed newest first.
- AC8: After reloading the page or restarting the server, the list shows the same todos with the same completed state.
- AC9: With no todos, the list area shows "No todos yet".
- AC10: While the list is loading, a loading indicator is shown instead of the list.
- AC11: If loading the list fails, an error message with a Retry button is shown; Retry loads the list again.
- AC12: While an add, toggle or delete is saving, its control is disabled; if the save fails, the list stays as it was and an inline error message is shown.
- AC13: Toggling or deleting a todo that no longer exists returns 404 from the API.

## Scope
- In scope: one screen at `/` (see spec "Detailed behaviour"), the API below, SQLite storage, tests for API and UI behaviour.
- Files: `server/` (backend, T1), `web/` (frontend, T2/T3). Nothing at the repo root except what already exists.
- Out of scope: login/accounts, editing titles, filters, reordering, due dates, priorities, pagination, undo, deployment.

## Decisions already made
- Two independent Bun projects, no root workspace: `server/` and `web/`, each with its own package.json and bun.lock, so backend and frontend tasks never touch the same file.
- Server: Express on Bun, listens on `PORT` (default 3000); SQLite file path from `DB_PATH` (default `server/data/todos.sqlite`, gitignored, directory created if missing). Start with `bun run start` (and `bun run dev`) in `server/`.
- bun:sqlite only exists in the Bun runtime: server tests run under Bun (`bun --bun vitest run`, wired as `bun run test`).
- Web: Vite dev server (default 5173) proxies `/api` to `http://localhost:3000`. `bun run dev`, `bun run build`, `bun run test` in `web/`.
- Order newest first by createdAt, ties broken by id descending (several todos can share a millisecond).
- Spec details to honour: Enter submits; input keeps its text if the save fails; validation messages show under the input before any request; save error message e.g. "Couldn't save, try again", cleared on next successful action; load error "Couldn't load todos" + Retry; empty "No todos yet"; placeholder "What needs doing?".

## API contract
Base path `/api`. JSON in and out.

Todo shape:
```json
{ "id": 1, "title": "Buy milk", "completed": false, "createdAt": "2026-11-09T12:00:00.000Z" }
```

- `GET /api/todos` → 200, array of todos, newest first.
- `POST /api/todos` body `{ "title": string }` → 201, the created todo. 400 if title is missing, empty after trim, or over 200 chars.
- `PATCH /api/todos/:id` body `{ "completed": boolean }` → 200, the updated todo. 400 if `completed` is not a boolean. 404 if no such todo.
- `DELETE /api/todos/:id` → 204. 404 if no such todo.

Error shape (all 4xx/5xx):
```json
{ "error": "Title must be 1-200 characters" }
```
- Design: yes
- Design doc: /Users/ronaldogomes/Projects/repos/tests/simple-test/tmp/team/todo-app/design.md (storyboard: tmp/team/todo-app/design/storyboard.png)
