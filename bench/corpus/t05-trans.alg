// Benchmark obligation t05 — transitivity.
//
// Category: combinator (trans). Two named equality proofs share the
// middle term `4`; `proof_trans(ab, bc)` composes them into the goal
// `2 + 2 == 8 / 2`. The prover must select and order the two lemmas.
theorem ab: 2 + 2 == 4
theorem bc: 4 == 8 / 2
theorem goal: 2 + 2 == 8 / 2 by proof_trans(ab, bc)
