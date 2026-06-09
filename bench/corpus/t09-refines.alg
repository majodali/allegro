// Benchmark obligation t09 — refinement-domain entailment.
//
// Category: type-bound. The proposition is itself a Proof-valued
// expression: `proof_refines(5, PositiveInt)` discharges through the
// abstract-domain lattice (5's domain `== 5` entails `≥ 1`). There is
// no `by` slot — auto-PE discharges it directly, with no prover. This
// row measures the kernel's free type-bound reasoning.
PositiveInt = Int & _ > 0
theorem goal: proof_refines(5, PositiveInt)
