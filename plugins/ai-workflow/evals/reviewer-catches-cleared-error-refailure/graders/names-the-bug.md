---
type: llm
focus: { source: file, path: review.md }
weight: 2
---

PASS if the review lists as a blocker that a control's error can stay hidden when it fails again after an earlier failure of the same control was cleared by another successful action (the remembered "seen" value is not reset for the new attempt).
FAIL if no blocker describes that sequence, even if other issues are listed.
