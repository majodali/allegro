---
name: feedback-test-modification-rules
description: Add test conditions freely; never remove or change existing conditions without discussing — even obvious changes may signal a misunderstanding
type: feedback
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Note: this is about modifying TEST conditions, not Allegro's value immutability (linear types / transient mutation). Don't conflate.

## The rule

- **Add new conditions to a test freely.** Strengthening coverage is fine.
- **Never remove or change an existing condition without discussing first.** This includes assertions, expected outputs, `// expect:` comments, and structural test setup. If you genuinely believe a test was wrong, propose the change in plain text and wait.

## Why

User: "Even obvious changes may signal a previous misunderstanding we can learn from." A test was written for a reason. If it now fails, that's a signal — possibly a real bug, possibly an outdated assumption, possibly a previous misunderstanding worth surfacing. Silently "fixing" the test discards the signal.

Related stance: don't accept "known issues" unless they're truly known, isolated, and have a planned remediation. The instinct is to fix root causes rather than work around them.

## How to apply

- When a test fails after a change, investigate root cause first. Don't reach for the test file.
- If the test really was wrong, surface the proposed change ("this test asserts X but the new behavior should be Y because…") and wait for confirmation.
- Adding new assertions / new test cases / new files is fine without discussion.
- This applies to `// expect:` comments in `.alg` files too — those are test conditions in disguise.
