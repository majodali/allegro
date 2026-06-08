// Benchmark obligation t07 — congruence.
//
// Category: combinator (cong). `proof_cong(triple, t3)` lifts the
// equality `3 == 1 + 2` through the function `triple`, yielding
// `triple(3) == triple(1 + 2)`. The prover must recognise that the
// goal is a function applied to both sides of an in-scope equality.
triple(x: Int): Int => x * 3
theorem t3: 3 == 1 + 2
theorem goal: triple(3) == triple(1 + 2) by proof_cong(triple, t3)
