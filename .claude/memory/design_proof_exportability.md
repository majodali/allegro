---
name: proof-exportability-as-design-goal
description: Allegro proofs should be exportable to external checkers (Lean / Coq / similar); pairs with transitive assurance through dependencies
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
**Proofs should be portable, not internal artifacts.**

Most provability systems treat proofs as system-internal — F\*'s proofs live in F\*, Dafny's in Dafny. Allegro's design goal is the opposite: a proof generated for an Allegro module should be **exportable to external checkers** (Lean, Coq, or similar) so a downstream auditor can re-check without trusting Allegro's checker.

This pairs structurally with **transitive assurance through dependencies**: when I import a library, I import its proofs, and I (or a third party) can re-check those proofs in my own kernel of choice. That's a stronger trust model than most systems offer — auditors don't have to trust Allegro, only the kernel they choose.

**Why:** Allegro's safety story rests on dependency-level provability scaling beyond what code review can reach. If proofs are only checkable inside Allegro, the trust chain ends at Allegro's checker — meaningful, but smaller. Exportable proofs make Allegro's assurance *additive* to existing formal-methods infrastructure, not a competing silo.

**How to apply:**
- The real engineering challenge is not "can we export proof terms" — it's "which base implementation components ship alongside the proof so it's concrete enough to check externally." Plan for shipping a verified-substrate library (axiomatized in the target checker) alongside the proof.
- When designing predicate / contract / effect machinery, prefer shapes that translate cleanly to standard proof-assistant primitives (typed lambda calculus, dependent types). Avoid baking in evaluation-only constructs that can't be reified outside Allegro.
- This is a long-term design goal, not a v1 deliverable. Surface it when foundational choices (predicate representation, proof-term shape) are being made — those are where the cost of *not* designing for exportability accumulates.
