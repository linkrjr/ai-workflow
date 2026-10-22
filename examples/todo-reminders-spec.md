# Due-date reminders for tasks

Type: FEATURE

## Problem
Users miss deadlines because nothing surfaces a task as it approaches its due date — they only see it if they happen to open the list.

## User stories
- As a task owner, I can see which of my tasks are due today or overdue so that I can act on them without hunting through the full list.

## Acceptance criteria
- AC1: A task with a due date of today or earlier shows a "due" badge in the task list.
- AC2: A task with no due date shows no badge.
- AC3: Badges update without a page reload when a task's due date changes.

## Detailed behaviour
- Empty state: task list with no tasks shows the existing "no tasks yet" message, unchanged.
- Loading state: badges are not shown until task data has loaded; no flash of an unbadged task.
- Error state: if due dates fail to load, tasks render without badges rather than blocking the list.

## Access and permissions
Any user who can see a task can see its due badge — no new permission tier.

## Business rules
- "Due" means `due_date <= today` in the user's local timezone.
- A task marked complete never shows a due badge, regardless of due date.

## Scope
- In scope: badge rendering in the existing task list component, due-date comparison logic.
- Out of scope: due-date reminder emails or push notifications.
- Must stay unchanged: task creation and editing flows.
