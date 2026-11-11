---
title: Clear save errors on any successful action
status: done
created-at: 2026-11-09
---

# Intent: Clear save errors on any successful action

Author: Ronaldo Gomes. Status: done

## Problem
The final gate (tmp/team/todo-app/final-qa-round-1.md, blocker 1) found that "Couldn't save, try again" does not clear on the next successful action, as the spec requires. Each mutation keeps its own error, so a failed delete stays shown after a successful toggle on the same or another row, and a failed add stays shown under the input after a successful toggle or delete. The user sees an error next to data that did save.

## Proposed outcome
Any successful add, toggle or delete clears every visible save error ("Couldn't save, try again"), under the input and under any row. The error still appears where it does now (under the input for add, under the row for toggle/delete), and the list still stays unchanged on failure. Validation messages keep their current behaviour (clear on next keystroke). Covers AC12 (message clears on next success). Vitest tests for: failed delete then successful toggle on the same row; failed delete on row A then successful toggle on row B; failed add then successful toggle or delete.

Also fix the completed strike line to match the design (final-qa-round-1.md note 2): lime, and only across the title text, not the full row width.

## Affected users and systems
End users of the todo screen. web/src/TodoRow.tsx, web/src/AddForm.tsx, possibly web/src/TodosPage.tsx, web/src/styles.css, web/src/TodosPage.test.tsx.

## Constraints
Same API contract and design doc as T2/T3. No optimistic updates. Depends on: T3 (merged).

## Out of scope
Server code. The add-after-failed-load behaviour and the 500 logging noted in final-review-round-1.md.

## Open questions
None
