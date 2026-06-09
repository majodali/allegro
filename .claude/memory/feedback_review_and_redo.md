---
name: feedback-corpus-driven-review-and-redo
description: Every feature/syntax element will be reviewed once we have a corpus of real-world examples; possibly redefined from scratch
type: feedback
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
For every feature and every syntax element: once we have a corpus of real-world examples, we will review it and possibly **redefine from scratch**. This is an expected step, not a contingency.

**Why:** The corpus reveals what actually works in real use, which is rarely what we predicted at design time. Investing too heavily in v1 commitments locks us into shapes we'll later regret. The user explicitly: "we're going to do that with every feature and syntax element."

**How to apply:**
- Don't over-invest in v1 syntax/semantics commitments. Aim for "good enough to use and learn from", not "final form".
- When the user defers a bikeshed ("effect files {...}" vs value bindings, etc.), respect it — the redo will resolve those questions with evidence.
- When designing new features, build escape hatches and clear deprecation paths so a redo doesn't break dependent code catastrophically.
- Treat surface syntax especially as provisional. Semantics are stickier (changes propagate further), but they're also subject to revision once the corpus shows what's actually needed.
- Resist the urge to ship the "perfect" version. Ship the version that lets us learn the most.
