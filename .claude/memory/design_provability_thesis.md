---
name: provability-and-safety-thesis
description: Provability + safety as Allegro's defining feature; PE-as-discharge with AI-generated [impl, proof] pairs as the primary proof strategy, SMT as use-case-driven fallback
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Allegro's defining feature is **provable correctness + safety** — formally a conjunction of two predicate families over function behavior, poetically the yin/yang of what code should and shouldn't do. The astronomical reading of "conjunction" works as a frame too.

## The two halves

- **Correctness** (positive): code does what it should — refinement types, predicate sets, contracts, invariants
- **Safety** (negative, formally): code does NOT do what it shouldn't — effects, capabilities, info flow, behavioral budgets (Phase D arc)

Use **safety** as the user-facing term. "Negative" is formal-only.

Many properties have a foot in both streams (termination, determinism, resource bounds). Positive/negative is a perspective on a property, not a strict partition of properties.

## Why both, why now

A year ago "safety" meant OWASP + dependency review — a checklist over known-bad patterns. AI code generation breaks that model: you can't read every line for "did it do something I didn't ask for", but you CAN check that a function didn't escape its declared capability set. Safety machinery goes from niche-academic to practically necessary precisely because read-the-diff review doesn't scale to AI velocity. For engineers and stakeholders, the balance now feels real in a way it didn't before.

This is also the website framing: lead with provability + safety together, motivated by AI velocity.

## The unifying machinery — types as predicates

Every provability feature is a predicate over a different surface of "what the function does":

- refinement types → predicate over a value
- contracts → predicate over input/output relations
- invariants → predicate over an instance's lifecycle
- effects → predicate over what's invoked
- capabilities → predicate over what resources are reachable
- info flow → predicate over what data influences what output

All discharged by the SAME machinery: predicate sets + abstract domains + entailment + PE reduction.

**Falsifiable design constraint:** if a new safety/correctness feature ends up needing parallel infrastructure rather than reusing predicate-set entailment, the thesis has failed in implementation. Phase D's effect propagation should feel structurally identical to Phase B's domain propagation.

## The proof strategy — three legs

1. **PE-as-discharge (primary):** predicates are Allegro lambdas; PE reduces them against residuals; if a predicate reduces to `true` the constraint is discharged. The interpreter and the proof checker are the same artifact because predicates are first-class Allegro values. Existing camps (Liquid Haskell, F\*, Dafny, KLEE) each pick a different discharge mechanism (SMT, structural type checking, symbolic execution); using *evaluation itself* as the discharge mechanism is what's underexplored — and what Allegro's evaluator was designed for from the start.

2. **AI-generated [implementation, proof] pairs (primary):** instead of "write code, derive proofs later" (SMT model), AI agents produce implementation and proof TOGETHER. This is the bet. Not guaranteed to suffice — but the planned default. Goal: build a library of abstract, reusable [impl, proof] pairs that compose. AI is the search muscle for these pairs.

3. **SMT (selective fallback):** explored where PE isn't strong enough (arithmetic-heavy obligations, theory combination) and where AI-generated proofs aren't economical. Use-case-driven, not foundational. Can combine with the other two — e.g., AI generates a proof skeleton that delegates a Presburger obligation to SMT.

## Build vs derive

Compile-time-first: specs are discharged during partial evaluation; the executable carries only residuals (with optional warnings when configured). Runtime checks are the fallback, not the spec. The proof obligation isn't "every runtime trace satisfies P" — it's "this expression, partially evaluated, reduces to one whose result satisfies P." Futamura territory pointed at verification rather than specialization: same machinery proves correctness and compiles the code in one pass.

"Build safety IN" — don't bolt proofs onto arbitrary code, design code to be inherently provable. Failed asserts halt visibly, not silently produce error values. Performance hits from safety analysis are solved with better proofs/algorithms, not by relaxing safety.

## How to apply

- When designing new features, lead with provability/safety. Don't bury it.
- When new safety/correctness features land (Phase B–J), extend the SHARED predicate-set / abstract-domain / entailment machinery — never a parallel system. If you find yourself building parallel infra, surface that as a thesis-level concern.
- When reasoning about whether something is provable: PE-style reduction first; AI-generated [impl, proof] second; SMT only when use-case-justified.
- When framing on website/docs: lead with the AI-velocity argument. "Provable correctness AND safety" — both halves, together.
- "Allegro Vivace" tier inherits all of this transparently — formal-methods machinery is for power users and library authors, not surface syntax developers must learn.
