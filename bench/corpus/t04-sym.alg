// Benchmark obligation t04 — symmetry.
//
// Category: combinator (sym). `ab` is discharged by evaluation and
// carries its two sides, so `proof_sym(ab)` flips it into the goal
// `4 == 3 + 1`. The available lemma `ab` is the citation the prover
// must find.
theorem ab: 3 + 1 == 4
theorem goal: 4 == 3 + 1 by proof_sym(ab)
