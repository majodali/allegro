---
name: Dual brace and offside-rule syntax modes
description: User wants Allegro to support both braces and offside-rule modes like Scala/F#
type: project
---

User wants Allegro to eventually support both brace-delimited and offside-rule (indentation) syntax modes, similar to Scala 3 and F#.

**Why:** Flexibility — different contexts and preferences benefit from different delimiters. Fits the "alternate syntaxes" philosophy of the language platform.

**How to apply:** Keep this in mind when designing new syntactic constructs — they should work in both modes. Don't hardcode assumptions about indentation-only parsing.
