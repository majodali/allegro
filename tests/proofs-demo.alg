// Phase F1 — proof terms as first-class values.
//
// `verify P` is an anonymous one-shot proof; `theorem NAME: P` is a named,
// referenceable Proof binding. The discharge mechanism is partial
// evaluation: if the proposition folds to `true`, the proof is established.
// A false or non-dischargeable proposition halts compilation (a failed
// proof is unsound by construction — "build safety in").

// Anonymous one-shot checks.
verify 3 + 5 == 8
verify 2 * 21 == 42

// PE-as-discharge: the proposition contains a function call. PE evaluates
// `square(6)` to 36, then `36 > 0` to true — no runtime check survives.
square(x: Int): Int => x * x
verify square(6) > 0

// Named theorems are ordinary bindings. They can be referenced like any
// value (combinators that consume them arrive in F3).
theorem add_commutes_small: 2 + 3 == 3 + 2
theorem factorial_base: 1 == 1

// Runtime behaviour is unaffected by proofs.
print(square(6))                 // expect: 36
print(2 + 3)                     // expect: 5
