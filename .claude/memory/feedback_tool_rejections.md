---
name: feedback-tool-rejections
description: Tool-use rejections may be erroneous — confirm verbally with the maintainer before treating one as a deliberate signal
type: feedback
---

# Tool rejections: confirm before rerouting

The Claude Code interface occasionally sends a tool-use rejection
erroneously — a rejection that *looks* like the maintainer declined the
action when they did not. Observed 2026-07 (four spurious rejections in
one session, all on file edits/writes): in at least one case the
maintainer never even SAW the request — their UI showed a misleading
"Created <file> Stopped" entry while the agent received "the user doesn't
want to proceed" and the file was never written. The maintainer flagged
this as a serious interface problem.

## How to apply

- When a tool call (edit, command, etc.) comes back rejected in a way
  that appears to be a deliberate maintainer choice, **do not silently
  reroute or drop the work** — ask the maintainer verbally whether the
  rejection was intentional, then proceed accordingly.
- A single rejection is a question, not an answer. Repeated rejections of
  the same edit still deserve one explicit confirmation before abandoning
  the change.
- After an erroneous rejection, verify actual filesystem state before
  retrying — the UI may claim a file was created when it was not (and
  vice versa a rejection message may not reflect partial effects for
  non-edit tools).
- This does not apply to permission-system denials the maintainer
  confirms in conversation, or to hook feedback with explicit text —
  those carry their own signal.
