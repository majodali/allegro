---
name: feedback-update-claude-md
description: Always update CLAUDE.md before every commit to keep it current
type: feedback
---

Update CLAUDE.md before every commit, not after. The user explicitly requested this.

**Why:** CLAUDE.md is the primary reference for the project state. If it falls behind, future conversations start with stale context, leading to incorrect assumptions and wasted effort.

**How to apply:** Before running `git commit`, check if any of these changed: file descriptions, test counts, syntax examples, architecture descriptions, "What's Next" items. Update CLAUDE.md as part of the same commit.
