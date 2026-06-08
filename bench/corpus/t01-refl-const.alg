// Benchmark obligation t01 — refl-trivial.
//
// Category: refl-trivial. The goal is a syntactic identity; the only
// correct proof term is reflexivity. Auto-PE discharges the bare
// proposition (7 == 7 folds to true); the soundness-gated `by` form
// rejects any term that proves a different fact.
theorem goal: 7 == 7 by proof_refl(7)
