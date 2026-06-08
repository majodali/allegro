// Benchmark obligation t02 — refl-trivial.
//
// Category: refl-trivial. The proposition is an arithmetic identity.
// PE folds `2 + 2` to `4`, so the reflexive witness `proof_refl(2 + 2)`
// establishes exactly `4 == 4`, which value-matches the goal.
theorem goal: 2 + 2 == 4 by proof_refl(2 + 2)
