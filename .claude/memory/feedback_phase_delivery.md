---
name: feedback-implementation-phase-delivery
description: Stay close on current work; for upcoming work write a plan and let the user decide on chunks
type: feedback
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Note: "phase" here refers to Claude's IMPLEMENTATION work cadence (Phase A / B / C of the provability arc, etc.), NOT Allegro's build phases (invocation → config → compile → emit → package → deploy → execute). Don't conflate.

## Two modes

1. **Current work — stay close.** When the user is mid-task with Claude, deliver in tight increments and check in. Don't run ahead by chaining multiple steps without confirmation. Summarize and wait.

2. **Upcoming work — plan first, chunks second.** For larger features (new phases, big refactors, ambitious changes), write a plan doc in `.claude/plans/` and let the user decide on chunk boundaries. The user explicitly: "For upcoming work, write a plan and we'll decide on chunks."

## Why

The user wants to absorb each delta and validate direction before more code lands. Discussion is part of the work, not overhead. They've explicitly said "Let's discuss before finalizing the Phase C spec" in the past — discussion enables the formal-methods architecture work to converge. Chained-without-confirmation deliveries lose this signal.

## How to apply

- For current/live work: deliver an increment, summarize what changed, stop. If the user says "great work" without "next" or "go ahead", they likely want to discuss before continuing.
- For new larger features: write the plan doc first. Don't start chunk 1 without an explicit go-ahead. Plan docs use evocative names per `feedback_naming_conventions.md`.
- After each chunk in a planned feature: summarize, stop, wait for "go ahead with chunk N+1" or "next phase".
- Recent precedents (commit log): `crystal-proving-curry.md`, `lucid-discharging-lambek.md`.
