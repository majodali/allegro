// Benchmark obligation t10 — universal quantification over Bool.
//
// Category: type-bound. `prove_for_all_bool` enumerates the two-value
// domain to establish `∀b: Bool, neg(neg(b)) == b` (the involution
// law). Like t09, the proposition is Proof-valued and auto-PE
// discharges it directly — no `by` slot, no prover. This row measures
// the kernel's free finite-domain quantification.
neg(b: Bool): Bool => if b then false else true
theorem goal: prove_for_all_bool(b => neg(neg(b)) == b)
