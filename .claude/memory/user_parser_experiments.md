---
name: user-parser-experiment-and-codegen-scheduling
description: User has a homegrown LL(k)+Pratt parser experiment outside the repo (deferred); codegen IS scheduled as Phase I of the provability arc
type: reference
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
## Parser experiment (outside this repo)

The user has an experimental parsing algorithm: an LL(k) extension that restructures left-recursive subgrammars into Pratt-style precedence handlers without modifying the source grammar, using a graph-based universal parser machine formalism. Doesn't support ambiguous grammars. Code lives outside this repo.

**Status: deferred until Allegro is done.** After the memo-bucketing fix gave 42–50× speedup and restored ~linear scaling on the current grammar2 engine, the user said: "I'm not convinced my parsing algorithm will improve anything — since we're already at approximately linear scaling. Let's wait till Allegro is done and take a look then."

**How to apply:** Don't propose pulling the parser into the repo. The current grammar2 engine (Warth-style left recursion + memo-bucketed scannerless parser) is the foundation until Allegro feature work is done. Performance work happens via PE optimizations and instrumentation first.

## Codegen scheduling (NOT indefinitely deferred)

Codegen is **Phase I of the provability arc** — scheduled, not on-hold. It comes after D2–H complete (parametric capabilities, info flow, budgets, totality, proof terms, provable stdlib, AI collaboration protocol). User's framing: codegen "should happen right after we've worked through all the phases to deliver provability."

**Why scheduled rather than rushed:** the user wants codegen to be informed by invariants and effects so it can be aggressive but safe. Doing it before the safety/correctness machinery is mature would forfeit that benefit.

**How to apply:** Don't propose starting codegen now. When provability arc nears completion, codegen becomes the natural next milestone. The "I'd like to hold off on Phase 9 until we really deeply understand the performance issues" quote applies to *premature* codegen, not the scheduled Phase I.
